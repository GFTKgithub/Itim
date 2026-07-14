/**
 * Book Config Modal — clean modular sections for one book's settings.
 * Sections: Study Method, Study Range, Reviews, Start Date Override.
 */
import { getTotalAmudim } from "../utils/talmud.js";
import { numberToHebrew } from "../utils/gematria.js";
import { HEBREW_MILESTONE_DATES, getNearestHebrewMilestone } from "../utils/dates.js";

let _modalWired = false;

export function setupBookConfigModal({ getSchedule, getBookSequence, getBookRangeLimits, computeDaySlots, onSaveConfig }) {
    const bookSequenceList = document.getElementById('bookSequenceList');
    const configModal = document.getElementById('bookConfigModal');

    // Elements
    const methodPaceBtn = document.getElementById('bookConfigMethodPace');
    const methodTargetBtn = document.getElementById('bookConfigMethodTarget');
    const paceSection = document.getElementById('bookConfigPaceSection');
    const targetDateSection = document.getElementById('bookConfigTargetDateSection');
    const paceInput = document.getElementById('bookConfigPaceInput');
    const targetDateInput = document.getElementById('bookConfigTargetDateInput');
    const startDateInput = document.getElementById('bookConfigStartDateInput');

    // Reviews
    const reviewDaysInput = document.getElementById('bookConfigReviewDays');
    const periodicToggle = document.getElementById('bookConfigPeriodicReviewToggle');
    const periodicFields = document.getElementById('bookConfigPeriodicReviewFields');
    const periodicFrequency = document.getElementById('bookConfigPeriodicFrequency');
    const periodicMode = document.getElementById('bookConfigPeriodicMode');
    const periodicAmount = document.getElementById('bookConfigPeriodicAmount');
    const periodicSummary = document.getElementById('bookConfigPeriodicSummary');

    // Range
    const startDafSelect = document.getElementById('bookConfigStartDaf');
    const startAmudSelect = document.getElementById('bookConfigStartAmud');
    const endDafSelect = document.getElementById('bookConfigEndDaf');
    const endAmudSelect = document.getElementById('bookConfigEndAmud');

    // ─── Persistent wire (once) ──────────────────────────────────
    if (!_modalWired) {
        _modalWired = true;

        // Range validation
        startDafSelect?.addEventListener('change', validateRangeConstraints);
        startAmudSelect?.addEventListener('change', validateRangeConstraints);
        endDafSelect?.addEventListener('change', validateRangeConstraints);
        endAmudSelect?.addEventListener('change', validateRangeConstraints);

        // Method toggle tabs
        const setMethod = (method) => {
            methodPaceBtn?.classList.toggle('active', method === 'pace');
            methodTargetBtn?.classList.toggle('active', method === 'targetDate');
            paceSection?.classList.toggle('hidden', method !== 'pace');
            targetDateSection?.classList.toggle('hidden', method !== 'targetDate');
        };

        methodPaceBtn?.addEventListener('click', () => setMethod('pace'));
        methodTargetBtn?.addEventListener('click', () => setMethod('targetDate'));

        // Periodic review toggle
        periodicToggle?.addEventListener('change', () => {
            periodicFields?.classList.toggle('hidden', !periodicToggle.checked);
            updatePeriodicSummary();
        });

        periodicFrequency?.addEventListener('input', updatePeriodicSummary);
        periodicMode?.addEventListener('change', updatePeriodicSummary);
        periodicAmount?.addEventListener('input', updatePeriodicSummary);
        document.querySelectorAll('.periodic-weekday-cb').forEach(cb => {
            cb.addEventListener('change', updatePeriodicSummary);
        });

        // Quick milestone selector
        const dropdown = document.getElementById('bookConfigDateTemplate');
        if (dropdown && targetDateInput) {
            dropdown.addEventListener('change', (e) => {
                const key = e.target.value;
                const template = HEBREW_MILESTONE_DATES[key];
                if (!template) return;
                const calculatedISODate = getNearestHebrewMilestone(template);
                targetDateInput.value = calculatedISODate;
                targetDateInput.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }

        // Save
        document.getElementById('saveConfigBtn')?.addEventListener('click', () => {
            const reviewDays = parseInt(reviewDaysInput?.value || '0', 10);

            // Determine active method
            const isTarget = methodTargetBtn?.classList.contains('active');
            const calcMethod = isTarget ? 'targetDate' : 'pace';
            const paceValue = paceInput ? parseFloat(paceInput.value) : 1;
            const targetDate = targetDateInput ? targetDateInput.value : '';
            const startDateOverride = startDateInput ? startDateInput.value : '';
            const { startAmudIdx, endAmudIdx } = getSelectedIndices();
            const editingIndex = parseInt(configModal.dataset.editingIndex || '0', 10);

            let periodicReview = null;
            if (periodicToggle?.checked) {
                periodicReview = {
                    enabled: true,
                    mode: (periodicMode ? periodicMode.value : 'days'),
                    frequency: parseInt(periodicFrequency ? periodicFrequency.value : 7, 10) || 7,
                    amount: parseInt(periodicAmount ? periodicAmount.value : 1, 10) || 1
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
                calcMethod,
                paceValue,
                targetDate,
                startDate: startDateOverride || undefined,
                reviewDays,
                startAmudIdx,
                endAmudIdx,
                periodicReview
            });

            configModal.classList.add('hidden');
        });

        // Close
        const closeConfig = () => configModal.classList.add('hidden');
        document.getElementById('closeBookConfigModal')?.addEventListener('click', closeConfig);
        document.getElementById('cancelConfigBtn')?.addEventListener('click', closeConfig);
    }

    // ─── Helpers ──────────────────────────────────────

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
        for (let i = 0; i < startDafSelect.options.length; i++) {
            uniqueDafList.push(startDafSelect.options[i].value);
        }
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

    function updatePeriodicSummary() {
        if (!periodicSummary || !periodicMode || !periodicFrequency || !periodicAmount) return;
        const mode = periodicMode.value;
        const freq = periodicFrequency.value || '7';
        const amount = periodicAmount.value || '1';

        const weekdaysContainer = document.getElementById('bookConfigPeriodicWeekdays');
        if (weekdaysContainer) {
            weekdaysContainer.classList.toggle('hidden', mode !== 'weekdays');
        }

        const descriptions = {
            days: `${amount} ימי חזרה בכל ${freq} ימי לימוד`,
            calendar: `${amount} ימי חזרה בכל ${freq} ימים בלוח`,
            dafs: `${amount} ימי חזרה אחרי כל ${freq} דפים`,
        };
        if (mode === 'weekdays') {
            const checked = document.querySelectorAll('.periodic-weekday-cb:checked');
            const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
            const selected = Array.from(checked).map(cb => dayNames[parseInt(cb.value)]).join(', ');
            periodicSummary.textContent = selected ? `חזרה בימים: ${selected}` : 'בחר ימי חזרה שבועיים';
        } else {
            periodicSummary.textContent = descriptions[mode] || `${amount} ימי חזרה בכל ${freq} ${mode}`;
        }
    }

    // ─── Per-open wiring ──────────────────────────────────

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
        configModal.dataset.editingIndex = editingIndex;

        // Start date override
        if (startDateInput) {
            startDateInput.value = book.startDate || '';
            if (editingIndex > 0 && currentSchedule?.length > 0) {
                const prevBookName = typeof currentBookSequence[editingIndex - 1] === 'string'
                    ? currentBookSequence[editingIndex - 1]
                    : currentBookSequence[editingIndex - 1].name;
                const prevBookDays = currentSchedule.filter(d => d.book === prevBookName);
                if (prevBookDays.length > 0) {
                    const lastDayString = prevBookDays[prevBookDays.length - 1].dateString;
                    if (lastDayString) {
                        const nextAvailableDate = new Date(lastDayString);
                        nextAvailableDate.setDate(nextAvailableDate.getDate() + 1);
                        startDateInput.min = nextAvailableDate.toISOString().split('T')[0];
                    }
                }
            } else {
                startDateInput.min = '';
            }
        }

        // Range
        const totalAmudimCount = getTotalAmudim(bookName);
        populateRangeDropdowns(totalAmudimCount);

        const savedStartAmudIdx = book.startAmudIdx !== undefined ? book.startAmudIdx : 0;
        const savedEndAmudIdx = book.endAmudIdx !== undefined ? book.endAmudIdx : (totalAmudimCount - 1);

        startDafSelect.value = numberToHebrew(Math.floor(savedStartAmudIdx / 2) + 2);
        startAmudSelect.value = (savedStartAmudIdx % 2 === 1) ? 'b' : 'a';
        endDafSelect.value = numberToHebrew(Math.floor(savedEndAmudIdx / 2) + 2);
        endAmudSelect.value = (savedEndAmudIdx % 2 === 1) ? 'b' : 'a';

        // Method
        const savedMethod = book.calcMethod || 'pace';
        const isPace = savedMethod === 'pace';
        methodPaceBtn?.classList.toggle('active', isPace);
        methodTargetBtn?.classList.toggle('active', !isPace);
        paceSection?.classList.toggle('hidden', !isPace);
        targetDateSection?.classList.toggle('hidden', isPace);

        const savedPace = book.paceValue !== undefined ? book.paceValue : 1;
        const limits = getBookRangeLimits(editingIndex);
        if (targetDateInput && limits.minDate) {
            targetDateInput.min = limits.minDate;
        }
        const savedTargetDate = book.targetDate || limits.minDate || '';
        if (paceInput) paceInput.value = savedPace;
        if (targetDateInput) targetDateInput.value = savedTargetDate;

        // Reviews — end-of-book
        if (reviewDaysInput) reviewDaysInput.value = book.reviewDays || 0;

        // Reviews — periodic
        const periodic = (typeof book === 'object' && book.periodicReview) || {};
        if (periodicToggle) periodicToggle.checked = periodic.enabled || false;
        if (periodicFields) periodicFields.classList.toggle('hidden', !periodic.enabled);
        if (periodicMode) periodicMode.value = periodic.mode || 'days';
        if (periodicFrequency) periodicFrequency.value = periodic.frequency || 7;
        if (periodicAmount) periodicAmount.value = periodic.amount || 1;

        const savedWeekdays = periodic.weekdays || [];
        document.querySelectorAll('.periodic-weekday-cb').forEach(cb => {
            cb.checked = savedWeekdays.includes(parseInt(cb.value, 10));
        });

        updatePeriodicSummary();

        configModal.classList.remove('hidden');
    };
    bookSequenceList?.addEventListener('click', bookSequenceList._configClickHandler);
}