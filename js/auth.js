// js/auth.js

// Import Firebase dependencies
import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==============================
// 1. Handle Sign Up
// ==============================
const signupForm = document.getElementById('signup-form');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent page reload
        
        // Show loading state on button
        const btn = signupForm.querySelector('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Creating Account...';

        // Get user inputs
        const fullname = document.getElementById('fullname').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            // Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save user profile details in Firestore Database
            await setDoc(doc(db, "users", user.uid), {
                fullName: fullname,
                email: email,
                role: "user",
                joinedAt: serverTimestamp()
            });

            // Redirect to dashboard (No annoying alerts needed for smooth UX)
            window.location.href = "dashboard.html"; 
            
        } catch (error) {
            alert("Error: " + error.message);
            btn.innerHTML = originalText; // Reset button text
        }
    });
}

// ==============================
// 2. Handle Log In
// ==============================
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = loginForm.querySelector('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Logging in...';

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = "dashboard.html"; // Redirect to dashboard
            
        } catch (error) {
            alert("Error: Invalid Email or Password.");
            btn.innerHTML = originalText;
        }
    });
}
