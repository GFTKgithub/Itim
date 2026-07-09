/**
 * Settings Drawer — the slide-out panel containing user preferences,
 * cloud auth, backup management, and reset options.
 * 
 * This module handles ONLY the drawer open/close mechanics and the
 * preference toggles inside it (minimal calendar, sync preferences).
 * Cloud auth, backup, and reset are handled by their own modules.
 */
let _drawerWired = false;

export function setupSettingsDrawer({ userPreferences, onUpdateUserPreference, onGenerate }) {
    const toggleSettingsPanelBtn = document.getElementById('toggleSettingsPanelBtn');
    const settingsDrawer = document.getElementById('settingsDrawer');
    const drawerOverlay = document.getElementById('drawerOverlay');
    const drawerPanel = document.getElementById('drawerPanel');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');

    // Wire persistent drawer button listeners only once
    if (!_drawerWired) {
        _drawerWired = true;

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

        // --- Sync User Preferences Toggle (persistent) ---
        const syncUserPreferencesToggle = document.getElementById('syncUserPreferences');
        syncUserPreferencesToggle?.addEventListener('change', (e) => {
            const checked = e.target.checked;
            onUpdateUserPreference('syncUserPreferences', checked);
        });
    }

    // --- Minimal Calendar Toggle (re-applied each time since calendarContainer is re-created) ---
    const minimalistUiToggle = document.getElementById('minimalistUiToggle');
    
    const isMinimal = userPreferences?.minimalCalendar === true || userPreferences?.minimalCalendar === 'true';
    
    // Set initial toggle state
    if (minimalistUiToggle) {
        minimalistUiToggle.checked = isMinimal;
    }
    
    // Remove old change listener if it exists to prevent double-wiring
    if (minimalistUiToggle._minimalChangeHandler) {
        minimalistUiToggle.removeEventListener('change', minimalistUiToggle._minimalChangeHandler);
    }
    minimalistUiToggle._minimalChangeHandler = (e) => {
        const checked = e.target.checked;
        if (typeof onUpdateUserPreference === 'function') {
            onUpdateUserPreference('minimalCalendar', checked);
        }
        // Trigger re-render - the calendar component will apply minimal styling automatically
        if (typeof onGenerate === 'function') {
            onGenerate();            
        }
    };
    minimalistUiToggle?.addEventListener('change', minimalistUiToggle._minimalChangeHandler);
}
