import { DEFAULT_TRACK_SETTINGS, createNewTrack, getActiveTrack } from './track.js';
import { talmud_bavli_masechtot } from './data.js';

import { hydrateHtmlFromAppState, updateBookSequenceUI, renderDateLabels, renderTrackSwitcher } from './ui/track-config.js';
import { renderAmudGrid, renderDailyView, updateModalProgressStats } from './ui/book-config-modal.js';
import { showDialog } from './ui/components.js';
import { renderCalendar, updateCalendarViewToggle } from './ui/calendar.js';

import { addToSequence, removeFromSequence, clearSequence } from './book-sequence.js';
import { generateStudyCalendar, cycleStudyStatusOverride, computeDaySlots } from './scheduler.js';
import { initPersistence, saveState, loadFromLocalStorage, exportStateBackup, importStateBackup } from './persistence.js';
import { exportScheduleToExcel, exportScheduleToICal } from './exports.js';

import {
    setupActionDock,
    setupBookSequence,
    setupTrackSelector,
    setupBackupManagement,
    setupSettings,
    setupBookSequenceDragAndDrop,
    setupBookConfigModal,
    setupCloudAuth,
    setupCalendarContextMenus,
    setupViewModeToggle
} from './setup.js';

// Firebase
import { registerUser, loginUser, logoutUser, initAuthListener } from './services/auth.js'
import { getFriendlyFirebaseErrorMessage } from './utils/errors.js';
import { loadFromFirebase } from './persistence.js';

const DEFAULT_USER_PREFERENCES = {
    minimalCalendar: false,
    calendarViewMode: 'paginated',
    syncUserPreferences: true
}

let AppState = {
    userPreferences: { ...DEFAULT_USER_PREFERENCES },       // User Preferences (with default values)
    activeTrackId: null, // To keep track of which track is currently active in the UI, for when multiple tracks are implemented in the future
    activeMonthIndex: 0  // Tracks current page index for paginated calendar view mode
}

let activeTrack = null; // This will be dynamically set to the active track object based on activeTrackId, for easier access in the code.

let tracks = []; // Future-proofing for multiple tracks, currently only one track is supported and stored in AppState

/* 
    Page initiation logic
*/

// Executes main initiation function upon page load
document.addEventListener('DOMContentLoaded', init);


// Main page initiation function
async function init() {
    console.log("HTML page initialized successfully");

    const trackHydratorRule = async (leanTrack) => {
        const trackCalendarEvents = {};
        
        const calculatedSchedule = await generateStudyCalendar({
            trackSettings: leanTrack.trackSettings || leanTrack.settings,
            bookSequence: leanTrack.bookSequence,
            studyStatusOverrides: leanTrack.studyStatusOverrides,
            calendarEvents: trackCalendarEvents
        });

        return {
            ...leanTrack,
            calendarEvents: trackCalendarEvents,
            studySchedule: calculatedSchedule
        };
    };

    initPersistence(AppState, tracks, trackHydratorRule);

    await loadFromLocalStorage();

    if (tracks.length === 0) {
        console.log("No tracks found in storage. Creating default track.");
        const defaultTrack = createNewTrack("מסלול לימוד ראשי");
        tracks.push(defaultTrack);
        AppState.activeTrackId = defaultTrack.id;
    }

    activeTrack = getActiveTrack(AppState, tracks);
    
    setupMainPage()

    refreshTrackConfigPanel();
}

