import { masechtot } from './data.js';
import { hydrateHtmlFromAppState, toggleInputs, updateTrackSequenceUI, renderAmudGrid, renderDailyView, updateModalProgressStats, renderDateLabels, renderCalendar, showDialog } from './ui.js';
import { addToSequence, removeFromSequence, clearSequence } from './track-sequence.js';
import { generateSchedule, cycleDateOverride } from './scheduler.js';
import { initPersistence, saveState, loadFromLocalStorage, exportStateBackup, importStateBackup } from './persistence.js';
import { exportScheduleToExcel } from './excel-export.js';

import {
    setupMainControls,
    setupBackupManagement,
    setupSettings,
    setupTrackSequenceDragAndDrop,
    setupBookConfigModal,
    setupCloudAuth
} from './setup.js';

// Firebase
import { auth } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { loadFromFirebase, saveToFirebase } from './persistence.js';

const DEFAULT_USER_SETTINGS = {
    method: 'pace',
    pace: 1,
    breakDays: 0,
    startDate: new Date().toISOString().split('T')[0],
    targetDate: '',
    startDaf: 'ב',
    startAmud: 'א',
    studyDays: [0, 1, 2, 3, 4, 5], // Default: Sun-Fri (0-5), Shabbat (6) excluded
    includeHolidays: false,
    calendarType: 'hebrew'
}

let AppState = {
    trackSequence: [],      // Masechet sequence list
    schedule: [],           // Data of the entire schedule
    manualOverrides: {},    // Manual overrides of calendar days study status (0 = Default, 1 = Force Break, 2 = Force Study)
    calendarData: {},       // Data of special calendar events (DD.YY.MM)
    userSettings: { ...DEFAULT_USER_SETTINGS }       // User Settings (with default values)
}

let currentEditingIndex = null;
let tempAmudStates = [];
let currentDaySlots = [];   // Pre-computed per-day amud ranges for the currently open masechet
let isBunchedView = false;

/* 
    Page initiation logic
*/

function initializeApp() {
    setupMainControls({
        onGenerate: handleScheduleGeneration,
        onAddToSequence: () => { 
            AppState.trackSequence = addToSequence(AppState.trackSequence);
            saveState();
        },
        onClearSequence: async () => {
            AppState.trackSequence = await clearSequence(AppState.trackSequence);
            saveState();
            handleScheduleGeneration();
        },
        onExportExcel: exportScheduleToExcel(AppState.schedule)
    });

    setupBackupManagement({
        onExport: exportStateBackup,
        onImport: importStateBackup,
        onResetSettings: handleResetSettings,
        onResetManualOverrides: handleResetManualOverrides
    });

    setupSettings({
        onUpdateSetting: handleUpdateSetting,
        onGenerate: handleScheduleGeneration,
        onToggleInputs: toggleInputs,
        onRenderDateLabels: renderDateLabels,
        onSyncToToday: handleSyncToToday
    });

    setupTrackSequenceDragAndDrop({
        onRemove: (indexToRemove) => {
            AppState.trackSequence = removeFromSequence(AppState.trackSequence, indexToRemove);
            saveState();
            updateTrackSequenceUI(AppState.trackSequence); // Make sure the layout stays synced
        },
        onReorder: handleTrackReorder
    });

    setupBookConfigModal({
        // Pass global data down so the function can read it safely
        getTrackSequence: () => AppState.trackSequence,
        getSchedule: () => AppState.schedule,

        // Helper logic functions (temporary)
        computeDaySlots: computeDaySlots,
        renderAmudGrid: renderAmudGrid,              // Pass it down
        renderDailyView: renderDailyView,            // Pass it down
        updateModalProgressStats: updateModalProgressStats, // Pass it down

        // Handle the data adjustments and app side-effects here
        onSaveConfig: ({ index, reviewDays, amudStates }) => {
            let masechet = AppState.trackSequence[index];
            if (typeof masechet === 'string') {
                masechet = { name: masechet, reviewDays: 0, amudStates: [] };
            }
            
            masechet.reviewDays = reviewDays;
            masechet.amudStates = amudStates;
            AppState.trackSequence[index] = masechet;
    
            saveState();
            updateTrackSequenceUI(AppState.trackSequence);
            handleScheduleGeneration(); 
        },
    
        onDateOverride: (date) => {
            handleDateOverrideClick(date);
        }
    });
    
    // 1. Initialize the UI and capture the UI updater function
    const { updateAuthUI } = setupCloudAuth({
        onRegister: async (email, password) => {
            if (!email || !password) return alert("נא להזין אימייל וסיסמה");
            try {
                await createUserWithEmailAndPassword(auth, email, password);
                alert("החשבון נוצר וחובר בהצלחה!");
            } catch (err) {
                alert(`שגיאת רישום: ${err.message}`);
            }
        },
        
        onLogin: async (email, password) => {
            try { 
                await signInWithEmailAndPassword(auth, email, password); 
            } catch (err) { 
                alert(`שגיאת התחברות: ${err.message}`); 
            }
        },
        
        onLogout: () => {
            signOut(auth);
        },
        
        onFetchData: async () => {
            if (await loadFromFirebase()) {
                alert("הנתונים נמשכו מהענן בהצלחה! העמוד יתעדכן.");
                initUserConfigPanel();
                handleScheduleGeneration();
            } else {
                alert("לא נמצאו נתונים שמורים בענן עבור משתמש זה.");
            }
        }
    });

    // 2. Wire up your Firebase listener in the controller layer to update the UI
    onAuthStateChanged(auth, (user) => {
        const userEmail = user ? user.email : null;
        updateAuthUI(userEmail);
    });
}

