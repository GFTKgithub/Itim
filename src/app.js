import { DEFAULT_TRACK_SETTINGS, createNewTrack, getActiveTrack } from './track.js';
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

let AppState = {
    userPreferences: { ...DEFAULT_USER_PREFERENCES },       // User Preferences (with default values)
    activeTrackId: null // To keep track of which track is currently active in the UI, for when multiple tracks are implemented in the future
}

let currentTrack = null; // This will be dynamically set to the active track object based on activeTrackId, for easier access in the code.

let tracks = []; // Future-proofing for multiple tracks, currently only one track is supported and stored in AppState.trackSettings

/* 
    Page initiation logic
*/

// Executes main initiation function upon page load
document.addEventListener('DOMContentLoaded', init);


// Main page initiation function
function init() {
    console.log("HTML page initialized successfully");

    initPersistence(AppState, tracks);

    loadFromLocalStorage();

    if (tracks.length === 0) {
        console.log("No tracks found in storage. Creating default track.");
        const defaultTrack = createNewTrack("מסלול לימוד ראשי");
        tracks.push(defaultTrack);
        AppState.activeTrackId = defaultTrack.id;
    }

    currentTrack = getActiveTrack(AppState, tracks);
    
    setupMainPage()

    window.addEventListener('load', initTrackConfigPanel);
}

