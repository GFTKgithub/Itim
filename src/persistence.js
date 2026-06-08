import { auth, db } from './firebase-config.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { getActiveTrack } from './track.js';


let stateRef = null;
let tracksRef = [];

const STORAGE_KEY = 'itim_app_state';

export function initPersistence(AppState, tracks) {
    stateRef = AppState;
    tracksRef = tracks;
}

// Helper to grab only the user-affected state data for LocalStorage
function extractSavableStateForLocalStorage() {
    return {
        userPreferences: stateRef.userPreferences,
        activeTrackId: stateRef.activeTrackId,
        tracks: tracksRef
    };
}

// Helper to grab only the user-affected state data for Cloud storage
function extractSavableStateForFirebase() {
    const { syncUserPreferences: syncEnabled, ...cloudPreferences } = stateRef?.userPreferences || {};

    const payload = {
        activeTrackId: stateRef.activeTrackId ?? null,
        tracks: tracksRef || []
    };

    // If syncing is enabled locally, attach the stripped preferences to the payload
    if (syncEnabled) {
        payload.userPreferences = cloudPreferences;
    }

    return payload;
}

/* 
    LocalStorage logic
*/

// ONLY saves to LocalStorage
export async function saveToLocalStorage() {
    const stateToSave = extractSavableStateForLocalStorage();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
}

export async function loadFromLocalStorage() {
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
    if (!parsed) return;

    // Fallback missing userPreferences to an empty object to prevent downstream crashes
    const safeParsed = {
        ...parsed,
        userPreferences: parsed.userPreferences || {}
    };

    const parsedTracks = safeParsed.tracks || [];
    
    // Pass the safe parsed object with guaranteed userPreferences block
    const parsedActiveTrack = getActiveTrack(safeParsed, parsedTracks);

    if (parsedActiveTrack) {
        // 1. Force the global AppState references to update cleanly
        stateRef.activeTrackId = safeParsed.activeTrackId;
        
        // 2. Clear out the old track data without breaking the array reference
        tracksRef.length = 0; 
        parsedTracks.forEach(track => {
            tracksRef.push(track);
        });

        // 3. Handle global user preferences safely
        stateRef.userPreferences = { 
            ...stateRef.userPreferences, 
            ...safeParsed.userPreferences 
        };
    } else {
        console.warn("No active track found in the parsed data.");
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
        const stateToSave = extractSavableStateForFirebase();
        await setDoc(doc(db, "users", user.uid), {
            userData: stateToSave,
            lastSynced: new Date().toISOString()
        }, { merge: true });         
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
    await saveToLocalStorage();

    // 2. Automatically try to back up to the cloud if a user is logged in
    if (auth.currentUser) {
        await saveToFirebase();
    }
}

/* 
    Backup Logic
*/
export async function exportStateBackup() {
    if (!stateRef) return;
    const dataToBackup = extractSavableStateForLocalStorage();

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

export async function importStateBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const parsed = JSON.parse(e.target.result);

            if (!parsed.userPreferences && !parsed.trackSettings && !parsed.bookSequence && !parsed.studyStatusOverrides) {
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