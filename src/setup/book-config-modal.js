import { getTotalAmudim } from "../utils/talmud.js";
import { numberToHebrew } from "../utils/gematria.js";
import { HEBREW_MILESTONE_DATES, getNearestHebrewMilestone } from "../utils/dates.js";
import { renderAmudGrid, renderDailyView, updateModalProgressStats } from "../ui/components/book-config-modal.js";
import { createBookConfigModalState } from "../ui/modal/book-config-modal-state.js";

// --- Book Config Modal ---
export function setupBookConfigModal({ getSchedule, getBookSequence, getBookRangeLimits, computeDaySlots, onSaveConfig, onStudyStatusOverride }) {
    const modalState = createBookConfigModalState();

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

    // Range Bound Elements
    const startDafSelect = document.getElementById('bookConfigStartDaf');
    const startAmudSelect = document.getElementById('bookConfigStartAmud');
    const endDafSelect = document.getElementById('bookConfigEndDaf');
    const endAmudSelect = document.getElementById('bookConfigEndAmud');

    // Reactively populates the bounds select structures matching specific book depths
    function populateRangeDropdowns(totalAmudim) {
        if (!startDafSelect || !endDafSelect) return;

        startDafSelect.innerHTML = '';
        endDafSelect.innerHTML = '';

        for (let i = 0; i < totalAmudim; i += 2) {
            const dafNumber = Math.floor(i / 2) + 2;
            const dafHeb = numberToHebrew(dafNumber);

            const optStart = new Option(dafHeb, dafHeb);
            const optEnd = new Option(dafHeb, dafHeb);
            startDafSelect.add(optStart);
            endDafSelect.add(optEnd);
        }
    }

    // Helper mapping selected dropdown states back into global array index values
    function getSelectedIndices() {
        const uniqueDafList = [];
        const opts = startDafSelect.options;
        for (let i = 0; i < opts.length; i++) uniqueDafList.push(opts[i].value);

        const startDafIdx = uniqueDafList.indexOf(startDafSelect.value);
        const endDafIdx = uniqueDafList.indexOf(endDafSelect.value);

        const startAmudIdx = (startDafIdx * 2) + (startAmudSelect.value === 'b' ? 1 : 0);
        const endAmudIdx = (endDafIdx * 2) + (endAmudSelect.value === 'b' ? 1 : 0);

        return { startAmudIdx, endAmudIdx };
    }

    // Range guard constraint system to prevent backward selections
    function validateRangeConstraints() {
        const { startAmudIdx, endAmudIdx } = getSelectedIndices();
        if (startAmudIdx > endAmudIdx) {
            endDafSelect.value = startDafSelect.value;
            endAmudSelect.value = startAmudSelect.value;
        }
    }

    startDafSelect?.addEventListener('change', validateRangeConstraints);
    startAmudSelect?.addEventListener('change', validateRangeConstraints);
    endDafSelect?.addEventListener('change', validateRangeConstraints);
    endAmudSelect?.addEventListener('change', validateRangeConstraints);

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

        const editingIndex = parseInt(configBtn.getAttribute('data-index'), 10);
        
        const currentBookSequence = getBookSequence();
        const currentSchedule = getSchedule();

        const book = currentBookSequence[editingIndex];
        if (!book) return;

        const bookName = typeof book === 'string' ? book : (book.name || "לא ידוע");
        document.getElementById('bookConfigModalTitle').innerText = `הגדרות מסכת ${bookName}`;
        document.getElementById('bookConfigReviewDays').value = book.reviewDays || 0;

        const totalAmudimCount = getTotalAmudim(bookName);
        populateRangeDropdowns(totalAmudimCount);

        const savedStartAmudIdx = book.startAmudIdx !== undefined ? book.startAmudIdx : 0;
        const savedEndAmudIdx = book.endAmudIdx !== undefined ? book.endAmudIdx : (totalAmudimCount - 1);

        const startDafHeb = numberToHebrew(Math.floor(savedStartAmudIdx / 2) + 2);
        const startAmudVal = (savedStartAmudIdx % 2 === 1) ? 'b' : 'a';
        const endDafHeb = numberToHebrew(Math.floor(savedEndAmudIdx / 2) + 2);
        const endAmudVal = (savedEndAmudIdx % 2 === 1) ? 'b' : 'a';

        if (startDafSelect) startDafSelect.value = startDafHeb;
        if (startAmudSelect) startAmudSelect.value = startAmudVal;
        if (endDafSelect) endDafSelect.value = endDafHeb;
        if (endAmudSelect) endAmudSelect.value = endAmudVal;

        const limits = getBookRangeLimits(editingIndex);
        if (configTargetDateInput && limits.minDate) {
            configTargetDateInput.min = limits.minDate;
            if (book.targetDate && book.targetDate < limits.minDate) {
                book.targetDate = limits.minDate;
            }
        }

        const savedMethod = book.calcMethod || 'pace';
        const savedPace = book.paceValue !== undefined ? book.paceValue : 1;
        const savedTargetDate = book.targetDate || limits.minDate || '';

        if (configCalcMethod) configCalcMethod.value = savedMethod;
        if (configPaceInput) configPaceInput.value = savedPace;
        if (configTargetDateInput) configTargetDateInput.value = savedTargetDate;

        toggleModalFields(savedMethod);

        const amudStates = (!book.amudStates || book.amudStates.length === 0)
            ? new Array(totalAmudimCount).fill(0)
            : [...book.amudStates];

        const daySlots = computeDaySlots(currentSchedule, bookName, editingIndex, currentBookSequence);

        // Initialize modal state
        modalState.open(editingIndex, amudStates, daySlots);
        
        setActiveView('individual');
        renderAmudGrid('amudGridContainer', modalState.getAmudStates(), false);
        updateModalProgressStats(modalState.getAmudStates());
        configModal.classList.remove('hidden');
    });

    amudGridContainer?.addEventListener('click', (e) => {
        const btn = e.target.closest('.amud-btn');
        if (!btn) return;
        
        const idx = parseInt(btn.dataset.amudIdx, 10);
        if (isNaN(idx)) return;

        modalState.toggleAmudState(idx);
        renderAmudGrid('amudGridContainer', modalState.getAmudStates(), modalState.getIsBunchedView());
        updateModalProgressStats(modalState.getAmudStates());
    });

    dailyViewContainer?.addEventListener('click', (e) => {
        const btn = e.target.closest('.day-slot-btn');
        if (!btn) return;
        const slotIdx = parseInt(btn.dataset.slotIdx);
        if (isNaN(slotIdx)) return;

        modalState.toggleDaySlot(slotIdx);
        renderDailyView('dailyViewContainer', modalState.getDaySlots(), modalState.getAmudStates());
        updateModalProgressStats(modalState.getAmudStates());
    });

    document.getElementById('saveConfigBtn')?.addEventListener('click', () => {
        const reviewDays = parseInt(document.getElementById('bookConfigReviewDays').value, 10) || 0;
        const calcMethod = configCalcMethod ? configCalcMethod.value : 'pace';
        const paceValue = configPaceInput ? parseFloat(configPaceInput.value) : 1;
        const targetDate = configTargetDateInput ? configTargetDateInput.value : '';
        const { startAmudIdx, endAmudIdx } = getSelectedIndices();
        
        onSaveConfig({
            index: modalState.getEditingIndex(),
            calcMethod: calcMethod,
            paceValue: paceValue,
            targetDate: targetDate,
            reviewDays: reviewDays,
            amudStates: [...modalState.getAmudStates()],
            startAmudIdx: startAmudIdx,
            endAmudIdx: endAmudIdx
        });

        configModal.classList.add('hidden');
        modalState.close();
    });

    const closeConfig = () => {
        configModal.classList.add('hidden');
        modalState.close();
    };
    document.getElementById('closeBookConfigModal')?.addEventListener('click', closeConfig);
    document.getElementById('cancelConfigBtn')?.addEventListener('click', closeConfig);

    document.getElementById('toggleViewIndividual')?.addEventListener('click', () => {
        modalState.setViewMode('individual');
        setActiveView('individual');
        renderAmudGrid('amudGridContainer', modalState.getAmudStates(), false);
    });
    document.getElementById('toggleViewBunched')?.addEventListener('click', () => {
        modalState.setViewMode('bunched');
        setActiveView('bunched');
        renderAmudGrid('amudGridContainer', modalState.getAmudStates(), true);
    });
    document.getElementById('toggleViewDaily')?.addEventListener('click', () => {
        setActiveView('daily');
        renderDailyView('dailyViewContainer', modalState.getDaySlots(), modalState.getAmudStates());
    });

    document.getElementById('calendarContainer')?.addEventListener('click', (event) => {
        const calendarDay = event.target.closest('.calendar-day');
        if (calendarDay?.dataset.date) {
            onStudyStatusOverride(calendarDay.dataset.date);
        }
    });

    document.getElementById('markTodayBtn')?.addEventListener('click', () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const success = modalState.markToday(todayStr);

        if (!success) {
            alert('לא נמצא שיעור מתוכנן להיום במסכת זו.');
            return;
        }

        renderAmudGrid('amudGridContainer', modalState.getAmudStates(), modalState.getIsBunchedView());
        renderDailyView('dailyViewContainer', modalState.getDaySlots(), modalState.getAmudStates());
        updateModalProgressStats(modalState.getAmudStates());
    });

    const dropdown = document.getElementById('bookConfigDateTemplate');

    if (!dropdown || !configTargetDateInput) return;

    dropdown.addEventListener('change', (e) => {
        const key = e.target.value;
        const template = HEBREW_MILESTONE_DATES[key];

        if (!template) return;

        const calculatedISODate = getNearestHebrewMilestone(template);
        configTargetDateInput.value = calculatedISODate;
        configTargetDateInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
}