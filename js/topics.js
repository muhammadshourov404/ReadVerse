// js/topics.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  collection, query, where, orderBy, getDocs,
  doc, getDoc, updateDoc,
  arrayUnion, arrayRemove, increment,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ─── State ────────────────────────────────────────────────────────────────────

let currentUser      = null;
let allTopics        = [];   // { name, count, icon }
let followedTopics   = [];   // array of topic names from user doc
let activeTopicFilter = null;

// ─── Default topics (shown even if Firestore has no articles yet) ─────────────

const DEFAULT_TOPICS = [
  { name: 'Technology',  icon: 'ph-cpu'              },
  { name: 'Science',     icon: 'ph-flask'             },
  { name: 'Health',      icon: 'ph-heart'             },
  { name: 'Business',    icon: 'ph-briefcase'         },
  { name: 'Culture',     icon: 'ph-globe'             },
  { name: 'Politics',    icon: 'ph-buildings'         },
  { name: 'Education',   icon: 'ph-graduation-cap'    },
  { name: 'Travel',      icon: 'ph-airplane'          },
  { name: 'Food',        icon: 'ph-fork-knife'        },
  { name: 'Sports',      icon: 'ph-soccer-ball'       },
  { name: 'Art',         icon: 'ph-paint-brush'       },
  { name: 'Music',       icon: 'ph-music-note'        },
  { name: 'Film',        icon: 'ph-film-clapper'      },
  { name: 'Programming', icon: 'ph-code'              },
  { name: 'Finance',     icon: 'ph-currency-dollar'   },
  { name: 'Environment', icon: 'ph-leaf'              },
  { name: 'Psychology',  icon: 'ph-brain'             },
  { name: 'History',     icon: 'ph-book-bookmark'     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const escapeHtml = (str = '') =>
  str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
     .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

const el      = (id)       => document.getElementById(id);
const setHTML = (id, html) => { const n = el(id); if (n) n.innerHTML = html; };

const makePreview = (html = '', max = 120) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const text = (tmp.textContent || '').trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const showTopicSkeletons = () => {
  setHTML('topics-grid', Array(12).fill(`
    <div class="topic-card skeleton">
      <div class="skeleton-line" style="width:40px;height:40px;border-radius:50%;margin-bottom:10px;"></div>
      <div class="skeleton-line medium" style="height:14px;margin-bottom:6px;"></div>
      <div class="skeleton-line short"  style="height:12px;"></div>
    </div>
  `).join(''));
};

const showArticleSkeletons = () => {
  setHTML('topic-articles', Array(4).fill(`
    <div class="article-card skeleton" style="padding:16px;">
      <div class="skeleton-line long"   style="height:20px;margin-bottom:8px;"></div>
      <div class="skeleton-line medium" style="height:14px;margin-bottom:6px;"></div>
      <div class="skeleton-line short"  style="height:12px;"></div>
    </div>
  `).join(''));
};

// ─── Build topics with article counts from Firestore ─────────────────────────

const buildTopicsFromArticles = async () => {
  try {
    // Fetch all articles (only tags field needed — lightweight)
    const snap = await getDocs(
      query(collection(db, 'articles'), orderBy('createdAt', 'desc'))
    );

    // Count articles per tag
    const countMap = {};
    snap.forEach(d => {
      const tags = d.data().tags || [];
      tags.forEach(tag => {
        const key = tag.toLowerCase();
        countMap[key] = (countMap[key] || 0) + 1;
      });
    });

    // Merge DEFAULT_TOPICS with real counts
    const topicsWithCount = DEFAULT_TOPICS.map(t => ({
      ...t,
      count : countMap[t.name.toLowerCase()] || 0,
    }));

    // Also add any tags from Firestore not in DEFAULT_TOPICS
    Object.entries(countMap).forEach(([name, count]) => {
      const exists = topicsWithCount.some(
        t => t.name.toLowerCase() === name
      );
      if (!exists) {
        topicsWithCount.push({
          name  : name.charAt(0).toUpperCase() + name.slice(1),
          icon  : 'ph-tag',
          count,
        });
      }
    });

    // Sort: followed first → then by article count
    allTopics = topicsWithCount.sort((a, b) => {
      const aFollowed = followedTopics.includes(a.name.toLowerCase());
      const bFollowed = followedTopics.includes(b.name.toLowerCase());
      if (aFollowed && !bFollowed) return -1;
      if (!aFollowed && bFollowed) return 1;
      return b.count - a.count;
    });

  } catch (err) {
    console.error('Topics build error:', err);
    // Fallback to defaults with 0 counts
    allTopics = DEFAULT_TOPICS.map(t => ({ ...t, count: 0 }));
  }
};

// ─── Render topics grid ───────────────────────────────────────────────────────

const renderTopicsGrid = (topics) => {
  const grid = el('topics-grid');
  if (!grid) return;

  if (!topics.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <i class="ph ph-magnifying-glass"></i>
        <p>No topics match your search.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = topics.map(topic => {
    const key        = topic.name.toLowerCase();
    const isFollowed = followedTopics.includes(key);
    const isActive   = activeTopicFilter === key;

    return `
      <div
        class="topic-card ${isActive ? 'active' : ''}"
        data-topic="${escapeHtml(key)}"
        role="button"
        tabindex="0"
      >
        <div class="topic-icon-wrap ${isFollowed ? 'followed' : ''}">
          <i class="ph ${escapeHtml(topic.icon)}"></i>
        </div>
        <span class="topic-name">${escapeHtml(topic.name)}</span>
        <span class="topic-count">${topic.count} article${topic.count !== 1 ? 's' : ''}</span>

        ${currentUser ? `
          <button
            class="topic-follow-btn ${isFollowed ? 'following' : ''}"
            data-topic="${escapeHtml(key)}"
            title="${isFollowed ? 'Unfollow' : 'Follow'}"
          >
            <i class="ph ph-${isFollowed ? 'minus' : 'plus'}"></i>
            ${isFollowed ? 'Following' : 'Follow'}
          </button>
        ` : `
          <a href="./login.html" class="topic-follow-btn">
            <i class="ph ph-plus"></i> Follow
          </a>
        `}
      </div>
    `;
  }).join('');

  // ── Click handlers ──

  // Card click → filter articles
  grid.querySelectorAll('.topic-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't trigger if the follow button was clicked
      if (e.target.closest('.topic-follow-btn')) return;
      const topic = card.dataset.topic;
      filterArticlesByTopic(topic);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') card.click();
    });
  });

  // Follow button click
  grid.querySelectorAll('.topic-follow-btn[data-topic]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleFollowTopic(btn.dataset.topic, btn);
    });
  });
};

