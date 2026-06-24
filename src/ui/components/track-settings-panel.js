import { getActiveTrack } from '../../core/track.js';
import { formatGematria, numberToHebrew } from '../../utils/gematria.js';

// Hydrates the track configuration panel elements with saved data
export function hydrateHtmlFromAppState(AppState, tracks) {
    let currentTrack = getActiveTrack(AppState, tracks);
    let settings = currentTrack.settings;

    document.getElementById('calendarSystem').value = settings.calendarSystem;
    document.getElementById('includeHolidaysInput').checked = settings.includeHolidays;
    document.getElementById('includeBeinHazmanimInput').checked = settings.includeBeinHazmanim;
    document.getElementById('startDateInput').value = settings.startDate;

    // Synchronize Weekday Selection checkboxes
    const activeDays = settings.studyDays || [];
    document.querySelectorAll('input[name="studyDays"]').forEach(checkbox => {
        checkbox.checked = activeDays.includes(parseInt(checkbox.value, 10));
    });

    document.getElementById('minimalistUiToggle').checked = AppState.userPreferences.minimalCalendar
}

// Renders the track switcher dropdown options based on the current tracks array and active track in AppState
export function renderTrackSwitcher(tracks, activeTrackId) {
    const dropdown = document.getElementById('trackSelectDropdown');
    if (!dropdown) return;

    // Clear existing options
    dropdown.innerHTML = '';

    // Populate options from tracks array
    tracks.forEach(track => {
        const option = document.createElement('option');
        option.value = track.id;
        option.textContent = track.name || "מסלול ללא שם";
        
        // Mark the active track as selected
        if (track.id === activeTrackId) {
            option.selected = true;
        }
        dropdown.appendChild(option);
    });
}

// Renders the Hebrew date labels
export function renderDateLabels(startDate, targetDate) {
    const startDateLabel = document.getElementById('startDateHebrewLabel');
    const targetDateLabel = document.getElementById('targetDateHebrewLabel');

    const getHebrewLabelText = (dateInput) => {
        if (!dateInput) return "";

        const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);

        // Check for an invalid date
        if (isNaN(dateObj.getTime())) return "";

        try {
            const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }).formatToParts(dateObj);

            const dayNum = parseInt(parts.find(p => p.type === 'day').value, 10);
            let yearNum = parseInt(parts.find(p => p.type === 'year').value, 10);
            const monthName = parts.find(p => p.type === 'month').value;

            if (yearNum < 1000) yearNum += 5000;

            const dayHebrew = formatGematria(dayNum, numberToHebrew(dayNum));
            const yearHebrew = formatGematria(yearNum, numberToHebrew(yearNum));

            return `${dayHebrew} ב${monthName} ${yearHebrew}`;
        } catch (e) {
            console.error("Error generating custom Hebrew date format string", e);
            return "";
        }
    };

    if (startDateLabel) {
        startDateLabel.textContent = getHebrewLabelText(startDate);
    }

    if (targetDateLabel) {
        targetDateLabel.textContent = targetDate ? getHebrewLabelText(targetDate) : '';
    }
}
