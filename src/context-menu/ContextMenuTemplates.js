/**
 * Context Menu Blueprint Factory
 * Returns distinct menu layouts based on whether the cell has an active book track.
 */
export const ContextMenuTemplates = {
    // 1. Template for active learning days
    CALENDAR_STUDY_DAY: (dateString, bookLabel, handlers) => [
        {
            label: `הגדרת יעד לסיום ${bookLabel}`,
            icon: '🎯',
            action: () => {
                handlers.onAdjustTargetDate(dateString, bookLabel);
                console.log(`[Action] Adjust Target Date for book: "${bookLabel}" starting from date: ${dateString}`);
            }
        },
        {
            label: 'שינוי קצב הלימוד מהיום',
            icon: '⚡',
            action: () => {
                handlers.onAdjustPacing(dateString);
                console.log(`[Action] Adjust pacing/Pace Mode starting from date: ${dateString}`);
            }
        },
        { divider: true },
        {
            label: 'בטל יום חזרה',
            icon: '❌',
            action: () => {
                handlers.onCancelReviewDay(dateString, bookLabel);
                console.log(`[Action] Cancel review/chazara day status for date: ${dateString}`);
            }
        },
        {
            label: 'הוספת אירוע מיוחד',
            icon: '📌',
            action: () => {
                handlers.onAddCustomEvent(dateString);
                console.log(`[Action] Add custom special event on date: ${dateString}`);
            }
        },
        { divider: true },
        {
            label: 'הוספת רצף ימי הפסקה',
            icon: '🛑',
            action: () => {
                handlers.onAddBreakDays(dateString);
                console.log(`[Action] Insert multiple consecutive break days starting: ${dateString}`);
            }
        },
        {
            label: 'הגדרת חזרות מחזוריות מכאן והלאה',
            icon: '📅',
            action: () => {
                handlers.onSetPeriodicReview(dateString);
                console.log(`[Action] Insert periodic review days starting from: ${dateString} (Every X days / Y dafs)`);
            }
        }
    ],

    // 2. Fallback template for empty padding cells 
    CALENDAR_EMPTY_DAY: (dateString, handlers) => [
        {
            label: 'התחלת ספר חדש מתאריך זה',
            icon: '🌱',
            action: () => {
                handlers.onStartNewBook(dateString);
                console.log(`[Action] Start new book from empty cell on date: ${dateString}`);
            }
        },
        {
            label: 'הוספת אירוע מיוחד',
            icon: '📌',
            action: () => {
                handlers.onAddCustomEvent(dateString);
                console.log(`[Action] Add custom special event on date: ${dateString}`);
            }
        }, { divider: true }, 
        {
            label: 'הוספת רצף ימי הפסקה',
            icon: '🛑',
            action: () => {
                handlers.onAddBreakDays(dateString);
                console.log(`[Action] Insert multiple consecutive break days starting: ${dateString}`);
            }
        }
    ]
};
