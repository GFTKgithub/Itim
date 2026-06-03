import { numberToHebrew, formatGematria } from "./gematria.js";


// Converts a Hebrew year number into its corresponding Hebrew numeral year string
export function formatHebrewMonthTitle(date) {
    const monthName = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'long' }).format(date);
    const hebrewYearFull = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { year: 'numeric' }).format(date);

    // חילוץ המספר (למשל 5786)
    const yearNum = parseInt(hebrewYearFull.replace(/\D/g, ''));

    return `${monthName} ${formatGematria(yearNum, numberToHebrew(yearNum))}`;
}

// Formats a date to 'YYYY-MM-DD' based on the Asia/Jerusalem timezone
export function formatDateToIL(date) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(date);
}

// 
export function formatDateToISO(d) {
    return d.toISOString().split('T')[0];
}

// Converts a 'YYYY-MM-DD' string into a local Date object set to noon
export function parseDateToIL(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    // יצירת התאריך לפי שעון מקומי ואיזון שעות אם נדרש
    const date = new Date(year, month - 1, day, 12, 0, 0);
    return date;
}

// Formats a Date object into a Hebrew calendar string (Day + Month) in Hebrew
export function getHebrewDate(date) {
    return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        day: 'numeric',
        month: 'long'
    }).format(date);
}

// Formats a Date object into a Gregorian calendar string (Day + Month) in Hebrew
export function getGregorianDate(date) {
    return new Intl.DateTimeFormat('he-IL', {
        day: 'numeric',
        month: 'long'
    }).format(date);
}