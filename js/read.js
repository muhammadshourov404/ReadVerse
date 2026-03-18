// js/read.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  doc, getDoc, updateDoc,
  increment, setDoc, deleteDoc,
  arrayUnion, arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ─── State ────────────────────────────────────────────────────────────────────

let currentUser  = null;
let articleData  = null;
const articleId  = new URLSearchParams(window.location.search).get('id');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const escapeHtml = (str = '') =>
  str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
     .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

const el = (id) => document.getElementById(id);

// ─── Read progress bar ────────────────────────────────────────────────────────

const initProgressBar = () => {
  const bar = document.getElementById('read-progress-bar');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const scrollTop    = window.scrollY;
    const docHeight    = document.body.scrollHeight - window.innerHeight;
    const pct          = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
    bar.style.width    = pct + '%';
  }, { passive: true });
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const showSkeleton = (container) => {
  container.innerHTML = `
    <div class="read-skeleton">
      <div class="skeleton-line" style="height:40px;width:80%;margin-bottom:16px;"></div>
      <div class="skeleton-line" style="height:16px;width:40%;margin-bottom:32px;"></div>
      <div class="skeleton-line" style="height:300px;width:100%;margin-bottom:24px;border-radius:var(--radius-lg);"></div>
      <div class="skeleton-line" style="height:14px;width:95%;margin-bottom:10px;"></div>
      <div class="skeleton-line" style="height:14px;width:88%;margin-bottom:10px;"></div>
      <div class="skeleton-line" style="height:14px;width:92%;margin-bottom:10px;"></div>
    </div>
  `;
};

// ─── Like logic ───────────────────────────────────────────────────────────────

const handleLike = async () => {
  if (!currentUser) {
    window.location.href = './login.html';
    return;
  }
  if (!articleId) return;

  const likeRef  = doc(db, 'articles', articleId, 'likes', currentUser.uid);
  const likeSnap = await getDoc(likeRef);
  const likeBtn  = el('like-btn');
  const likeCount = el('like-count');

  if (likeSnap.exists()) {
    // Un-like
    await deleteDoc(likeRef);
    await updateDoc(doc(db, 'articles', articleId), { likes: increment(-1) });
    if (likeBtn)  likeBtn.classList.remove('active');
    if (likeCount) likeCount.textContent = Math.max(0, parseInt(likeCount.textContent) - 1);
  } else {
    // Like
    await setDoc(likeRef, { likedAt: new Date() });
    await updateDoc(doc(db, 'articles', articleId), { likes: increment(1) });
    if (likeBtn)  likeBtn.classList.add('active');
    if (likeCount) likeCount.textContent = parseInt(likeCount.textContent) + 1;
  }
};

// ─── Bookmark logic ───────────────────────────────────────────────────────────

const handleBookmark = async () => {
  if (!currentUser) {
    window.location.href = './login.html';
    return;
  }
  if (!articleId) return;

  const userRef  = doc(db, 'users', currentUser.uid);
  const userSnap = await getDoc(userRef);
  const bookmarks = userSnap.data()?.bookmarks || [];
  const bookmarkBtn = el('bookmark-btn');
  const isBookmarked = bookmarks.includes(articleId);

  if (isBookmarked) {
    await updateDoc(userRef, { bookmarks: arrayRemove(articleId) });
    if (bookmarkBtn) {
      bookmarkBtn.classList.remove('active');
      bookmarkBtn.querySelector('span').textContent = 'Save';
    }
  } else {
    await updateDoc(userRef, { bookmarks: arrayUnion(articleId) });
    if (bookmarkBtn) {
      bookmarkBtn.classList.add('active');
      bookmarkBtn.querySelector('span').textContent = 'Saved';
    }
  }
};

// ─── Check if current user already liked / bookmarked ────────────────────────

const loadUserInteractions = async () => {
  if (!currentUser || !articleId) return;

  // Check like
  const likeSnap = await getDoc(doc(db, 'articles', articleId, 'likes', currentUser.uid));
  if (likeSnap.exists()) el('like-btn')?.classList.add('active');

  // Check bookmark
  const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
  const bookmarks = userSnap.data()?.bookmarks || [];
  if (bookmarks.includes(articleId)) {
    const bookmarkBtn = el('bookmark-btn');
    if (bookmarkBtn) {
      bookmarkBtn.classList.add('active');
      bookmarkBtn.querySelector('span').textContent = 'Saved';
    }
  }
};

