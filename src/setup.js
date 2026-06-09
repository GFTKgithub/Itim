import { talmud_bavli_masechtot } from "./data.js";
import { HEBREW_MILESTONE_DATES, getNearestHebrewMilestone } from "./utils/dates.js";

import { showDialog } from "./ui/components.js";
import { ContextMenuTemplates, showContextMenu } from "./ui/context-menu.js";

// --- 1. Main Controls ---
export function setupMainControls({ onGenerate, onAddNewTrack, onSwitchTrack, onAddToSequence, onClearSequence, onExportExcel, onExportICal}) {
    const select = document.getElementById('bookSelect');
    const generateBtn = document.getElementById('generateBtn');
    const addToSequenceBtn = document.getElementById('addToSequenceBtn');
    const clearSequenceBtn = document.getElementById('clearSequenceBtn');
    const icalBtn = document.getElementById('exportToICalBtn');
    const exportBtn = document.getElementById('exportToExcelBtn');
    const printBtn = document.getElementById('printBtn');
    
    // Handle the "Add New Track" button click to create a new track based on the selected masechet
    document.getElementById('addNewTrackBtn').addEventListener('click', async () => {
        const inputInput = document.getElementById('newTrackNameInput');
        const name = inputInput.value;
        
        await onAddNewTrack(name);
        
        inputInput.value = ""; 
    });
    
    // Handle track switching from the dropdown
    document.getElementById('trackSelectDropdown').addEventListener('change', async (e) => {
        const selectedTrackId = e.target.value;

        onSwitchTrack(selectedTrackId);
    });

    talmud_bavli_masechtot.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.innerText = m.name;
        select.appendChild(opt);
    });

    generateBtn?.addEventListener('click', async () => {
        // 1. Tell the controller to generate the schedule and wait for it to finish
        await onGenerate();
        
        // 2. Pure UI Behavior: Handle smooth scrolling locally
        const listContainer = document.getElementById('bookSequenceList');
        if (listContainer && listContainer.children.length > 0) {
            document.getElementById('calendarContainer')?.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
    });

    addToSequenceBtn?.addEventListener('click', () => {
        onAddToSequence();
    });

    clearSequenceBtn?.addEventListener('click', () => {
        onClearSequence();
    });

    icalBtn?.addEventListener('click', () => {
        onExportICal();
    });

    exportBtn?.addEventListener('click', () => {
        onExportExcel();
    });

    printBtn?.addEventListener('click', () => window.print());
}

// --- 2. Backup Management ---
export function setupBackupManagement({onExport, onImport, onResetSettings, onResetStudyStatusOverrides}) {
    const backupExportBtn = document.getElementById('backupExportBtn');
    const backupImportBtn = document.getElementById('backupImportBtn');
    const backupFileInput = document.getElementById('backupFileInput');
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');
    const resetStudyStatusOverridesBtn = document.getElementById('resetStudyStatusOverridesBtn');

    backupExportBtn?.addEventListener('click', onExport);
    backupImportBtn?.addEventListener('click', () => backupFileInput.click());
    backupFileInput?.addEventListener('change', onImport);
    resetSettingsBtn?.addEventListener('click', onResetSettings);
    resetStudyStatusOverridesBtn?.addEventListener('click', onResetStudyStatusOverrides);
}