// Executes setup helpers for index.html
function setupMainPage() {
    setupMainControls({
        onGenerate: handleScheduleGeneration,
        onAddToSequence: () => { 
            currentTrack.bookSequence = addToSequence(currentTrack.bookSequence);
            saveState();
        },
        onClearSequence: async () => {
            currentTrack.bookSequence = await clearSequence(currentTrack.bookSequence);
            saveState();
            handleScheduleGeneration();
        },
        onExportExcel: () => exportScheduleToExcel(currentTrack.studySchedule),
        onExportICal: () => exportScheduleToICal(currentTrack.studySchedule)
    });

    setupBackupManagement({
        onExport: exportStateBackup,
        onImport: importStateBackup,
        onResetSettings: handleResetSettings,
        onResetStudyStatusOverrides: handleResetStudyStatusOverrides
    });

    setupSettings({
        trackSettings: currentTrack ? currentTrack.settings : null,
        onUpdateUserPreference: handleUpdateUserPreference,
        onUpdateTrackSetting: handleUpdateTrackSetting,
        onGenerate: handleScheduleGeneration,
        onSyncToToday: handleSyncToToday
    });

    setupBookSequenceDragAndDrop({
        onRemove: (indexToRemove) => {
            currentTrack.bookSequence = removeFromSequence(currentTrack.bookSequence, indexToRemove);
            saveState();
            updateBookSequenceUI(currentTrack.bookSequence); // Make sure the layout stays synced
        },
        onReorder: handleBookSequenceReorder
    });

    setupBookConfigModal({
        // Pass global data down so the function can read it safely
        getBookSequence: () => currentTrack.bookSequence,
        getSchedule: () => currentTrack.studySchedule,

        getBookRangeLimits: (index) => {
            // If it's the first book, its constraint relies on the global scheduler setup startDate
            if (index === 0) {
                return { minDate: currentTrack.settings.startDate };
            }
            
            // Otherwise, look up the day the previous book finished in the computed schedule
            const previousBook = currentTrack.bookSequence[index - 1];
            const previousBookName = typeof previousBook === 'string' ? previousBook : previousBook.name;
            
            const previousBookDays = currentTrack.studySchedule.filter(day => day.book === previousBookName);
            
            if (previousBookDays.length > 0) {
                // Get the absolute last recorded date slot assigned to that book
                const lastDay = previousBookDays[previousBookDays.length - 1].dateString; 
                const nextAvailableDate = new Date(lastDay);
                nextAvailableDate.setDate(nextAvailableDate.getDate() + 1);
                
                return { 
                    minDate: nextAvailableDate.toISOString().split('T')[0] 
                };
            }
            
            return { minDate: currentTrack.settings.startDate };
        },

        // Helper logic functions (temporary)
        computeDaySlots: computeDaySlots,
        renderAmudGrid: renderAmudGrid,              // Pass it down
        renderDailyView: renderDailyView,            // Pass it down
        updateModalProgressStats: updateModalProgressStats, // Pass it down

        // Handle the data adjustments and app side-effects here
        onSaveConfig: ({ index, reviewDays, amudStates }) => {
            let book = currentTrack.bookSequence[index];
            if (typeof book === 'string') {
                book = { name: book };
            }
            
            // Capture values from the modal elements
            book.reviewDays = parseInt(reviewDays, 10) || 0;
            book.amudStates = amudStates || [];
            book.calcMethod = document.getElementById('bookConfigCalcMethod').value;
            book.paceValue = parseFloat(document.getElementById('bookConfigPaceInput').value) || 1;
            book.targetDate = document.getElementById('bookConfigTargetDateInput').value;
        
            currentTrack.bookSequence[index] = book;
        
            saveState();
            updateBookSequenceUI(currentTrack.bookSequence);
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
                
                // RE-ALIGN THE POINTER TO GET THE FRESH TRACK
                currentTrack = getActiveTrack(AppState, tracks);
                
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

    hydrateHtmlFromAppState(AppState, tracks);

    renderDateLabels(currentTrack.settings.startDate, currentTrack.settings.targetDate);

    updateBookSequenceUI(currentTrack.bookSequence);

    if (currentTrack.bookSequence.length > 0) {
        handleScheduleGeneration();
    }
}

/* 
    Handlers
*/

// Orchestrates schedule calculation by piping AppState inputs into the engine and rendering the resulting timeline grid
async function handleScheduleGeneration() {
    if (!currentTrack.bookSequence || currentTrack.bookSequence.length === 0) {
        currentTrack.studySchedule = [];

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
            trackSettings: currentTrack.settings,
            bookSequence: currentTrack.bookSequence,
            studyStatusOverrides: currentTrack.studyStatusOverrides,
            calendarEvents: currentTrack.calendarEvents
        });

        currentTrack.studySchedule = updatedSchedule;

        // EXTRACT AND SAVE SIYUM EVENTS GLOBALLY
        currentTrack.siyumEvents = updatedSchedule
            .filter(day => day.isSiyum)
            .map(day => ({
                dateString: day.dateString,
                date: day.date,
                book: day.book,
                title: `סיום מסכת ${day.book}`
            }));
        
        const isMinimal = AppState.userPreferences?.minimal_calendar === true || 
        AppState.userPreferences?.minimal_calendar === 'true';

        renderCalendar('calendarContainer', currentTrack.studySchedule, {
            calendarSystem: currentTrack.settings.calendarSystem,
            overrides: currentTrack.studyStatusOverrides,
            isMinimal: isMinimal
        });

        document.getElementById('action-dock').classList.remove('hidden');

    } catch (error) {
        alert(error.message);
    }
}

function handleUpdateUserPreference(key, value) {
    AppState.userPreferences[key] = value;
    
    saveState();
}

// Takes a setting key and a value and updates the track setting to the value
function handleUpdateTrackSetting(key, value) {
    currentTrack.settings[key] = value;
    
    saveState();
}

// Orchestrates date override by passing current studyStatusOverride state and a date into a cycle function
function handleStudyStatusOverride(dateString) {
    currentTrack.studyStatusOverrides = cycleStudyStatusOverride(currentTrack.studyStatusOverrides, dateString);

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

    currentTrack.settings = { ...DEFAULT_TRACK_SETTINGS };
    currentTrack.bookSequence = [];

    // Synchronize your local files, view layout, and engine calculations
    saveState();
    initTrackConfigPanel();    // Repopulates form inputs with the fresh AppState.trackSettings values
    updateBookSequenceUI(currentTrack.bookSequence);    // Re-renders the list layout (now empty)
    handleScheduleGeneration(); // Generates empty/default state layout cleanly
}

// Erases targeted timeline override blocks completely while leaving configuration controls alone
async function handleResetStudyStatusOverrides() {
    if (Object.keys(currentTrack.studyStatusOverrides).length === 0) {
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
    currentTrack.studyStatusOverrides = {};

    // Save state changes and re-run calculations
    saveState();
    handleScheduleGeneration();
}

// Handles re-ordering of items in book sequence list
function handleBookSequenceReorder(newOrderOfIndices) {
    // Map old state array items to their new positions using the indices sent from the UI
    currentTrack.bookSequence = newOrderOfIndices.map(oldIndex => {
        const entry = currentTrack.bookSequence[oldIndex];
        // Standardize string entries to objects if needed
        return typeof entry === 'string' 
            ? { name: entry, reviewDays: 0, amudStates: [] } 
            : entry;
    });

    saveState();
    updateBookSequenceUI(currentTrack.bookSequence); 
}

// Handle global book "sync to today"
async function handleSyncToToday() {
    // 1. Safety check using the global schedule
    if (!currentTrack.studySchedule || currentTrack.studySchedule.length === 0) {
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
    currentTrack.bookSequence.forEach((book, bookIdx) => {
        if (typeof book === 'string') {
            book = { name: book, reviewDays: 0, amudStates: [] };
            // AppState.bookSequence[bookIdx] = book;
            currentTrack.bookSequence[bookIdx] = book;
        }

        const bookName = book.name || "לא ידוע";
        
        // Ensure books is accessible/imported in app.js
        const targetData = talmud_bavli_masechtot.find(m => m.name === bookName);
        const totalAmudim = targetData ? (targetData.amudCount || 120) : 120;

        if (!book.amudStates || book.amudStates.length === 0) {
            book.amudStates = new Array(totalAmudim).fill(0);
        }

        // 4. Dynamically compute the slots 
        const slots = computeDaySlots(currentTrack.studySchedule, bookName, bookIdx, currentTrack.bookSequence);

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
        updateBookSequenceUI(currentTrack.bookSequence);
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