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
    const includeHolidaysInput = document.getElementById('includeHolidaysInput');
    const breakDaysInput = document.getElementById('breakDaysInput');
    const startDateInput = document.getElementById('startDateInput');
    const targetDateInput = document.getElementById('targetDateInput');
    const paceInput = document.getElementById('paceInput');
    const startDafInput = document.getElementById('startDafInput');
    const startAmudInput = document.getElementById('startAmudInput');

    // --- Action Listeners ---
    generateBtn.addEventListener('click', async () => {
        await handleScheduleGeneration();

        const listContainer = document.getElementById('trackSequenceList');

        // Only scroll if trackList is empty
        if (listContainer && listContainer.children.length > 0) {
            const calendarContainer = document.getElementById('calendarContainer');

            if (calendarContainer) {
                calendarContainer.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });

    addToSequenceBtn.addEventListener('click', () => {
        AppState.trackSequence = addToSequence(AppState.trackSequence);
        saveToLocalStorage();
    });

    clearSequenceBtn.addEventListener('click', async () => {
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

    // Dynamic Tracking for Study Days Checkboxes
    document.querySelectorAll('input[name="studyDays"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const checkedDays = Array.from(document.querySelectorAll('input[name="studyDays"]:checked'))
                .map(cb => parseInt(cb.value, 10));

            AppState.userSettings.studyDays = checkedDays;
            saveToLocalStorage();
        });
    });

    includeHolidaysInput.addEventListener('change', (e) => {
        AppState.userSettings.includeHolidays = e.target.checked;
        saveToLocalStorage();
        handleScheduleGeneration();
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

    // --- Track Sequence List Drag & Drop ---
    let dragElement = null;     // Original row wrapper hidden/styled in list
    let mirrorElement = null;   // Floating visual copy appended to body
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    trackSequenceList.addEventListener('pointerdown', (e) => {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;

        const row = e.target.closest('.drag-row');
        if (!row) return;

        e.preventDefault();

        dragElement = row;
        trackSequenceList.setPointerCapture(e.pointerId);

        // Target the inner visual card for the mirror blueprint dimensions
        const innerCard = dragElement.querySelector('.drag-item');
        const rect = innerCard.getBoundingClientRect();

        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;

        mirrorElement = innerCard.cloneNode(true);
        mirrorElement.style.position = 'fixed';
        mirrorElement.style.top = `${rect.top}px`;
        mirrorElement.style.left = `${rect.left}px`;
        mirrorElement.style.width = `${rect.width}px`;
        mirrorElement.style.height = `${rect.height}px`;
        mirrorElement.style.pointerEvents = 'none';

        mirrorElement.classList.add('z-[9999]', 'shadow-2xl', 'border-blue-500', 'bg-white/95', 'scale-[1.03]', 'transition-transform', 'duration-100');
        document.body.appendChild(mirrorElement);

        innerCard.classList.add('opacity-40', 'bg-slate-100', 'border-dashed', 'border-slate-300');
        document.body.style.cursor = 'grabbing';
    });

    trackSequenceList.addEventListener('pointermove', (e) => {
        if (!dragElement || !mirrorElement) return;

        mirrorElement.style.top = `${e.clientY - dragOffsetY}px`;
        mirrorElement.style.left = `${e.clientX - dragOffsetX}px`;

        const rows = [...trackSequenceList.querySelectorAll('.drag-row')];
        const mirrorRect = mirrorElement.getBoundingClientRect();
        const mirrorMidY = mirrorRect.top + mirrorRect.height / 2;

        const currentDragIndex = rows.indexOf(dragElement);

        for (let i = 0; i < rows.length; i++) {
            const targetRow = rows[i];
            if (targetRow === dragElement) continue;

            const box = targetRow.getBoundingClientRect();
            const boxMidY = box.top + box.height / 2;

            if (i < currentDragIndex) {
                // DRAGGING UPWARD
                if (mirrorMidY < boxMidY) {
                    trackSequenceList.insertBefore(dragElement, targetRow);
                    break;
                }
            } else {
                // DRAGGING DOWNWARD
                if (mirrorMidY > boxMidY) {
                    trackSequenceList.insertBefore(dragElement, targetRow.nextElementSibling);
                    break;
                }
            }
        }
    });

    const handlePointerUpOrCancel = (e) => {
        if (!dragElement) return;

        try {
            trackSequenceList.releasePointerCapture(e.pointerId);
        } catch (err) { }

        if (mirrorElement) {
            mirrorElement.remove();
            mirrorElement = null;
        }

        const innerCard = dragElement.querySelector('.drag-item');
        if (innerCard) {
            innerCard.classList.remove('opacity-40', 'bg-slate-100', 'border-dashed', 'border-slate-300');
        }
        document.body.style.cursor = '';

        // Read out array indexes matching the updated structural layout order
        const finalDomRows = [...trackSequenceList.querySelectorAll('.drag-row')];
        const updatedSequence = finalDomRows.map(row => AppState.trackSequence[Number(row.dataset.index)]);

        AppState.trackSequence = updatedSequence;

        // Fully synchronizes clean tracking configurations
        updateTrackSequenceUI(AppState.trackSequence);
        saveToLocalStorage();

        dragElement = null;
    };

    trackSequenceList.addEventListener('pointerup', handlePointerUpOrCancel);
    trackSequenceList.addEventListener('pointercancel', handlePointerUpOrCancel);
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

        renderCalendar('calendarContainer', AppState.schedule, {
            calendarType: AppState.userSettings.calendarType,
            overrides: AppState.manualOverrides
        });

        document.getElementById('output').classList.remove('hidden');

    } catch (error) {
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

    if (!confirmed) return;

    AppState.userSettings = { ...DEFAULT_USER_SETTINGS };
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