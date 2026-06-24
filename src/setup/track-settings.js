import { renderDateLabels } from "../ui/components/track-settings-panel.js";

/**
 * Track Settings — inline controls in the main page content area.
 * Pure settings (calendar system, study days, holidays, bein hazmanim, start date).
 * NOT the settings drawer — that's a separate UI concern.
 */
export function setupTrackSettings({ onUpdateTrackSetting, onGenerate, onSyncToToday }) {
    const calendarSystem = document.getElementById('calendarSystem');
    const includeHolidaysInput = document.getElementById('includeHolidaysInput');
    const includeBeinHazmanimInput = document.getElementById('includeBeinHazmanimInput');
    const startDateInput = document.getElementById('startDateInput');

    calendarSystem?.addEventListener('change', (e) => {
        onUpdateTrackSetting('calendarSystem', e.target.value);
        onGenerate();
    });

    document.querySelectorAll('input[name="studyDays"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const selectedDays = Array.from(document.querySelectorAll('input[name="studyDays"]:checked'))
                .map(cb => parseInt(cb.value, 10));
            onUpdateTrackSetting('studyDays', selectedDays);
            onGenerate(); 
        });
    });

    includeHolidaysInput?.addEventListener('change', (e) => {
        onUpdateTrackSetting('includeHolidays', e.target.checked);
        onGenerate();
    });

    includeBeinHazmanimInput?.addEventListener('change', (e) => {
        onUpdateTrackSetting('includeBeinHazmanim', e.target.checked);
        onGenerate();
    });

    const handleDateChange = () => {
        onUpdateTrackSetting('startDate', startDateInput.value);
        renderDateLabels(startDateInput.value);
    };

    startDateInput?.addEventListener('change', handleDateChange);

    document.getElementById('syncToTodayBtn')?.addEventListener('click', () => {
        if (onSyncToToday) onSyncToToday();
    });
}