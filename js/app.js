// js/app.js

import { db } from "./firebase-config.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Function to remove HTML tags (like <b>, <i>) for the clean preview text
const stripHtml = (html) => {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
};

const fetchArticles = async () => {
    // This is where our real articles will replace the skeleton loading
    const articlesGrid = document.getElementById('articles-grid');
    if(!articlesGrid) return;

    try {
        // Fetch articles from newest to oldest
        const q = query(collection(db, "articles"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        // If no articles exist in database
        if (querySnapshot.empty) {
            articlesGrid.innerHTML = `
                <div style="text-align: center; grid-column: 1 / -1; padding: 50px; border: 1px dashed var(--border-color); border-radius: var(--radius-lg);">
                    <i class="ph ph-empty" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 10px;"></i>
                    <p style="color: var(--text-secondary);">No articles published yet. Be the first to write!</p>
                </div>
            `;
            return;
        }

        let html = "";
        
        // Loop through each article and generate HTML card
        querySnapshot.forEach((doc) => {
            const article = doc.data();
            
            // Format Date (e.g., "Oct 15, 2024")
            const date = article.createdAt 
                ? article.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
                : 'Just now';
            
            const previewText = stripHtml(article.content);

            // 🚀 FIXED: Removed the leading slash (/) from href links
            html += `
                <div class="article-card">
                    <div class="article-meta">
                        <i class="ph ph-user-circle" style="font-size: 1.2rem;"></i>
                        <span>${article.authorName}</span>
                        <span>•</span>
                        <span>${date}</span>
                    </div>
                    <a href="pages/read.html?id=${doc.id}" class="article-title">${article.title}</a>
                    <p class="article-preview">${previewText}</p>
                    <a href="pages/read.html?id=${doc.id}" class="read-more-btn">
                        Read Article <i class="ph ph-arrow-right"></i>
                    </a>
                </div>
            `;
        });

        // Inject the real cards into the HTML, replacing the skeleton
        articlesGrid.innerHTML = html;

    } catch(error) {
        console.error("Error fetching articles: ", error);
        articlesGrid.innerHTML = `<p style="color: #DC2626; text-align: center;">Error loading articles. Please try again.</p>`;
    }
};

// Run the function when the page loads
document.addEventListener('DOMContentLoaded', fetchArticles);
