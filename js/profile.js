// js/profile.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  doc, getDoc, getDocs, updateDoc,
  collection, query, where, orderBy,
  increment, arrayUnion, arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ─── State ────────────────────────────────────────────────────────────────────

let currentUser  = null;
// Profile owner UID — from ?uid=... or falls back to logged-in user
const profileUid = new URLSearchParams(window.location.search).get('uid');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const escapeHtml = (str = '') =>
  str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
     .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

const el    = (id) => document.getElementById(id);
const setHTML = (id, html) => { const n = el(id); if (n) n.innerHTML = html; };

const makePreview = (html = '', max = 120) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const text = (tmp.textContent || '').trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const showSkeletons = () => {
  setHTML('profile-header', `
    <div class="profile-avatar-wrap">
      <div class="skeleton-line" style="width:96px;height:96px;border-radius:50%;"></div>
    </div>
    <div style="flex:1">
      <div class="skeleton-line long"  style="height:24px;margin-bottom:10px;"></div>
      <div class="skeleton-line short" style="height:14px;margin-bottom:8px;"></div>
      <div class="skeleton-line medium"style="height:14px;"></div>
    </div>
  `);
  setHTML('profile-stats', Array(3).fill(`
    <div class="stat-card skeleton">
      <div class="skeleton-line short" style="height:32px;margin-bottom:6px;"></div>
      <div class="skeleton-line medium" style="height:12px;"></div>
    </div>
  `).join(''));
  setHTML('profile-articles', `
    <div class="skeleton-line" style="height:100px;border-radius:var(--radius-lg);"></div>
  `);
};

// ─── Profile header ───────────────────────────────────────────────────────────

