// js/write.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  collection, addDoc, doc, getDoc, updateDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ─── State ────────────────────────────────────────────────────────────────────

let currentUser     = null;
let currentUserData = {};
let autoSaveTimer   = null;
const editId        = new URLSearchParams(window.location.search).get('edit');
const isEditMode    = !!editId;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const titleInput    = document.getElementById('article-title');
const editor        = document.getElementById('article-content');
const publishBtn    = document.getElementById('publish-btn');
const saveStatus    = document.getElementById('save-status');
const wordCountEl   = document.getElementById('word-count');
const readTimeEl    = document.getElementById('read-time');
const tagsInput     = document.getElementById('article-tags');
const coverInput    = document.getElementById('cover-image-url');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const showToast = (message, type = 'error') => {
  let toast = document.getElementById('write-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'write-toast';
    document.body.appendChild(toast);
  }
  toast.textContent  = message;
  toast.className    = `write-toast write-toast--${type}`;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
};

const getPlainText = () => {
  const tmp = document.createElement('div');
  tmp.innerHTML = editor?.innerHTML || '';
  return (tmp.textContent || '').trim();
};

const isContentEmpty = () => {
  const text = getPlainText();
  return !text || text.length < 5;
};

const parseTags = (raw = '') =>
  raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 5);

const calcReadTime = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const words = (tmp.textContent || '').trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
};

const updateStats = () => {
  if (!editor) return;
  const text  = getPlainText();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const mins  = Math.max(1, Math.round(words / 200));
  if (wordCountEl) wordCountEl.textContent = `${words} words`;
  if (readTimeEl)  readTimeEl.textContent  = `${mins} min read`;
};

// ─── Toolbar formatting (Selection API — no deprecated execCommand) ───────────

const applyFormat = (command, value = null) => {
  if (!editor) return;
  editor.focus();

  // Modern Selection API approach
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  // Fallback gracefully to execCommand where still available
  try {
    document.execCommand(command, false, value);
  } catch {
    // Future-proof: wrap selection in appropriate tag
    const range = selection.getRangeAt(0);
    const tagMap = { bold: 'strong', italic: 'em', underline: 'u', strikeThrough: 's' };
    const tag = tagMap[command];
    if (tag) {
      const el = document.createElement(tag);
      try { range.surroundContents(el); } catch { /* partial selection */ }
    }
  }
};

document.querySelectorAll('.format-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    applyFormat(
      btn.getAttribute('data-command'),
      btn.getAttribute('data-value') || null
    );
  });
});

// ─── Real localStorage auto-save ─────────────────────────────────────────────

const DRAFT_KEY = `readverse_draft_${isEditMode ? editId : 'new'}`;

const saveDraftLocally = () => {
  const draft = {
    title   : titleInput?.value   || '',
    content : editor?.innerHTML   || '',
    tags    : tagsInput?.value    || '',
    cover   : coverInput?.value   || '',
    savedAt : Date.now(),
  };
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  if (saveStatus) {
    saveStatus.style.opacity = '1';
    saveStatus.textContent   = 'Draft saved locally';
    setTimeout(() => { saveStatus.style.opacity = '0'; }, 2000);
  }
};

const restoreDraft = () => {
  if (isEditMode) return; // Don't overwrite edit data with local draft
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (titleInput && draft.title)   titleInput.value   = draft.title;
    if (editor    && draft.content)  editor.innerHTML   = draft.content;
    if (tagsInput && draft.tags)     tagsInput.value    = draft.tags;
    if (coverInput && draft.cover)   coverInput.value   = draft.cover;
    showToast('Draft restored from last session.', 'info');
    updateStats();
  } catch {}
};

if (editor) {
  editor.addEventListener('input', () => {
    updateStats();
    if (saveStatus) {
      saveStatus.style.opacity = '1';
      saveStatus.textContent   = 'Saving draft…';
    }
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveDraftLocally, 1200);
  });
}

// ─── Edit mode — load existing article ───────────────────────────────────────

const loadArticleForEdit = async () => {
  if (!isEditMode) return;
  try {
    const snap = await getDoc(doc(db, 'articles', editId));
    if (!snap.exists()) { showToast('Article not found.'); return; }

    const data = snap.data();

    // Ownership check
    if (data.authorId !== currentUser?.uid) {
      showToast('You are not the author of this article.', 'error');
      window.location.href = './dashboard.html';
      return;
    }

    if (titleInput)  titleInput.value  = data.title   || '';
    if (editor)      editor.innerHTML  = data.content || '';
    if (tagsInput)   tagsInput.value   = (data.tags || []).join(', ');
    if (coverInput)  coverInput.value  = data.coverImage || '';

    if (publishBtn) publishBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Update Article';
    updateStats();
  } catch (err) {
    console.error('Load article error:', err);
    showToast('Failed to load article for editing.');
  }
};

// ─── Publish / Update ─────────────────────────────────────────────────────────

const handlePublish = async () => {
  // Guard: auth must be ready
  if (!currentUser) {
    showToast('Please wait — verifying your session…');
    return;
  }

  const title   = titleInput?.value.trim() || '';
  const content = editor?.innerHTML.trim() || '';

  if (!title || title.length < 3) {
    showToast('Please enter a title (at least 3 characters).');
    return;
  }
  if (isContentEmpty()) {
    showToast('Please write some content before publishing.');
    return;
  }

  const originalHTML = publishBtn.innerHTML;
  publishBtn.disabled  = true;
  publishBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Publishing…';

  const tags      = parseTags(tagsInput?.value || '');
  const coverImage = coverInput?.value.trim() || '';
  const readTime   = calcReadTime(content);

  const articleData = {
    title,
    content,
    tags,
    coverImage,
    readTime,
    authorId       : currentUser.uid,
    authorName     : currentUserData.fullName || currentUser.displayName || 'Anonymous',
    authorPhotoURL : currentUserData.photoURL || currentUser.photoURL    || '',
    views          : 0,
    likes          : 0,
    updatedAt      : serverTimestamp(),
  };

  try {
    if (isEditMode) {
      // Update existing article
      await updateDoc(doc(db, 'articles', editId), articleData);
    } else {
      // Create new article
      articleData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'articles'), articleData);
    }

    // Clear local draft on successful publish
    try { localStorage.removeItem(DRAFT_KEY); } catch {}

    showToast(isEditMode ? 'Article updated!' : 'Article published!', 'success');
    setTimeout(() => { window.location.href = './dashboard.html'; }, 800);

  } catch (err) {
    console.error('Publish error:', err);
    showToast('Failed to publish. Please try again.');
    publishBtn.disabled  = false;
    publishBtn.innerHTML = originalHTML;
  }
};

if (publishBtn) publishBtn.addEventListener('click', handlePublish);

// ─── Auth gate ────────────────────────────────────────────────────────────────

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = './login.html';
    return;
  }

  currentUser = user;

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) currentUserData = snap.data();
  } catch (err) {
    console.error('User data fetch error:', err);
  }

  if (isEditMode) {
    await loadArticleForEdit();
  } else {
    restoreDraft();
  }
});
