/**
 * Settings Drawer — the slide-out panel containing user preferences,
 * cloud auth, backup management, and reset options.
 * 
 * This module handles ONLY the drawer open/close mechanics and the
 * preference toggles inside it (minimal calendar, sync preferences).
 * Cloud auth, backup, and reset are handled by their own modules.
 */
export function setupSettingsDrawer({ userPreferences, onUpdateUserPreference, onGenerate }) {
    const toggleSettingsPanelBtn = document.getElementById('toggleSettingsPanelBtn');
    const settingsDrawer = document.getElementById('settingsDrawer');
    const drawerOverlay = document.getElementById('drawerOverlay');
    const drawerPanel = document.getElementById('drawerPanel');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');

    function openDrawer() {
        if (!settingsDrawer || !drawerOverlay || !drawerPanel) return;
        settingsDrawer.classList.remove('pointer-events-none', 'invisible');
        setTimeout(() => {
            drawerOverlay.classList.remove('opacity-0');
            drawerOverlay.classList.add('opacity-100');
            drawerPanel.classList.remove('translate-x-full');
            drawerPanel.classList.add('translate-x-0');
        }, 10);
    }

    function closeDrawer() {
        if (!settingsDrawer || !drawerOverlay || !drawerPanel) return;
        drawerOverlay.classList.remove('opacity-100');
        drawerOverlay.classList.add('opacity-0');
        drawerPanel.classList.remove('translate-x-0');
        drawerPanel.classList.add('translate-x-full');
        setTimeout(() => {
            settingsDrawer.classList.add('pointer-events-none', 'invisible');
        }, 300);
    }

    toggleSettingsPanelBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openDrawer();
    });

    closeDrawerBtn?.addEventListener('click', closeDrawer);
    drawerOverlay?.addEventListener('click', closeDrawer);

    // --- Minimal Calendar Toggle ---
    const minimalistUiToggle = document.getElementById('minimalistUiToggle');
    const calendarContainer = document.getElementById('calendarContainer');

    const isMinimal = userPreferences?.minimalCalendar === true || userPreferences?.minimalCalendar === 'true';
    
    if (minimalistUiToggle && calendarContainer) {
        minimalistUiToggle.checked = isMinimal;
        if (isMinimal) {
            calendarContainer.classList.add('minimal-calendar');
        } else {
            calendarContainer.classList.remove('minimal-calendar');
        }
    }
    
    minimalistUiToggle?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        if (typeof onUpdateUserPreference === 'function') {
            onUpdateUserPreference('minimalCalendar', checked);
        }
        if (checked) {
            calendarContainer.classList.add('minimal-calendar');
        } else {
            calendarContainer.classList.remove('minimal-calendar');
        }
        if (typeof onGenerate === 'function') {
            onGenerate();            
        }
    });

    // --- Sync User Preferences Toggle ---
    const syncUserPreferencesToggle = document.getElementById('syncUserPreferences');

    syncUserPreferencesToggle?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        onUpdateUserPreference('syncUserPreferences', checked);
    });
}