// Executes setup helpers for index.html
function setupMainPage() {
    setupTrackSelector({
        onAddNewTrack: async (name) => await handleAddNewTrack(name),
        onSwitchTrack: async (trackId) => await handleSwitchTrack(trackId)
    });

    setupBookSequence({
        onAddToSequence: () => { 
            activeTrack.bookSequence = addToSequence(activeTrack.bookSequence);
            saveState();
        },
        onClearSequence: async () => {
            activeTrack.bookSequence = await clearSequence(activeTrack.bookSequence);
            saveState();
            handleScheduleGeneration();
        }
    });

    setupActionDock({
        onGenerate: handleScheduleGeneration,
        onExportExcel: () => exportScheduleToExcel(activeTrack.studySchedule),
        onExportICal: () => exportScheduleToICal(activeTrack.studySchedule)
    });

    setupBackupManagement({
        onExport: exportStateBackup,
        onImport: importStateBackup,
        onResetSettings: handleResetSettings,
        onResetStudyStatusOverrides: handleResetStudyStatusOverrides
    });

    setupSettings({
        trackSettings: activeTrack ? activeTrack.settings : null,
        onUpdateUserPreference: handleUpdateUserPreference,
        onUpdateTrackSetting: handleUpdateTrackSetting,
        onGenerate: handleScheduleGeneration,
        onSyncToToday: handleSyncToToday
    });

    setupBookSequenceDragAndDrop({
        onRemove: (indexToRemove) => {
            activeTrack.bookSequence = removeFromSequence(activeTrack.bookSequence, indexToRemove);
            saveState();
            updateBookSequenceUI(activeTrack.bookSequence); // Make sure the layout stays synced
        },
        onReorder: handleBookSequenceReorder
    });

    setupBookConfigModal({
        // Pass global data down so the function can read it safely
        getBookSequence: () => activeTrack.bookSequence,
        getSchedule: () => activeTrack.studySchedule,

        getBookRangeLimits: (index) => {
            // If it's the first book, its constraint relies on the global scheduler setup startDate
            if (index === 0) {
                return { minDate: activeTrack.settings.startDate };
            }
            
            // Otherwise, look up the day the previous book finished in the computed schedule
            const previousBook = activeTrack.bookSequence[index - 1];
            const previousBookName = typeof previousBook === 'string' ? previousBook : previousBook.name;
            
            const previousBookDays = activeTrack.studySchedule.filter(day => day.book === previousBookName);
            
            if (previousBookDays.length > 0) {
                // Get the absolute last recorded date slot assigned to that book
                const lastDay = previousBookDays[previousBookDays.length - 1].dateString; 
                const nextAvailableDate = new Date(lastDay);
                nextAvailableDate.setDate(nextAvailableDate.getDate() + 1);
                
                return { 
                    minDate: nextAvailableDate.toISOString().split('T')[0] 
                };
            }
            
            return { minDate: activeTrack.settings.startDate };
        },

        // Helper logic functions (temporary)
        computeDaySlots: computeDaySlots,
        renderAmudGrid: renderAmudGrid,              // Pass it down
        renderDailyView: renderDailyView,            // Pass it down
        updateModalProgressStats: updateModalProgressStats, // Pass it down

        // Handle the data adjustments and app side-effects here
        onSaveConfig: ({ index, calcMethod, paceValue, targetDate, reviewDays, amudStates, startAmudIdx, endAmudIdx }) => {
            let book = activeTrack.bookSequence[index];
            if (typeof book === 'string') {
                book = { name: book };
            }
            
            // Capture all calculation settings packaged from the configuration modal fields
            book.calcMethod = calcMethod;
            book.paceValue = paceValue;
            book.targetDate = targetDate;
            book.reviewDays = reviewDays;
            book.amudStates = amudStates || [];
            
            // Persist the user-defined boundaries safely into the track sequence store
            book.startAmudIdx = startAmudIdx;
            book.endAmudIdx = endAmudIdx;
        
            activeTrack.bookSequence[index] = book;
        
            saveState();
            updateBookSequenceUI(activeTrack.bookSequence);
            handleScheduleGeneration(); 
        },
    
        onStudyStatusOverride: (date) => {
            handleStudyStatusOverride(date);
        }
    });;
    
    setupCalendarContextMenus();

    setupViewModeToggle({
        onGenerate: handleScheduleGeneration,
        onUpdateUserPreference: handleUpdateUserPreference,
        onUpdateViewToggle: updateCalendarViewToggle,
        getCalendarViewMode: () => AppState.userPreferences.calendarViewMode
    })

    // Handle print: temporarily switch to continuous (all-months) mode so the printout shows everything
    window.addEventListener('beforeprint', () => {
        const calendarContainer = document.getElementById('calendarContainer');
        if (!calendarContainer || !activeTrack.studySchedule || activeTrack.studySchedule.length === 0) return;

        // Save the current view mode preference
        window.__printRestoreViewMode = AppState.userPreferences?.calendarViewMode || 'paginated';

        // Render all months for printing by forcing continuous mode just for the print
        renderCalendar('calendarContainer', activeTrack.studySchedule, {
            calendarSystem: activeTrack.settings.calendarSystem,
            overrides: activeTrack.studyStatusOverrides,
            isMinimal: AppState.userPreferences?.minimalCalendar === true || AppState.userPreferences?.minimalCalendar === 'true',
            calendarViewMode: 'continuous',
            activeMonthIndex: 0
        });
    });

    window.addEventListener('afterprint', () => {
        const restoreMode = window.__printRestoreViewMode || 'paginated';
        
        // Re-render the calendar in the original view mode
        handleScheduleGeneration();
    });


    // 1. Initialize the UI and capture the UI updater function
    const { updateAuthUI } = setupCloudAuth({
        onRegister: async (email, password, nickname) => {
            try {
                await registerUser(email, password, nickname);
                alert("החשבון נוצר וחובר בהצלחה!");
            } catch (err) {
                console.error(err);
                // If it's a validation error thrown manually, use its message. Otherwise, use Firebase's code.
                const errorMsg = err.code ? getFriendlyFirebaseErrorMessage(err.code) : err.message;
                alert(`שגיאת רישום: ${errorMsg}`); 
            }
        },
        
        onLogin: async (email, password) => {
            try { 
                await loginUser(email, password); 
            } catch (err) { 
                alert(`שגיאת התחברות: ${getFriendlyFirebaseErrorMessage(err.code)}`); 
            }
        },
        
        onLogout: () => {
            logoutUser();
        },
        
        onFetchData: async () => {
            if (await loadFromFirebase()) {
                alert("הנתונים נמשכו מהענן בהצלחה! העמוד יתעדכן.");
                
                // RE-ALIGN THE POINTER TO GET THE FRESH TRACK
                activeTrack = getActiveTrack(AppState, tracks);
                
                await refreshTrackConfigPanel();
                await handleScheduleGeneration();
            } else {
                alert("לא נמצאו נתונים שמורים בענן עבור משתמש זה.");
            }
        }
    });
    
    // 2. Wire up your Firebase listener via the auth service
    initAuthListener((userEmail) => {
        updateAuthUI(userEmail);
    });
}

