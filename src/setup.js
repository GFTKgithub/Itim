// --- 1. Main Controls ---
export function setupMainControls({ onGenerate, onAddToSequence, onClearSequence, onExportExcel }) {
    const generateBtn = document.getElementById('generateBtn');
    const addToSequenceBtn = document.getElementById('addToSequenceBtn');
    const clearSequenceBtn = document.getElementById('clearSequenceBtn');
    const exportBtn = document.getElementById('exportToExcelBtn');
    const printBtn = document.getElementById('printBtn');

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

    exportBtn?.addEventListener('click', () => {
        onExportExcel();
    });

    printBtn?.addEventListener('click', () => window.print());
}

// --- 2. Backup Management ---
export function setupBackupManagement({onExport, onImport, onResetSettings, onResetManualOverrides}) {
    const backupExportBtn = document.getElementById('backupExportBtn');
    const backupImportBtn = document.getElementById('backupImportBtn');
    const backupFileInput = document.getElementById('backupFileInput');
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');
    const resetManualOverridesBtn = document.getElementById('resetManualOverridesBtn');

    backupExportBtn?.addEventListener('click', onExport);
    backupImportBtn?.addEventListener('click', () => backupFileInput.click());
    backupFileInput?.addEventListener('change', onImport);
    resetSettingsBtn?.addEventListener('click', onResetSettings);
    resetManualOverridesBtn?.addEventListener('click', onResetManualOverrides);
}

