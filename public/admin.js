// SEPARATE ADMIN PANEL SCRIPT - DEVICE IP & MAC MONITOR
document.addEventListener('DOMContentLoaded', () => {

  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const adminDashboard = document.getElementById('adminDashboard');
  const logoutBtn = document.getElementById('logoutBtn');

  let adminToken = localStorage.getItem('chronicle_admin_token') || null;
  let deviceList = [];

  // Check login state
  if (adminToken) {
    showDashboard();
  }

  // --- LOGIN HANDLER ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('adminUsername').value.trim();
    const p = document.getElementById('adminPassword').value.trim();

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });
      const data = await res.json();

      if (data.success) {
        adminToken = data.token;
        localStorage.setItem('chronicle_admin_token', adminToken);
        showToast("Authentication Successful! Welcome Admin", "success");
        showDashboard();
      } else {
        showToast(data.error || "Authentication Failed", "danger");
      }
    } catch (err) {
      showToast("Server connection error during login", "danger");
    }
  });

  logoutBtn.addEventListener('click', () => {
    adminToken = null;
    localStorage.removeItem('chronicle_admin_token');
    adminDashboard.style.display = 'none';
    loginModal.style.display = 'flex';
  });

  function showDashboard() {
    loginModal.style.display = 'none';
    adminDashboard.style.display = 'flex';
    fetchAdminDevices();
    initSseStream();
  }

  // --- FETCH CONNECTED DEVICES WITH IP & MAC ---
  async function fetchAdminDevices() {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/devices', {
        headers: { 'X-Admin-Token': adminToken }
      });

      if (res.status === 401) {
        logoutBtn.click();
        return;
      }

      const data = await res.json();
      deviceList = data.devices;

      document.getElementById('serverMacDisplay').textContent = `Server MAC: ${data.serverMac}`;
      document.getElementById('statTotalDev').textContent = data.totalDevices;
      document.getElementById('statActiveDev').textContent = data.activeOnline;
      
      // Count unique MACs
      const uniqueMacs = new Set(data.devices.map(d => d.mac)).size;
      document.getElementById('statUniqueMac').textContent = uniqueMacs;
      document.getElementById('statBlockedCount').textContent = data.blockedCount;

      renderDevicesTable(deviceList);
      renderBlockedList(data.blockedIPs);

    } catch (e) {
      console.warn("Failed to fetch admin devices:", e);
    }
  }

  // --- RENDER DEVICES MATRIX TABLE ---
  function renderDevicesTable(devices) {
    const tbody = document.querySelector('#devicesTable tbody');
    const filter = document.getElementById('deviceSearch').value.toLowerCase();

    const filtered = devices.filter(d => 
      d.ip.toLowerCase().includes(filter) || 
      d.mac.toLowerCase().includes(filter) ||
      d.os.toLowerCase().includes(filter) ||
      d.browser.toLowerCase().includes(filter)
    );

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--text-muted);">No connected devices found matching query.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(dev => `
      <tr>
        <td>
          <span class="badge-status ${dev.isBlocked ? 'badge-blocked' : dev.status === 'ONLINE' ? 'badge-online' : 'badge-idle'}">
            ${dev.isBlocked ? '🔴 BLOCKED' : dev.status === 'ONLINE' ? '🟢 ONLINE' : '🟡 IDLE'}
          </span>
        </td>
        <td><span class="ip-badge">${dev.ip}</span></td>
        <td><span class="mac-badge">${dev.mac}</span></td>
        <td style="font-weight:600;">${dev.os}</td>
        <td style="color:var(--text-muted);">${dev.browser}</td>
        <td><code style="color:var(--cyan); font-family:var(--font-mono);">${dev.currentPage}</code></td>
        <td style="font-family:var(--font-mono); font-weight:700;">${dev.requestCount}</td>
        <td style="font-family:var(--font-mono); font-size:0.78rem; color:var(--text-muted);">${dev.lastActive}</td>
        <td>
          <div style="display:flex; gap:0.4rem;">
            ${dev.isBlocked 
              ? `<button class="btn-success-sm" onclick="toggleBlockIp('${dev.ip}', 'unblock')">🟢 Unblock</button>`
              : `<button class="btn-danger-sm" onclick="toggleBlockIp('${dev.ip}', 'block')">⚡ Block IP</button>`
            }
            <button class="btn-admin-sm" onclick="kickDeviceSession('${dev.id}')">🗑️ Kick</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('deviceSearch').addEventListener('input', () => {
    renderDevicesTable(deviceList);
  });

  document.getElementById('refreshDevicesBtn').addEventListener('click', () => {
    fetchAdminDevices();
    showToast("Device matrix refreshed");
  });

  // --- RENDER BLACKLISTED IPS ---
  function renderBlockedList(blockedList) {
    const container = document.getElementById('blockedIpList');
    if (!blockedList || blockedList.length === 0) {
      container.innerHTML = `<div style="font-size:0.8rem; color:var(--text-dim);">No IP addresses are currently blacklisted.</div>`;
      return;
    }

    container.innerHTML = blockedList.map(ip => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(244,63,94,0.1); padding:0.6rem 0.8rem; border-radius:var(--radius-sm); border:1px solid rgba(244,63,94,0.2);">
        <span style="font-family:var(--font-mono); font-weight:700; color:var(--rose); font-size:0.85rem;">🚫 ${ip}</span>
        <button class="btn-success-sm" onclick="toggleBlockIp('${ip}', 'unblock')">Unblock</button>
      </div>
    `).join('');
  }

  // --- ACTIONS: BLOCK & UNBLOCK IP ---
  window.toggleBlockIp = async (ip, action) => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/block-ip', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        },
        body: JSON.stringify({ ip, action })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, action === 'block' ? 'danger' : 'success');
        fetchAdminDevices();
      }
    } catch (e) {
      showToast("Error toggling IP block", "danger");
    }
  };

  // --- ACTION: KICK DEVICE ---
  window.kickDeviceSession = async (id) => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/kick-device', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        showToast("Device session kicked", "success");
        fetchAdminDevices();
      }
    } catch (e) {}
  };

  // --- ACTION: BROADCAST ALERT ---
  document.getElementById('broadcastForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('broadcastMsg').value.trim();
    if (!msg || !adminToken) return;

    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        },
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      if (data.success) {
        showToast("Broadcast alert dispatched to main website!", "success");
        document.getElementById('broadcastMsg').value = '';
      }
    } catch (e) {
      showToast("Failed to dispatch broadcast alert", "danger");
    }
  });

  // --- SSE STREAM FOR LIVE DEVICE MONITORING ---
  function initSseStream() {
    const sse = new EventSource('/api/admin/stream');
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        deviceList = data.devices;
        document.getElementById('statTotalDev').textContent = data.totalDevices;
        document.getElementById('statActiveDev').textContent = data.activeOnline;
        renderDevicesTable(deviceList);
      } catch (e) {}
    };
  }

  // TOAST MESSAGES
  function showToast(message, type = 'info') {
    const container = document.getElementById('adminToastContainer');
    const toast = document.createElement('div');
    toast.style.background = 'rgba(15, 23, 42, 0.95)';
    toast.style.border = `1px solid ${type === 'danger' ? '#f43f5e' : type === 'success' ? '#10b981' : '#00f3ff'}`;
    toast.style.borderRadius = '8px';
    toast.style.padding = '0.75rem 1.25rem';
    toast.style.color = '#fff';
    toast.style.fontSize = '0.85rem';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';

    toast.innerHTML = `<span>${type === 'danger' ? '🚨' : type === 'success' ? '✅' : 'ℹ️'}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

});
