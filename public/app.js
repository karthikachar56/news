// THE GLOBAL CHRONICLE - FRONTEND APPLICATION LOGIC WITH ADMIN ALERT LISTENER
document.addEventListener('DOMContentLoaded', () => {

  let articlesData = [];
  let currentArticle = null;
  let isSpeaking = false;
  let lastSeenAlertId = null;

  // --- THEME SWITCHER (LIGHT / DARK) ---
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const body = document.body;

  const savedTheme = localStorage.getItem('chronicle_theme') || 'dark';
  if (savedTheme === 'light') {
    body.classList.add('light-theme');
    themeToggleBtn.textContent = '☀️ Light Mode';
  }

  themeToggleBtn.addEventListener('click', () => {
    body.classList.toggle('light-theme');
    const isLight = body.classList.contains('light-theme');
    themeToggleBtn.textContent = isLight ? '☀️ Light Mode' : '🌙 Dark Mode';
    localStorage.setItem('chronicle_theme', isLight ? 'light' : 'dark');
  });

  // --- FETCH NEWS ARTICLES ---
  async function fetchNews(category = 'All Stories', search = '') {
    try {
      const url = new URL('/api/news', window.location.origin);
      if (category && category !== 'All Stories') url.searchParams.set('category', category);
      if (search) url.searchParams.set('search', search);

      const res = await fetch(url);
      
      // If 403 Forbidden (Blocked by Admin)
      if (res.status === 403) {
        document.body.innerHTML = await res.text();
        return;
      }

      articlesData = await res.json();
      
      renderHero(articlesData[0]);
      renderTrending(articlesData);
      renderGrid(articlesData);

      document.getElementById('articleCountText').textContent = `${articlesData.length} Article${articlesData.length !== 1 ? 's' : ''}`;
    } catch (e) {
      console.warn("Failed to fetch news stories:", e);
    }
  }

  // --- RENDER HERO CARD ---
  function renderHero(article) {
    if (!article) return;
    document.getElementById('heroImage').src = article.image;
    document.getElementById('heroCategory').textContent = article.category;
    document.getElementById('heroTitle').textContent = article.title;
    document.getElementById('heroSubtitle').textContent = article.subtitle;
    document.getElementById('heroAuthor').textContent = article.author;
    document.getElementById('heroAvatar').src = article.authorAvatar;
    
    document.getElementById('heroCard').onclick = () => openArticleModal(article.id);
  }

  // --- RENDER TRENDING SIDEBAR ---
  function renderTrending(articles) {
    const list = document.getElementById('trendingList');
    list.innerHTML = articles.slice(0, 5).map((art, idx) => `
      <li class="trending-item" onclick="openArticleModal('${art.id}')">
        <div class="trending-number">0${idx + 1}</div>
        <div class="trending-details">
          <span class="trending-cat">${art.category}</span>
          <h4 class="trending-title">${art.title}</h4>
          <span style="font-size:0.75rem; color:var(--text-dim); margin-top:0.2rem;">⏱️ ${art.readTime}</span>
        </div>
      </li>
    `).join('');
  }

  // --- RENDER ARTICLE GRID ---
  function renderGrid(articles) {
    const grid = document.getElementById('articleGrid');
    if (articles.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-muted);">No articles found matching your search.</div>`;
      return;
    }

    grid.innerHTML = articles.map(art => `
      <article class="article-card" onclick="openArticleModal('${art.id}')">
        <img src="${art.image}" alt="${art.title}" class="article-thumb">
        <div class="article-card-body">
          <span class="card-cat-badge">${art.category}</span>
          <h3 class="card-headline">${art.title}</h3>
          <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.4;">${art.subtitle}</p>
          <div class="card-footer-meta">
            <span>By ${art.author}</span>
            <span>⏱️ ${art.readTime}</span>
          </div>
        </div>
      </article>
    `).join('');
  }

  // --- CATEGORY & SEARCH LISTENERS ---
  const categoryItems = document.querySelectorAll('.category-item');
  categoryItems.forEach(item => {
    item.addEventListener('click', () => {
      categoryItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const cat = item.getAttribute('data-category');
      document.getElementById('gridTitle').textContent = cat === 'All Stories' ? 'Latest News & Deep Dives' : cat;
      fetchNews(cat, document.getElementById('searchInput').value);
    });
  });

  const searchInput = document.getElementById('searchInput');
  let searchTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const activeCat = document.querySelector('.category-item.active').getAttribute('data-category');
      fetchNews(activeCat, searchInput.value.trim());
    }, 300);
  });

  // --- ARTICLE READER MODAL ---
  const modal = document.getElementById('articleModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  let currentFontSize = 1.05;

  window.openArticleModal = (articleId) => {
    const article = articlesData.find(a => a.id === articleId);
    if (!article) return;
    
    currentArticle = article;
    document.getElementById('modalCategory').textContent = article.category;
    document.getElementById('modalTitle').textContent = article.title;
    document.getElementById('modalAuthor').textContent = article.author;
    document.getElementById('modalAvatar').src = article.authorAvatar;
    document.getElementById('modalDate').textContent = article.date;
    document.getElementById('modalImage').src = article.image;
    document.getElementById('modalLikesCount').textContent = article.likes;
    document.getElementById('modalContent').innerHTML = article.content;

    renderComments(article.comments || []);

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  function renderComments(comments) {
    const list = document.getElementById('modalCommentsList');
    if (comments.length === 0) {
      list.innerHTML = `<div style="font-size:0.85rem; color:var(--text-dim);">No comments yet. Be the first to share your perspective!</div>`;
      return;
    }

    list.innerHTML = comments.map(c => `
      <div style="background:var(--bg-card); padding:0.85rem 1.1rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
        <div style="display:flex; justify-space-between; align-items:center; margin-bottom:0.3rem;">
          <strong style="font-size:0.88rem;">${c.user}</strong>
          <span style="font-size:0.75rem; color:var(--text-dim); font-family:var(--font-mono);">${c.time}</span>
        </div>
        <p style="font-size:0.88rem; color:var(--text-muted);">${c.text}</p>
      </div>
    `).join('');
  }

  modalCloseBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    stopSpeech();
  });

  // FONT RESIZE
  document.getElementById('fontSmallerBtn').addEventListener('click', () => {
    if (currentFontSize > 0.85) {
      currentFontSize -= 0.1;
      document.getElementById('modalContent').style.fontSize = `${currentFontSize}rem`;
    }
  });

  document.getElementById('fontBiggerBtn').addEventListener('click', () => {
    if (currentFontSize < 1.6) {
      currentFontSize += 0.1;
      document.getElementById('modalContent').style.fontSize = `${currentFontSize}rem`;
    }
  });

  // SPEECH SYNTHESIS ("LISTEN TO ARTICLE")
  const listenBtn = document.getElementById('listenArticleBtn');
  listenBtn.addEventListener('click', () => {
    if (isSpeaking) {
      stopSpeech();
    } else {
      startSpeech();
    }
  });

  function startSpeech() {
    if (!('speechSynthesis' in window) || !currentArticle) return;
    stopSpeech();

    const plainText = currentArticle.title + '. ' + document.getElementById('modalContent').innerText;
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      isSpeaking = false;
      listenBtn.textContent = '🔊 Read Aloud';
    };

    window.speechSynthesis.speak(utterance);
    isSpeaking = true;
    listenBtn.textContent = '⏹️ Stop Reading';
  }

  function stopSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isSpeaking = false;
    listenBtn.textContent = '🔊 Read Aloud';
  }

  // LISTEN TO PODCAST BRIEFING TOP BAR BUTTON
  document.getElementById('listenPodcastBtn').addEventListener('click', () => {
    if (isSpeaking) {
      stopSpeech();
    } else {
      const summaryText = "Welcome to The Global Chronicle Daily Intelligence Briefing for Sunday, October 4. Headline news: Scientists achieve 48 hour continuous fusion plasma energy gain. In artificial intelligence, an optical quantum processor solves 4000 year protein folding in 14 seconds.";
      const utterance = new SpeechSynthesisUtterance(summaryText);
      window.speechSynthesis.speak(utterance);
      isSpeaking = true;
      document.getElementById('listenPodcastBtn').textContent = '⏹️ Stop Podcast';
      utterance.onend = () => {
        isSpeaking = false;
        document.getElementById('listenPodcastBtn').textContent = '🎙️ Listen to Daily Briefing';
      };
    }
  });

  // LIKE BUTTON
  document.getElementById('likeBtn').addEventListener('click', async () => {
    if (!currentArticle) return;
    try {
      const res = await fetch('/api/news/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentArticle.id })
      });
      const data = await res.json();
      if (data.success) {
        currentArticle.likes = data.likes;
        document.getElementById('modalLikesCount').textContent = data.likes;
      }
    } catch (e) {}
  });

  // COMMENT FORM
  document.getElementById('commentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('commentInput');
    const text = input.value.trim();
    if (!text || !currentArticle) return;

    try {
      const res = await fetch('/api/news/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentArticle.id, user: 'Reader', text })
      });
      const data = await res.json();
      if (data.success) {
        currentArticle.comments.push(data.comment);
        renderComments(currentArticle.comments);
        input.value = '';
      }
    } catch (e) {}
  });

  // --- ADMIN BROADCAST ALERT LISTENER ---
  async function checkForAdminAlerts() {
    try {
      const res = await fetch('/api/alerts/latest');
      const data = await res.json();
      if (data.message && data.id !== lastSeenAlertId) {
        lastSeenAlertId = data.id;
        showAdminBroadcastBanner(data.message, data.timestamp);
      }
    } catch (e) {}
  }

  function showAdminBroadcastBanner(msg, timeStr) {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #111827;
      border: 2px solid #00f3ff;
      box-shadow: 0 10px 30px rgba(0, 243, 255, 0.3);
      color: #fff;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 1rem;
      font-family: sans-serif;
      max-width: 90%;
      animation: fadeInDown 0.4s ease forwards;
    `;

    banner.innerHTML = `
      <span style="font-size:1.5rem;">📢</span>
      <div>
        <div style="font-size:0.75rem; color:#00f3ff; font-family:monospace; font-weight:700;">ADMINISTRATIVE BROADCAST ALERT • ${timeStr || ''}</div>
        <div style="font-size:0.95rem; font-weight:600; margin-top:0.2rem;">${msg}</div>
      </div>
      <button style="background:transparent; border:none; color:#94a3b8; font-size:1.2rem; cursor:pointer; margin-left:1rem;" onclick="this.parentElement.remove()">✕</button>
    `;
    document.body.appendChild(banner);
  }

  // INITIAL LOAD
  fetchNews();
  setInterval(checkForAdminAlerts, 3000);
});
