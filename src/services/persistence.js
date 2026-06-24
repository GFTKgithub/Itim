import { auth, db } from '../firebase-config.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { getActiveTrack } from '../core/track.js';

let stateRef = null;
let tracksRef = [];
let hydrateTrackFn = null;

const STORAGE_KEY = 'itim_app_state';

export function initPersistence(AppState, tracks, trackHydrator) {
    stateRef = AppState;
    tracksRef = tracks;
    hydrateTrackFn = trackHydrator;
}

// Helper to strip ONLY studySchedule, keeping the other configuration arguments intact
function minimizeTracks(tracks) {
    return (tracks || []).map(track => {
        // Extract studySchedule out, and bundle everything else into leanTrack
        const { studySchedule, calendarEvents, ...leanTrack } = track;
        return leanTrack; 
    });
}

// Helper to grab only the user-affected state data for LocalStorage
function extractSavableStateForLocalStorage() {
    return {
        userPreferences: stateRef.userPreferences,
        activeTrackId: stateRef.activeTrackId,
        tracks: minimizeTracks(tracksRef)
    };
}

// Helper to grab only the user-affected state data for Cloud storage
function extractSavableStateForFirebase() {
    const { syncUserPreferences: syncEnabled, ...cloudPreferences } = stateRef?.userPreferences || {};

    const payload = {
        activeTrackId: stateRef.activeTrackId ?? null,
        tracks: minimizeTracks(tracksRef)
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
        await applyParsedState(JSON.parse(saved));
        console.log("State restored successfully from localStorage");
    } catch (e) {
        console.error("Error loading state from localStorage:", e);
    }
}

// Helper to map parsed JSON data onto the active AppState references
async function applyParsedState(parsed) {
    if (!parsed) return;

    const safeParsed = {
        ...parsed,
        userPreferences: parsed.userPreferences || {}
    };

    const leanTracks = safeParsed.tracks || [];
    
    // Process every track using the rule given to us by our main application environment
    const hydratedTracks = await Promise.all(leanTracks.map(async (track) => {
        if (typeof hydrateTrackFn === 'function') {
            try {
                // Execute whatever custom function was injected
                return await hydrateTrackFn(track); 
            } catch (err) {
                console.error("Error hydrating track via injected function:", err);
            }
        }
        // Fallback profile if no hydrator was passed or if it failed
        return { ...track, calendarEvents: {}, studySchedule: [] };
    }));
    
    const parsedActiveTrack = getActiveTrack(safeParsed, hydratedTracks);

    if (parsedActiveTrack) {
        stateRef.activeTrackId = safeParsed.activeTrackId;
        
        // Push fully complete data back into runtime memory pointers cleanly
        tracksRef.length = 0; 
        hydratedTracks.forEach(track => {
            tracksRef.push(track);
        });

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
    if (!user) return;

    try {
        const rawState = extractSavableStateForFirebase();
        
        // This strips away any 'undefined' properties that the bad commit created
        const stateToSave = removeUndefinedFields(rawState);

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
                await applyParsedState(cloudData);
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

// A recursive cleaning machine that deletes any 'undefined' keys before Firebase sees them
function removeUndefinedFields(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    
    // If it's an array, clean every item inside it
    if (Array.isArray(obj)) {
        return obj.map(item => removeUndefinedFields(item));
    }
    
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            // Recursively clean nested objects/arrays, fallback to null if blank
            cleaned[key] = typeof value === 'object' ? removeUndefinedFields(value) : value;
        }
    }
    return cleaned;
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

            if (!parsed.userPreferences && !parsed.settings && !parsed.bookSequence && !parsed.studyStatusOverrides) {
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