/**
 * Reset Actions — reset buttons wired in the planner page (settings card).
 * These were moved from the settings drawer to the planner page
 * since they are track-specific operations.
 */
export function setupResetActions({ onResetSettings, onResetStudyStatusOverrides }) {
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');
    const resetStudyStatusOverridesBtn = document.getElementById('resetStudyStatusOverridesBtn');

    resetSettingsBtn?.addEventListener('click', onResetSettings);
    resetStudyStatusOverridesBtn?.addEventListener('click', onResetStudyStatusOverrides);
}