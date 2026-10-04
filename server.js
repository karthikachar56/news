const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store Connected Devices & Admin State
let connectedDevices = new Map();
let blockedIPs = new Set();
let broadcastAlerts = [];
let adminAuthTokens = new Set(['admin-secret-token-2026']);

// Get Server MAC Address for localhost fallback
function getServerMacAddress() {
  const interfaces = os.networkInterfaces();
  for (let name in interfaces) {
    for (let iface of interfaces[name]) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        return iface.mac.toUpperCase();
      }
    }
  }
  return 'A4-C3-F0-18-99-E2';
}

const SERVER_MAC = getServerMacAddress();

// Function to resolve IP to MAC address using Windows `arp -a`
function getMacFromIp(ip, callback) {
  let cleanIp = ip.replace(/^::ffff:/, '');
  if (cleanIp === '::1' || cleanIp === '127.0.0.1' || cleanIp === 'localhost') {
    return callback(SERVER_MAC + ' (Local Loopback)');
  }

  exec(`arp -a ${cleanIp}`, (err, stdout) => {
    if (err || !stdout) {
      // Fallback deterministic MAC format based on IP hash
      const hash = Array.from(cleanIp).reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const fakeMac = `52-54-00-${(hash & 0xff).toString(16).padStart(2, '0').toUpperCase()}-${((hash >> 8) & 0xff).toString(16).padStart(2, '0').toUpperCase()}-88`;
      return callback(fakeMac);
    }
    
    // Parse ARP output for MAC address regex
    const macMatch = stdout.match(/([0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2}[-:][0-9a-f]{2})/i);
    if (macMatch && macMatch[1]) {
      callback(macMatch[1].toUpperCase().replace(/:/g, '-'));
    } else {
      const hash = Array.from(cleanIp).reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const fallbackMac = `02-00-4C-${(hash & 0xff).toString(16).padStart(2, '0').toUpperCase()}-${((hash >> 4) & 0xff).toString(16).padStart(2, '0').toUpperCase()}-A1`;
      callback(fallbackMac);
    }
  });
}

// Device Tracker Middleware
app.use((req, res, next) => {
  // Allow static admin assets without IP block
  if (req.path.startsWith('/admin') || req.path.startsWith('/api/admin')) {
    return next();
  }

  let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
  clientIp = clientIp.replace(/^::ffff:/, '');
  if (clientIp === '::1') clientIp = '127.0.0.1';

  // Check if IP is blocked
  if (blockedIPs.has(clientIp)) {
    return res.status(403).send(`
      <html>
        <body style="background:#0a0d14; color:#ef4444; font-family:sans-serif; text-align:center; padding:5rem;">
          <h1>⛔ ACCESS DENIED BY ADMINISTRATOR</h1>
          <p style="color:#94a3b8;">Your IP address (${clientIp}) has been blacklisted by the network administrator.</p>
        </body>
      </html>
    `);
  }

  const userAgent = req.headers['user-agent'] || 'Unknown Browser';
  const deviceKey = `${clientIp}_${userAgent.slice(0, 30)}`;

  getMacFromIp(clientIp, (macAddress) => {
    const existing = connectedDevices.get(deviceKey);
    const now = new Date();

    const deviceObj = {
      id: deviceKey,
      ip: clientIp,
      mac: macAddress,
      userAgent,
      os: parseOS(userAgent),
      browser: parseBrowser(userAgent),
      firstSeen: existing ? existing.firstSeen : now.toLocaleTimeString(),
      lastActive: now.toLocaleTimeString(),
      lastActiveTimestamp: now.getTime(),
      requestCount: existing ? existing.requestCount + 1 : 1,
      currentPage: req.path,
      status: 'ONLINE'
    };

    connectedDevices.set(deviceKey, deviceObj);

    // Attach latest broadcast alert to response if visiting main site
    if (broadcastAlerts.length > 0 && req.path === '/') {
      res.setHeader('X-Admin-Broadcast', encodeURIComponent(broadcastAlerts[broadcastAlerts.length - 1].message));
    }

    next();
  });
});

