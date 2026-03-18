// js/components.js
import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Path helper — works on localhost, GitHub Pages, and custom domains
const getPrefix = () => {
  const inPages = window.location.pathname.includes('/pages/');
  return {
    home:  inPages ? '../index.html'  : './index.html',
    pages: inPages ? '.'              : './pages',
  };
};

// ─── Navbar HTML builders ───────────────────────────────────────────────────

const guestNav = (p) => `
  <a href="${p.pages}/explore.html" class="nav-link">
    <i class="ph ph-compass"></i> Explore
  </a>
  <a href="${p.pages}/write.html" class="nav-link">
    <i class="ph ph-pen-nib"></i> Write
  </a>
  <a href="${p.pages}/login.html" class="btn-primary nav-cta">
    <i class="ph ph-sign-in"></i> Sign In
  </a>
`;

const authNav = (p, user) => `
  <a href="${p.pages}/explore.html" class="nav-link">
    <i class="ph ph-compass"></i> Explore
  </a>
  <a href="${p.pages}/write.html" class="nav-link">
    <i class="ph ph-pen-nib"></i> Write
  </a>
  <a href="${p.pages}/notifications.html" class="nav-link nav-icon" title="Notifications">
    <i class="ph ph-bell"></i>
  </a>
  <a href="${p.pages}/bookmarks.html" class="nav-link nav-icon" title="Bookmarks">
    <i class="ph ph-bookmarks"></i>
  </a>
  <div class="nav-profile-menu">
    <img
      src="${user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=random`}"
      alt="Profile"
      class="nav-avatar"
      id="nav-avatar-btn"
    />
    <div class="nav-dropdown" id="nav-dropdown">
      <a href="${p.pages}/dashboard.html"><i class="ph ph-layout"></i> Dashboard</a>
      <a href="${p.pages}/profile.html"><i class="ph ph-user"></i> Profile</a>
      <a href="${p.pages}/settings.html"><i class="ph ph-gear"></i> Settings</a>
      <a href="${p.pages}/membership.html"><i class="ph ph-crown"></i> Membership</a>
      <hr/>
      <button id="logout-btn"><i class="ph ph-sign-out"></i> Sign Out</button>
    </div>
  </div>
`;

// ─── Main render function ────────────────────────────────────────────────────

const renderNavbar = () => {
  const placeholder = document.getElementById('navbar-placeholder');
  if (!placeholder) return;

  const p = getPrefix();

  // Inject structure immediately (avoids layout shift)
  placeholder.innerHTML = `
    <header class="site-header">
      <div class="container navbar-inner">
        <a href="${p.home}" class="nav-brand">
          <i class="ph ph-book-open-text"></i>
          <span>ReadVerse</span>
        </a>

        <!-- Desktop nav -->
        <nav class="nav-links" id="nav-links"></nav>

        <!-- Mobile hamburger -->
        <button class="nav-hamburger" id="nav-hamburger" aria-label="Toggle menu">
          <i class="ph ph-list"></i>
        </button>
      </div>

      <!-- Mobile drawer -->
      <div class="nav-mobile-drawer" id="nav-mobile-drawer"></div>
    </header>
  `;

  // Highlight active page link
  const setActiveLinks = () => {
    placeholder.querySelectorAll('a.nav-link').forEach(link => {
      const isCurrent = link.href === window.location.href ||
                        window.location.pathname.endsWith(link.getAttribute('href')?.split('/').pop());
      link.classList.toggle('active', isCurrent);
    });
  };

  // Auth state — fills nav with correct version
  onAuthStateChanged(auth, (user) => {
    const navContent = user ? authNav(p, user) : guestNav(p);
    const linksEl   = placeholder.querySelector('#nav-links');
    const drawerEl  = placeholder.querySelector('#nav-mobile-drawer');

    if (linksEl)  linksEl.innerHTML  = navContent;
    if (drawerEl) drawerEl.innerHTML = navContent; // mobile mirror

    setActiveLinks();

    // Profile dropdown toggle
    const avatarBtn  = placeholder.querySelector('#nav-avatar-btn');
    const dropdown   = placeholder.querySelector('#nav-dropdown');
    if (avatarBtn && dropdown) {
      avatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });
      document.addEventListener('click', () => dropdown.classList.remove('open'));
    }

    // Logout
    const logoutBtn = placeholder.querySelector('#logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await signOut(auth);
          window.location.href = p.home;
        } catch (err) {
          console.error("Logout failed:", err.message);
        }
      });
    }
  });

  // Mobile hamburger toggle
  const hamburger = placeholder.querySelector('#nav-hamburger');
  const drawer    = placeholder.querySelector('#nav-mobile-drawer');
  if (hamburger && drawer) {
    hamburger.addEventListener('click', () => drawer.classList.toggle('open'));
  }
};

document.addEventListener('DOMContentLoaded', renderNavbar);
