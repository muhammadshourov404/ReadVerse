// js/dashboard.js

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Check if user is logged in
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in, fetch their data from Firestore
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                
                // Update Welcome Banner
                const welcomeSection = document.getElementById('welcome-section');
                welcomeSection.innerHTML = `
                    <div>
                        <h2>Welcome back, ${userData.fullName}!</h2>
                        <p>Ready to write something amazing today?</p>
                    </div>
                    <i class="ph ph-rocket-launch" style="font-size: 3rem; opacity: 0.8;"></i>
                `;
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    } else {
        // User is not signed in, redirect to login page
        window.location.href = "login.html";
    }
});

// Logout Logic
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            window.location.href = "login.html";
        } catch (error) {
            alert("Error logging out.");
        }
    });
}
