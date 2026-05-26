import { masechtot } from './data.js';
import { hydrateHtmlFromAppState, toggleInputs, updateTrackSequenceUI, renderDateLabels, renderCalendar, showDialog } from './ui.js';
import { addToSequence, removeFromSequence, clearSequence } from './track-sequence.js';
import { generateSchedule, cycleDateOverride } from './scheduler.js';
import { initPersistence, saveToLocalStorage, loadFromLocalStorage, exportStateBackup, importStateBackup } from './persistence.js';

const DEFAULT_USER_SETTINGS = {
    method: 'pace',
    pace: 1,
    breakDays: 0,
    startDate: new Date().toISOString().split('T')[0],
    targetDate: '',
    startDaf: 'ב',
    startAmud: 'א',
    includeShabbat: true,
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

/* 
    Page initiation logic
*/

// Setups all event listeners in the page
function setupEventListeners() {
    // Cache DOM elements up front to prevent repeated DOM queries
    const generateBtn = document.getElementById('generateBtn');
    const addToSequenceBtn = document.getElementById('addToSequenceBtn');
    const clearSequenceBtn = document.getElementById('clearSequenceBtn');

    const exportBtn = document.getElementById('exportToExcelBtn');
    const printBtn = document.getElementById('printBtn');
    const trackSequenceList = document.getElementById('trackSequenceList');
    const calendarContainer = document.getElementById('calendarContainer');

    const backupExportBtn = document.getElementById('backupExportBtn');
    const backupImportBtn = document.getElementById('backupImportBtn');
    const backupFileInput = document.getElementById('backupFileInput');

    const resetSettingsBtn = document.getElementById('resetSettingsBtn')
    const resetManualOverridesBtn = document.getElementById('resetManualOverridesBtn')

    // User settings elements
    const calcMethod = document.getElementById('calcMethod');
    const calendarType = document.getElementById('calendarType');
    const includeShabbatInput = document.getElementById('includeShabbatInput');
    const includeHolidaysInput = document.getElementById('includeHolidaysInput');
    const breakDaysInput = document.getElementById('breakDaysInput');
    const startDateInput = document.getElementById('startDateInput');
    const targetDateInput = document.getElementById('targetDateInput');
    const paceInput = document.getElementById('paceInput');
    const startDafInput = document.getElementById('startDafInput');
    const startAmudInput = document.getElementById('startAmudInput');

    // --- Action Listeners ---
    generateBtn.addEventListener('click', handleScheduleGeneration);

    addToSequenceBtn.addEventListener('click', () => {
        AppState.trackSequence = addToSequence(AppState.trackSequence);
        saveToLocalStorage();
    });

    clearSequenceBtn.addEventListener('click', async () => 
    {
        AppState.trackSequence = await clearSequence(AppState.trackSequence);
        saveToLocalStorage();
        handleScheduleGeneration(); // Update to remove ghost calendar UI
    });
    
    exportBtn.addEventListener('click', () => exportScheduleToExcel(AppState.schedule));
    printBtn.addEventListener('click', () => window.print());

    // --- Backup Action Listeners ---
    backupExportBtn.addEventListener('click', exportStateBackup);

    // Clicking our styled button triggers the hidden file input
    backupImportBtn.addEventListener('click', () => backupFileInput.click());

    // When a file is chosen, pass the event to your import function
    backupFileInput.addEventListener('change', importStateBackup);

    resetSettingsBtn.addEventListener('click', handleResetSettings);
    resetManualOverridesBtn.addEventListener('click', handleResetManualOverrides);

    // --- Event Delegation ---
    trackSequenceList.addEventListener('click', (event) => {
        const removeBtn = event.target.closest('.remove-btn');
        if (removeBtn) {
            AppState.trackSequence = removeFromSequence(AppState.trackSequence, Number(removeBtn.dataset.index));
            saveToLocalStorage();
        }
    });

    calendarContainer.addEventListener('click', (event) => {
        const calendarDay = event.target.closest('.calendar-day');
        if (calendarDay?.dataset.date) {
            handleDateOverrideClick(calendarDay.dataset.date);
        }
    });

    // --- App Settings Sync Listeners ---
    calcMethod.addEventListener('change', (e) => {
        AppState.userSettings.method = e.target.value;
        toggleInputs();
        saveToLocalStorage();
    });

    calendarType.addEventListener('change', (e) => {
        AppState.userSettings.calendarType = e.target.value;
        handleScheduleGeneration();
        saveToLocalStorage();
    });

    includeShabbatInput.addEventListener('change', (e) => {
        AppState.userSettings.includeShabbat = e.target.checked;
        saveToLocalStorage();
    });

    includeHolidaysInput.addEventListener('change', (e) => {
        AppState.userSettings.includeHolidays = e.target.checked;
        saveToLocalStorage();
    });

    breakDaysInput.addEventListener('input', (e) => {
        AppState.userSettings.breakDays = parseInt(e.target.value, 10) || 0;
        saveToLocalStorage();
    });

    startDafInput.addEventListener('change', (e) => {
        AppState.userSettings.startDaf = e.target.value;
        saveToLocalStorage();
    });

    startAmudInput.addEventListener('change', (e) => {
        AppState.userSettings.startAmud = e.target.value;
        saveToLocalStorage();
    });

    paceInput.addEventListener('change', (e) => {
        AppState.userSettings.pace = e.target.value;
        saveToLocalStorage();
    })

    // --- Date Inputs Sync ---
    const handleDateChange = () => {
        AppState.userSettings.startDate = startDateInput.value;
        AppState.userSettings.targetDate = targetDateInput.value;
        renderDateLabels(AppState.userSettings.startDate, AppState.userSettings.targetDate);
        saveToLocalStorage();
    };

    startDateInput.addEventListener('change', handleDateChange);
    targetDateInput.addEventListener('change', handleDateChange);

    // --- Drag and Drop Event Orchestration ---
    let draggedItemIndex = null;

    trackSequenceList.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.drag-item');
        if (!item) return;
        draggedItemIndex = Number(item.dataset.index);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    trackSequenceList.addEventListener('dragover', (e) => {
        e.preventDefault(); // Required to allow dropping
        const item = e.target.closest('.drag-item');
        if (!item || item.classList.contains('dragging')) return;

        item.classList.add('drag-over');
    });

    trackSequenceList.addEventListener('dragleave', (e) => {
        const item = e.target.closest('.drag-item');
        if (item) item.classList.remove('drag-over');
    });

    trackSequenceList.addEventListener('drop', (e) => {
        e.preventDefault();
        const item = e.target.closest('.drag-item');
        if (!item) return;

        item.classList.remove('drag-over');
        const targetIndex = Number(item.dataset.index);

        if (draggedItemIndex !== null && draggedItemIndex !== targetIndex) {
            // Re-order our global sequence variable
            const reorderedSeq = [...AppState.trackSequence];
            const [removed] = reorderedSeq.splice(draggedItemIndex, 1);
            reorderedSeq.splice(targetIndex, 0, removed);

            // Sync mutated array state back to DOM and store
            AppState.trackSequence = reorderedSeq;
            updateTrackSequenceUI(AppState.trackSequence);
            saveToLocalStorage();
        }
    });

    trackSequenceList.addEventListener('dragend', (e) => {
        const item = e.target.closest('.drag-item');
        if (item) item.classList.remove('dragging');

        // Clean up fallback remnants
        document.querySelectorAll('.drag-item').forEach(el => el.classList.remove('drag-over'));
        draggedItemIndex = null;
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
    console.log("HTML page initialized succesfully");

    initPersistence(AppState);

    loadFromLocalStorage();

    setupEventListeners();

    window.addEventListener('load', initUserConfigPanel);
}

// Executes main initiation function upon page load
document.addEventListener('DOMContentLoaded', init);

/* 
    Handlers
*/

// Orchestrates schedule calculation by piping AppState inputs into the engine and rendering the resulting timeline grid
async function handleScheduleGeneration() {
    // 1. Explicit UI State Check: Is the track sequence empty?
    if (!AppState.trackSequence || AppState.trackSequence.length === 0) {
        // Clear internal state data
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

        // Hide the output wrapper if you don't want an empty wrapper showing
        document.getElementById('output').classList.add('hidden');
        return; // Exit early safely
    }

    try {
        // 2. Core Logic Pipeline Execution (Independent calculation)
        const updatedSchedule = await generateSchedule({
            trackSequence: AppState.trackSequence,
            userSettings: AppState.userSettings,
            manualOverrides: AppState.manualOverrides,
            calendarData: AppState.calendarData
        });

        // 3. Synchronize calculated timeline back into internal state 
        AppState.schedule = updatedSchedule;

        // 4. Command interface rendering safely down inside the UI engine layer
        renderCalendar('calendarContainer', AppState.schedule, {
            calendarType: AppState.userSettings.calendarType,
            overrides: AppState.manualOverrides
        });

        // Reveal view component wrapper
        document.getElementById('output').classList.remove('hidden');

    } catch (error) {
        // Pure error handler catch boundary interface logic (real errors like network, dates, etc.)
        alert(error.message);
    }
}

// Orchestrates date override by passing current manualOverride state and a date into a cycle function
function handleDateOverrideClick(dateString) {
    AppState.manualOverrides = cycleDateOverride(AppState.manualOverrides, dateString);

    saveToLocalStorage();
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

    if(!confirmed) return;

    // Reset user layout variables back to default blueprint values safely
    AppState.userSettings = { ...DEFAULT_USER_SETTINGS };

    // Clear out the track structure arrays separately if desired (optional)
    AppState.trackSequence = [];

    // Synchronize your local files, view layout, and engine calculations
    saveToLocalStorage();
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
    saveToLocalStorage();
    handleScheduleGeneration();
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