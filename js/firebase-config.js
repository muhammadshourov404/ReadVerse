// js/firebase-config.js

// Firebase SDKs from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBsgb371yoKozq4RjvCErLkmTMJUPyoh6s",
  authDomain: "readverse-ac7d9.firebaseapp.com",
  projectId: "readverse-ac7d9",
  storageBucket: "readverse-ac7d9.firebasestorage.app",
  messagingSenderId: "914094357959",
  appId: "1:914094357959:web:d0b7be0a166a07e4faede2",
  measurementId: "G-J70TBW0WXK"
};

// Initialize Firebase App, Auth, and Firestore
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("Firebase Master Connection Successful!");
