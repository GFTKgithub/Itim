import { masechtot } from './data.js';
import { hydrateHtmlFromAppState, toggleInputs, updateTrackSequenceUI, renderAmudGrid, renderDailyView, updateModalProgressStats, renderDateLabels, renderCalendar, showDialog } from './ui.js';
import { addToSequence, removeFromSequence, clearSequence } from './track-sequence.js';
import { generateSchedule, cycleDateOverride } from './scheduler.js';
import { initPersistence, saveToLocalStorage, loadFromLocalStorage, exportStateBackup, importStateBackup } from './persistence.js';

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
        saveState();
    });

    clearSequenceBtn.addEventListener('click', async () => {
        AppState.trackSequence = await clearSequence(AppState.trackSequence);
        saveState();
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
            saveState();
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
        saveState();
    });

    calendarType.addEventListener('change', (e) => {
        AppState.userSettings.calendarType = e.target.value;
        handleScheduleGeneration();
        saveState();
    });

    // Dynamic Tracking for Study Days Checkboxes
    document.querySelectorAll('input[name="studyDays"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const checkedDays = Array.from(document.querySelectorAll('input[name="studyDays"]:checked'))
                .map(cb => parseInt(cb.value, 10));

            AppState.userSettings.studyDays = checkedDays;
            saveState();
        });
    });

    includeHolidaysInput.addEventListener('change', (e) => {
        AppState.userSettings.includeHolidays = e.target.checked;
        saveState();
        handleScheduleGeneration();
    });

    breakDaysInput.addEventListener('input', (e) => {
        AppState.userSettings.breakDays = parseInt(e.target.value, 10) || 0;
        saveState();
    });

    startDafInput.addEventListener('change', (e) => {
        AppState.userSettings.startDaf = e.target.value;
        saveState();
    });

    startAmudInput.addEventListener('change', (e) => {
        AppState.userSettings.startAmud = e.target.value;
        saveState();
    });

    paceInput.addEventListener('change', (e) => {
        AppState.userSettings.pace = e.target.value;
        saveState();
    })

    // --- Date Inputs Sync ---
    const handleDateChange = () => {
        AppState.userSettings.startDate = startDateInput.value;
        AppState.userSettings.targetDate = targetDateInput.value;
        renderDateLabels(AppState.userSettings.startDate, AppState.userSettings.targetDate);
        saveState();
    };

    startDateInput.addEventListener('change', handleDateChange);
    targetDateInput.addEventListener('change', handleDateChange);

    // --- Track Sequence List Drag & Drop ---
    let dragElement = null;     // Original row wrapper hidden/styled in list
    let mirrorElement = null;   // Floating visual copy appended to body
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let autoScrollFrameId = null; // Keeps track of the active requestAnimationFrame loop

    // Track the actual live position of the mouse across frames
    let currentMouse = { x: 0, y: 0, pointerId: null };

    trackSequenceList.addEventListener('pointerdown', (e) => {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;

        const row = e.target.closest('.drag-row');
        if (!row) return;

        e.preventDefault();

        dragElement = row;
        trackSequenceList.setPointerCapture(e.pointerId);

        // Populate initial mouse position
        currentMouse.x = e.clientX;
        currentMouse.y = e.clientY;
        currentMouse.pointerId = e.pointerId;

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

    // HELPER FUNCTION
    function updateDragPositionAndSorting() {
        if (!dragElement || !mirrorElement) return;

        const listRect = trackSequenceList.getBoundingClientRect();
        const mirrorRect = mirrorElement.getBoundingClientRect();

        // Calculate and clamp positions based on the LIVE mouse coordinates
        const idealTop = currentMouse.y - dragOffsetY;
        const clampedTop = Math.max(listRect.top, Math.min(idealTop, listRect.bottom - mirrorRect.height));

        mirrorElement.style.top = `${clampedTop}px`;
        mirrorElement.style.left = `${currentMouse.x - dragOffsetX}px`;

        // DOM Reordering Logic
        const rows = [...trackSequenceList.querySelectorAll('.drag-row')];
        const mirrorMidY = clampedTop + mirrorRect.height / 2;
        const currentDragIndex = rows.indexOf(dragElement);

        for (let i = 0; i < rows.length; i++) {
            const targetRow = rows[i];
            if (targetRow === dragElement) continue;

            const box = targetRow.getBoundingClientRect();
            const boxMidY = box.top + box.height / 2;

            if (i < currentDragIndex) {
                if (mirrorMidY < boxMidY) {
                    trackSequenceList.insertBefore(dragElement, targetRow);
                    break;
                }
            } else {
                if (mirrorMidY > boxMidY) {
                    trackSequenceList.insertBefore(dragElement, targetRow.nextElementSibling);
                    break;
                }
            }
        }
    }

    trackSequenceList.addEventListener('pointermove', (e) => {
        if (!dragElement || !mirrorElement) return;

        // CRITICAL: Continuously update the live mouse coordinates as the user physically moves
        currentMouse.x = e.clientX;
        currentMouse.y = e.clientY;

        // Immediately update visual position
        updateDragPositionAndSorting();

        // AUTO-SCROLL EVALUATION
        const listRect = trackSequenceList.getBoundingClientRect();
        const scrollThreshold = 35;
        const scrollSpeed = 6;

        const distanceFromTop = currentMouse.y - listRect.top;
        const distanceFromBottom = listRect.bottom - currentMouse.y;

        let scrollDirection = 0;

        if (distanceFromTop < scrollThreshold && trackSequenceList.scrollTop > 0) {
            scrollDirection = -1;
        } else if (distanceFromBottom < scrollThreshold && (trackSequenceList.scrollTop + listRect.height < trackSequenceList.scrollHeight)) {
            scrollDirection = 1;
        }

        if (scrollDirection !== 0) {
            if (!autoScrollFrameId) {
                const performAutoScroll = () => {
                    if (!dragElement || !mirrorElement) return;

                    // Scroll the container
                    trackSequenceList.scrollTop += scrollDirection * scrollSpeed;

                    // Force an update reading the newly changed mouse location 
                    // (even if it only changed on the X axis!)
                    updateDragPositionAndSorting();

                    autoScrollFrameId = requestAnimationFrame(performAutoScroll);
                };
                autoScrollFrameId = requestAnimationFrame(performAutoScroll);
            }
        } else {
            if (autoScrollFrameId) {
                cancelAnimationFrame(autoScrollFrameId);
                autoScrollFrameId = null;
            }
        }
    });

    const handlePointerUpOrCancel = (e) => {
        if (!dragElement) return;

        // Clean up the running animation loops
        if (autoScrollFrameId) {
            cancelAnimationFrame(autoScrollFrameId);
            autoScrollFrameId = null;
        }

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
        const updatedSequence = finalDomRows.map(row => {
            const entry = AppState.trackSequence[Number(row.dataset.index)];
            // Normalize legacy string entries into full objects
            if (typeof entry === 'string') {
                return { name: entry, reviewDays: 0, amudStates: [] };
            }
            return entry;
        });

        AppState.trackSequence = updatedSequence;

        // Fully synchronizes clean tracking configurations
        updateTrackSequenceUI(AppState.trackSequence);
        saveState();

        dragElement = null;
    };

    trackSequenceList.addEventListener('pointerup', handlePointerUpOrCancel);
    trackSequenceList.addEventListener('pointercancel', handlePointerUpOrCancel);

    trackSequenceList.addEventListener('click', (e) => {
        // 1. Correctly isolate the button element, even if they click the ⚙️ emoji text inside it
        const configBtn = e.target.closest('.configure-btn');
        if (!configBtn) return;

        // 2. Parse string index explicitly to base-10 Integer
        currentEditingIndex = parseInt(configBtn.getAttribute('data-index'), 10);

        // 3. Safety check: does this index actually exist in your track array?
        const masechet = AppState.trackSequence[currentEditingIndex];
        if (!masechet) {
            console.error(`Masechet not found at index: ${currentEditingIndex}`);
            return;
        }

        // 4. Extract name safely supporting both legacy string format and new object format
        const masechetName = typeof masechet === 'string' ? masechet : (masechet.name || "לא ידוע");

        // 5. Hydrate Modal UI text inputs
        document.getElementById('configModalTitle').innerText = `הגדרות מסכת ${masechetName}`;
        document.getElementById('configReviewDays').value = masechet.reviewDays || 0;

        // 6. Safeguard amudStates array generation if it doesn't exist yet
        if (!masechet.amudStates || masechet.amudStates.length === 0) {
            tempAmudStates = new Array(120).fill(0);
        } else {
            tempAmudStates = [...masechet.amudStates];
        }

        // 7. Pre-compute per-day amud slots for this masechet
        currentDaySlots = computeDaySlots(AppState.schedule, masechetName, currentEditingIndex, AppState.trackSequence);

        // 8. Always open in amud view; reset tab styling
        isBunchedView = false;
        setActiveView('individual');
        renderAmudGrid('amudGridContainer', tempAmudStates, false);
        updateModalProgressStats(tempAmudStates);

        // 9. Open it
        document.getElementById('masechetConfigModal').classList.remove('hidden');
    });

    // Grid Interaction (Cycling states)
    document.getElementById('amudGridContainer').addEventListener('click', (e) => {
        const btn = e.target.closest('.amud-btn');
        if (!btn) return;

        const idx = parseInt(btn.dataset.amudIdx);

        if (isBunchedView) {
            // Toggle both Amud A and B of the same Daf
            const isAmudA = idx % 2 === 0;
            const partnerIdx = isAmudA ? idx + 1 : idx - 1;
            const nextState = (tempAmudStates[idx] + 1) % 3;

            tempAmudStates[idx] = nextState;
            if (partnerIdx >= 0 && partnerIdx < tempAmudStates.length) {
                tempAmudStates[partnerIdx] = nextState;
            }
        } else {
            // Individual cycle
            tempAmudStates[idx] = (tempAmudStates[idx] + 1) % 3;
        }

        renderAmudGrid('amudGridContainer', tempAmudStates, isBunchedView);
        updateModalProgressStats(tempAmudStates);
    });

    // Save Logic
    document.getElementById('saveConfigBtn').addEventListener('click', () => {
        let masechet = AppState.trackSequence[currentEditingIndex];

        // Normalize legacy string entries into full objects before writing properties
        if (typeof masechet === 'string') {
            masechet = { name: masechet, reviewDays: 0, amudStates: [...tempAmudStates] };
            AppState.trackSequence[currentEditingIndex] = masechet;
        }

        masechet.reviewDays = parseInt(document.getElementById('configReviewDays').value, 10) || 0;
        masechet.amudStates = [...tempAmudStates];

        saveState();

        // Re-render the progress bar
        updateTrackSequenceUI(AppState.trackSequence);

        document.getElementById('masechetConfigModal').classList.add('hidden');
        handleScheduleGeneration(); // Refresh the calendar with new start points
    });

    // Cancel/Close
    const closeConfig = () => document.getElementById('masechetConfigModal').classList.add('hidden');
    document.getElementById('closeConfigModal').addEventListener('click', closeConfig);
    document.getElementById('cancelConfigBtn').addEventListener('click', closeConfig);

    // --- View Switching ---
    // Helper: shows the right container and highlights the active tab button
    function setActiveView(view) {
        const amudGrid    = document.getElementById('amudGridContainer');
        const dailyView   = document.getElementById('dailyViewContainer');
        const btnIndividual = document.getElementById('toggleViewIndividual');
        const btnBunched    = document.getElementById('toggleViewBunched');
        const btnDaily      = document.getElementById('toggleViewDaily');

        // Reset all tab styles
        [btnIndividual, btnBunched, btnDaily].forEach(btn => {
            btn.classList.remove('bg-white', 'shadow-sm');
            btn.classList.add('text-slate-500');
        });

        if (view === 'daily') {
            amudGrid.classList.add('hidden');
            dailyView.classList.remove('hidden');
            btnDaily.classList.add('bg-white', 'shadow-sm');
            btnDaily.classList.remove('text-slate-500');
        } else {
            amudGrid.classList.remove('hidden');
            dailyView.classList.add('hidden');
            if (view === 'bunched') {
                btnBunched.classList.add('bg-white', 'shadow-sm');
                btnBunched.classList.remove('text-slate-500');
            } else {
                btnIndividual.classList.add('bg-white', 'shadow-sm');
                btnIndividual.classList.remove('text-slate-500');
            }
        }
    }

    document.getElementById('toggleViewIndividual').addEventListener('click', () => {
        isBunchedView = false;
        setActiveView('individual');
        renderAmudGrid('amudGridContainer', tempAmudStates, false);
    });

    document.getElementById('toggleViewBunched').addEventListener('click', () => {
        isBunchedView = true;
        setActiveView('bunched');
        renderAmudGrid('amudGridContainer', tempAmudStates, true);
    });

    document.getElementById('toggleViewDaily').addEventListener('click', () => {
        setActiveView('daily');
        renderDailyView('dailyViewContainer', currentDaySlots, tempAmudStates);
    });

    // Daily view: cycle day slot state — unlearned → all learned → all skipped → unlearned
    document.getElementById('dailyViewContainer').addEventListener('click', (e) => {
        const btn = e.target.closest('.day-slot-btn');
        if (!btn) return;
        const slot = currentDaySlots[parseInt(btn.dataset.slotIdx)];
        if (!slot) return;

        // Determine current aggregate state
        let learnedCount = 0, skippedCount = 0;
        for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
            if (i < tempAmudStates.length) {
                if (tempAmudStates[i] === 1) learnedCount++;
                else if (tempAmudStates[i] === 2) skippedCount++;
            }
        }
        const isFullyLearned = learnedCount === slot.amudCount;
        const isFullySkipped = skippedCount === slot.amudCount;

        // Cycle: unlearned (or partial) → all learned → all skipped → unlearned
        const newState = isFullyLearned ? 2 : isFullySkipped ? 0 : 1;
        for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
            if (i < tempAmudStates.length) tempAmudStates[i] = newState;
        }

        renderDailyView('dailyViewContainer', currentDaySlots, tempAmudStates);
        updateModalProgressStats(tempAmudStates);
    });

    // Mark today: finds today's slot and cycles its state (same 3-way cycle as above)
    document.getElementById('markTodayBtn').addEventListener('click', () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const slot = currentDaySlots.find(s => s.dateString === todayStr);

        if (!slot) {
            showDialog({ title: 'לא נמצא', message: 'לא נמצא שיעור מתוכנן להיום במסכת זו.', icon: '📅', confirmText: 'הבנתי' });
            return;
        }

        let learnedCount = 0, skippedCount = 0;
        for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
            if (i < tempAmudStates.length) {
                if (tempAmudStates[i] === 1) learnedCount++;
                else if (tempAmudStates[i] === 2) skippedCount++;
            }
        }
        const isFullyLearned = learnedCount === slot.amudCount;
        const isFullySkipped = skippedCount === slot.amudCount;
        const newState = isFullyLearned ? 2 : isFullySkipped ? 0 : 1;

        for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
            if (i < tempAmudStates.length) tempAmudStates[i] = newState;
        }

        renderAmudGrid('amudGridContainer', tempAmudStates, isBunchedView);
        renderDailyView('dailyViewContainer', currentDaySlots, tempAmudStates);
        updateModalProgressStats(tempAmudStates);
    });

    // Sync to today (Global Version): marks past study days for ALL track sequence items as learned
    document.getElementById('syncToTodayBtn').addEventListener('click', async () => {
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
            // Normalize legacy string entries into full objects if necessary
            if (typeof masechet === 'string') {
                masechet = { name: masechet, reviewDays: 0, amudStates: [] };
                AppState.trackSequence[trackIdx] = masechet;
            }

            const masechetName = masechet.name || "לא ידוע";
            
            // Get target data to find amudCount
            const targetData = masechtot.find(m => m.name === masechetName);
            const totalAmudim = targetData ? (targetData.amudCount || 120) : 120;

            // Ensure the amudStates array is instantiated
            if (!masechet.amudStates || masechet.amudStates.length === 0) {
                masechet.amudStates = new Array(totalAmudim).fill(0);
            }

            // 4. Dynamically compute the slots for this specific Masechet on the fly
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
    });

    // --- Firebase Auth & Cloud Sync Listeners ---
    const cloudLoggedOut = document.getElementById('cloudLoggedOut');
    const cloudLoggedIn = document.getElementById('cloudLoggedIn');
    const cloudUserEmail = document.getElementById('cloudUserEmail');

    const cloudEmail = document.getElementById('cloudEmail');
    const cloudPassword = document.getElementById('cloudPassword');

    const cloudLoginBtn = document.getElementById('cloudLoginBtn');
    const cloudRegisterBtn = document.getElementById('cloudRegisterBtn');
    const cloudLogoutBtn = document.getElementById('cloudLogoutBtn');
    const cloudFetchBtn = document.getElementById('cloudFetchBtn');

    // Monitor authentication shifts automatically
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User logged in: flip UI cards
            cloudLoggedOut.classList.add('hidden');
            cloudLoggedIn.classList.remove('hidden');
            cloudUserEmail.innerText = user.email;
        } else {
            // User logged out: restore default inputs
            cloudLoggedOut.classList.remove('hidden');
            cloudLoggedIn.classList.add('hidden');
            cloudUserEmail.innerText = '';
        }
    });

    // Create account handling
    cloudRegisterBtn.addEventListener('click', async () => {
        const email = cloudEmail.value.trim();
        const password = cloudPassword.value;
        if (!email || !password) return alert("נא להזין אימייל וסיסמה");

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            alert("החשבון נוצר וחובר בהצלחה!");
        } catch (err) {
            alert(`שגיאת רישום: ${err.message}`);
        }
    });

    // Login handling
    cloudLoginBtn.addEventListener('click', async () => {
        const email = cloudEmail.value.trim();
        const password = cloudPassword.value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            alert(`שגיאת התחברות: ${err.message}`);
        }
    });

    // Logout handling
    cloudLogoutBtn.addEventListener('click', () => signOut(auth));

    // Forceful down-sync pulling action
    cloudFetchBtn.addEventListener('click', async () => {
        const success = await loadFromFirebase();
        if (success) {
            alert("הנתונים נמשכו מהענן בהצלחה! העמוד יתעדכן.");

            // Re-render UI views based on the freshly updated AppState variables
            initUserConfigPanel();
            handleScheduleGeneration();
        } else {
            alert("לא נמצאו נתונים שמורים בענן עבור משתמש זה.");
        }
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

    setupEventListeners();

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