import { auth, db } from './firebase-config.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let stateRef = null;
const STORAGE_KEY = 'itim_app_state';

export function initPersistence(AppState) {
    stateRef = AppState;
}

// Helper to grab only the user-customized state data
function extractSavableState() {
    return {
        bookSequence: stateRef.bookSequence,
        manualOverrides: stateRef.manualOverrides,
        userSettings: stateRef.userSettings,
        trackSettings: stateRef.trackSettings
    };
}

/* 
    LocalStorage logic
*/

// ONLY saves to LocalStorage
export function saveToLocalStorage() {
    const stateToSave = extractSavableState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
}

export function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        applyParsedState(JSON.parse(saved));
        console.log("State restored successfully from localStorage");
    } catch (e) {
        console.error("Error loading state from localStorage:", e);
    }
}

// Helper to map parsed JSON data onto the active AppState references
function applyParsedState(parsed) {
    stateRef.bookSequence = parsed.bookSequence || [];
    stateRef.manualOverrides = parsed.manualOverrides || {};
    if (parsed.userSettings) {
        stateRef.userSettings = { ...stateRef.userSettings, ...parsed.userSettings };
    }

    if (parsed.trackSettings) {
        stateRef.trackSettings = { ...stateRef.trackSettings, ...parsed.trackSettings };
    }
}

/* 
    Firebase Cloud Sync Logic
*/

// Push local state data up to Firestore
export async function saveToFirebase() {
    const user = auth.currentUser;
    if (!user) return; // Silent return if guest user

    try {
        const stateToSave = extractSavableState();
        await setDoc(doc(db, "users", user.uid), {
            userData: stateToSave,
            lastSynced: new Date().toISOString()
        });
        console.log("State successfully synchronized with Firestore cloud.");
    } catch (error) {
        console.error("Failed to sync state to Firestore:", error);
    }
}

// Fetch cloud state and override local state
export async function loadFromFirebase() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const cloudData = docSnap.data().userData;
            if (cloudData) {
                // 1. Apply to active runtime state
                applyParsedState(cloudData);
                // 2. Mirror it to local storage for offline PWA capabilities
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData));
                console.log("State synchronized from Firestore cloud successfully.");
                return true; 
            }
        }
    } catch (error) {
        console.error("Failed to fetch state from Firestore:", error);
    }
    return false;
}

/*
    Combined Master Saving Logic (The "Ultimate" Default)
*/
export async function saveState() {
    // 1. Save locally instantly for rapid UI responsiveness
    saveToLocalStorage();

    // 2. Automatically try to back up to the cloud if a user is logged in
    if (auth.currentUser) {
        await saveToFirebase();
    }
}

/* 
    Backup Logic
*/
export function exportStateBackup() {
    if (!stateRef) return;
    const dataToBackup = extractSavableState();

    const jsonString = JSON.stringify(dataToBackup, null, 4);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = `גיבוי_עיתים_${new Date().toISOString().split('T')[0]}.json`;

    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
}

export function importStateBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const parsed = JSON.parse(e.target.result);

            if (!parsed.userSettings && !parsed.trackSettings && !parsed.bookSequence && !parsed.manualOverrides) {
                throw new Error("קובץ הגיבוי אינו תואם או פגום.");
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            applyParsedState(parsed);

            // Utilizing the split Firebase logic cleanly here
            if (auth.currentUser) {
                await saveToFirebase();
            }

            alert("הגיבוי נטען בהצלחה! העמוד יתרענן כעת.");
            window.location.reload();

        } catch (err) {
            alert("שגיאה בטעינת קובץ הגיבוי: " + err.message);
        }
    };
    reader.readAsText(file);
}