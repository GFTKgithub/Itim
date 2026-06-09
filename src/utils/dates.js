import { numberToHebrew, formatGematria } from "./gematria.js";

export const HEBREW_MILESTONE_DATES = {
    zman_choref_end: { month: 'ניסן',  day: 1 },
    zman_kayitz_end: { month: 'אב',    day: 9 },
    zman_elul_end:   { month: 'אלול',  day: 29 },
    rosh_hashana:    { month: 'תשרי',  day: 1 },
    chanukah:        { month: 'כסלו',  day: 25 },
    purim:           { month: 'אדר',   day: 14 },
    leil_haseder:    { month: 'ניסן',  day: 15 },
    shavuot:         { month: 'סיון',  day: 6 }
};

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

// Determines whether a given date falls within the traditional yeshiva Bein Hazmanim ranges
export function checkIsBeinHazmanim(dateObj) {
    try {
        // Format the date into raw Hebrew calendar parts
        const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
            day: 'numeric',
            month: 'numeric', // Returns numeric mapping (e.g., 1, 2, 5, etc.)
        });
        
        const parts = formatter.formatToParts(dateObj);
        const day = parseInt(parts.find(p => p.type === 'day').value, 10);
        const month = parseInt(parts.find(p => p.type === 'month').value, 10);

        // Note: Intl Hebrew numeric month values can vary slightly depending on leap years,
        // but the long string name is globally stable. Let's pull the text month to be safe:
        const textFormatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'long' });
        const monthName = textFormatter.format(dateObj);

        // 1. Nissan Break: 1 Nissan to 30 Nissan (entire month)
        if (monthName.includes('ניסן')) {
            return true;
        }

        // 2. Av Break: 10 Av to 30 Av (starts day after Tisha B'Av)
        if (monthName.includes('אב') && day >= 10) {
            return true;
        }

        // 3. Tishrei Break: 11 Tishrei to 30 Tishrei (starts day after Yom Kippur)
        if (monthName.includes('תשרי') && day >= 11) {
            return true;
        }

        return false;
    } catch (error) {
        console.error("Error calculating Hebrew date boundaries for Bein Hazmanim:", error);
        return false;
    }
}

// Resolves the closest upcoming Gregorian date based on a Hebrew template rule.
export function getNearestHebrewMilestone(template) {
    const today = new Date();
    // Use your existing parse utility to establish clean local mid-day baselines
    let currentCheckDate = parseDateToIL(formatDateToIL(today));
    
    // Intentionally construct matching formatting tokens using native Intl properties
    const hebrewFormatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        day: 'numeric',
        month: 'long'
    });

    while (true) {
        const parts = hebrewFormatter.formatToParts(currentCheckDate);
        const currentMonth = parts.find(p => p.type === 'month').value;
        const currentDay = parseInt(parts.find(p => p.type === 'day').value, 10);

        let isMonthMatch = currentMonth === template.month;

        // טיפול שורש לחודש אדר - דילוג מובטח על אדר א'
        if (template.month === 'אדר') {
            const hasAdar = currentMonth.includes('אדר');
            const hasBet = currentMonth.includes('ב');
            const hasAlef = currentMonth.includes('א') && !currentMonth.includes('חשוון'); // הגנה קלה למקרה של שיבוש מחרוזות

            // אנחנו רוצים להתאים רק אם:
            // 1. זה אדר ב' (שנה מעוברת)
            // 2. או שזה אדר רגיל לחלוטין (אין בו לא א' ולא ב' - שנה פשוטה)
            isMonthMatch = hasAdar && (hasBet || (!hasAlef && !hasBet));
        }

        // Match found!
        if (isMonthMatch && currentDay === template.day) {
            return formatDateToIL(currentCheckDate);
        }

        // Increment day-by-day
        currentCheckDate.setDate(currentCheckDate.getDate() + 1);
        
        // Safety circuit-breaker (never let an unmatched string cause an infinite loop)
        if (currentCheckDate.getFullYear() > today.getFullYear() + 2) {
            console.error("Hebrew calendar token parsing failed boundary thresholds.");
            return formatDateToIL(today);
        }
    }
}