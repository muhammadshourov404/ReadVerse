// js/dashboard.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  doc, getDoc,
  collection, query, where, orderBy, getDocs, deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const escapeHtml = (str = '') =>
  str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
     .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

const el = (id) => document.getElementById(id);

const setHTML = (id, html) => {
  const node = el(id);
  if (node) node.innerHTML = html;
};

// Show skeleton placeholders
const showDashboardSkeletons = () => {
  setHTML('welcome-section', `
    <div class="skeleton-line long"  style="height:28px;margin-bottom:8px;"></div>
    <div class="skeleton-line short" style="height:16px;"></div>
  `);
  setHTML('stats-section', Array(4).fill(`
    <div class="stat-card skeleton">
      <div class="skeleton-line short" style="height:36px;margin-bottom:6px;"></div>
      <div class="skeleton-line medium" style="height:14px;"></div>
    </div>
  `).join(''));
  setHTML('my-articles-list', `<div class="skeleton-line long" style="height:80px;"></div>`);
};

// ─── Welcome banner ───────────────────────────────────────────────────────────

const renderWelcome = (user, userData) => {
  const name   = escapeHtml(userData.fullName || user.displayName || 'Reader');
  const avatar = userData.photoURL || user.photoURL
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=80`;
  const joined = userData.joinedAt
    ? userData.joinedAt.toDate().toLocaleDateString('en-US',
        { month: 'long', year: 'numeric' })
    : '';

  setHTML('welcome-section', `
    <div class="welcome-left">
      <img src="${avatar}" alt="${name}" class="dashboard-avatar" />
      <div>
        <h2>Welcome back, ${name}!</h2>
        <p class="text-secondary">
          ${joined ? `Member since ${joined} · ` : ''}Ready to write something amazing?
        </p>
      </div>
    </div>
    <a href="./write.html" class="btn-primary">
      <i class="ph ph-pen-nib"></i> Write New Article
    </a>
  `);
};

// ─── Stats cards ──────────────────────────────────────────────────────────────

const renderStats = (userData, articleCount) => {
  const stats = [
    { icon: 'ph-article',        label: 'Articles',  value: articleCount              },
    { icon: 'ph-users',          label: 'Followers',  value: userData.followers  || 0 },
    { icon: 'ph-user-plus',      label: 'Following',  value: userData.following  || 0 },
    { icon: 'ph-eye',            label: 'Total Views',value: userData.totalViews || 0 },
  ];

  setHTML('stats-section', stats.map(s => `
    <div class="stat-card">
      <i class="ph ${s.icon} stat-icon"></i>
      <span class="stat-value">${s.value.toLocaleString()}</span>
      <span class="stat-label">${s.label}</span>
    </div>
  `).join(''));
};

// ─── User's own articles ──────────────────────────────────────────────────────

const renderMyArticles = (articles) => {
  const container = el('my-articles-list');
  if (!container) return;

  if (!articles.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ph ph-pencil-line"></i>
        <p>You haven't published any articles yet.</p>
        <a href="./write.html" class="btn-primary">Write your first article</a>
      </div>
    `;
    return;
  }

  container.innerHTML = articles.map(({ id, data }) => {
    const title = escapeHtml(data.title || 'Untitled');
    const date  = data.createdAt
      ? data.createdAt.toDate().toLocaleDateString('en-US',
          { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Just now';
    const views = data.views || 0;

    return `
      <div class="my-article-row" data-id="${id}">
        <div class="my-article-info">
          <a href="./read.html?id=${id}" class="my-article-title">${title}</a>
          <span class="text-secondary" style="font-size:0.85rem;">
            ${date} · <i class="ph ph-eye"></i> ${views} views
          </span>
        </div>
        <div class="my-article-actions">
          <a href="./write.html?edit=${id}" class="btn-outline btn-sm">
            <i class="ph ph-pencil"></i> Edit
          </a>
          <button class="btn-danger btn-sm delete-btn" data-id="${id}">
            <i class="ph ph-trash"></i> Delete
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Delete handlers
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const articleId = btn.dataset.id;
      const confirmed = confirm('Delete this article? This cannot be undone.');
      if (!confirmed) return;

      btn.disabled = true;
      btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';

      try {
        await deleteDoc(doc(db, 'articles', articleId));
        btn.closest('.my-article-row').remove();
      } catch (err) {
        console.error('Delete failed:', err);
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-trash"></i> Delete';
      }
    });
  });
};

// ─── Auth gate + data loader ──────────────────────────────────────────────────

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = './login.html';
    return;
  }

  showDashboardSkeletons();

  try {
    // Fetch user profile
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    const userData  = userSnap.exists() ? userSnap.data() : {};

    // Fetch user's own articles
    const articlesQuery = query(
      collection(db, 'articles'),
      where('authorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const articlesSnap = await getDocs(articlesQuery);
    const articles = articlesSnap.docs.map(d => ({ id: d.id, data: d.data() }));

    // Render all sections
    renderWelcome(user, userData);
    renderStats(userData, articles.length);
    renderMyArticles(articles);

  } catch (err) {
    console.error('Dashboard load error:', err);
    setHTML('welcome-section', `
      <p class="auth-error" style="display:block;">
        Failed to load dashboard. Please refresh.
      </p>
    `);
  }
});
