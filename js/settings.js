// js/settings.js
import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged, updatePassword,
         updateEmail, reauthenticateWithCredential,
         EmailAuthProvider, deleteUser,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  doc, getDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// ─── State ────────────────────────────────────────────────────────────────────

let currentUser     = null;
let currentUserData = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const el       = (id) => document.getElementById(id);
const escapeHtml = (str = '') =>
  str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
     .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

// Toast notification
const showToast = (message, type = 'error') => {
  let toast = document.getElementById('settings-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'settings-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className   = `write-toast write-toast--${type}`;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
};

// Set loading state on any button
const setLoading = (btn, loading, originalHTML) => {
  if (!btn) return;
  btn.disabled  = loading;
  btn.innerHTML = loading
    ? '<i class="ph ph-spinner ph-spin"></i> Please wait…'
    : originalHTML;
};

// ─── Load current settings into form fields ───────────────────────────────────

const populateForm = (user, data) => {
  // Profile section
  const nameInput   = el('settings-fullname');
  const bioInput    = el('settings-bio');
  const emailInput  = el('settings-email');
  const avatarPreview = el('avatar-preview');

  if (nameInput)  nameInput.value  = data.fullName || user.displayName || '';
  if (bioInput)   bioInput.value   = data.bio      || '';
  if (emailInput) emailInput.value = user.email    || '';

  const avatarUrl = data.photoURL || user.photoURL
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.fullName||'U')}&background=random&size=96`;
  if (avatarPreview) avatarPreview.src = avatarUrl;

  // Notification toggles
  const notifEmail = el('notif-email');
  const notifPush  = el('notif-push');
  if (notifEmail) notifEmail.checked = data.notifEmail !== false; // default true
  if (notifPush)  notifPush.checked  = data.notifPush  !== false;

  // Theme toggle
  const themeToggle = el('theme-toggle');
  if (themeToggle) {
    const saved = localStorage.getItem('readverse_theme') || data.theme || 'light';
    themeToggle.value = saved;
    applyTheme(saved);
  }
};

// ─── Theme ────────────────────────────────────────────────────────────────────

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('readverse_theme', theme);
};

const initThemeToggle = () => {
  const toggle = el('theme-toggle');
  if (!toggle) return;
  toggle.addEventListener('change', () => {
    applyTheme(toggle.value);
    // Persist to Firestore silently
    if (currentUser) {
      updateDoc(doc(db, 'users', currentUser.uid), { theme: toggle.value })
        .catch(() => {});
    }
  });
};

// ─── Avatar upload preview ────────────────────────────────────────────────────

const initAvatarPreview = () => {
  const fileInput     = el('avatar-file-input');
  const avatarPreview = el('avatar-preview');
  if (!fileInput || !avatarPreview) return;

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    // Client-side size check (max 2 MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be smaller than 2 MB.');
      fileInput.value = '';
      return;
    }
    // Live preview
    const reader = new FileReader();
    reader.onload = (e) => { avatarPreview.src = e.target.result; };
    reader.readAsDataURL(file);
  });
};

// ─── 1. Save Profile (name, bio, avatar) ─────────────────────────────────────

const handleSaveProfile = async () => {
  if (!currentUser) return;

  const fullName  = el('settings-fullname')?.value.trim() || '';
  const bio       = el('settings-bio')?.value.trim()       || '';
  const fileInput = el('avatar-file-input');
  const file      = fileInput?.files[0];
  const btn       = el('save-profile-btn');
  const orig      = btn?.innerHTML;

  // Validation
  if (!fullName || fullName.length < 2) {
    showToast('Please enter your full name (at least 2 characters).');
    return;
  }
  if (bio.length > 200) {
    showToast('Bio must be 200 characters or fewer.');
    return;
  }

  setLoading(btn, true, orig);

  try {
    let photoURL = currentUserData.photoURL || currentUser.photoURL || '';

    // Upload new avatar if selected
    if (file) {
      const storageRef = ref(storage, `avatars/${currentUser.uid}`);
      const snapshot   = await uploadBytes(storageRef, file);
      photoURL         = await getDownloadURL(snapshot.ref);
    }

    // Update Firebase Auth profile
    await updateProfile(currentUser, { displayName: fullName, photoURL });

    // Update Firestore
    await updateDoc(doc(db, 'users', currentUser.uid), {
      fullName,
      bio,
      photoURL,
    });

    // Update local state
    currentUserData = { ...currentUserData, fullName, bio, photoURL };

    // Update navbar avatar if present
    const navAvatar = document.querySelector('.nav-avatar');
    if (navAvatar) navAvatar.src = photoURL;

    showToast('Profile updated successfully!', 'success');
    if (fileInput) fileInput.value = '';

  } catch (err) {
    console.error('Profile update error:', err);
    showToast('Failed to update profile. Please try again.');
  } finally {
    setLoading(btn, false, orig);
  }
};

// ─── 2. Change Email ──────────────────────────────────────────────────────────

const handleChangeEmail = async () => {
  if (!currentUser) return;

  const newEmail  = el('settings-email')?.value.trim()    || '';
  const password  = el('email-confirm-password')?.value   || '';
  const btn       = el('save-email-btn');
  const orig      = btn?.innerHTML;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    showToast('Please enter a valid email address.');
    return;
  }
  if (!password) {
    showToast('Please enter your current password to confirm.');
    return;
  }
  if (newEmail === currentUser.email) {
    showToast('This is already your current email.', 'info');
    return;
  }

  setLoading(btn, true, orig);

  try {
    // Re-authenticate first (required by Firebase for sensitive ops)
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);

    await updateEmail(currentUser, newEmail);
    await updateDoc(doc(db, 'users', currentUser.uid), { email: newEmail });

    showToast('Email updated successfully!', 'success');
    if (el('email-confirm-password')) el('email-confirm-password').value = '';

  } catch (err) {
    const msgMap = {
      'auth/wrong-password'      : 'Incorrect password.',
      'auth/email-already-in-use': 'This email is already in use.',
      'auth/requires-recent-login': 'Please log out and log back in, then try again.',
    };
    showToast(msgMap[err.code] || 'Failed to update email.');
  } finally {
    setLoading(btn, false, orig);
  }
};

// ─── 3. Change Password ───────────────────────────────────────────────────────

const handleChangePassword = async () => {
  if (!currentUser) return;

  const current  = el('current-password')?.value  || '';
  const newPass  = el('new-password')?.value       || '';
  const confirm  = el('confirm-new-password')?.value || '';
  const btn      = el('save-password-btn');
  const orig     = btn?.innerHTML;

  if (!current) { showToast('Please enter your current password.'); return; }
  if (newPass.length < 6) { showToast('New password must be at least 6 characters.'); return; }
  if (newPass !== confirm) { showToast('New passwords do not match.'); return; }
  if (current === newPass) { showToast('New password must be different from the current one.'); return; }

  setLoading(btn, true, orig);

  try {
    const credential = EmailAuthProvider.credential(currentUser.email, current);
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPass);

    showToast('Password changed successfully!', 'success');
    ['current-password','new-password','confirm-new-password']
      .forEach(id => { const i = el(id); if (i) i.value = ''; });

  } catch (err) {
    const msgMap = {
      'auth/wrong-password'       : 'Current password is incorrect.',
      'auth/requires-recent-login': 'Please log out and log back in, then try again.',
      'auth/weak-password'        : 'Password is too weak. Use at least 6 characters.',
    };
    showToast(msgMap[err.code] || 'Failed to change password.');
  } finally {
    setLoading(btn, false, orig);
  }
};

// ─── 4. Notification Preferences ─────────────────────────────────────────────

const handleSaveNotifications = async () => {
  if (!currentUser) return;

  const btn  = el('save-notif-btn');
  const orig = btn?.innerHTML;
  setLoading(btn, true, orig);

  try {
    await updateDoc(doc(db, 'users', currentUser.uid), {
      notifEmail : el('notif-email')?.checked ?? true,
      notifPush  : el('notif-push')?.checked  ?? true,
    });
    showToast('Notification preferences saved!', 'success');
  } catch (err) {
    console.error('Notif save error:', err);
    showToast('Failed to save preferences.');
  } finally {
    setLoading(btn, false, orig);
  }
};

// ─── 5. Delete Account ────────────────────────────────────────────────────────

const handleDeleteAccount = async () => {
  if (!currentUser) return;

  const confirmed = confirm(
    '⚠️ Are you sure you want to delete your account?\n\n' +
    'This will permanently delete your profile and ALL your articles. ' +
    'This action cannot be undone.'
  );
  if (!confirmed) return;

  const password = prompt('Enter your password to confirm deletion:');
  if (!password) return;

  const btn  = el('delete-account-btn');
  const orig = btn?.innerHTML;
  setLoading(btn, true, orig);

  try {
    // Re-authenticate
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);

    const uid   = currentUser.uid;
    const batch = writeBatch(db);

    // Delete all user's articles
    const articlesSnap = await getDocs(
      query(collection(db, 'articles'), where('authorId', '==', uid))
    );
    articlesSnap.forEach(d => batch.delete(d.ref));

    // Delete user Firestore doc
    batch.delete(doc(db, 'users', uid));

    await batch.commit();

    // Delete Firebase Auth account last
    await deleteUser(currentUser);

    // Clear local storage
    Object.keys(localStorage)
      .filter(k => k.startsWith('readverse_'))
      .forEach(k => localStorage.removeItem(k));

    window.location.href = '../index.html';

  } catch (err) {
    const msgMap = {
      'auth/wrong-password'       : 'Incorrect password. Account not deleted.',
      'auth/requires-recent-login': 'Please log out and log back in, then try again.',
    };
    showToast(msgMap[err.code] || 'Failed to delete account. Please try again.');
    setLoading(btn, false, orig);
  }
};

// ─── Wire up all buttons ──────────────────────────────────────────────────────

const attachHandlers = () => {
  el('save-profile-btn')      ?.addEventListener('click', handleSaveProfile);
  el('save-email-btn')        ?.addEventListener('click', handleChangeEmail);
  el('save-password-btn')     ?.addEventListener('click', handleChangePassword);
  el('save-notif-btn')        ?.addEventListener('click', handleSaveNotifications);
  el('delete-account-btn')    ?.addEventListener('click', handleDeleteAccount);

  initAvatarPreview();
  initThemeToggle();
};

// ─── Auth gate ────────────────────────────────────────────────────────────────

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = './login.html';
    return;
  }

  currentUser = user;

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    currentUserData = snap.exists() ? snap.data() : {};
    populateForm(user, currentUserData);
  } catch (err) {
    console.error('Settings load error:', err);
    showToast('Failed to load your settings.');
  }

  attachHandlers();
});