// Refreshes the calendar configuration control panel
async function refreshTrackConfigPanel() {
    hydrateHtmlFromAppState(AppState, tracks);

    renderTrackSwitcher(tracks, AppState.activeTrackId);
    renderDateLabels(activeTrack.settings.startDate, activeTrack.settings.targetDate);

    updateBookSequenceUI(activeTrack.bookSequence);

    await handleScheduleGeneration();
}

/* 
    Handlers
*/

// Orchestrates schedule calculation by piping AppState inputs into the engine and rendering the resulting timeline grid
async function handleScheduleGeneration() {
    if (!activeTrack.bookSequence || activeTrack.bookSequence.length === 0) {
        activeTrack.studySchedule = [];

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
            trackSettings: activeTrack.settings,
            bookSequence: activeTrack.bookSequence,
            studyStatusOverrides: activeTrack.studyStatusOverrides,
            calendarEvents: activeTrack.calendarEvents
        });

        activeTrack.studySchedule = updatedSchedule;

        // EXTRACT AND SAVE SIYUM EVENTS GLOBALLY
        activeTrack.siyumEvents = updatedSchedule
            .filter(day => day.isSiyum)
            .map(day => ({
                dateString: day.dateString,
                date: day.date,
                book: day.book,
                title: `סיום מסכת ${day.book}`
            }));
        
        const isMinimal = AppState.userPreferences?.minimalCalendar === true || 
        AppState.userPreferences?.minimalCalendar === 'true';

        const currentCalendarViewMode = AppState.userPreferences?.calendarViewMode || 'paginated';
        
        renderCalendar('calendarContainer', activeTrack.studySchedule, {
            calendarSystem: activeTrack.settings.calendarSystem,
            overrides: activeTrack.studyStatusOverrides,
            isMinimal: isMinimal,
            calendarViewMode: currentCalendarViewMode,
            activeMonthIndex: AppState.activeMonthIndex,
            onMonthChange: (direction) => {
                AppState.activeMonthIndex = Math.max(0, (AppState.activeMonthIndex || 0) + direction);
                handleScheduleGeneration();
            }
        });

        document.getElementById('action-dock').classList.remove('hidden');

    } catch (error) {
        alert(error.message);
    }
}