// --- 3. Settings Synchronization ---
export function setupSettings({onUpdateSetting, onToggleInputs, onGenerate, onRenderDateLabels, onSyncToToday}) {
    const calcMethod = document.getElementById('calcMethod');
    const calendarType = document.getElementById('calendarType');
    const includeHolidaysInput = document.getElementById('includeHolidaysInput');
    const startDafInput = document.getElementById('startDafInput');
    const startAmudInput = document.getElementById('startAmudInput');
    const paceInput = document.getElementById('paceInput');
    const startDateInput = document.getElementById('startDateInput');
    const targetDateInput = document.getElementById('targetDateInput');

    calcMethod?.addEventListener('change', (e) => {
        onUpdateSetting('method', e.target.value);
        onToggleInputs();
    });

    calendarType?.addEventListener('change', (e) => {
        onUpdateSetting('calendarType', e.target.value);
        onGenerate();
    });

    document.querySelectorAll('input[name="studyDays"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const selectedDays = Array.from(document.querySelectorAll('input[name="studyDays"]:checked'))
                .map(cb => parseInt(cb.value, 10));

            onUpdateSetting('studyDays', selectedDays);
        });
    });

    includeHolidaysInput?.addEventListener('change', (e) => {
        onUpdateSetting('includeHolidays', e.target.checked);
    });

    startDafInput?.addEventListener('change', (e) => { onUpdateSetting('startDaf', e.target.value); });
    startAmudInput?.addEventListener('change', (e) => { onUpdateSetting('startAmud', e.target.value); });
    paceInput?.addEventListener('change', (e) => { onUpdateSetting('pace', e.target.value); });

    const handleDateChange = () => {
        onUpdateSetting('startDate', startDateInput.value);
        onUpdateSetting('targetDate', targetDateInput.value);
        onRenderDateLabels(startAmudInput.value, targetDateInput.value);
    };

    startDateInput?.addEventListener('change', handleDateChange);
    targetDateInput?.addEventListener('change', handleDateChange);

    document.getElementById('syncToTodayBtn')?.addEventListener('click', () => {
        if (onSyncToToday) onSyncToToday();
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
export function setupBookConfigModal({ getSchedule, getBookSequence, computeDaySlots, renderAmudGrid, renderDailyView, updateModalProgressStats, onSaveConfig, onDateOverride }) {
    let currentEditingIndex = null;
    let tempAmudStates = [];
    let currentDaySlots = [];
    let isBunchedView = false;

    const bookSequenceList = document.getElementById('bookSequenceList');
    const amudGridContainer = document.getElementById('amudGridContainer');
    const dailyViewContainer = document.getElementById('dailyViewContainer');
    const bookConfigModal = document.getElementById('bookConfigModal');

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
        
        // FETCH LIVE DATA HERE by calling the functions
        const currentBookSequence = getBookSequence();
        const currentSchedule = getSchedule();

        const book = currentBookSequence[currentEditingIndex];
        if (!book) return;

        const bookName = typeof book === 'string' ? book : (book.name || "לא ידוע");
        document.getElementById('configModalTitle').innerText = `הגדרות מסכת ${bookName}`;
        document.getElementById('configReviewDays').value = book.reviewDays || 0;

        tempAmudStates = (!book.amudStates || book.amudStates.length === 0) 
            ? new Array(120).fill(0) 
            : [...book.amudStates];

        // DECOUPLED: Changed AppState.schedule/bookSequence to the passed-in variables
        currentDaySlots = computeDaySlots(currentSchedule, bookName, currentEditingIndex, currentBookSequence);
        isBunchedView = false;
        setActiveView('individual');
        renderAmudGrid('amudGridContainer', tempAmudStates, false);
        updateModalProgressStats(tempAmudStates);
        bookConfigModal.classList.remove('hidden');
    });

    amudGridContainer?.addEventListener('click', (e) => {
        const btn = e.target.closest('.amud-btn');
        if (!btn) return;
        const idx = parseInt(btn.dataset.amudIdx);

        if (isBunchedView) {
            const partnerIdx = (idx % 2 === 0) ? idx + 1 : idx - 1;
            const nextState = (tempAmudStates[idx] + 1) % 3;
            tempAmudStates[idx] = nextState;
            if (partnerIdx >= 0 && partnerIdx < tempAmudStates.length) tempAmudStates[partnerIdx] = nextState;
        } else {
            tempAmudStates[idx] = (tempAmudStates[idx] + 1) % 3;
        }
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
        const reviewDays = parseInt(document.getElementById('configReviewDays').value, 10) || 0;
        
        // Pass the raw data back to the orchestrator
        onSaveConfig({
            index: currentEditingIndex,
            reviewDays: reviewDays,
            amudStates: [...tempAmudStates]
        });

        bookConfigModal.classList.add('hidden');
    });

    const closeConfig = () => bookConfigModal.classList.add('hidden');
    document.getElementById('closeConfigModal')?.addEventListener('click', closeConfig);
    document.getElementById('cancelConfigBtn')?.addEventListener('click', closeConfig);

    document.getElementById('toggleViewIndividual')?.addEventListener('click', () => { isBunchedView = false; setActiveView('individual'); renderAmudGrid('amudGridContainer', tempAmudStates, false); });
    document.getElementById('toggleViewBunched')?.addEventListener('click', () => { isBunchedView = true; setActiveView('bunched'); renderAmudGrid('amudGridContainer', tempAmudStates, true); });
    document.getElementById('toggleViewDaily')?.addEventListener('click', () => { setActiveView('daily'); renderDailyView('dailyViewContainer', currentDaySlots, tempAmudStates); });

    document.getElementById('calendarContainer')?.addEventListener('click', (event) => {
        const calendarDay = event.target.closest('.calendar-day');
        
        // Pass the date string up
        if (calendarDay?.dataset.date) {
            onDateOverride(calendarDay.dataset.date);
        }
    });

    document.getElementById('markTodayBtn')?.addEventListener('click', () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const slot = currentDaySlots.find(s => s.dateString === todayStr);

        if (!slot) {
            // If showDialog isn't in this file, you can use alert() or pass showDialog in
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
}

// --- 6. Cloud Authentication ---
export function setupCloudAuth({ onRegister, onLogin, onLogout, onFetchData }) {
    const cloudLoggedOut = document.getElementById('cloudLoggedOut');
    const cloudLoggedIn = document.getElementById('cloudLoggedIn');
    const cloudUserEmail = document.getElementById('cloudUserEmail');
    const cloudEmail = document.getElementById('cloudEmail');
    const cloudPassword = document.getElementById('cloudPassword');

    // This is returned or exposed so the orchestrator can update the UI reactively
    function updateAuthUI(userEmail) {
        if (userEmail) {
            cloudLoggedOut?.classList.add('hidden');
            cloudLoggedIn?.classList.remove('hidden');
            if (cloudUserEmail) cloudUserEmail.innerText = userEmail;
        } else {
            cloudLoggedOut?.classList.remove('hidden');
            cloudLoggedIn?.classList.add('hidden');
            if (cloudUserEmail) cloudUserEmail.innerText = '';
        }
    }

    document.getElementById('cloudRegisterBtn')?.addEventListener('click', () => {
        const email = cloudEmail.value.trim();
        const password = cloudPassword.value;
        
        // DECOUPLED: Actions Up with the raw form input values
        onRegister(email, password);
    });

    document.getElementById('cloudLoginBtn')?.addEventListener('click', () => {
        const email = cloudEmail.value.trim();
        const password = cloudPassword.value;
        onLogin(email, password);
    });

    document.getElementById('cloudLogoutBtn')?.addEventListener('click', () => {
        onLogout();
    });

    document.getElementById('cloudFetchBtn')?.addEventListener('click', () => {
        onFetchData();
    });

    // Expose the view-updater function to the controller layer
    return { updateAuthUI };
}