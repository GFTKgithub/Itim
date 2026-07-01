import { getTotalAmudim } from "../utils/talmud.js";
import { numberToHebrew } from "../utils/gematria.js";
import { HEBREW_MILESTONE_DATES, getNearestHebrewMilestone } from "../utils/dates.js";

// --- Book Config Modal ---
// Focused solely on book pacing, range, and periodic review settings.
// Progress marking (amud grid, daily view) moved to the progress page.
let _modalWired = false;

export function setupBookConfigModal({ getSchedule, getBookSequence, getBookRangeLimits, computeDaySlots, onSaveConfig }) {
    const bookSequenceList = document.getElementById('bookSequenceList');
    const configModal = document.getElementById('bookConfigModal');

    // Modal Injected Control Elements
    const configCalcMethod = document.getElementById('bookConfigCalcMethod');
    const configPaceSection = document.getElementById('bookConfigPaceSection');
    const configTargetDateSection = document.getElementById('bookConfigTargetDateSection');
    const configPaceInput = document.getElementById('bookConfigPaceInput');
    const configTargetDateInput = document.getElementById('bookConfigTargetDateInput');
    const configStartDateInput = document.getElementById('bookConfigStartDateInput');

    // Periodic Review Elements
    const configPeriodicToggle = document.getElementById('bookConfigPeriodicReviewToggle');
    const configPeriodicFields = document.getElementById('bookConfigPeriodicReviewFields');
    const configPeriodicFrequency = document.getElementById('bookConfigPeriodicFrequency');
    const configPeriodicMode = document.getElementById('bookConfigPeriodicMode');
    const configPeriodicAmount = document.getElementById('bookConfigPeriodicAmount');
    const configPeriodicSummary = document.getElementById('bookConfigPeriodicSummary');

    // Range Bound Elements
    const startDafSelect = document.getElementById('bookConfigStartDaf');
    const startAmudSelect = document.getElementById('bookConfigStartAmud');
    const endDafSelect = document.getElementById('bookConfigEndDaf');
    const endAmudSelect = document.getElementById('bookConfigEndAmud');

    // Only wire persistent modal button listeners once to prevent double-registration
    if (!_modalWired) {
        _modalWired = true;

        startDafSelect?.addEventListener('change', validateRangeConstraints);
        startAmudSelect?.addEventListener('change', validateRangeConstraints);
        endDafSelect?.addEventListener('change', validateRangeConstraints);
        endAmudSelect?.addEventListener('change', validateRangeConstraints);

        configCalcMethod?.addEventListener('change', (e) => {
            toggleModalFields(e.target.value);
        });

        configPeriodicToggle?.addEventListener('change', () => {
            if (configPeriodicFields) {
                configPeriodicFields.classList.toggle('hidden', !configPeriodicToggle.checked);
            }
            updatePeriodicReviewSummary();
        });

        configPeriodicFrequency?.addEventListener('input', updatePeriodicReviewSummary);
        configPeriodicMode?.addEventListener('change', updatePeriodicReviewSummary);
        configPeriodicAmount?.addEventListener('input', updatePeriodicReviewSummary);

        document.querySelectorAll('.periodic-weekday-cb').forEach(cb => {
            cb.addEventListener('change', updatePeriodicReviewSummary);
        });

        document.getElementById('saveConfigBtn')?.addEventListener('click', () => {
            const reviewDays = parseInt(document.getElementById('bookConfigReviewDays').value, 10) || 0;
            const calcMethod = configCalcMethod ? configCalcMethod.value : 'pace';
            const paceValue = configPaceInput ? parseFloat(configPaceInput.value) : 1;
            const targetDate = configTargetDateInput ? configTargetDateInput.value : '';
            const startDateOverride = configStartDateInput ? configStartDateInput.value : '';
            const { startAmudIdx, endAmudIdx } = getSelectedIndices();
            const editingIndex = parseInt(configModal.dataset.editingIndex || '0', 10);

            let periodicReview = null;
            if (configPeriodicToggle && configPeriodicToggle.checked) {
                periodicReview = {
                    enabled: true,
                    mode: (configPeriodicMode ? configPeriodicMode.value : 'days'),
                    frequency: parseInt(configPeriodicFrequency ? configPeriodicFrequency.value : 7, 10) || 7,
                    amount: parseInt(configPeriodicAmount ? configPeriodicAmount.value : 1, 10) || 1
                };
                if (periodicReview.mode === 'weekdays') {
                    const checkedWeekdays = [];
                    document.querySelectorAll('.periodic-weekday-cb:checked').forEach(cb => {
                        checkedWeekdays.push(parseInt(cb.value, 10));
                    });
                    periodicReview.weekdays = checkedWeekdays;
                }
            }

            onSaveConfig({
                index: editingIndex,
                calcMethod: calcMethod,
                paceValue: paceValue,
                targetDate: targetDate,
                startDate: startDateOverride || undefined,
                reviewDays: reviewDays,
                startAmudIdx: startAmudIdx,
                endAmudIdx: endAmudIdx,
                periodicReview: periodicReview
            });

            configModal.classList.add('hidden');
        });

        const closeConfig = () => {
            configModal.classList.add('hidden');
        };
        document.getElementById('closeBookConfigModal')?.addEventListener('click', closeConfig);
        document.getElementById('cancelConfigBtn')?.addEventListener('click', closeConfig);

        const dropdown = document.getElementById('bookConfigDateTemplate');
        if (dropdown && configTargetDateInput) {
            dropdown.addEventListener('change', (e) => {
                const key = e.target.value;
                const template = HEBREW_MILESTONE_DATES[key];
                if (!template) return;
                const calculatedISODate = getNearestHebrewMilestone(template);
                configTargetDateInput.value = calculatedISODate;
                configTargetDateInput.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
    }

    // ========== Functions ==========

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

    function validateRangeConstraints() {
        const { startAmudIdx, endAmudIdx } = getSelectedIndices();
        if (startAmudIdx > endAmudIdx) {
            endDafSelect.value = startDafSelect.value;
            endAmudSelect.value = startAmudSelect.value;
        }
    }

    function toggleModalFields(method) {
        if (method === 'targetDate') {
            configPaceSection?.classList.add('hidden');
            configTargetDateSection?.classList.remove('hidden');
        } else {
            configPaceSection?.classList.remove('hidden');
            configTargetDateSection?.classList.add('hidden');
        }
    }

    function updatePeriodicReviewSummary() {
        if (!configPeriodicSummary || !configPeriodicMode || !configPeriodicFrequency || !configPeriodicAmount) return;
        const mode = configPeriodicMode.value;
        const freq = configPeriodicFrequency.value || '7';
        const amount = configPeriodicAmount.value || '1';

        const weekdaysContainer = document.getElementById('bookConfigPeriodicWeekdays');
        if (weekdaysContainer) {
            weekdaysContainer.classList.toggle('hidden', mode !== 'weekdays');
        }

        if (mode === 'days') {
            configPeriodicSummary.textContent = `${amount} ימי חזרה בכל ${freq} ימי לימוד`;
        } else if (mode === 'calendar') {
            configPeriodicSummary.textContent = `${amount} ימי חזרה בכל ${freq} ימים בלוח`;
        } else if (mode === 'weekdays') {
            const checked = document.querySelectorAll('.periodic-weekday-cb:checked');
            const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
            const selected = Array.from(checked).map(cb => dayNames[parseInt(cb.value)]).join(', ');
            configPeriodicSummary.textContent = selected ? `חזרה בימים: ${selected}` : 'בחר ימי חזרה שבועיים';
        } else {
            configPeriodicSummary.textContent = `${amount} ימי חזרה אחרי כל ${freq} דפים`;
        }
    }

    // ========== Re-wire listeners on planner DOM elements (called each time planner page renders) ==========

    // Unwire old listener if it exists
    if (bookSequenceList._configClickHandler) {
        bookSequenceList.removeEventListener('click', bookSequenceList._configClickHandler);
    }
    bookSequenceList._configClickHandler = (e) => {
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
        configModal.dataset.editingIndex = editingIndex;

        if (configStartDateInput) {
            configStartDateInput.value = book.startDate || '';
            if (editingIndex > 0 && currentSchedule && currentSchedule.length > 0) {
                const previousBookName = typeof currentBookSequence[editingIndex - 1] === 'string'
                    ? currentBookSequence[editingIndex - 1]
                    : currentBookSequence[editingIndex - 1].name;
                const prevBookDays = currentSchedule.filter(d => d.book === previousBookName);
                if (prevBookDays.length > 0) {
                    const lastDayString = prevBookDays[prevBookDays.length - 1].dateString;
                    if (lastDayString) {
                        const nextAvailableDate = new Date(lastDayString);
                        nextAvailableDate.setDate(nextAvailableDate.getDate() + 1);
                        configStartDateInput.min = nextAvailableDate.toISOString().split('T')[0];
                    }
                }
            } else {
                configStartDateInput.min = '';
            }
        }

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

        const periodic = (typeof book === 'object' && book.periodicReview) || {};
        if (configPeriodicToggle) configPeriodicToggle.checked = periodic.enabled || false;
        if (configPeriodicFields) configPeriodicFields.classList.toggle('hidden', !periodic.enabled);
        if (configPeriodicMode) configPeriodicMode.value = periodic.mode || 'days';
        if (configPeriodicFrequency) configPeriodicFrequency.value = periodic.frequency || 7;
        if (configPeriodicAmount) configPeriodicAmount.value = periodic.amount || 1;

        const savedWeekdays = periodic.weekdays || [];
        document.querySelectorAll('.periodic-weekday-cb').forEach(cb => {
            cb.checked = savedWeekdays.includes(parseInt(cb.value, 10));
        });

        updatePeriodicReviewSummary();

        configModal.classList.remove('hidden');
    };
    bookSequenceList?.addEventListener('click', bookSequenceList._configClickHandler);
}