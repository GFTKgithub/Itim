import { talmud_bavli_masechtot } from './data.js';
import { hydrateHtmlFromAppState, updateBookSequenceUI, renderAmudGrid, renderDailyView, updateModalProgressStats, renderDateLabels, renderCalendar, showDialog } from './ui.js';
import { addToSequence, removeFromSequence, clearSequence } from './book-sequence.js';
import { generateStudyCalendar, cycleStudyStatusOverride, computeDaySlots } from './scheduler.js';
import { initPersistence, saveState, loadFromLocalStorage, exportStateBackup, importStateBackup } from './persistence.js';
import { exportScheduleToExcel, exportScheduleToICal } from './exports.js';

import {
    setupMainControls,
    setupBackupManagement,
    setupSettings,
    setupBookSequenceDragAndDrop,
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
import { loadFromFirebase } from './persistence.js';

const DEFAULT_USER_PREFERENCES = {
    minimal_calendar: false
}

const DEFAULT_TRACK_SETTINGS = {
    method: 'pace',
    pace: 1,
    startDate: new Date().toISOString().split('T')[0],
    targetDate: '',
    startDaf: 'ב',
    startAmud: 'א',
    studyDays: [0, 1, 2, 3, 4, 5], // Default: Sun-Fri (0-5), Shabbat (6) excluded
    includeHolidays: false,
    calendarSystem: 'hebrew',
}

let AppState = {
    userPreferences: { ...DEFAULT_USER_PREFERENCES },       // User Preferences (with default values)
    bookSequence: [],               // Book sequence list
    studySchedule: [],                   // Data of the entire study schedule
    studyStatusOverrides: {},       // Manual overrides of calendar days study status (0 = Default, 1 = Force Break, 2 = Force Study)
    calendarEvents: {},          // Data of special calendar events (DD.YY.MM)
    trackSettings: { ...DEFAULT_TRACK_SETTINGS }    // Track Settings (with default values)
}

/* 
    Page initiation logic
*/

// Executes main initiation function upon page load
document.addEventListener('DOMContentLoaded', init);


// Main page initiation function
function init() {
    console.log("HTML page initialized successfully");

    initPersistence(AppState);

    loadFromLocalStorage();

    setupMainPage()

    window.addEventListener('load', initTrackConfigPanel);
}

// Executes setup helpers for index.html
function setupMainPage() {
    setupMainControls({
        onGenerate: handleScheduleGeneration,
        onAddToSequence: () => { 
            AppState.bookSequence = addToSequence(AppState.bookSequence);
            saveState();
        },
        onClearSequence: async () => {
            AppState.bookSequence = await clearSequence(AppState.bookSequence);
            saveState();
            handleScheduleGeneration();
        },
        onExportExcel: () => exportScheduleToExcel(AppState.studySchedule),
        onExportICal: () => exportScheduleToICal(AppState.studySchedule)
    });

    setupBackupManagement({
        onExport: exportStateBackup,
        onImport: importStateBackup,
        onResetSettings: handleResetSettings,
        onResetStudyStatusOverrides: handleResetStudyStatusOverrides
    });

    setupSettings({
        trackSettings: AppState.trackSettings,
        onUpdateUserPreference: handleUpdateUserPreference,
        onUpdateTrackSetting: handleUpdateTrackSetting,
        onGenerate: handleScheduleGeneration,
        onSyncToToday: handleSyncToToday
    });

    setupBookSequenceDragAndDrop({
        onRemove: (indexToRemove) => {
            AppState.bookSequence = removeFromSequence(AppState.bookSequence, indexToRemove);
            saveState();
            updateBookSequenceUI(AppState.bookSequence); // Make sure the layout stays synced
        },
        onReorder: handleBookSequenceReorder
    });

    setupBookConfigModal({
        // Pass global data down so the function can read it safely
        getBookSequence: () => AppState.bookSequence,
        getSchedule: () => AppState.studySchedule,

        getBookRangeLimits: (index) => {
            // If it's the first book, its constraint relies on the global scheduler setup startDate
            if (index === 0) {
                return { minDate: AppState.trackSettings.startDate };
            }
            
            // Otherwise, look up the day the previous book finished in the computed schedule
            const previousBook = AppState.bookSequence[index - 1];
            const previousBookName = typeof previousBook === 'string' ? previousBook : previousBook.name;
            
            const previousBookDays = AppState.studySchedule.filter(day => day.book === previousBookName);
            
            if (previousBookDays.length > 0) {
                // Get the absolute last recorded date slot assigned to that book
                const lastDay = previousBookDays[previousBookDays.length - 1].dateString; 
                const nextAvailableDate = new Date(lastDay);
                nextAvailableDate.setDate(nextAvailableDate.getDate() + 1);
                
                return { 
                    minDate: nextAvailableDate.toISOString().split('T')[0] 
                };
            }
            
            return { minDate: AppState.trackSettings.startDate };
        },

        // Helper logic functions (temporary)
        computeDaySlots: computeDaySlots,
        renderAmudGrid: renderAmudGrid,              // Pass it down
        renderDailyView: renderDailyView,            // Pass it down
        updateModalProgressStats: updateModalProgressStats, // Pass it down

        // Handle the data adjustments and app side-effects here
        onSaveConfig: ({ index, reviewDays, amudStates }) => {
            let book = AppState.bookSequence[index];
            if (typeof book === 'string') {
                book = { name: book };
            }
            
            // Capture values from the modal elements
            book.reviewDays = parseInt(reviewDays, 10) || 0;
            book.amudStates = amudStates || [];
            book.calcMethod = document.getElementById('bookConfigCalcMethod').value;
            book.paceValue = parseFloat(document.getElementById('bookConfigPaceInput').value) || 1;
            book.targetDate = document.getElementById('bookConfigTargetDateInput').value;
        
            AppState.bookSequence[index] = book;
        
            saveState();
            updateBookSequenceUI(AppState.bookSequence);
            handleScheduleGeneration(); 
        },
    
        onStudyStatusOverride: (date) => {
            handleStudyStatusOverride(date);
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
                initTrackConfigPanel();
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

// Initiates calendar configuration control panel
function initTrackConfigPanel() {

    hydrateHtmlFromAppState(AppState);

    renderDateLabels(AppState.trackSettings.startDate, AppState.trackSettings.targetDate);

    updateBookSequenceUI(AppState.bookSequence);

    if (AppState.bookSequence.length > 0) {
        handleScheduleGeneration();
    }
}

/* 
    Handlers
*/

// Orchestrates schedule calculation by piping AppState inputs into the engine and rendering the resulting timeline grid
async function handleScheduleGeneration() {
    if (!AppState.bookSequence || AppState.bookSequence.length === 0) {
        AppState.studySchedule = [];

        // Wipe the UI container completely or replace it with a placeholder
        const container = document.getElementById('calendarContainer');
        if (container) {
            container.innerHTML = `
                <div class="text-center p-8 text-slate-400 italic">
                    טרם נבחר חומר לימוד. נא לבחור לפחות מסכת אחת כדי להציג לוח לימוד.
                </div>
            `;
        }

        document.getElementById('action-dock').classList.add('hidden');
        return;
    }

    try {
        const updatedSchedule = await generateStudyCalendar({
            trackSettings: AppState.trackSettings,
            bookSequence: AppState.bookSequence,
            studyStatusOverrides: AppState.studyStatusOverrides,
            calendarEvents: AppState.calendarEvents
        });

        AppState.studySchedule = updatedSchedule;

        // EXTRACT AND SAVE SIYUM EVENTS GLOBALLY
        AppState.siyumEvents = updatedSchedule
            .filter(day => day.isSiyum)
            .map(day => ({
                dateString: day.dateString,
                date: day.date,
                book: day.book,
                title: `סיום מסכת ${day.book}`
            }));
        
        const isMinimal = AppState.userPreferences?.minimal_calendar === true || 
        AppState.userPreferences?.minimal_calendar === 'true';

        renderCalendar('calendarContainer', AppState.studySchedule, {
            calendarSystem: AppState.trackSettings.calendarSystem,
            overrides: AppState.studyStatusOverrides,
            isMinimal: isMinimal
        });

        document.getElementById('action-dock').classList.remove('hidden');

    } catch (error) {
        alert(error.message);
    }
}

// Takes a preference key and a value and updates the user preference to the value
function handleUpdateUserPreference(key, value) {
    AppState.userPreferences[key] = value;
    
    saveState();
}

// Takes a setting key and a value and updates the track setting to the value
function handleUpdateTrackSetting(key, value) {
    AppState.trackSettings[key] = value;
    
    saveState();
}

// Orchestrates date override by passing current studyStatusOverride state and a date into a cycle function
function handleStudyStatusOverride(dateString) {
    AppState.studyStatusOverrides = cycleStudyStatusOverride(AppState.studyStatusOverrides, dateString);

    saveState();
    handleScheduleGeneration();
}

// Factory-resets track configuration variables and settings
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

    AppState.trackSettings = { ...DEFAULT_TRACK_SETTINGS };
    AppState.bookSequence = [];

    // Synchronize your local files, view layout, and engine calculations
    saveState();
    initTrackConfigPanel();    // Repopulates form inputs with the fresh AppState.trackSettings values
    updateBookSequenceUI(AppState.bookSequence);    // Re-renders the list layout (now empty)
    handleScheduleGeneration(); // Generates empty/default state layout cleanly
}

// Erases targeted timeline override blocks completely while leaving configuration controls alone
async function handleResetStudyStatusOverrides() {
    if (Object.keys(AppState.studyStatusOverrides).length === 0) {
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
    AppState.studyStatusOverrides = {};

    // Save state changes and re-run calculations
    saveState();
    handleScheduleGeneration();
}

// Handles re-ordering of items in book sequence list
function handleBookSequenceReorder(newOrderOfIndices) {
    // Map old state array items to their new positions using the indices sent from the UI
    AppState.bookSequence = newOrderOfIndices.map(oldIndex => {
        const entry = AppState.bookSequence[oldIndex];
        // Standardize string entries to objects if needed
        return typeof entry === 'string' 
            ? { name: entry, reviewDays: 0, amudStates: [] } 
            : entry;
    });

    saveState();
    updateBookSequenceUI(AppState.bookSequence); 
}

// Handle global book "sync to today"
async function handleSyncToToday() {
    // 1. Safety check using the global schedule
    if (!AppState.studySchedule || AppState.studySchedule.length === 0) {
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

    // 3. Loop through every single Book inside your book sequence
    AppState.bookSequence.forEach((book, bookIdx) => {
        if (typeof book === 'string') {
            book = { name: book, reviewDays: 0, amudStates: [] };
            AppState.bookSequence[bookIdx] = book;
        }

        const bookName = book.name || "לא ידוע";
        
        // Ensure books is accessible/imported in app.js
        const targetData = talmud_bavli_masechtot.find(m => m.name === bookName);
        const totalAmudim = targetData ? (targetData.amudCount || 120) : 120;

        if (!book.amudStates || book.amudStates.length === 0) {
            book.amudStates = new Array(totalAmudim).fill(0);
        }

        // 4. Dynamically compute the slots 
        const slots = computeDaySlots(AppState.studySchedule, bookName, bookIdx, AppState.bookSequence);

        // 5. Apply the sync logic over this Book's slots
        slots.forEach(slot => {
            if (slot.dateString <= todayStr) {
                for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
                    if (i < book.amudStates.length && book.amudStates[i] !== 2) {
                        book.amudStates[i] = 1;
                        hasChanges = true;
                    }
                }
            }
        });
    });

    // 6. Save data and refresh the master UI views
    if (hasChanges) {
        saveState();
        updateBookSequenceUI(AppState.bookSequence);
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