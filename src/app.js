import { createAppState } from './state/app-state.js';
import { initPrintLayoutHandler } from './ui/components/calendar.js';
import { initAuthListener } from './services/auth.js';

import { setupBookSequence, setupActionDock, setupBackupManagement, setupViewModeToggle } from './setup/listeners.js';
import { setupTrackSettings } from './setup/track-settings.js';
import { setupSettingsDrawer } from './setup/settings-drawer.js';
import { setupBookSequenceDragAndDrop } from './setup/drag-and-drop.js';
import { setupBookConfigModal } from './setup/book-config-modal.js';
import { setupCloudAuth } from './setup/cloud-auth.js';
import { setupCalendarContextMenus } from './setup/calendar-context.js';

import { registerPage, navigateTo, setContainerId } from './services/router.js';
import { renderNavBar, updateActiveNavLink } from './ui/components/nav-bar.js';
import { renderDashboardPage } from './pages/dashboard-page.js';
import { renderPlannerPage } from './pages/planner-page.js';
import { renderProgressPage } from './pages/progress-page.js';
import { renderStatsPage } from './pages/stats-page.js';

// Executes main initiation function upon page load
document.addEventListener('DOMContentLoaded', init);

let _app = null; // Store app reference for nav bar

// Main page initiation function
async function init() {
    console.log("HTML page initialized successfully");

    // 1. Create central app state controller
    const app = createAppState();
    _app = app;

    // 2. Initialize state (loads from persistence, creates default track if needed)
    await app.init();

    // 3. Setup router and register pages
    setupRouter(app);

    // 4. Render the nav bar
    const navContainer = document.getElementById('nav-container');
    if (navContainer) {
        renderNavBar(navContainer, app, (page) => handlePageNavigation(page, app));
    }

    // 5. Setup all DOM listeners (wired on initial page render)
    setupMainPage(app);

    // 6. Navigate to initial page (dashboard)
    await handlePageNavigation('dashboard', app);

    // Wire up Firebase auth listener (already handles its own DOM)
    setupFirebaseAuth(app);
}

/**
 * Register all application pages with the router.
 */
function setupRouter(app) {
    setContainerId('page-container');

    registerPage('dashboard', {
        render: (container) => renderDashboardPage(container, app, (page) => handlePageNavigation(page, app, true)),
        destroy: () => {
            // Cleanup dashboard if needed
        }
    });

    registerPage('planner', {
        render: (container) => renderPlannerPage(container, app),
        destroy: () => {
            // Cleanup planner-specific listeners if needed
        }
    });

    registerPage('progress', {
        render: (container) => renderProgressPage(container, app),
        destroy: () => {
            // Cleanup progress page if needed
        }
    });

    registerPage('stats', {
        render: (container) => renderStatsPage(container, app),
        destroy: () => {
            // Cleanup stats page if needed
        }
    });
}

/**
 * Handle page navigation — updates state, navigates, and refreshes UI.
 */
async function handlePageNavigation(page, app, force = false) {
    // Update state
    const state = app.getStateRef();
    state.currentPage = page;

    // Navigate via router
    await navigateTo(page, app, force);

    // Update nav highlight
    updateActiveNavLink(page);

    // Re-setup page-specific listeners when navigating to planner
    if (page === 'planner') {
        // Ensure activeTrack is synced after page re-render
        app.syncActiveTrack();
        setupPlannerPageListeners(app);
        await app.handleScheduleGeneration();
    }
    
    // Refresh track config when navigating to dashboard (tracks may have changed)
    if (page === 'dashboard') {
        app.syncActiveTrack();
    }
}

/**
 * Setup the listeners for the planner page.
 * These need to be re-wired after the planner page DOM is rendered,
 * because the DOM elements are destroyed and re-created on each navigation.
 */
function setupPlannerPageListeners(app) {
    setupBookSequence({
        onAddToSequence: (selectedName) => app.handleAddToSequence(selectedName),
        onClearSequence: () => app.handleClearSequence()
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

    setupActionDock({
        onGenerate: () => app.handleScheduleGeneration(),
        onExportExcel: () => app.handleExportExcel(),
        onExportICal: () => app.handleExportICal()
    });

    setupBookSequenceDragAndDrop({
        onRemove: (indexToRemove) => app.handleRemoveFromSequence(indexToRemove),
        onReorder: (newOrderOfIndices) => app.handleBookSequenceReorder(newOrderOfIndices)
    });

    setupViewModeToggle({
        onGenerate: () => app.handleScheduleGeneration(),
        onUpdateUserPreference: (key, value) => app.handleUpdateUserPreference(key, value),
        getCalendarViewMode: () => app.getStateRef().userPreferences.calendarViewMode
    });

    setupCalendarContextMenus({
        getActiveTrack: () => app.getActiveTrack(),
        onGenerate: () => app.handleScheduleGeneration()
    });

    // Calendar click for study status override (planner page)
    const calendarContainer = document.getElementById('calendarContainer');
    if (calendarContainer) {
        if (calendarContainer._plannerCalClick) {
            calendarContainer.removeEventListener('click', calendarContainer._plannerCalClick);
        }
        calendarContainer._plannerCalClick = (event) => {
            const calendarDay = event.target.closest('.calendar-day');
            if (calendarDay?.dataset.date) {
                app.handleStudyStatusOverride(calendarDay.dataset.date);
            }
        };
        calendarContainer.addEventListener('click', calendarContainer._plannerCalClick);
    }

    setupBookConfigModal({
        getBookSequence: () => app.getActiveTrack().bookSequence,
        getSchedule: () => app.getActiveTrack().studySchedule,
        getBookRangeLimits: (index) => app.getBookRangeLimitsForIndex(index),
        computeDaySlots: app.computeDaySlots,
        onSaveConfig: (config) => app.handleSaveBookConfig(config)
    });

    // Handle print: temporarily switch to continuous mode
    initPrintLayoutHandler({
        getActiveTrack: () => app.getActiveTrack(),
        getUserPreferences: () => app.getStateRef().userPreferences,
        onGenerate: () => app.handleScheduleGeneration()
    });

    // Refresh the active track UI
    app.refreshTrackConfigPanel();
}

// Executes setup helpers for persistent UI elements (modals, drawers, etc.)
// These elements exist in the HTML regardless of which page is shown.
function setupMainPage(app) {
    // Backup management (persistent in settings drawer, which is in HTML)
    setupBackupManagement({
        onExport: () => app.handleExportBackup(),
        onImport: (event) => app.handleImportBackup(event),
        onResetSettings: () => app.handleResetSettings(),
        onResetStudyStatusOverrides: () => app.handleResetStudyStatusOverrides()
    });
}

// Setup Firebase auth listener
function setupFirebaseAuth(app) {
    const { updateAuthUI } = setupCloudAuth({
        onRegister: (email, password, nickname) => app.handleCloudRegister(email, password, nickname),
        onLogin: (email, password) => app.handleCloudLogin(email, password),
        onLogout: () => app.handleCloudLogout(),
        onFetchData: () => app.handleCloudFetchData()
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