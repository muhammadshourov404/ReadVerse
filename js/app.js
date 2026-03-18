// js/app.js
import { db } from "./firebase-config.js";
import {
  collection, query, orderBy, limit,
  startAfter, getDocs
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const PAGE_SIZE = 9; // প্রতিবার ৯টি article লোড
let lastVisible  = null; // pagination cursor
let isLoading    = false;
let allLoaded    = false;

// XSS-safe text escape
const escapeHtml = (str = '') =>
  str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
     .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

// HTML strip + truncate for preview
const makePreview = (html, maxChars = 120) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const text = (tmp.textContent || tmp.innerText || '').trim();
  return text.length > maxChars ? text.slice(0, maxChars) + '…' : text;
};

// Read-time estimate (avg 200 wpm)
const readTime = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const words = (tmp.textContent || '').trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
};

// Skeleton card HTML
const skeletonCard = () => `
  <div class="article-card skeleton">
    <div class="skeleton-line short"></div>
    <div class="skeleton-line long"></div>
    <div class="skeleton-line medium"></div>
    <div class="skeleton-line short"></div>
  </div>
`;

// Show skeleton while loading
const showSkeletons = (grid, count = PAGE_SIZE) => {
  grid.insertAdjacentHTML('beforeend',
    Array(count).fill(skeletonCard()).join('')
  );
};

const removeSkeletons = (grid) => {
  grid.querySelectorAll('.skeleton').forEach(el => el.remove());
};

// Build one article card (XSS-safe)
const buildCard = (id, article) => {
  const date = article.createdAt
    ? article.createdAt.toDate().toLocaleDateString('en-US',
        { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Just now';

  const safeTitle  = escapeHtml(article.title  || 'Untitled');
  const safeAuthor = escapeHtml(article.authorName || 'Anonymous');
  const preview    = escapeHtml(makePreview(article.content || ''));
  const mins       = readTime(article.content || '');
  const avatar     = article.authorPhotoURL
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(article.authorName || 'U')}&background=random&size=40`;
  const cover      = article.coverImage || '';
  const tags       = Array.isArray(article.tags) ? article.tags.slice(0, 3) : [];

  return `
    <div class="article-card">
      ${cover ? `<a href="pages/read.html?id=${id}" class="article-cover-link">
        <img src="${cover}" alt="${safeTitle}" class="article-cover" loading="lazy"/>
      </a>` : ''}

      <div class="article-body">
        <div class="article-meta">
          <img src="${avatar}" alt="${safeAuthor}" class="author-avatar" loading="lazy"/>
          <span class="author-name">${safeAuthor}</span>
          <span class="meta-dot">·</span>
          <span>${date}</span>
          <span class="meta-dot">·</span>
          <span>${mins} min read</span>
        </div>

        <a href="pages/read.html?id=${id}" class="article-title">${safeTitle}</a>
        <p class="article-preview">${preview}</p>

        ${tags.length ? `
          <div class="article-tags">
            ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
          </div>` : ''}

        <a href="pages/read.html?id=${id}" class="read-more-btn">
          Read Article <i class="ph ph-arrow-right"></i>
        </a>
      </div>
    </div>
  `;
};

// ─── Main fetch function ─────────────────────────────────────────────────────

const fetchArticles = async (isFirstLoad = false) => {
  if (isLoading || allLoaded) return;

  const grid      = document.getElementById('articles-grid');
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (!grid) return;

  isLoading = true;
  if (loadMoreBtn) loadMoreBtn.disabled = true;

  showSkeletons(grid, isFirstLoad ? PAGE_SIZE : 3);

  try {
    let q = query(
      collection(db, 'articles'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );
    if (!isFirstLoad && lastVisible) {
      q = query(
        collection(db, 'articles'),
        orderBy('createdAt', 'desc'),
        startAfter(lastVisible),
        limit(PAGE_SIZE)
      );
    }

    const snapshot = await getDocs(q);
    removeSkeletons(grid);

    if (isFirstLoad && snapshot.empty) {
      grid.innerHTML = `
        <div class="empty-state">
          <i class="ph ph-pencil-line"></i>
          <p>No articles yet. <a href="pages/write.html">Be the first to write!</a></p>
        </div>
      `;
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    snapshot.forEach((doc) => {
      grid.insertAdjacentHTML('beforeend', buildCard(doc.id, doc.data()));
    });

    // Update pagination cursor
    lastVisible = snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.size < PAGE_SIZE) {
      allLoaded = true;
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    }

  } catch (error) {
    console.error('Error fetching articles:', error);
    removeSkeletons(grid);
    grid.insertAdjacentHTML('beforeend', `
      <p class="fetch-error">
        <i class="ph ph-warning"></i> Could not load articles. Please try again.
      </p>
    `);
  } finally {
    isLoading = false;
    if (loadMoreBtn && !allLoaded) loadMoreBtn.disabled = false;
  }
};

// ─── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  fetchArticles(true);

  // "Load More" button (add <button id="load-more-btn"> in index.html)
  const btn = document.getElementById('load-more-btn');
  if (btn) btn.addEventListener('click', () => fetchArticles(false));
});