// ─── Share logic ──────────────────────────────────────────────────────────────

const handleShare = async () => {
  const shareData = {
    title : articleData?.title || 'ReadVerse Article',
    url   : window.location.href,
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(window.location.href);
      const btn = el('share-btn');
      if (btn) {
        btn.querySelector('span').textContent = 'Copied!';
        setTimeout(() => { btn.querySelector('span').textContent = 'Share'; }, 2000);
      }
    }
  } catch {}
};

// ─── Main article render ──────────────────────────────────────────────────────

const renderArticle = (id, data) => {
  articleData = data;
  const display = el('article-display');
  if (!display) return;

  const safeTitle  = escapeHtml(data.title  || 'Untitled');
  const safeAuthor = escapeHtml(data.authorName || 'Anonymous');
  const date = data.createdAt
    ? data.createdAt.toDate().toLocaleDateString('en-US',
        { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Just now';
  const avatar = data.authorPhotoURL
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.authorName||'U')}&background=random&size=80`;
  const tags     = Array.isArray(data.tags) ? data.tags : [];
  const readTime = data.readTime || 1;
  const cover    = data.coverImage || '';

  document.title = `${safeTitle} — ReadVerse`;

  // NOTE: article.content is trusted HTML from our own editor — rendered as-is.
  // title/authorName are escaped since they come from user text fields.
  display.innerHTML = `
    ${cover ? `<img src="${cover}" alt="${safeTitle}" class="read-cover-image" />` : ''}

    <h1 class="read-title">${safeTitle}</h1>

    <div class="read-meta">
      <img src="${avatar}" alt="${safeAuthor}" class="read-author-avatar" loading="lazy" />
      <div class="read-author-details">
        <strong>${safeAuthor}</strong>
        <span class="text-secondary">
          ${date} · ${readTime} min read ·
          <i class="ph ph-eye"></i> <span id="view-count">${data.views || 0}</span> views
        </span>
      </div>
    </div>

    ${tags.length ? `
      <div class="read-tags">
        ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
      </div>` : ''}

    <div class="read-content">${data.content || ''}</div>

    <div class="read-actions">
      <button class="action-btn" id="like-btn">
        <i class="ph ph-heart"></i>
        <span id="like-count">${data.likes || 0}</span>
      </button>
      <button class="action-btn" id="bookmark-btn">
        <i class="ph ph-bookmark-simple"></i>
        <span>Save</span>
      </button>
      <button class="action-btn" id="share-btn">
        <i class="ph ph-share-network"></i>
        <span>Share</span>
      </button>
    </div>
  `;

  // Attach handlers
  el('like-btn')    ?.addEventListener('click', handleLike);
  el('bookmark-btn')?.addEventListener('click', handleBookmark);
  el('share-btn')   ?.addEventListener('click', handleShare);
};

// ─── Fetch article ────────────────────────────────────────────────────────────

const fetchArticle = async () => {
  const display = el('article-display');
  if (!display) return;

  if (!articleId) {
    display.innerHTML = `<p class="read-error">No article ID provided.</p>`;
    return;
  }

  showSkeleton(display);

  try {
    const snap = await getDoc(doc(db, 'articles', articleId));

    if (!snap.exists()) {
      display.innerHTML = `<p class="read-error">This article has been removed or does not exist.</p>`;
      return;
    }

    renderArticle(snap.id, snap.data());

    // Increment view count (fire-and-forget — don't await)
    updateDoc(doc(db, 'articles', articleId), { views: increment(1) })
      .then(() => {
        const vc = el('view-count');
        if (vc) vc.textContent = parseInt(vc.textContent) + 1;
      })
      .catch(() => {});

    await loadUserInteractions();

  } catch (err) {
    console.error('Error fetching article:', err);
    display.innerHTML = `<p class="read-error">Failed to load article. Please try again.</p>`;
  }
};

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initProgressBar();
  fetchArticle();
});

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  // Re-check interactions if auth resolves after article is already loaded
  if (user && articleData) loadUserInteractions();
});