const renderHeader = (uid, data, isOwnProfile, isFollowing, followerCount) => {
  const name    = escapeHtml(data.fullName || 'Anonymous');
  const bio     = escapeHtml(data.bio     || 'No bio yet.');
  const joined  = data.joinedAt
    ? data.joinedAt.toDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';
  const avatar  = data.photoURL
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.fullName||'U')}&background=random&size=96`;

  const actionBtn = isOwnProfile
    ? `<a href="./settings.html" class="btn-outline profile-action-btn">
         <i class="ph ph-gear"></i> Edit Profile
       </a>`
    : currentUser
      ? `<button class="btn-primary profile-action-btn ${isFollowing ? 'following' : ''}" id="follow-btn" data-uid="${uid}">
           <i class="ph ph-${isFollowing ? 'user-minus' : 'user-plus'}"></i>
           ${isFollowing ? 'Unfollow' : 'Follow'}
         </button>`
      : `<a href="./login.html" class="btn-primary profile-action-btn">
           <i class="ph ph-user-plus"></i> Follow
         </a>`;

  setHTML('profile-header', `
    <div class="profile-avatar-wrap">
      <img src="${avatar}" alt="${name}" class="profile-avatar-lg" loading="lazy" />
    </div>
    <div class="profile-info">
      <div class="profile-name-row">
        <h2 class="profile-name">${name}</h2>
        ${actionBtn}
      </div>
      <p class="profile-bio">${bio}</p>
      <span class="text-secondary profile-joined">
        <i class="ph ph-calendar-blank"></i>
        ${joined ? `Joined ${joined}` : ''}
      </span>
    </div>
  `);

  // Follow button handler
  const followBtn = el('follow-btn');
  if (followBtn) {
    followBtn.addEventListener('click', () => handleFollow(uid, followerCount));
  }
};

// ─── Stats ────────────────────────────────────────────────────────────────────

const renderStats = (data, articleCount) => {
  const stats = [
    { label: 'Articles',  value: articleCount          },
    { label: 'Followers', value: data.followers || 0   },
    { label: 'Following', value: data.following || 0   },
  ];
  setHTML('profile-stats', stats.map(s => `
    <div class="stat-card">
      <span class="stat-value">${s.value.toLocaleString()}</span>
      <span class="stat-label">${s.label}</span>
    </div>
  `).join(''));
};

// ─── Articles list ────────────────────────────────────────────────────────────

const renderArticles = (articles, isOwnProfile) => {
  const container = el('profile-articles');
  if (!container) return;

  if (!articles.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ph ph-pencil-line"></i>
        <p>${isOwnProfile
          ? `You haven't published any articles yet. <a href="./write.html">Write one now!</a>`
          : `This author hasn't published any articles yet.`}
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = articles.map(({ id, data }) => {
    const title   = escapeHtml(data.title || 'Untitled');
    const preview = escapeHtml(makePreview(data.content || ''));
    const date    = data.createdAt
      ? data.createdAt.toDate().toLocaleDateString('en-US',
          { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Just now';
    const tags    = Array.isArray(data.tags) ? data.tags.slice(0, 3) : [];
    const cover   = data.coverImage || '';
    const readTime = data.readTime || 1;

    return `
      <div class="profile-article-card">
        ${cover ? `
          <a href="./read.html?id=${id}" class="profile-article-cover-link">
            <img src="${cover}" alt="${title}" class="profile-article-cover" loading="lazy"/>
          </a>` : ''}
        <div class="profile-article-body">
          <a href="./read.html?id=${id}" class="article-title">${title}</a>
          <p class="article-preview">${preview}</p>
          ${tags.length ? `
            <div class="article-tags">
              ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
            </div>` : ''}
          <div class="profile-article-meta text-secondary">
            <span>${date}</span>
            <span>·</span>
            <span>${readTime} min read</span>
            <span>·</span>
            <span><i class="ph ph-eye"></i> ${data.views || 0}</span>
            ${isOwnProfile ? `
              <a href="./write.html?edit=${id}" class="btn-outline btn-sm" style="margin-left:auto">
                <i class="ph ph-pencil"></i> Edit
              </a>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
};

// ─── Follow / Unfollow ────────────────────────────────────────────────────────

const handleFollow = async (targetUid, currentFollowerCount) => {
  if (!currentUser) { window.location.href = './login.html'; return; }

  const btn        = el('follow-btn');
  const isFollowing = btn?.classList.contains('following');

  const targetRef  = doc(db, 'users', targetUid);
  const myRef      = doc(db, 'users', currentUser.uid);

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>'; }

  try {
    if (isFollowing) {
      // Unfollow
      await updateDoc(targetRef, {
        followers       : increment(-1),
        followersList   : arrayRemove(currentUser.uid),
      });
      await updateDoc(myRef, {
        following       : increment(-1),
        followingList   : arrayRemove(targetUid),
      });
      if (btn) {
        btn.classList.remove('following');
        btn.innerHTML = '<i class="ph ph-user-plus"></i> Follow';
        btn.disabled  = false;
      }
    } else {
      // Follow
      await updateDoc(targetRef, {
        followers       : increment(1),
        followersList   : arrayUnion(currentUser.uid),
      });
      await updateDoc(myRef, {
        following       : increment(1),
        followingList   : arrayUnion(targetUid),
      });
      if (btn) {
        btn.classList.add('following');
        btn.innerHTML = '<i class="ph ph-user-minus"></i> Unfollow';
        btn.disabled  = false;
      }
    }
  } catch (err) {
    console.error('Follow error:', err);
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = isFollowing
        ? '<i class="ph ph-user-minus"></i> Unfollow'
        : '<i class="ph ph-user-plus"></i> Follow';
    }
  }
};

// ─── Main loader ──────────────────────────────────────────────────────────────

const loadProfile = async (viewer) => {
  // Decide whose profile to show
  const targetUid = profileUid || viewer?.uid;

  if (!targetUid) {
    // Not logged in AND no ?uid= in URL → send to login
    window.location.href = './login.html';
    return;
  }

  showSkeletons();

  try {
    // Fetch profile owner's data
    const profileSnap = await getDoc(doc(db, 'users', targetUid));
    if (!profileSnap.exists()) {
      setHTML('profile-header', `<p class="read-error">User not found.</p>`);
      return;
    }

    const data          = profileSnap.data();
    const isOwnProfile  = viewer?.uid === targetUid;

    // Check if current viewer already follows this profile
    const isFollowing = !isOwnProfile && viewer
      ? (data.followersList || []).includes(viewer.uid)
      : false;

    // Fetch this user's published articles
    const articlesSnap = await getDocs(query(
      collection(db, 'articles'),
      where('authorId', '==', targetUid),
      orderBy('createdAt', 'desc')
    ));
    const articles = articlesSnap.docs.map(d => ({ id: d.id, data: d.data() }));

    // Render everything
    renderHeader(targetUid, data, isOwnProfile, isFollowing, data.followers || 0);
    renderStats(data, articles.length);
    renderArticles(articles, isOwnProfile);

  } catch (err) {
    console.error('Profile load error:', err);
    setHTML('profile-header', `
      <p class="read-error">Failed to load profile. Please refresh.</p>
    `);
  }
};

// ─── Auth gate ────────────────────────────────────────────────────────────────

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  loadProfile(user);
});