// --- 3. Settings Synchronization ---
export function setupSettings({ userPreferences, onUpdateUserPreference, onUpdateTrackSetting, onGenerate, onSyncToToday }) {
    const calendarSystem = document.getElementById('calendarSystem');
    const includeHolidaysInput = document.getElementById('includeHolidaysInput');
    const includeBeinHazmanimInput = document.getElementById('includeBeinHazmanimInput');
    const startDateInput = document.getElementById('startDateInput');

    calendarSystem?.addEventListener('change', (e) => {
        onUpdateTrackSetting('calendarSystem', e.target.value);
        onGenerate();
    });

    document.querySelectorAll('input[name="studyDays"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const selectedDays = Array.from(document.querySelectorAll('input[name="studyDays"]:checked'))
                .map(cb => parseInt(cb.value, 10));

            onUpdateTrackSetting('studyDays', selectedDays);
            onGenerate(); 
        });
    });

    includeHolidaysInput?.addEventListener('change', (e) => {
        onUpdateTrackSetting('includeHolidays', e.target.checked);
        onGenerate();
    });

    // Add this block below the holiday tracking logic:
    includeBeinHazmanimInput?.addEventListener('change', (e) => {
        onUpdateTrackSetting('includeBeinHazmanim', e.target.checked);
        onGenerate();
    });

    const handleDateChange = () => {
        onUpdateTrackSetting('startDate', startDateInput.value);
    };

    startDateInput?.addEventListener('change', handleDateChange);

    document.getElementById('syncToTodayBtn')?.addEventListener('click', () => {
        if (onSyncToToday) onSyncToToday();
    });

    // Replace the old block toggle references...
    const toggleSettingsPanelBtn = document.getElementById('toggleSettingsPanelBtn');
    const settingsDrawer = document.getElementById('settingsDrawer');
    const drawerOverlay = document.getElementById('drawerOverlay');
    const drawerPanel = document.getElementById('drawerPanel');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');

    const minimalistUiToggle = document.getElementById('minimalistUiToggle');
    const calendarContainer = document.getElementById('calendarContainer');
    const syncUserPreferencesToggle = document.getElementById('syncUserPreferences');
        
    // --- Settings Drawer Open/Close Interactivity Engines ---
    function openDrawer() {
        if (!settingsDrawer || !drawerOverlay || !drawerPanel) return;
        
        settingsDrawer.classList.remove('pointer-events-none', 'invisible');
        
        // Quick timeout ensures Tailwind runs opacity and translation animations concurrently
        setTimeout(() => {
            drawerOverlay.classList.remove('opacity-0');
            drawerOverlay.classList.add('opacity-100');
            drawerPanel.classList.remove('translate-x-full');
            drawerPanel.classList.add('translate-x-0');
        }, 10);
    }

    function closeDrawer() {
        if (!settingsDrawer || !drawerOverlay || !drawerPanel) return;
        
        drawerOverlay.classList.remove('opacity-100');
        drawerOverlay.classList.add('opacity-0');
        drawerPanel.classList.remove('translate-x-0');
        drawerPanel.classList.add('translate-x-full');
        
        // Completely disable interactions once animations conclude
        setTimeout(() => {
            settingsDrawer.classList.add('pointer-events-none', 'invisible');
        }, 300);
    }

    // Open command
    if (toggleSettingsPanelBtn) {
        toggleSettingsPanelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openDrawer();
        });
    }

    closeDrawerBtn?.addEventListener('click', closeDrawer);
    drawerOverlay?.addEventListener('click', closeDrawer);
        

    // Minimal Calendar
    const isMinimal = userPreferences?.is_minimalCalendar === true || userPreferences?.is_minimalCalendar === 'true';
    
    if (minimalistUiToggle && calendarContainer) {
        minimalistUiToggle.checked = isMinimal;
        if (isMinimal) {
            calendarContainer.classList.add('minimal-calendar');
        } else {
            calendarContainer.classList.remove('minimal-calendar');
        }
    }
    
    minimalistUiToggle?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        
        if (typeof onUpdateUserPreference === 'function') {
            onUpdateUserPreference('minimalCalendar', checked);
        }
        
        if (checked) {
            calendarContainer.classList.add('minimal-calendar');
        } else {
            calendarContainer.classList.remove('minimal-calendar');
        }
    
        if (typeof onGenerate === 'function') {
            onGenerate();            
        }
    });

    syncUserPreferencesToggle?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        
        onUpdateUserPreference('syncUserPreferences', checked)

        if (typeof saveSettings === 'function') {
            onSaveState(); 
        }
    });
}

