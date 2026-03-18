// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsgb371yoKozq4RjvCErLkmTMJUPyoh6s",
  authDomain: "readverse-ac7d9.firebaseapp.com",
  projectId: "readverse-ac7d9",
  storageBucket: "readverse-ac7d9.firebasestorage.app",
  messagingSenderId: "914094357959",
  appId: "1:914094357959:web:d0b7be0a166a07e4faede2",
  measurementId: "G-J70TBW0WXK"
};

// Initialize Firebase
let app, auth, db, storage, analytics;

try {
  app       = initializeApp(firebaseConfig);
  auth      = getAuth(app);
  db        = getFirestore(app);
  storage   = getStorage(app);
  analytics = getAnalytics(app);

  // Auth persistence — page reload-এ user logout হবে না
  await setPersistence(auth, browserLocalPersistence);

} catch (error) {
  console.error("Firebase initialization failed:", error.message);
}

export { auth, db, storage, analytics };
