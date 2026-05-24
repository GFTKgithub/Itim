



/* 
    LocalStorage logic
*/

const STORAGE_KEY = 'itim_app_state';

// Saves user-configurable data from AppState to localStorage
export function saveToLocalStorage() {
    const stateToSave = {
        trackSequence: AppState.trackSequence,
        manualOverrides: AppState.manualOverrides,
        userSettings: AppState.userSettings
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
}

// Loads user-configurable data from localStorage to AppState
export function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;

        const parsed = JSON.parse(saved);

        // Use logical OR (||) fallbacks to ensure arrays/objects stay initialized
        AppState.trackSequence = parsed.trackSequence || [];
        AppState.manualOverrides = parsed.manualOverrides || {};

        if (parsed.userSettings) {
            AppState.userSettings = { ...AppState.userSettings, ...parsed.userSettings };
        }
        console.log("State restored successfully from localStorage");
    } catch (e) {
        console.error("Error loading state from localStorage:", e);
    }
}
