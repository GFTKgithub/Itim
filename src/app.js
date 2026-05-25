import { masechtot } from './data.js';
import { hydrateHtmlFromAppState, toggleInputs, updateTrackSequenceUI, renderDateLabels, renderCalendar } from './ui.js';
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
    const sequenceList = document.getElementById('trackSequenceList');
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
    // generateBtn.addEventListener('click', generate);
    generateBtn.addEventListener('click', handleScheduleGeneration);

    addToSequenceBtn.addEventListener('click', () => {
        AppState.trackSequence = addToSequence(AppState.trackSequence);
        saveToLocalStorage();
    });

    clearSequenceBtn.addEventListener('click', () => 
    {
        AppState.trackSequence = clearSequence(AppState.trackSequence);
        saveToLocalStorage();
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
    sequenceList.addEventListener('click', (event) => {
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
        // generate();
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

// Orchestrates schedule calculation by piping AppState inputs into the engine and rendering the resulting timeline grid
async function handleScheduleGeneration() {
    try {
        // 1. Core Logic Pipeline Execution (Independent calculation)
        const updatedSchedule = await generateSchedule({
            trackSequence: AppState.trackSequence,
            userSettings: AppState.userSettings,
            manualOverrides: AppState.manualOverrides,
            calendarData: AppState.calendarData
        });

        // 2. Synchronize calculated timeline back into internal state 
        AppState.schedule = updatedSchedule;

        // 3. Command interface rendering safely down inside the UI engine layer
        renderCalendar('calendarContainer', AppState.schedule, {
            calendarType: AppState.userSettings.calendarType,
            overrides: AppState.manualOverrides
        });

        // Reveal view component wrapper
        document.getElementById('output').classList.remove('hidden');

    } catch (error) {
        // Pure error handler catch boundary interface logic
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
function handleResetSettings() {
    if (!confirm("האם אתה בטוח שברצונך לאפס את כל ההגדרות והקצב לברירת המחדל?")) return;

    // Reset user layout variables back to default blueprint values safely
    AppState.userSettings = { ...DEFAULT_USER_SETTINGS };

    // Clear out the track structure arrays separately if desired (optional)
    AppState.trackSequence = [];

    // Synchronize your local files, view layout, and engine calculations
    saveToLocalStorage();
    initUserConfigPanel();    // Repopulates form inputs with the fresh AppState.userSettings values
    renderTrackSequence();    // Re-renders the list layout (now empty)
    handleScheduleGeneration(); // Generates empty/default state layout cleanly
}

// Erases targeted timeline override blocks completely while leaving configuration controls alone
function handleResetManualOverrides() {
    if (Object.keys(AppState.manualOverrides).length === 0) {
        alert("לא נמצאו שינויים ידניים בלוח הקיים.");
        return;
    }

    if (!confirm("האם אתה בטוח שברצונך למחוק את כל חסימות התאריכים והשינויים הידניים שביצעת?")) return;

    // Wipe out the map object completely
    AppState.manualOverrides = {};

    // Save state changes and re-run calculations
    saveToLocalStorage();
    handleScheduleGeneration();
}