// Initiate calendar configuration control panel
function initUserConfigPanel() {
    // 1. Populate Masechet dropdown select element
    const select = document.getElementById('masechetSelect');
    masechtot.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.innerText = m.name;
        select.appendChild(opt);
    });

    hydrateHtmlFromAppState(AppState);

    toggleInputs();
    renderDateLabels(AppState.userSettings.startDate, AppState.userSettings.targetDate);

    updateTrackSequenceUI(AppState.trackSequence);

    if (AppState.trackSequence.length > 0) {
        handleScheduleGeneration();
    }
}

// Main page initiation function
function init() {
    console.log("HTML page initialized successfully");

    initPersistence(AppState);

    loadFromLocalStorage();

    // setupEventListeners();
    initializeApp()

    window.addEventListener('load', initUserConfigPanel);
}

// Executes main initiation function upon page load
document.addEventListener('DOMContentLoaded', init);

/* 
    Helpers
*/

// Builds a flat list of { dateString, label, amudStart, amudCount } for each study day
// belonging to a specific masechet entry (identified by its index in trackSequence).
// Works by replaying the amud pointer across the schedule in order.
function computeDaySlots(schedule, masechetName, trackIdx, trackSequence) {
    if (!schedule || schedule.length === 0) return [];

    // Compute the global amud offset where this masechet's block starts.
    // Each masechet before it in the sequence consumes amudCount amudim.
    let blockStart = 0;
    for (let i = 0; i < trackIdx; i++) {
        const entry = trackSequence[i];
        const name = typeof entry === 'string' ? entry : entry.name;
        const data = masechtot.find(m => m.name === name);
        if (data) blockStart += (data.amudCount || 0);
    }

    const targetEntry = trackSequence[trackIdx];
    const targetName  = typeof targetEntry === 'string' ? targetEntry : targetEntry?.name;
    const targetData  = masechtot.find(m => m.name === targetName);
    const blockEnd    = blockStart + (targetData?.amudCount || 0);

    const slots = [];
    let globalPointer = 0; // Tracks position in the full masterAmudPool across the schedule

    for (const day of schedule) {
        if (day.isEmpty || day.isReviewDay || !day.pages || day.pages <= 0) continue;

        const amudCount = Math.round(day.pages * 2);

        // Check whether this day's amud range overlaps our target block
        const dayEnd = globalPointer + amudCount;
        if (day.masechet === masechetName && globalPointer >= blockStart && globalPointer < blockEnd) {
            const localStart = globalPointer - blockStart;
            slots.push({
                dateString: day.dateString,
                label: `${day.dateString} — ${day.content}`,
                amudStart: localStart,
                amudCount: Math.min(amudCount, blockEnd - globalPointer)
            });
        }

        globalPointer += amudCount;
    }

    return slots;
}

/* 
    Handlers
*/

// Orchestrates schedule calculation by piping AppState inputs into the engine and rendering the resulting timeline grid
async function handleScheduleGeneration() {
    if (!AppState.trackSequence || AppState.trackSequence.length === 0) {
        AppState.schedule = [];

        // Wipe the UI container completely or replace it with a placeholder
        const container = document.getElementById('calendarContainer');
        if (container) {
            container.innerHTML = `
                <div class="text-center p-8 text-slate-400 italic">
                    טרם נבחר חומר לימוד. נא לבחור לפחות מסכת אחת כדי להציג לוח לימוד.
                </div>
            `;
        }

        document.getElementById('output').classList.add('hidden');
        return;
    }

    try {
        const updatedSchedule = await generateSchedule({
            trackSequence: AppState.trackSequence,
            userSettings: AppState.userSettings,
            manualOverrides: AppState.manualOverrides,
            calendarData: AppState.calendarData
        });

        AppState.schedule = updatedSchedule;

        // EXTRACT AND SAVE SIYUM EVENTS GLOBALLY
        AppState.siyumEvents = updatedSchedule
            .filter(day => day.isSiyum)
            .map(day => ({
                dateString: day.dateString,
                date: day.date,
                masechet: day.masechet,
                title: `סיום מסכת ${day.masechet}`
            }));

        renderCalendar('calendarContainer', AppState.schedule, {
            calendarType: AppState.userSettings.calendarType,
            overrides: AppState.manualOverrides
        });

        document.getElementById('output').classList.remove('hidden');

    } catch (error) {
        alert(error.message);
    }
}

// Takes a setting key and a value and updates the setting to the value
function handleUpdateSetting(key, value) {
    AppState.userSettings[key] = value;
    
    saveState();
}

