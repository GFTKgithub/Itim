import { createAppState } from './state/app-state.js';
import { addToSequence } from './core/book-sequence.js';
import { computeDaySlots } from './core/scheduler.js';
import { showDialog } from './ui/components/dialog.js';
import { updateCalendarViewToggle, renderCalendar } from './ui/components/calendar.js';
import { updateBookSequenceUI } from './ui/components/book-sequence-list.js';
import { initAuthListener } from './services/auth.js';
import { saveState } from './services/persistence.js';

import { setupTrackSelector, setupBookSequence, setupActionDock, setupBackupManagement, setupViewModeToggle } from './setup/listeners.js';
import { setupTrackSettings } from './setup/track-settings.js';
import { setupSettingsDrawer } from './setup/settings-drawer.js';
import { setupBookSequenceDragAndDrop } from './setup/drag-and-drop.js';
import { setupBookConfigModal } from './setup/book-config-modal.js';
import { setupCloudAuth } from './setup/cloud-auth.js';
import { setupCalendarContextMenus } from './setup/calendar-context.js';

// Executes main initiation function upon page load
document.addEventListener('DOMContentLoaded', init);

// Main page initiation function
async function init() {
    console.log("HTML page initialized successfully");

    // 1. Create central app state controller
    const app = createAppState();

    // 2. Initialize state (loads from persistence, creates default track if needed)
    await app.init();

    // 3. Setup all DOM listeners
    setupMainPage(app);

    // 4. Refresh the UI
    await app.refreshTrackConfigPanel();

    // Wire up Firebase auth listener
    setupFirebaseAuth(app);
}

// Executes setup helpers for index.html
function setupMainPage(app) {
    setupTrackSelector({
        onAddNewTrack: async (name) => await app.handleAddNewTrack(name),
        onSwitchTrack: async (trackId) => await app.handleSwitchTrack(trackId),
        onDeleteTrack: async (trackId) => await app.handleDeleteTrack(trackId)
    });

    setupBookSequence({
        onAddToSequence: () => {
            const selectedName = document.getElementById('bookSelect')?.value;
            app.handleAddToSequence(selectedName);
        },
        onClearSequence: async () => {
            const confirmed = await showDialog({
                title: 'ניקוי רשימת המסכתות במסלול',
                message: 'האם אתה בטוח שברצונך לנקות את רשימת המסכתות במסלול?',
                icon: '🗑️',
                showCancel: true,
                confirmText: 'כן, נקה הכל',
                cancelText: 'לא, התחרטתי'
            });
            if (!confirmed) return;
            
            const track = app.getActiveTrack();
            track.bookSequence = [];
            saveState();
            updateBookSequenceUI(track.bookSequence);
            app.handleScheduleGeneration();
        }
    });

    setupActionDock({
        onGenerate: () => app.handleScheduleGeneration(),
        onExportExcel: () => app.handleExportExcel(),
        onExportICal: () => app.handleExportICal()
    });

    setupBackupManagement({
        onExport: () => app.handleExportBackup(),
        onImport: (event) => app.handleImportBackup(event),
        onResetSettings: () => app.handleResetSettings(),
        onResetStudyStatusOverrides: () => app.handleResetStudyStatusOverrides()
    });

    setupTrackSettings({
        onUpdateTrackSetting: (key, value) => app.handleUpdateTrackSetting(key, value),
        onGenerate: () => app.handleScheduleGeneration(),
        onSyncToToday: () => app.handleSyncToToday()
    });

    setupSettingsDrawer({
        userPreferences: app.getStateRef().userPreferences,
        onUpdateUserPreference: (key, value) => app.handleUpdateUserPreference(key, value),
        onGenerate: () => app.handleScheduleGeneration()
    });

    setupBookSequenceDragAndDrop({
        onRemove: (indexToRemove) => app.handleRemoveFromSequence(indexToRemove),
        onReorder: (newOrderOfIndices) => app.handleBookSequenceReorder(newOrderOfIndices)
    });

    setupBookConfigModal({
        getBookSequence: () => app.getActiveTrack().bookSequence,
        getSchedule: () => app.getActiveTrack().studySchedule,
        getBookRangeLimits: (index) => {
            const track = app.getActiveTrack();
            if (index === 0) {
                return { minDate: track.settings.startDate };
            }
            const previousBook = track.bookSequence[index - 1];
            const previousBookName = typeof previousBook === 'string' ? previousBook : previousBook.name;
            const previousBookDays = track.studySchedule.filter(day => day.book === previousBookName);
            if (previousBookDays.length > 0) {
                const lastDay = previousBookDays[previousBookDays.length - 1].dateString;
                const nextAvailableDate = new Date(lastDay);
                nextAvailableDate.setDate(nextAvailableDate.getDate() + 1);
                return { minDate: nextAvailableDate.toISOString().split('T')[0] };
            }
            return { minDate: track.settings.startDate };
        },
        computeDaySlots: computeDaySlots,
        onSaveConfig: (config) => app.handleSaveBookConfig(config),
        onStudyStatusOverride: (date) => app.handleStudyStatusOverride(date)
    });

    setupCalendarContextMenus({
        getActiveTrack: () => app.getActiveTrack(),
        onGenerate: () => app.handleScheduleGeneration()
    });

    setupViewModeToggle({
        onGenerate: () => app.handleScheduleGeneration(),
        onUpdateUserPreference: (key, value) => app.handleUpdateUserPreference(key, value),
        onUpdateViewToggle: (viewMode) => updateCalendarViewToggle(viewMode),
        getCalendarViewMode: () => app.getStateRef().userPreferences.calendarViewMode
    });

    // Handle print: temporarily switch to continuous mode
    window.addEventListener('beforeprint', () => {
        const calendarContainer = document.getElementById('calendarContainer');
        const track = app.getActiveTrack();
        if (!calendarContainer || !track?.studySchedule || track.studySchedule.length === 0) return;

        window.__printRestoreViewMode = app.getStateRef().userPreferences?.calendarViewMode || 'paginated';

        renderCalendar('calendarContainer', track.studySchedule, {
            calendarSystem: track.settings.calendarSystem,
            overrides: track.studyStatusOverrides,
            isMinimal: app.getStateRef().userPreferences?.minimalCalendar === true || app.getStateRef().userPreferences?.minimalCalendar === 'true',
            calendarViewMode: 'continuous',
            activeMonthIndex: 0
        });
    });

    window.addEventListener('afterprint', () => {
        app.handleScheduleGeneration();
    });
}

// Setup Firebase auth listener
function setupFirebaseAuth(app) {
    const { updateAuthUI } = setupCloudAuth({
        onRegister: async (email, password, nickname) => {
            await app.handleCloudRegister(email, password, nickname);
        },
        onLogin: async (email, password) => {
            await app.handleCloudLogin(email, password);
        },
        onLogout: () => {
            app.handleCloudLogout();
        },
        onFetchData: async () => {
            await app.handleCloudFetchData();
        }
    });

    initAuthListener((userEmail) => {
        updateAuthUI(userEmail);
    });
}

// Initiate service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then((registration) => {
                console.log('ServiceWorker registered successfully.');
            })
            .catch((error) => {
                console.error('ServiceWorker registration failed: ', error);
            });
    });
}