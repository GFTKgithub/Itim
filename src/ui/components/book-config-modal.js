import { numberToHebrew } from '../../utils/gematria.js';

// Populates the range dropdowns (start/end daf selects) with all daf options for a book
export function populateRangeDropdowns(totalAmudim) {
    const startDafSelect = document.getElementById('bookConfigStartDaf');
    const endDafSelect = document.getElementById('bookConfigEndDaf');
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

// Reads the selected start/end amud indices from the range dropdowns
export function getSelectedIndices() {
    const startDafSelect = document.getElementById('bookConfigStartDaf');
    const startAmudSelect = document.getElementById('bookConfigStartAmud');
    const endDafSelect = document.getElementById('bookConfigEndDaf');
    const endAmudSelect = document.getElementById('bookConfigEndAmud');

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

// Ensures the start range never exceeds the end range
export function validateRangeConstraints() {
    const { startAmudIdx, endAmudIdx } = getSelectedIndices();
    if (startAmudIdx > endAmudIdx) {
        const startDafSelect = document.getElementById('bookConfigStartDaf');
        const endDafSelect = document.getElementById('bookConfigEndDaf');
        const startAmudSelect = document.getElementById('bookConfigStartAmud');
        const endAmudSelect = document.getElementById('bookConfigEndAmud');
        endDafSelect.value = startDafSelect.value;
        endAmudSelect.value = startAmudSelect.value;
    }
}

// Updates the periodic review summary text based on current form values
export function updatePeriodicSummary() {
    const periodicSummary = document.getElementById('bookConfigPeriodicSummary');
    const periodicMode = document.getElementById('bookConfigPeriodicMode');
    const periodicFrequency = document.getElementById('bookConfigPeriodicFrequency');
    const periodicAmount = document.getElementById('bookConfigPeriodicAmount');

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

// Simple helper to refresh just the progress text in the modal header
export function updateModalProgressStats(amudStates) {
    const learned = amudStates.filter(s => s === 1).length;
    const total = amudStates.length;
    const percent = total > 0 ? Math.round((learned / total) * 100) : 0;
    const infoEl = document.getElementById('configModalProgressInfo');
    if (infoEl) {
        infoEl.innerText = `התקדמות: ${learned}/${total} עמודים (${percent}%)`;
    }
}
