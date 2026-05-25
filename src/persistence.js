let stateRef = null;

export function initPersistence(AppState) {
    stateRef = AppState;
}

/* 
    LocalStorage logic
*/

const STORAGE_KEY = 'itim_app_state';

// Saves user-configurable data from AppState (stateRef) to localStorage
export function saveToLocalStorage() {
    const stateToSave = {
        trackSequence: stateRef.trackSequence,
        manualOverrides: stateRef.manualOverrides,
        userSettings: stateRef.userSettings
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
}

// Loads user-configurable data from localStorage to AppState (stateRef)
export function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;

        const parsed = JSON.parse(saved);

        // Use logical OR (||) fallbacks to ensure arrays/objects stay initialized
        stateRef.trackSequence = parsed.trackSequence || [];
        stateRef.manualOverrides = parsed.manualOverrides || {};

        if (parsed.userSettings) {
            stateRef.userSettings = { ...stateRef.userSettings, ...parsed.userSettings };
        }
        console.log("State restored successfully from localStorage");
    } catch (e) {
        console.error("Error loading state from localStorage:", e);
    }
}

/* 
    Backup Logic
*/

// Export app state to a JSON file
export function exportStateBackup() {
    if (!stateRef) return;
    const dataToBackup = {
        trackSequence: stateRef.trackSequence,
        manualOverrides: stateRef.manualOverrides,
        userSettings: stateRef.userSettings
    };

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

// Import app state from a JSON file
export function importStateBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const parsed = JSON.parse(e.target.result);

            if (!parsed.trackSequence && !parsed.userSettings && !parsed.manualOverrides) {
                throw new Error("קובץ הגיבוי אינו תואם או פגום.");
            }

            // 1. Save to localStorage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));

            // 2. Sync the in-memory stateRef
            stateRef.trackSequence = Array.isArray(parsed.trackSequence) ? parsed.trackSequence : [];
            stateRef.manualOverrides = parsed.manualOverrides || {};
            if (parsed.userSettings) {
                stateRef.userSettings = { ...stateRef.userSettings, ...parsed.userSettings };
            }

            alert("הגיבוי נטען בהצלחה! העמוד יתרענן כעת.");
            window.location.reload();

        } catch (err) {
            alert("שגיאה בטעינת קובץ הגיבוי: " + err.message);
        }
    };
    reader.readAsText(file);
}