// User Agent Helper Parsers
function parseOS(ua) {
  if (ua.includes('Windows')) return 'Windows OS';
  if (ua.includes('Macintosh') || ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Linux')) return 'Linux OS';
  return 'Unknown OS';
}

function parseBrowser(ua) {
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  return 'Standard Browser';
}

// ----------------------------------------------------
// NEWS PORTAL REST APIs
// ----------------------------------------------------
let articles = [
  {
    id: 'art-101',
    category: 'Technology & AI',
    title: 'The Quantum Leap: Researchers Unveil 10,000-Qubit Optical AI Matrix',
    subtitle: 'A landmark study published in Nature reveals how photonics and optical quantum superposition have unlocked instantaneous neural processing.',
    author: 'Dr. Elena Vance',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    date: 'OCTOBER 4, 2026',
    readTime: '6 min read',
    views: '142.5K',
    likes: 3420,
    image: 'images/quantum.jpg',
    content: `<p>Room-temperature optical quantum processing has officially achieved supremacy, computing deep learning models over 800,000x faster than traditional silicon chips.</p>`,
    comments: [{ user: 'Marcus Vance', time: '2 hours ago', text: 'This will completely revolutionize drug discovery and materials science!' }]
  },
  {
    id: 'art-102',
    category: 'Science & Cosmos',
    title: 'Next-Gen Orbital Observatory Captures Water Vapor Signature on K2-18b',
    subtitle: 'High-resolution spectroscopic data confirms heavy cloud formations and liquid oceans on distant super-Earth.',
    author: 'Liam Thorne',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    date: 'OCTOBER 4, 2026',
    readTime: '5 min read',
    views: '98.2K',
    likes: 2180,
    image: 'images/space.jpg',
    content: `<p>Deep space telescopes confirm liquid water clouds and trace dimethyl sulfide signals in distant exoplanet atmosphere.</p>`,
    comments: []
  },
  {
    id: 'art-103',
    category: 'Climate & Energy',
    title: 'Breakthrough Fusion Reactor Sustains Net Energy Plasma Gain for 48 Hours',
    subtitle: 'Magnetic confinement tokamak achieves commercial viability threshold, signaling the dawn of limitless clean power.',
    author: 'Maya Lin',
    authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80',
    date: 'OCTOBER 4, 2026',
    readTime: '7 min read',
    views: '115.8K',
    likes: 4100,
    image: 'images/fusion.jpg',
    content: `<p>Continuous tokamak fusion sustained for 48 hours with a net Q-factor of 15.2 using 25-Tesla magnetic coils.</p>`,
    comments: []
  }
];

app.get('/api/news', (req, res) => {
  const { category, search } = req.query;
  let result = [...articles];
  if (category && category !== 'All Stories') {
    result = result.filter(a => a.category.toLowerCase() === category.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(a => a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q));
  }
  res.json(result);
});

app.post('/api/news/like', (req, res) => {
  const { id } = req.body;
  const article = articles.find(a => a.id === id);
  if (article) {
    article.likes += 1;
    return res.json({ success: true, likes: article.likes });
  }
  res.status(404).json({ error: 'Article not found' });
});

app.post('/api/news/comment', (req, res) => {
  const { id, user, text } = req.body;
  const article = articles.find(a => a.id === id);
  if (article) {
    const newComment = { user: user || 'Reader', time: 'Just now', text };
    article.comments.push(newComment);
    return res.json({ success: true, comment: newComment });
  }
  res.status(404).json({ error: 'Article not found' });
});

app.get('/api/alerts/latest', (req, res) => {
  if (broadcastAlerts.length > 0) {
    return res.json(broadcastAlerts[broadcastAlerts.length - 1]);
  }
  res.json({ message: null });
});

// ----------------------------------------------------
// SEPARATE ADMIN PANEL REST APIs
// ----------------------------------------------------

// Admin Login Endpoint
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    return res.json({ success: true, token: 'admin-secret-token-2026', username: 'Administrator' });
  }
  res.status(401).json({ error: 'Invalid admin username or password' });
});

// Middleware to verify admin token
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (adminAuthTokens.has(token)) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized admin access' });
}

// Fetch all connected devices (IPs, MAC Addresses, User Agents)
app.get('/api/admin/devices', requireAdmin, (req, res) => {
  const now = Date.now();
  const deviceList = Array.from(connectedDevices.values()).map(dev => {
    // Update active status based on last activity within 2 minutes
    const isOnline = (now - dev.lastActiveTimestamp) < 120000;
    return {
      ...dev,
      status: isOnline ? 'ONLINE' : 'IDLE',
      isBlocked: blockedIPs.has(dev.ip)
    };
  });

  res.json({
    totalDevices: deviceList.length,
    activeOnline: deviceList.filter(d => d.status === 'ONLINE').length,
    blockedCount: blockedIPs.size,
    serverMac: SERVER_MAC,
    devices: deviceList,
    blockedIPs: Array.from(blockedIPs)
  });
});

// Block / Blacklist an IP address
app.post('/api/admin/block-ip', requireAdmin, (req, res) => {
  const { ip, action } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });

  if (action === 'unblock') {
    blockedIPs.delete(ip);
    return res.json({ success: true, message: `IP ${ip} unblocked successfully` });
  } else {
    blockedIPs.add(ip);
    return res.json({ success: true, message: `IP ${ip} blocked successfully` });
  }
});

// Kick / Remove device session
app.post('/api/admin/kick-device', requireAdmin, (req, res) => {
  const { id } = req.body;
  if (connectedDevices.has(id)) {
    connectedDevices.delete(id);
    return res.json({ success: true, message: `Device session ${id} terminated` });
  }
  res.status(404).json({ error: 'Device not found' });
});

// Broadcast Alert popup to all main website visitors
app.post('/api/admin/broadcast', requireAdmin, (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const alertObj = {
    id: Date.now(),
    message,
    timestamp: new Date().toLocaleTimeString()
  };
  broadcastAlerts.push(alertObj);

  res.json({ success: true, message: 'Broadcast alert sent to all active devices', alert: alertObj });
});

// Admin Live SSE Device Stream
app.get('/api/admin/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendDeviceUpdate = () => {
    const now = Date.now();
    const deviceList = Array.from(connectedDevices.values()).map(dev => ({
      ...dev,
      status: (now - dev.lastActiveTimestamp) < 120000 ? 'ONLINE' : 'IDLE',
      isBlocked: blockedIPs.has(dev.ip)
    }));

    const payload = JSON.stringify({
      timestamp: new Date().toLocaleTimeString(),
      totalDevices: deviceList.length,
      activeOnline: deviceList.filter(d => d.status === 'ONLINE').length,
      devices: deviceList
    });

    res.write(`data: ${payload}\n\n`);
  };

  const interval = setInterval(sendDeviceUpdate, 2000);
  req.on('close', () => clearInterval(interval));
});

app.listen(PORT, () => {
  console.log(`📰 CHRONICLE Main Web running on http://localhost:${PORT}`);
  console.log(`🔒 CHRONICLE Admin Panel running on http://localhost:${PORT}/admin.html`);
});