// Handles the creation of a new track, including state updates, persistence, and UI refresh
async function handleAddNewTrack(trackName) {
    if (!trackName || trackName.trim() === "") {
        trackName = `מסלול חדש #${tracks.length + 1}`;
    }

    const newTrack = createNewTrack(trackName);
    tracks.push(newTrack);

    AppState.activeTrackId = newTrack.id;

    activeTrack = newTrack;

    await saveState();

    refreshTrackConfigPanel();

    renderTrackSwitcher(tracks, AppState.activeTrackId);
}

// Handles switching between tracks
async function handleSwitchTrack(trackId) {
    const selectedTrack = tracks.find(t => t.id === trackId);
    if (!selectedTrack) {
        alert("המסלול שנבחר לא נמצא.");
        return;
    }

    AppState.activeTrackId = trackId;
    activeTrack = selectedTrack;

    await saveState();

    refreshTrackConfigPanel();

    renderTrackSwitcher(tracks, AppState.activeTrackId);
}

// Takes a user preference key and a value and updates the preference to the value
function handleUpdateUserPreference(key, value) {
    AppState.userPreferences[key] = value;
    
    saveState();
}

// Takes a setting key and a value and updates the track setting to the value
function handleUpdateTrackSetting(key, value) {
    activeTrack.settings[key] = value;
    
    saveState();
}

// Orchestrates date override by passing current studyStatusOverride state and a date into a cycle function
function handleStudyStatusOverride(dateString) {
    activeTrack.studyStatusOverrides = cycleStudyStatusOverride(activeTrack.studyStatusOverrides, dateString);

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

    activeTrack.settings = { ...DEFAULT_TRACK_SETTINGS };
    activeTrack.bookSequence = [];

    // Synchronize your local files, view layout, and engine calculations
    saveState();
    refreshTrackConfigPanel();    // Repopulates form inputs with the fresh track setting values
    updateBookSequenceUI(activeTrack.bookSequence);    // Re-renders the list layout (now empty)
    handleScheduleGeneration(); // Generates empty/default state layout cleanly
}

// Erases targeted timeline override blocks completely while leaving configuration controls alone
async function handleResetStudyStatusOverrides() {
    if (Object.keys(activeTrack.studyStatusOverrides).length === 0) {
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
    activeTrack.studyStatusOverrides = {};

    // Save state changes and re-run calculations
    saveState();
    handleScheduleGeneration();
}

// Handles re-ordering of items in book sequence list
function handleBookSequenceReorder(newOrderOfIndices) {
    // Map old state array items to their new positions using the indices sent from the UI
    activeTrack.bookSequence = newOrderOfIndices.map(oldIndex => {
        const entry = activeTrack.bookSequence[oldIndex];
        // Standardize string entries to objects if needed
        return typeof entry === 'string' 
            ? { name: entry, reviewDays: 0, amudStates: [] } 
            : entry;
    });

    saveState();
    updateBookSequenceUI(activeTrack.bookSequence); 
}

// Handle global book "sync to today"
async function handleSyncToToday() {
    // 1. Safety check using the global schedule
    if (!activeTrack.studySchedule || activeTrack.studySchedule.length === 0) {
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
    activeTrack.bookSequence.forEach((book, bookIdx) => {
        if (typeof book === 'string') {
            book = { name: book, reviewDays: 0, amudStates: [] };
            // AppState.bookSequence[bookIdx] = book;
            activeTrack.bookSequence[bookIdx] = book;
        }

        const bookName = book.name || "לא ידוע";
        
        // Ensure books is accessible/imported in app.js
        const targetData = talmud_bavli_masechtot.find(m => m.name === bookName);
        const totalAmudim = targetData ? (targetData.amudCount || 120) : 120;

        if (!book.amudStates || book.amudStates.length === 0) {
            book.amudStates = new Array(totalAmudim).fill(0);
        }

        // 4. Dynamically compute the slots 
        const slots = computeDaySlots(activeTrack.studySchedule, bookName, bookIdx, activeTrack.bookSequence);

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
        updateBookSequenceUI(activeTrack.bookSequence);
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