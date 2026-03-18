// js/auth.js
import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Path-safe redirect — works from both /pages/ and root
const redirectToDashboard = () => {
  const inPages = window.location.pathname.includes('/pages/');
  window.location.href = inPages ? './dashboard.html' : './pages/dashboard.html';
};

// Show inline error inside the form
const showError = (formEl, message) => {
  let box = formEl.querySelector('.auth-error');
  if (!box) {
    box = document.createElement('p');
    box.className = 'auth-error';
    formEl.prepend(box);
  }
  box.textContent = message;
  box.style.display = 'block';
};

const clearError = (formEl) => {
  const box = formEl.querySelector('.auth-error');
  if (box) box.style.display = 'none';
};

// Human-readable Firebase error messages
const friendlyError = (code) => {
  const map = {
    'auth/email-already-in-use'   : 'This email is already registered. Try logging in.',
    'auth/invalid-email'          : 'Please enter a valid email address.',
    'auth/weak-password'          : 'Password must be at least 6 characters.',
    'auth/user-not-found'         : 'No account found with this email.',
    'auth/wrong-password'         : 'Incorrect password. Please try again.',
    'auth/too-many-requests'      : 'Too many attempts. Please wait a moment.',
    'auth/popup-closed-by-user'   : 'Google sign-in was cancelled.',
    'auth/network-request-failed' : 'Network error. Check your connection.',
  };
  return map[code] || 'Something went wrong. Please try again.';
};

// Disable / enable submit button
const setLoading = (btn, loading, originalHTML) => {
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<i class="ph ph-spinner ph-spin"></i> Please wait…'
    : originalHTML;
};

// Validate signup fields before touching Firebase
const validateSignup = (fullname, email, password, confirm) => {
  if (!fullname.trim() || fullname.trim().length < 2)
    return 'Please enter your full name (at least 2 characters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return 'Please enter a valid email address.';
  if (password.length < 6)
    return 'Password must be at least 6 characters.';
  if (password !== confirm)
    return 'Passwords do not match.';
  return null; // no error
};

// Create or update Firestore user document (used for both email & Google)
const ensureUserDoc = async (user, extraData = {}) => {
  const ref  = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      fullName      : user.displayName || extraData.fullName || 'Anonymous',
      email         : user.email,
      photoURL      : user.photoURL    || '',
      bio           : '',
      role          : 'user',
      followers     : 0,
      following     : 0,
      articlesCount : 0,
      joinedAt      : serverTimestamp(),
      ...extraData,
    });
  }
};

// ─── 1. Sign Up ───────────────────────────────────────────────────────────────

const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError(signupForm);

    const fullname = document.getElementById('fullname').value.trim();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm  = document.getElementById('confirm-password')?.value || password;

    // Client-side validation first — no Firebase call needed
    const validationError = validateSignup(fullname, email, password, confirm);
    if (validationError) { showError(signupForm, validationError); return; }

    const btn = signupForm.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    setLoading(btn, true, orig);

    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);

      // Set displayName on Firebase Auth profile
      await updateProfile(user, { displayName: fullname });

      // Save full profile to Firestore
      await ensureUserDoc(user, { fullName: fullname });

      redirectToDashboard();
    } catch (err) {
      showError(signupForm, friendlyError(err.code));
      setLoading(btn, false, orig);
    }
  });
}

// ─── 2. Log In ────────────────────────────────────────────────────────────────

const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError(loginForm);

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showError(loginForm, 'Please enter your email and password.');
      return;
    }

    const btn = loginForm.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    setLoading(btn, true, orig);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      redirectToDashboard();
    } catch (err) {
      showError(loginForm, friendlyError(err.code));
      setLoading(btn, false, orig);
    }
  });
}

// ─── 3. Google Sign-In (works for both login & signup pages) ─────────────────

const googleBtns = document.querySelectorAll('.google-signin-btn');
googleBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    const orig = btn.innerHTML;
    setLoading(btn, true, orig);

    try {
      const provider = new GoogleAuthProvider();
      const { user }  = await signInWithPopup(auth, provider);

      // Create Firestore doc only if first time
      await ensureUserDoc(user);

      redirectToDashboard();
    } catch (err) {
      // Show error near whichever form is on this page
      const form = document.querySelector('form');
      if (form) showError(form, friendlyError(err.code));
      setLoading(btn, false, orig);
    }
  });
});