// ─── Follow / Unfollow a topic ────────────────────────────────────────────────

const handleFollowTopic = async (topicKey, btn) => {
  if (!currentUser) { window.location.href = './login.html'; return; }

  const isFollowing = followedTopics.includes(topicKey);
  const userRef     = doc(db, 'users', currentUser.uid);

  btn.disabled  = true;
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';

  try {
    if (isFollowing) {
      await updateDoc(userRef, { followedTopics: arrayRemove(topicKey) });
      followedTopics = followedTopics.filter(t => t !== topicKey);
    } else {
      await updateDoc(userRef, { followedTopics: arrayUnion(topicKey) });
      followedTopics.push(topicKey);
    }

    // Re-render grid with updated follow state
    const searchVal = el('topics-search')?.value.toLowerCase().trim() || '';
    const filtered  = searchVal
      ? allTopics.filter(t => t.name.toLowerCase().includes(searchVal))
      : allTopics;

    renderTopicsGrid(filtered);

    // Update "Following" count badge
    updateFollowingCount();

  } catch (err) {
    console.error('Follow topic error:', err);
    btn.disabled  = false;
    btn.innerHTML = isFollowing
      ? '<i class="ph ph-minus"></i> Following'
      : '<i class="ph ph-plus"></i> Follow';
  }
};

// ─── Filter articles by topic ─────────────────────────────────────────────────

const filterArticlesByTopic = async (topicKey) => {
  const articlesSection = el('topic-articles-section');
  const topicTitle      = el('topic-articles-title');

  // Toggle off if already active
  if (activeTopicFilter === topicKey) {
    activeTopicFilter = null;
    if (articlesSection) articlesSection.style.display = 'none';
    // Remove active class
    document.querySelectorAll('.topic-card').forEach(c =>
      c.classList.remove('active'));
    return;
  }

  activeTopicFilter = topicKey;

  // Highlight active card
  document.querySelectorAll('.topic-card').forEach(c => {
    c.classList.toggle('active', c.dataset.topic === topicKey);
  });

  if (articlesSection) articlesSection.style.display = 'block';
  if (topicTitle) topicTitle.textContent =
    `Articles in "${topicKey.charAt(0).toUpperCase() + topicKey.slice(1)}"`;

  showArticleSkeletons();

  // Scroll to articles section
  articlesSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const snap = await getDocs(query(
      collection(db, 'articles'),
      where('tags', 'array-contains', topicKey),
      orderBy('createdAt', 'desc')
    ));

    const articles = snap.docs.map(d => ({ id: d.id, data: d.data() }));
    renderTopicArticles(articles, topicKey);

  } catch (err) {
    console.error('Filter articles error:', err);
    setHTML('topic-articles', `
      <p style="color:var(--text-secondary);text-align:center;padding:32px 0;">
        Failed to load articles. Please try again.
      </p>
    `);
  }
};

