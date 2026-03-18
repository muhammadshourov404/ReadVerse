// js/write.js

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let currentUser = null;
let currentUserName = "Anonymous";

// ==========================================
// 1. Check Authentication & Get User Name
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                currentUserName = userDoc.data().fullName;
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    } else {
        // Silently redirect for better UX (Removed alert)
        window.location.href = "login.html";
    }
});

// ==========================================
// 2. Text Editor Formatting Logic
// ==========================================
const formatButtons = document.querySelectorAll('.format-btn');
const articleContent = document.getElementById('article-content');

if (formatButtons && articleContent) {
    formatButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default button behavior
            const command = btn.getAttribute('data-command');
            const value = btn.getAttribute('data-value') || null;
            
            // Execute the formatting command
            document.execCommand(command, false, value);
            articleContent.focus(); // Keep focus on the editor
        });
    });
}

// ==========================================
// 3. Real-time "Auto-save" Status UX
// ==========================================
const saveStatus = document.getElementById('save-status');
let typingTimer;

if (articleContent && saveStatus) {
    articleContent.addEventListener('input', () => {
        saveStatus.style.opacity = '1';
        saveStatus.innerText = 'Draft saving...';
        
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            saveStatus.innerText = 'Draft saved';
            // Hide the status after 2 seconds
            setTimeout(() => { saveStatus.style.opacity = '0'; }, 2000);
        }, 1000); // Wait 1 second after user stops typing
    });
}

// ==========================================
// 4. Publish Logic
// ==========================================
const publishBtn = document.getElementById('publish-btn');
if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
        const title = document.getElementById('article-title').value.trim();
        const content = articleContent.innerHTML.trim();

        // Validation
        if (!title || content === "" || content === "<br>") {
            alert("Please enter both a title and some content before publishing.");
            return;
        }

        // Show loading state
        const originalText = publishBtn.innerHTML;
        publishBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Publishing...';
        publishBtn.disabled = true;

        try {
            // Save Article to Firestore
            await addDoc(collection(db, "articles"), {
                title: title,
                content: content,
                authorId: currentUser.uid,
                authorName: currentUserName,
                createdAt: serverTimestamp(),
                views: 0,
                likes: 0
            });

            // Redirect to dashboard after success
            window.location.href = "dashboard.html"; 
            
        } catch (error) {
            alert("Error publishing article: " + error.message);
            publishBtn.innerHTML = originalText;
            publishBtn.disabled = false;
        }
    });
}
