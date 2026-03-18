// js/components.js

const renderNavbar = () => {
    // 🚀 MAGIC: Determine if the user is currently inside the 'pages' directory
    const currentPath = window.location.pathname;
    const inPagesFolder = currentPath.includes('/pages/');

    // Set the dynamic paths based on where this navbar is being rendered
    const homePath = inPagesFolder ? '../index.html' : './index.html';
    const pagesPrefix = inPagesFolder ? '.' : './pages';

    const navbarHTML = `
        <header style="background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); padding: 15px 0; position: sticky; top: 0; z-index: 100;">
            <div class="container" style="display: flex; justify-content: space-between; align-items: center;">
                <a href="${homePath}" style="text-decoration: none; color: var(--text-primary); display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 1.2rem;">
                    <i class="ph ph-book-open-text" style="color: var(--accent-color); font-size: 1.8rem;"></i>
                    <span>ReadVerse</span>
                </a>
                
                <div style="display: flex; gap: 20px; align-items: center;">
                    <a href="${pagesPrefix}/explore.html" style="text-decoration: none; color: var(--text-secondary); display: flex; align-items: center; gap: 5px; font-weight: 500;">
                        <i class="ph ph-compass"></i> Explore
                    </a>
                    <a href="${pagesPrefix}/write.html" style="text-decoration: none; color: var(--text-secondary); display: flex; align-items: center; gap: 5px; font-weight: 500;">
                        <i class="ph ph-pen-nib"></i> Write
                    </a>
                    <a href="${pagesPrefix}/login.html" style="background: var(--accent-color); color: white; padding: 8px 16px; border-radius: var(--radius-md); text-decoration: none; font-weight: 500; display: flex; align-items: center; gap: 5px;">
                        <i class="ph ph-sign-in"></i> Sign In
                    </a>
                </div>
            </div>
        </header>
    `;
    
    // Find the placeholder in HTML and inject the Navbar
    const navPlaceholder = document.getElementById('navbar-placeholder');
    if(navPlaceholder) {
        navPlaceholder.innerHTML = navbarHTML;
    }
};

// Run the function when the page loads
document.addEventListener('DOMContentLoaded', renderNavbar);
