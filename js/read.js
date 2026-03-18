// js/read.js

import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const fetchSingleArticle = async () => {
    const articleDisplay = document.getElementById('article-display');
    if (!articleDisplay) return;

    // Get the Article ID from the URL (e.g., read.html?id=12345)
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id');

    if (!articleId) {
        articleDisplay.innerHTML = `<h2 style="text-align:center; color: var(--text-secondary); margin-top: 50px;">Article not found.</h2>`;
        return;
    }

    try {
        // Fetch the specific document from Firestore
        const docRef = doc(db, "articles", articleId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const article = docSnap.data();
            
            // Format Date
            const date = article.createdAt 
                ? article.createdAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) 
                : 'Just now';

            // Change Page Title
            document.title = `${article.title} - ReadVerse`;

            // Inject Real Data
            articleDisplay.innerHTML = `
                <h1 class="read-title">${article.title}</h1>
                
                <div class="read-meta">
                    <div class="author-avatar">
                        <i class="ph ph-user-circle"></i>
                    </div>
                    <div class="author-details">
                        <h4>${article.authorName}</h4>
                        <p>Published on ${date} • <i class="ph ph-eye"></i> ${article.views || 0} Views</p>
                    </div>
                </div>

                <div class="read-content">
                    ${article.content}
                </div>
                
                <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid var(--border-color); display: flex; gap: 20px; color: var(--text-secondary);">
                    <button style="background: none; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <i class="ph ph-heart"></i> <span style="font-size: 1rem;">Like</span>
                    </button>
                    <button style="background: none; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <i class="ph ph-bookmark-simple"></i> <span style="font-size: 1rem;">Save</span>
                    </button>
                </div>
            `;
        } else {
            // Document doesn't exist
            articleDisplay.innerHTML = `<h2 style="text-align:center; color: var(--text-secondary); margin-top: 50px;">This article has been removed or does not exist.</h2>`;
        }
    } catch (error) {
        console.error("Error fetching document:", error);
        articleDisplay.innerHTML = `<h2 style="text-align:center; color: #DC2626; margin-top: 50px;">Error loading the article.</h2>`;
    }
};

// Run when page loads
document.addEventListener('DOMContentLoaded', fetchSingleArticle);
