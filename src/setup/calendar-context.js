import { showContextMenu } from "../ui/components/context-menu/context-menu.js";
import { ContextMenuTemplates } from "../ui/components/context-menu/ContextMenuTemplates.js";
import { ContextActions } from "../ui/components/context-menu/context-menu-actions.js";

// --- Calendar Grid Context Menu ---
export function setupCalendarContextMenus({ getActiveTrack, onGenerate }) {
    const container = document.getElementById('calendarContainer');
    if (!container) return;
    
    container.addEventListener('contextmenu', (event) => {
        const dayCell = event.target.closest('.calendar-day');
        if (!dayCell) return;

        event.preventDefault();

        const dateString = dayCell.dataset.date;
        const bookLabelEl = dayCell.querySelector('[data-book-label]');
        const bookLabel = bookLabelEl ? bookLabelEl.textContent.trim() : '';
        const activeTrack = getActiveTrack();

        const menuHandlers = {
            onAdjustTargetDate: (date, book) => ContextActions.onAdjustTargetDate(date, book, activeTrack, onGenerate),
            onAdjustPacing: (date) => ContextActions.onAdjustPacing(date, bookLabel, activeTrack, onGenerate),
            onCancelReviewDay: (date) => ContextActions.onCancelReviewDay(date, bookLabel, activeTrack, onGenerate),
            onAddCustomEvent: (date) => ContextActions.onAddCustomEvent(date, activeTrack, onGenerate),
            onAddBreakDays: (date) => ContextActions.onAddBreakDays(date, activeTrack, onGenerate),
            onSetPeriodicReview: (date) => ContextActions.onSetPeriodicReview(date, activeTrack, onGenerate),
            onStartNewBook: (date) => ContextActions.onStartNewBook(date, activeTrack, onGenerate)
        };

        const menuItems = (!bookLabel || bookLabel === '-')
            ? ContextMenuTemplates.CALENDAR_EMPTY_DAY(dateString, menuHandlers)
            : ContextMenuTemplates.CALENDAR_STUDY_DAY(dateString, bookLabel, menuHandlers);

        showContextMenu(event, menuItems);
    });
}