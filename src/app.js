import { createAppState } from './state/app-state.js';
import { updateCalendarViewToggle, initPrintLayoutHandler } from './ui/components/calendar.js';
import { initAuthListener } from './services/auth.js';

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
        onAddNewTrack: (name) => app.handleAddNewTrack(name),
        onSwitchTrack: (trackId) => app.handleSwitchTrack(trackId),
        onDeleteTrack: (trackId) => app.handleDeleteTrack(trackId)
    });

    setupBookSequence({
        onAddToSequence: (selectedName) => app.handleAddToSequence(selectedName),
        onClearSequence: () => app.handleClearSequence()
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
        getBookRangeLimits: (index) => app.getBookRangeLimitsForIndex(index),
        computeDaySlots: app.computeDaySlots,
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
        getCalendarViewMode: () => app.getStateRef().userPreferences.calendarViewMode
    });

    // Handle print: temporarily switch to continuous mode
    initPrintLayoutHandler({
        getActiveTrack: () => app.getActiveTrack(),
        getUserPreferences: () => app.getStateRef().userPreferences,
        onGenerate: () => app.handleScheduleGeneration()
    });
}

// Setup Firebase auth listener
function setupFirebaseAuth(app) {
    const { updateAuthUI } = setupCloudAuth({
        onRegister: (email, password, nickname) => app.handleCloudRegister(email, password, nickname), // ⚡ Cleaned
        onLogin: (email, password) => app.handleCloudLogin(email, password),                          // ⚡ Cleaned
        onLogout: () => app.handleCloudLogout(),
        onFetchData: () => app.handleCloudFetchData()                                                 // ⚡ Cleaned
    });

    initAuthListener((userEmail) => updateAuthUI(userEmail));
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