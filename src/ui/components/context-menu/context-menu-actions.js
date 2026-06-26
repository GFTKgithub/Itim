import { saveState } from '../../../services/persistence.js';
import { updateBookSequenceUI } from '../book-sequence-list.js';

import { talmud_bavli_masechtot } from '../../../core/data.js';
import { getTotalAmudim } from '../../../utils/talmud.js';

import { showDialog } from '../dialog.js';

/**
 * Handles actions dispatched from the calendar day context menus.
 * Operates on the activeTrack reference and invokes onGenerate to re-calculate schedules.
 */
export const ContextActions = {
    
    // Target Date Modification
    onAdjustTargetDate: async (dateString, bookLabel, activeTrack, onGenerate) => {
        const bookIdx = activeTrack.bookSequence.findIndex(b => 
            (typeof b === 'string' ? b : b.name) === bookLabel
        );
        if (bookIdx === -1) return;

        let currentEntry = activeTrack.bookSequence[bookIdx];
        const defaultDate = typeof currentEntry === 'object' && currentEntry.targetDate 
            ? currentEntry.targetDate 
            : dateString;

        // Custom Dialog Prompt
        const res = await showDialog({
            title: `שינוי יעד סיום ל${bookLabel}`,
            message: 'הזן תאריך יעד סיום חדש עבור מסכת זו במבנה המבוקש:',
            icon: '📅',
            showCancel: true,
            inputs: [{ name: 'targetDate', type: 'date', label: 'תאריך יעד סיום', value: defaultDate }]
        });

        if (!res || !res.targetDate) return;

        // Normalize string entry to configuration object matching scheduler specs
        if (typeof currentEntry === 'string') {
            currentEntry = { name: currentEntry };
        }
        
        currentEntry.calcMethod = 'targetDate';
        currentEntry.targetDate = res.targetDate;
        
        activeTrack.bookSequence[bookIdx] = currentEntry;
        
        saveState();
        if (typeof updateBookSequenceUI === 'function') updateBookSequenceUI(activeTrack.bookSequence);
        await onGenerate();
    },

    // Pace Alteration
    onAdjustPacing: async (dateString, bookLabel, activeTrack, onGenerate) => {
        const bookIdx = activeTrack.bookSequence.findIndex(b => 
            (typeof b === 'string' ? b : b.name) === bookLabel
        );
        if (bookIdx === -1) return;

        let currentEntry = activeTrack.bookSequence[bookIdx];
        const defaultPace = typeof currentEntry === 'object' && currentEntry.paceValue 
            ? currentEntry.paceValue 
            : 1;

        const res = await showDialog({
            title: `שינוי קצב לימוד - ${bookLabel}`,
            message: 'הזן קצב לימוד יומי בדפים לעמודים (לדוגמה: 1 = דף יומי, 0.5 = חצי דף):',
            icon: '⚡',
            showCancel: true,
            inputs: [{ name: 'paceValue', type: 'number', step: '0.1', min: '0.1', label: 'קצב דפים ליום לימוד', value: defaultPace }]
        });

        if (!res || isNaN(parseFloat(res.paceValue))) return;

        if (typeof currentEntry === 'string') {
            currentEntry = { name: currentEntry };
        }
        
        currentEntry.calcMethod = 'pace';
        currentEntry.paceValue = parseFloat(res.paceValue);
        
        activeTrack.bookSequence[bookIdx] = currentEntry;
        
        saveState();
        if (typeof updateBookSequenceUI === 'function') updateBookSequenceUI(activeTrack.bookSequence);
        await onGenerate();
    },

    // Remove Review Day Status
    onCancelReviewDay: async (dateString, bookLabel, activeTrack, onGenerate) => {
        if (!activeTrack || !activeTrack.bookSequence) {
            console.error("Context Actions Error: activeTrack state mapping is missing or corrupt", activeTrack);
            return;
        }

        const bookIdx = activeTrack.bookSequence.findIndex(b => 
            (typeof b === 'string' ? b : b.name) === bookLabel
        );

        if (bookIdx !== -1) {
            let currentEntry = activeTrack.bookSequence[bookIdx];
            
            if (typeof currentEntry === 'string') {
                currentEntry = { name: currentEntry, calcMethod: 'pace', paceValue: 1, reviewDays: 0 };
            }

            if (currentEntry.reviewDays > 0) {
                currentEntry.reviewDays = currentEntry.reviewDays - 1;
                activeTrack.bookSequence[bookIdx] = currentEntry;
            }
        }

        saveState();
        if (typeof updateBookSequenceUI === 'function') updateBookSequenceUI(activeTrack.bookSequence);
        await onGenerate();
    },

    // Force Multi-Day Breaks
    onAddBreakDays: async (startDateString, activeTrack, onGenerate) => {
        const res = await showDialog({
            title: 'הוספת ימי הפסקה רצופים',
            message: 'כמה ימי חופש ברצונך להחיל ברצף החל מתאריך זה?',
            icon: '🌴',
            showCancel: true,
            inputs: [{ name: 'totalDays', type: 'number', min: '1', step: '1', label: 'מספר ימי הפסקה', placeholder: 'למשל: 3' }]
        });

        if (!res || !res.totalDays || isNaN(parseInt(res.totalDays, 10)) || parseInt(res.totalDays, 10) <= 0) return;
        const totalDays = parseInt(res.totalDays, 10);

        if (!activeTrack.studyStatusOverrides) activeTrack.studyStatusOverrides = {};

        const allDayCells = Array.from(document.querySelectorAll('.calendar-day'));
        const startIndex = allDayCells.findIndex(cell => cell.dataset.date === startDateString);
        if (startIndex === -1) {
            console.error(`Could not locate cell with date signature: ${startDateString}`);
            return;
        }

        const targetCells = allDayCells.slice(startIndex, startIndex + totalDays);

        targetCells.forEach(cell => {
            const cellDateKey = cell.dataset.date;
            if (!cellDateKey) return;

            if (activeTrack.studyStatusOverrides[cellDateKey] === undefined) {
                activeTrack.studyStatusOverrides[cellDateKey] = 1; 
            }
        });

        saveState();
        await onGenerate();
    },

    // Add Custom Special Events
    onAddCustomEvent: async (dateString, activeTrack, onGenerate) => {
        if (!activeTrack.calendarEvents) activeTrack.calendarEvents = {};
        const existingEvent = activeTrack.calendarEvents[dateString]?.displayText || "";

        const res = await showDialog({
            title: 'ניהול תזכורת או אירוע מותאם',
            message: 'הוסף תיאור אירוע ליום זה. השאר ריק ולחץ אישור כדי למחוק את האירוע הקיים ולחזור לברירת מחדל.',
            icon: '📌',
            showCancel: true,
            inputs: [{ name: 'eventText', type: 'text', label: 'תיאור האירוע / הערה', value: existingEvent }]
        });
        
        // Cancel returns false
        if (res === false) return;

        const eventText = res.eventText ? res.eventText.trim() : "";

        if (eventText === "") {
            if (activeTrack.calendarEvents[dateString]) {
                delete activeTrack.calendarEvents[dateString];
            }
        } else {
            activeTrack.calendarEvents[dateString] = {
                displayText: eventText,
                traits: { isCustom: true }
            };
        }
        
        saveState();
        await onGenerate();
    },

    // Set Periodic Book Review Days
    onSetPeriodicReview: async (dateString, bookLabel, activeTrack, onGenerate) => {
        const bookIdx = activeTrack.bookSequence.findIndex(b => 
            (typeof b === 'string' ? b : b.name) === bookLabel
        );
        if (bookIdx === -1) return;

        let currentEntry = activeTrack.bookSequence[bookIdx];
        const defaultReview = typeof currentEntry === 'object' && currentEntry.reviewDays 
            ? currentEntry.reviewDays 
            : 0;

        const res = await showDialog({
            title: `חזרה מרוכזת בסיום מסכת ${bookLabel}`,
            message: 'כמה ימי חזרה כלליים ייעודיים ברצונך להקצות בסיום לימוד מסכת זו?',
            icon: '📚',
            showCancel: true,
            inputs: [{ name: 'reviewDays', type: 'number', min: '0', step: '1', label: 'מספר ימי חזרה', value: defaultReview }]
        });

        if (!res || isNaN(parseInt(res.reviewDays, 10))) return;

        if (typeof currentEntry === 'string') {
            currentEntry = { name: currentEntry };
        }

        currentEntry.reviewDays = parseInt(res.reviewDays, 10);
        activeTrack.bookSequence[bookIdx] = currentEntry;

        saveState();
        if (typeof updateBookSequenceUI === 'function') updateBookSequenceUI(activeTrack.bookSequence);
        await onGenerate();
    },

    // Append New Tract to current track sequence
    onStartNewBook: async (dateString, activeTrack, onGenerate) => {
        // Map the array of masechtot to the structure expected by the updated showDialog
        const masechtotOptions = talmud_bavli_masechtot.map(m => ({
            value: m.name,
            text: m.name
        }));

        const res = await showDialog({
            title: 'הוספת מסכת חדשה למחזור',
            message: 'בחר מסכת מתוך הרשימה הבאה:',
            icon: '➕',
            showCancel: true,
            inputs: [
                { 
                    name: 'bookName', 
                    type: 'select', 
                    label: 'שם המסכת בעברית',
                    options: masechtotOptions 
                }
            ]
        });

        if (!res || !res.bookName) return;
        const cleanName = res.bookName.trim();


        if (!activeTrack.bookSequence) activeTrack.bookSequence = [];
        if (!activeTrack.studyStatusOverrides) activeTrack.studyStatusOverrides = {};

        // 1. Convert DD/MM/YYYY dateString to standard YYYY-MM-DD format so Date parsing doesn't crash
        // 1. Robust date parsing that handles both YYYY-MM-DD and DD/MM/YYYY seamlessly
        let rawDate;
        if (dateString.includes('-')) {
            // It's already YYYY-MM-DD
            const [y, m, d] = dateString.split('-');
            rawDate = new Date(+y, +m - 1, +d);
        } else if (dateString.includes('/')) {
            // It's DD/MM/YYYY
            const [d, m, y] = dateString.split('/');
            rawDate = new Date(+y, +m - 1, +d);
        } else {
            // Fallback for native string timestamps
            rawDate = new Date(dateString);
        }

        // Generate safe components manually without string methods
        const finalY = rawDate.getFullYear();
        const rawM = rawDate.getMonth() + 1;
        const rawD = rawDate.getDate();
        
        const finalM = rawM < 10 ? '0' + rawM : rawM;
        const finalD = rawD < 10 ? '0' + rawD : rawD;
        
        const isoStartDate = `${finalY}-${finalM}-${finalD}`;
        const clickedTime = rawDate.getTime();

        const totalAmudim = getTotalAmudim(cleanName);
        const newBookEntry = {
            name: cleanName,
            calcMethod: 'pace',
            paceValue: 1,
            reviewDays: 0,
            startAmudIdx: 0,
            endAmudIdx: totalAmudim - 1,
            startDate: isoStartDate // Clean standard format
        };

        // 2. Loop through sequence to find exactly where this start time belongs
        let insertionIndex = activeTrack.bookSequence.length;

        for (let i = 0; i < activeTrack.bookSequence.length; i++) {
            const currentBook = activeTrack.bookSequence[i];
            
            if (currentBook && currentBook.startDate) {
                const [bYear, bMonth, bDay] = currentBook.startDate.split('-');
                const bookStartTime = new Date(+bYear, +bMonth - 1, +bDay).getTime();

                if (clickedTime < bookStartTime) {
                    insertionIndex = i;
                    break;
                }
            }
        }

        // 3. Splice into position
        activeTrack.bookSequence.splice(insertionIndex, 0, newBookEntry);

        saveState();
        if (typeof updateBookSequenceUI === 'function') updateBookSequenceUI(activeTrack.bookSequence);
        await onGenerate();
        
        await showDialog({
            title: 'הפעולה הושלמה',
            message: `מסכת ${cleanName} התווספה בהצלחה לרצף הלימוד!`,
            icon: '✅'
        });
    }
};