// ─── Render filtered articles ─────────────────────────────────────────────────

const renderTopicArticles = (articles, topicKey) => {
  const container = el('topic-articles');
  if (!container) return;

  if (!articles.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ph ph-pencil-line"></i>
        <p>No articles yet in this topic.
           <a href="./write.html">Be the first to write one!</a>
        </p>
      </div>
    `;
    return;
  }

  // Determine base path
  const inPages = window.location.pathname.includes('/pages/');
  const readPath = inPages ? './read.html' : './pages/read.html';

  container.innerHTML = articles.map(({ id, data }) => {
    const title   = escapeHtml(data.title || 'Untitled');
    const author  = escapeHtml(data.authorName || 'Anonymous');
    const preview = escapeHtml(makePreview(data.content || ''));
    const date    = data.createdAt
      ? data.createdAt.toDate().toLocaleDateString('en-US',
          { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Just now';
    const cover   = data.coverImage || '';
    const readTime = data.readTime || 1;
    const avatar  = data.authorPhotoURL
      || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.authorName||'U')}&background=random&size=40`;
    const tags    = (data.tags || []).slice(0, 3);

    return `
      <div class="article-card">
        ${cover ? `
          <a href="${readPath}?id=${id}">
            <img src="${cover}" alt="${title}" class="article-cover" loading="lazy"/>
          </a>` : ''}
        <div class="article-body">
          <div class="article-meta">
            <img src="${avatar}" alt="${author}" class="author-avatar" loading="lazy"/>
            <span class="author-name">${author}</span>
            <span class="meta-dot">·</span>
            <span>${date}</span>
            <span class="meta-dot">·</span>
            <span>${readTime} min read</span>
          </div>
          <a href="${readPath}?id=${id}" class="article-title">${title}</a>
          <p class="article-preview">${preview}</p>
          ${tags.length ? `
            <div class="article-tags">
              ${tags.map(t => `
                <span class="tag ${t === topicKey ? 'tag--active' : ''}">${escapeHtml(t)}</span>
              `).join('')}
            </div>` : ''}
          <a href="${readPath}?id=${id}" class="read-more-btn">
            Read Article <i class="ph ph-arrow-right"></i>
          </a>
        </div>
      </div>
    `;
  }).join('');
};

// ─── Search topics ────────────────────────────────────────────────────────────

const initTopicSearch = () => {
  const searchInput = el('topics-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    const val      = searchInput.value.toLowerCase().trim();
    const filtered = val
      ? allTopics.filter(t => t.name.toLowerCase().includes(val))
      : allTopics;
    renderTopicsGrid(filtered);
  });
};

// ─── Following count badge ────────────────────────────────────────────────────

const updateFollowingCount = () => {
  const badge = el('followed-topics-count');
  if (badge) badge.textContent = followedTopics.length;
};

// ─── "My Topics" tab — show only followed topics ──────────────────────────────

const initTabSwitcher = () => {
  const allTab  = el('tab-all-topics');
  const myTab   = el('tab-my-topics');
  if (!allTab || !myTab) return;

  allTab.addEventListener('click', () => {
    allTab.classList.add('active');
    myTab.classList.remove('active');
    renderTopicsGrid(allTopics);
  });

  myTab.addEventListener('click', () => {
    myTab.classList.add('active');
    allTab.classList.remove('active');

    if (!currentUser) {
      setHTML('topics-grid', `
        <div class="empty-state" style="grid-column:1/-1">
          <i class="ph ph-user"></i>
          <p><a href="./login.html">Sign in</a> to see your followed topics.</p>
        </div>
      `);
      return;
    }

    const myTopics = allTopics.filter(t =>
      followedTopics.includes(t.name.toLowerCase())
    );

    if (!myTopics.length) {
      setHTML('topics-grid', `
        <div class="empty-state" style="grid-column:1/-1">
          <i class="ph ph-bookmark"></i>
          <p>You haven't followed any topics yet. Click Follow on any topic above!</p>
        </div>
      `);
      return;
    }

    renderTopicsGrid(myTopics);
  });
};

// ─── Init ─────────────────────────────────────────────────────────────────────

const init = async (user) => {
  showTopicSkeletons();

  // Load followed topics from Firestore if logged in
  if (user) {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      followedTopics = snap.data()?.followedTopics || [];
    } catch { followedTopics = []; }
  }

  await buildTopicsFromArticles();

  renderTopicsGrid(allTopics);
  updateFollowingCount();
  initTopicSearch();
  initTabSwitcher();

  // If URL has ?topic=technology — auto-filter on load
  const topicParam = new URLSearchParams(window.location.search).get('topic');
  if (topicParam) filterArticlesByTopic(topicParam.toLowerCase());
};

// ─── Auth gate ────────────────────────────────────────────────────────────────

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  init(user);
});
