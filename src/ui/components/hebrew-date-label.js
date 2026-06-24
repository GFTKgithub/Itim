import { formatGematria, numberToHebrew } from '../../utils/gematria.js';

// Updates a Hebrew date label based on a gregorian date element
export function updateHebrewLabel(input, label) {
    if (!label) return;

    if (!input.value) {
        label.textContent = "";
        return;
    }

    try {
        const selectedDate = new Date(input.value);

        // Use he-IL with hebrew calendar to extract precise localized strings and numeric values
        const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).formatToParts(selectedDate);

        const dayNum = parseInt(parts.find(p => p.type === 'day').value, 10);
        let yearNum = parseInt(parts.find(p => p.type === 'year').value, 10);

        // Dynamically pull the exact Hebrew month name string directly from the browser's engine
        const monthName = parts.find(p => p.type === 'month').value;

        if (yearNum < 1000) yearNum += 5000;

        const rawDayHebrew = numberToHebrew(dayNum);
        const rawYearHebrew = numberToHebrew(yearNum);

        const dayHebrew = formatGematria(dayNum, rawDayHebrew);
        const yearHebrew = formatGematria(yearNum, rawYearHebrew);

        // Update display text formatting
        label.textContent = `(${dayHebrew} ב${monthName} ${yearHebrew})`;

    } catch (e) {
        console.error("Error generating custom Hebrew date format string", e);
        label.textContent = "";
    }
}