// --- 4. Book Sequence Drag and Drop Interaction ---
export function setupBookSequenceDragAndDrop({ onReorder, onRemove }) {
    const bookSequenceList = document.getElementById('bookSequenceList');
    if (!bookSequenceList) return;

    let dragElement = null;
    let mirrorElement = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let autoScrollFrameId = null;
    let currentMouse = { x: 0, y: 0, pointerId: null };

    function updateDragPositionAndSorting() {
        if (!dragElement || !mirrorElement) return;
        const listRect = bookSequenceList.getBoundingClientRect();
        const mirrorRect = mirrorElement.getBoundingClientRect();
        const idealTop = currentMouse.y - dragOffsetY;
        const clampedTop = Math.max(listRect.top, Math.min(idealTop, listRect.bottom - mirrorRect.height));

        mirrorElement.style.top = `${clampedTop}px`;
        mirrorElement.style.left = `${currentMouse.x - dragOffsetX}px`;

        const rows = [...bookSequenceList.querySelectorAll('.drag-row')];
        const mirrorMidY = clampedTop + mirrorRect.height / 2;
        const currentDragIndex = rows.indexOf(dragElement);

        for (let i = 0; i < rows.length; i++) {
            const targetRow = rows[i];
            if (targetRow === dragElement) continue;

            const box = targetRow.getBoundingClientRect();
            const boxMidY = box.top + box.height / 2;

            if (i < currentDragIndex && mirrorMidY < boxMidY) {
                bookSequenceList.insertBefore(dragElement, targetRow);
                break;
            } else if (i > currentDragIndex && mirrorMidY > boxMidY) {
                bookSequenceList.insertBefore(dragElement, targetRow.nextElementSibling);
                break;
            }
        }
    }

    bookSequenceList.addEventListener('pointerdown', (e) => {
        const handle = e.target.closest('.drag-handle');
        const row = e.target.closest('.drag-row');
        if (!handle || !row) return;

        e.preventDefault();
        dragElement = row;
        bookSequenceList.setPointerCapture(e.pointerId);

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

    bookSequenceList.addEventListener('pointermove', (e) => {
        if (!dragElement || !mirrorElement) return;
        currentMouse.x = e.clientX;
        currentMouse.y = e.clientY;
        updateDragPositionAndSorting();

        const listRect = bookSequenceList.getBoundingClientRect();
        const scrollThreshold = 35;
        const distanceFromTop = currentMouse.y - listRect.top;
        const distanceFromBottom = listRect.bottom - currentMouse.y;
        let scrollDirection = 0;

        if (distanceFromTop < scrollThreshold && bookSequenceList.scrollTop > 0) scrollDirection = -1;
        else if (distanceFromBottom < scrollThreshold && (bookSequenceList.scrollTop + listRect.height < bookSequenceList.scrollHeight)) scrollDirection = 1;

        if (scrollDirection !== 0) {
            if (!autoScrollFrameId) {
                const performAutoScroll = () => {
                    if (!dragElement || !mirrorElement) return;
                    bookSequenceList.scrollTop += scrollDirection * 6;
                    updateDragPositionAndSorting();
                    autoScrollFrameId = requestAnimationFrame(performAutoScroll);
                };
                autoScrollFrameId = requestAnimationFrame(performAutoScroll);
            }
        } else if (autoScrollFrameId) {
            cancelAnimationFrame(autoScrollFrameId);
            autoScrollFrameId = null;
        }
    });

    const handlePointerUpOrCancel = (e) => {
        if (!dragElement) return;
        if (autoScrollFrameId) { cancelAnimationFrame(autoScrollFrameId); autoScrollFrameId = null; }
        
        try { bookSequenceList.releasePointerCapture(e.pointerId); } catch (err) { }
        
        if (mirrorElement) { mirrorElement.remove(); mirrorElement = null; }
        
        const innerCard = dragElement.querySelector('.drag-item');
        if (innerCard) innerCard.classList.remove('opacity-40', 'bg-slate-100', 'border-dashed', 'border-slate-300');
        document.body.style.cursor = '';

        // Extract the new order of indices from the DOM layout
        const finalDomRows = [...bookSequenceList.querySelectorAll('.drag-row')];
        const newOrderOfIndices = finalDomRows.map(row => Number(row.dataset.index));

        // Pass the pure data back up to the controller
        onReorder(newOrderOfIndices);
        
        dragElement = null;
    };

    bookSequenceList.addEventListener('pointerup', handlePointerUpOrCancel);
    bookSequenceList.addEventListener('pointercancel', handlePointerUpOrCancel);

    bookSequenceList.addEventListener('click', (event) => {
        const removeBtn = event.target.closest('.remove-btn');
        if (removeBtn) {
            // Alert the controller that an item wants to be removed
            onRemove(Number(removeBtn.dataset.index));
        }
    });
}

// --- 5. Book Config Modal ---
export function setupBookConfigModal({ getSchedule, getBookSequence, getBookRangeLimits, computeDaySlots, renderAmudGrid, renderDailyView, updateModalProgressStats, onSaveConfig, onStudyStatusOverride }) {
    let currentEditingIndex = null;
    let tempAmudStates = [];
    let currentDaySlots = [];
    let isBunchedView = false;

    const bookSequenceList = document.getElementById('bookSequenceList');
    const amudGridContainer = document.getElementById('amudGridContainer');
    const dailyViewContainer = document.getElementById('dailyViewContainer');
    const configModal = document.getElementById('bookConfigModal');

    // Modal Injected Control Elements
    const configCalcMethod = document.getElementById('bookConfigCalcMethod');
    const configPaceSection = document.getElementById('bookConfigPaceSection');
    const configTargetDateSection = document.getElementById('bookConfigTargetDateSection');
    const configPaceInput = document.getElementById('bookConfigPaceInput');
    const configTargetDateInput = document.getElementById('bookConfigTargetDateInput');

    // Dynamic Visibility Toggle Engine for Modal Inputs
    function toggleModalFields(method) {
        if (method === 'targetDate') {
            configPaceSection?.classList.add('hidden');
            configTargetDateSection?.classList.remove('hidden');
        } else {
            configPaceSection?.classList.remove('hidden');
            configTargetDateSection?.classList.add('hidden');
        }
    }

    // Bind change listener for internal modal dropdown
    configCalcMethod?.addEventListener('change', (e) => {
        toggleModalFields(e.target.value);
    });

    function setActiveView(view) {
        const btnIndividual = document.getElementById('toggleViewIndividual');
        const btnBunched = document.getElementById('toggleViewBunched');
        const btnDaily = document.getElementById('toggleViewDaily');

        [btnIndividual, btnBunched, btnDaily].forEach(btn => {
            btn?.classList.remove('bg-white', 'shadow-sm');
            btn?.classList.add('text-slate-500');
        });

        if (view === 'daily') {
            amudGridContainer.classList.add('hidden');
            dailyViewContainer.classList.remove('hidden');
            btnDaily?.classList.add('bg-white', 'shadow-sm');
            btnDaily?.classList.remove('text-slate-500');
        } else {
            amudGridContainer.classList.remove('hidden');
            dailyViewContainer.classList.add('hidden');
            if (view === 'bunched') {
                btnBunched?.classList.add('bg-white', 'shadow-sm');
                btnBunched?.classList.remove('text-slate-500');
            } else {
                btnIndividual?.classList.add('bg-white', 'shadow-sm');
                btnIndividual?.classList.remove('text-slate-500');
            }
        }
    }

    bookSequenceList?.addEventListener('click', (e) => {
        const configBtn = e.target.closest('.configure-btn');
        if (!configBtn) return;

        currentEditingIndex = parseInt(configBtn.getAttribute('data-index'), 10);
        
        const currentBookSequence = getBookSequence();
        const currentSchedule = getSchedule();

        const book = currentBookSequence[currentEditingIndex];
        if (!book) return;

        const bookName = typeof book === 'string' ? book : (book.name || "לא ידוע");
        document.getElementById('bookConfigModalTitle').innerText = `הגדרות מסכת ${bookName}`;
        document.getElementById('bookConfigReviewDays').value = book.reviewDays || 0;

        // --- ENFORCE SYNCHRONOUS CONSTRAINTS ---
        const limits = getBookRangeLimits(currentEditingIndex);
        if (configTargetDateInput && limits.minDate) {
            // This safely forces the native HTML popup UI to gray out and disable invalid dates
            configTargetDateInput.min = limits.minDate; 
            
            // Validation fallback correction
            if (book.targetDate && book.targetDate < limits.minDate) {
                book.targetDate = limits.minDate;
            }
        }

        const savedMethod = book.calcMethod || 'pace';
        const savedPace = book.paceValue !== undefined ? book.paceValue : 1;
        const savedTargetDate = book.targetDate || limits.minDate || ''; // Fallback to min acceptable baseline date

        if (configCalcMethod) configCalcMethod.value = savedMethod;
        if (configPaceInput) configPaceInput.value = savedPace;
        if (configTargetDateInput) configTargetDateInput.value = savedTargetDate;

        toggleModalFields(savedMethod);

        tempAmudStates = (!book.amudStates || book.amudStates.length === 0) 
            ? new Array(120).fill(0) 
            : [...book.amudStates];

        currentDaySlots = computeDaySlots(currentSchedule, bookName, currentEditingIndex, currentBookSequence);
        isBunchedView = false;
        setActiveView('individual');
        renderAmudGrid('amudGridContainer', tempAmudStates, false);
        updateModalProgressStats(tempAmudStates);
        configModal.classList.remove('hidden');
    });

    amudGridContainer?.addEventListener('click', (e) => {
        const btn = e.target.closest('.amud-btn');
        if (!btn) return;
        
        const idx = parseInt(btn.dataset.amudIdx, 10);
        if (isNaN(idx)) return;

        if (isBunchedView) {
            // Bunched shifts toggle logic for both Amud Alef (.) and Amud Bet (:) at once
            const partnerIdx = (idx % 2 === 0) ? idx + 1 : idx - 1;
            const nextState = (tempAmudStates[idx] + 1) % 3; // Cycle cleanly: 0 (Unlearned) -> 1 (Learned) -> 2 (Skipped)
            
            tempAmudStates[idx] = nextState;
            if (partnerIdx >= 0 && partnerIdx < tempAmudStates.length) {
                tempAmudStates[partnerIdx] = nextState;
            }
        } else {
            // Individual item toggling sequence state calculation
            tempAmudStates[idx] = (tempAmudStates[idx] + 1) % 3;
        }

        // Force structural redrawing profiles immediately
        renderAmudGrid('amudGridContainer', tempAmudStates, isBunchedView);
        updateModalProgressStats(tempAmudStates);
    });

    dailyViewContainer?.addEventListener('click', (e) => {
        const btn = e.target.closest('.day-slot-btn');
        if (!btn) return;
        const slot = currentDaySlots[parseInt(btn.dataset.slotIdx)];
        if (!slot) return;

        let learnedCount = 0, skippedCount = 0;
        for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
            if (i < tempAmudStates.length) {
                if (tempAmudStates[i] === 1) learnedCount++;
                else if (tempAmudStates[i] === 2) skippedCount++;
            }
        }
        const newState = (learnedCount === slot.amudCount) ? 2 : (skippedCount === slot.amudCount) ? 0 : 1;
        for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
            if (i < tempAmudStates.length) tempAmudStates[i] = newState;
        }
        renderDailyView('dailyViewContainer', currentDaySlots, tempAmudStates);
        updateModalProgressStats(tempAmudStates);
    });

    document.getElementById('saveConfigBtn')?.addEventListener('click', () => {
        const reviewDays = parseInt(document.getElementById('bookConfigReviewDays').value, 10) || 0;
        
        onSaveConfig({
            index: currentEditingIndex,
            reviewDays: reviewDays,
            amudStates: [...tempAmudStates]
        });

        configModal.classList.add('hidden');
    });

    const closeConfig = () => configModal.classList.add('hidden');
    document.getElementById('closeBookConfigModal')?.addEventListener('click', closeConfig);
    document.getElementById('cancelConfigBtn')?.addEventListener('click', closeConfig);

    document.getElementById('toggleViewIndividual')?.addEventListener('click', () => { isBunchedView = false; setActiveView('individual'); renderAmudGrid('amudGridContainer', tempAmudStates, false); });
    document.getElementById('toggleViewBunched')?.addEventListener('click', () => { isBunchedView = true; setActiveView('bunched'); renderAmudGrid('amudGridContainer', tempAmudStates, true); });
    document.getElementById('toggleViewDaily')?.addEventListener('click', () => { setActiveView('daily'); renderDailyView('dailyViewContainer', currentDaySlots, tempAmudStates); });

    document.getElementById('calendarContainer')?.addEventListener('click', (event) => {
        const calendarDay = event.target.closest('.calendar-day');
        if (calendarDay?.dataset.date) {
            onStudyStatusOverride(calendarDay.dataset.date);
        }
    });

    document.getElementById('markTodayBtn')?.addEventListener('click', () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const slot = currentDaySlots.find(s => s.dateString === todayStr);

        if (!slot) {
            alert('לא נמצא שיעור מתוכנן להיום במסכת זו.');
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

    const dropdown = document.getElementById('bookConfigDateTemplate');
    const dateInput = document.getElementById('bookConfigTargetDateInput');

    if (!dropdown || !dateInput) return;

    dropdown.addEventListener('change', (e) => {
        const key = e.target.value;
        const template = HEBREW_MILESTONE_DATES[key];

        if (!template) return;

        // Calculate and apply cleanly
        const calculatedISODate = getNearestHebrewMilestone(template);
        dateInput.value = calculatedISODate;

        // Fire event down the pipeline to let track validations react naturally
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

// --- 6. Cloud Authentication ---
export function setupCloudAuth({ onRegister, onLogin, onLogout, onFetchData }) {
    let currentLoggedUserEmail = null;

    // Explicit confirmation wrapper used across the entire authentication instance
    async function triggerExplicitLogoutSequence() {
        const verifyLogout = await showDialog({
            title: "התנתקות מהחשבון",
            message: "האם אתה בטוח שברצונך להתנתק ממערכת הסנכרון העננית?",
            icon: "🚪",
            showCancel: true,
            confirmText: "כן, התנתק",
            cancelText: "ביטול"
        });

        if (verifyLogout === true && onLogout) {
            onLogout();
        }
    }

    async function handleAuthInteraction() {
        if (currentLoggedUserEmail) {
            // Intercept buttons right before your global component promises can swallow the click intent
            const confirmBtn = document.getElementById('dialogConfirmBtn');
            const cancelBtn = document.getElementById('dialogCancelBtn');
            
            let explicitButtonClick = null;

            const handleConfirmClick = () => { explicitButtonClick = 'FETCH'; };
            const handleCancelClick = () => { explicitButtonClick = 'LOGOUT'; };

            // Temporarily watch for direct user interaction
            confirmBtn?.addEventListener('click', handleConfirmClick);
            cancelBtn?.addEventListener('click', handleCancelClick);

            await showDialog({
                title: "ניהול חשבון סנכרון",
                message: `מחובר כעת כחלק מ: ${currentLoggedUserEmail}`,
                icon: "☁️",
                showCancel: true,
                confirmText: "משוך נתונים מהענן",
                cancelText: "התנתק מהחשבון"
            });

            // Clean up event listeners immediately to prevent memory leaks
            confirmBtn?.removeEventListener('click', handleConfirmClick);
            cancelBtn?.removeEventListener('click', handleCancelClick);

            // Execute strictly based on what button was physically pressed
            if (explicitButtonClick === 'FETCH') {
                if (onFetchData) onFetchData();
            } else if (explicitButtonClick === 'LOGOUT') {
                // Triggers the logical confirmation you actually wanted!
                triggerExplicitLogoutSequence();
            }
            // If explicitButtonClick is null, they clicked the overlay backdrop. Do absolutely nothing!

        } else {
            // Logged Out Sequence paths
            const confirmBtn = document.getElementById('dialogConfirmBtn');
            const cancelBtn = document.getElementById('dialogCancelBtn');
            
            let explicitButtonClick = null;

            const handleLoginPath = () => { explicitButtonClick = 'LOGIN'; };
            const handleRegisterPath = () => { explicitButtonClick = 'REGISTER'; };

            confirmBtn?.addEventListener('click', handleLoginPath);
            cancelBtn?.addEventListener('click', handleRegisterPath);

            await showDialog({
                title: "גיבוי וסנכרון בענן",
                message: "התחבר כדי לשמור את הלוח שלך בענן ולסנכרן בין מכשירים בזמן אמת.",
                icon: "🔐",
                showCancel: true,
                confirmText: "התחברות לחשבון",
                cancelText: "הרשמה לחשבון"
            });

            confirmBtn?.removeEventListener('click', handleLoginPath);
            cancelBtn?.removeEventListener('click', handleRegisterPath);

            if (explicitButtonClick === 'LOGIN') {
                openCredentialsForm('LOGIN');
            } else if (explicitButtonClick === 'REGISTER') {
                openCredentialsForm('REGISTER');
            }
        }
    }

    async function openCredentialsForm(mode) {
        const isLogin = mode === 'LOGIN';
        
        const credentials = await showDialog({
            title: isLogin ? "התחברות למערכת" : "הרשמה לחשבון חדש",
            message: isLogin ? "הזן אימייל וסיסמה כדי להתחבר:" : "הזן כתובת אימייל וסיסמה בת 6 תווים לפחות:",
            icon: "🔑",
            showCancel: true,
            confirmText: isLogin ? "התחבר" : "בצע הרשמה",
            cancelText: "חזור",
            inputs: [
                { label: "כתובת אימייל", type: "email", name: "email", placeholder: "you@example.com" },
                { label: "סיסמה", type: "password", name: "password", placeholder: "••••••••" }
            ]
        });

        if (credentials && credentials.email && credentials.password) {
            const email = credentials.email.trim();
            const password = credentials.password;

            if (isLogin) {
                if (onLogin) onLogin(email, password);
            } else {
                if (onRegister) onRegister(email, password);
            }
        }
    }

    // --- Wire Up Entry Hooks ---
    document.getElementById('openCloudAuthBtn')?.addEventListener('click', handleAuthInteraction);
    document.getElementById('settingsPanelAuthTriggerBtn')?.addEventListener('click', handleAuthInteraction);

    // Orchestrator State Syncer
    function updateAuthUI(userEmail) {
        currentLoggedUserEmail = userEmail;

        const globalBtnText = document.getElementById('globalCloudAuthBtnText');
        const panelRow = document.getElementById('settingsPanelCloudRow');

        if (userEmail) {
            if (globalBtnText) globalBtnText.innerText = "👤 החשבון שלי";
            
            if (panelRow) {
                panelRow.innerHTML = `
                    <div class="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-bold text-slate-400">מחובר כעת:</span>
                            <span class="text-xs font-bold text-blue-900 truncate">${userEmail}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 pt-1">
                            <button id="drawerCloudFetchBtn" class="bg-emerald-700 hover:bg-emerald-800 text-white py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all text-center">משוך נתונים</button>
                            <button id="drawerCloudLogoutBtn" class="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all text-center">התנתק</button>
                        </div>
                    </div>
                `;
                // Wire inline side panel triggers
                document.getElementById('drawerCloudFetchBtn')?.addEventListener('click', () => onFetchData?.());
                
                // Unified: Clicking logout directly inside the side panel drawer routes to the exact same prompt block!
                document.getElementById('drawerCloudLogoutBtn')?.addEventListener('click', triggerExplicitLogoutSequence);
            }
        } else {
            if (globalBtnText) globalBtnText.innerText = "👤 התחברות לחשבון";
            
            if (panelRow) {
                panelRow.innerHTML = `
                    <button id="settingsPanelAuthTriggerBtn" class="w-full text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5">
                        <span>👤 התחברות / הרשמה למערכת</span>
                    </button>
                `;
                document.getElementById('settingsPanelAuthTriggerBtn')?.addEventListener('click', handleAuthInteraction);
            }
        }
    }

    return { updateAuthUI };
}

// --- 7. Calendar Grid Context Menu ---
export function setupCalendarContextMenus() {
    const container = document.getElementById('calendarContainer');
    if (!container) return;
    
    container.addEventListener('contextmenu', async (event) => {
        // Find the closest day cell, even if the user right-clicked a text label inside it
        const dayCell = event.target.closest('.calendar-day');
        if (!dayCell) return;

        // Prevent the browser's default right-click menu from popping up
        event.preventDefault();

        // Extract the metadata injected by ui/calendar.js
        const dateString = dayCell.dataset.date;
        const bookLabelEl = dayCell.querySelector('[data-book-label]');
        
        // Check if there is an official book text in this specific cell
        const bookLabel = bookLabelEl ? bookLabelEl.textContent.trim() : '';

        // Dynamic routing template choice
        let menuItems;
        if (!bookLabel || bookLabel == '-') {
            // No learned book officially -> Use the empty cell layout
            menuItems = ContextMenuTemplates.EMPTY_DAY(dateString);
        } else {
            // Has an active book track -> Use the study day layout
            menuItems = ContextMenuTemplates.STUDY_DAY(dateString, bookLabel);
        }

        // Trigger the menu right at the cursor position
        showContextMenu(event, menuItems);
    });
}