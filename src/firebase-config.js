import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Paste your exact config object from the Firebase Console here:
const firebaseConfig = {
  apiKey: "AIzaSyDBu4LSAgS2eeFs80-bOdUxqjCq-65Sc1c",
  authDomain: "itim-25e74.firebaseapp.com",
  projectId: "itim-25e74",
  storageBucket: "itim-25e74.firebasestorage.app",
  messagingSenderId: "573113034050",
  appId: "1:573113034050:web:2493de8ca011efa04794db"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the services so we can use them in other files
export const auth = getAuth(app);
export const db = getFirestore(app);