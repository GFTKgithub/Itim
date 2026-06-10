import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth, db } from '../firebase-config.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Register a new user to Firebase
export async function registerUser(email, password, nickname) {
    // 1. Create the Auth Account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Initialize their Firestore Document
    await setDoc(doc(db, "users", user.uid), {
        email: email,
        username: nickname,
        registeredAt: new Date().toISOString()
    }, { merge: true });

    return user;
}

// Log in an existing user
export async function loginUser(email, password) {
    return await signInWithEmailAndPassword(auth, email, password);
}

// Log out the current user
export async function logoutUser() {
    return await signOut(auth);
}

// Listen for auth state changes and trigger a callback with the user's email
export function initAuthListener(onUserChanged) {
    onAuthStateChanged(auth, (user) => {
        const userEmail = user ? user.email : null;
        onUserChanged(userEmail);
    });
}