// Orchestrates date override by passing current manualOverride state and a date into a cycle function
function handleDateOverrideClick(dateString) {
    AppState.manualOverrides = cycleDateOverride(AppState.manualOverrides, dateString);

    saveState();
    handleScheduleGeneration();
}

// Factory-resets user configuration variables and settings
async function handleResetSettings() {
    const confirmed = await showDialog({
        title: 'איפוס הגדרות לברירת מחדל',
        message: 'האם אתה בטוח שברצונך לאפס את כל ההגדרות והקצב לברירת המחדל?',
        icon: '🗑️',
        showCancel: true,
        confirmText: 'כן, אפס הכל',
        cancelText: 'לא, התחרטתי'
    });

    if (!confirmed) return;

    AppState.userSettings = { ...DEFAULT_USER_SETTINGS };
    AppState.trackSequence = [];

    // Synchronize your local files, view layout, and engine calculations
    saveState();
    initUserConfigPanel();    // Repopulates form inputs with the fresh AppState.userSettings values
    updateTrackSequenceUI(AppState.trackSequence);    // Re-renders the list layout (now empty)
    handleScheduleGeneration(); // Generates empty/default state layout cleanly
}

// Erases targeted timeline override blocks completely while leaving configuration controls alone
async function handleResetManualOverrides() {
    if (Object.keys(AppState.manualOverrides).length === 0) {
        await showDialog({
            title: 'פעולה התבטלה',
            message: 'לא נמצאו שינויים ידניים בלוח הקיים.',
            icon: '🔄',
            confirmText: 'המשך'
        });
        return;
    }

    const confirmed = await showDialog({
        title: 'איפוס שינויים ידניים',
        message: 'האם אתה בטוח שברצונך לאפס את כל השינויים הידניים שעשית ללוח הזמנים?',
        icon: '🗑️',
        showCancel: true,
        confirmText: 'כן, אפס הכל',
        cancelText: 'לא, התחרטתי'
    });
    if (!confirmed) return;

    // Wipe out the map object completely
    AppState.manualOverrides = {};

    // Save state changes and re-run calculations
    saveState();
    handleScheduleGeneration();
}

// Handles re-ordering of items in track sequence list
function handleTrackReorder(newOrderOfIndices) {
    // Map old state array items to their new positions using the indices sent from the UI
    AppState.trackSequence = newOrderOfIndices.map(oldIndex => {
        const entry = AppState.trackSequence[oldIndex];
        // Standardize string entries to objects if needed
        return typeof entry === 'string' 
            ? { name: entry, reviewDays: 0, amudStates: [] } 
            : entry;
    });

    saveState();
    updateTrackSequenceUI(AppState.trackSequence); 
}

// Handle global book "sync to today"
async function handleSyncToToday() {
    // 1. Safety check using the global schedule
    if (!AppState.schedule || AppState.schedule.length === 0) {
        await showDialog({ title: 'אין נתונים', message: 'יש ליצור לוח לימוד קודם כדי לסנכרן.', icon: '📅', confirmText: 'הבנתי' });
        return;
    }

    // 2. Confirmation Dialog
    const confirmed = await showDialog({
        title: 'סנכרן עד היום',
        message: 'פעולה זו תסמן את כל ימי הלימוד שעברו (עד היום) בכל המסכתות כנלמדו. להמשיך?',
        icon: '🔄',
        showCancel: true,
        confirmText: 'כן, סנכרן',
        cancelText: 'ביטול'
    });
    if (!confirmed) return;

    const todayStr = new Date().toISOString().split('T')[0];
    let hasChanges = false;

    // 3. Loop through every single Masechet inside your track sequence
    AppState.trackSequence.forEach((masechet, trackIdx) => {
        if (typeof masechet === 'string') {
            masechet = { name: masechet, reviewDays: 0, amudStates: [] };
            AppState.trackSequence[trackIdx] = masechet;
        }

        const masechetName = masechet.name || "לא ידוע";
        
        // Ensure masechtot is accessible/imported in app.js
        const targetData = masechtot.find(m => m.name === masechetName);
        const totalAmudim = targetData ? (targetData.amudCount || 120) : 120;

        if (!masechet.amudStates || masechet.amudStates.length === 0) {
            masechet.amudStates = new Array(totalAmudim).fill(0);
        }

        // 4. Dynamically compute the slots 
        const slots = computeDaySlots(AppState.schedule, masechetName, trackIdx, AppState.trackSequence);

        // 5. Apply the sync logic over this Masechet's slots
        slots.forEach(slot => {
            if (slot.dateString <= todayStr) {
                for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
                    if (i < masechet.amudStates.length && masechet.amudStates[i] !== 2) {
                        masechet.amudStates[i] = 1;
                        hasChanges = true;
                    }
                }
            }
        });
    });

    // 6. Save data and refresh the master UI views
    if (hasChanges) {
        saveState();
        updateTrackSequenceUI(AppState.trackSequence);
        handleScheduleGeneration(); // Refreshes calendar view
    }
}

// Initiates manifest service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then((registration) => {
                console.log('ServiceWorker registered successfully.');
            })
            .catch((error) => {
                console.error('ServiceWorker registration failed: ', error);
            });
    });
}