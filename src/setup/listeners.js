import { talmud_bavli_masechtot } from "../core/data.js";

// --- Track Selector Component ---
export function setupTrackSelector({ onAddNewTrack, onSwitchTrack, onDeleteTrack }) {
    const newTrackBtn = document.getElementById('addNewTrackBtn');
    const trackDropdown = document.getElementById('trackSelectDropdown');
    const deleteTrackBtn = document.getElementById('deleteTrackBtn');

    newTrackBtn?.addEventListener('click', async () => {
        const inputInput = document.getElementById('newTrackNameInput');
        const name = inputInput?.value;
        await onAddNewTrack(name);
        if (inputInput) inputInput.value = ""; 
    });
    
    trackDropdown?.addEventListener('change', async (e) => {
        const selectedTrackId = e.target.value;
        await onSwitchTrack(selectedTrackId);
    });

    deleteTrackBtn?.addEventListener('click', async () => {
        const selectedTrackId = trackDropdown?.value;
        if (selectedTrackId && onDeleteTrack) {
            await onDeleteTrack(selectedTrackId);
        }
    });
}

// --- Book Sequence Component ---
export function setupBookSequence({ onAddToSequence, onClearSequence }) {
    const select = document.getElementById('bookSelect');
    const addToSequenceBtn = document.getElementById('addToSequenceBtn');
    const clearSequenceBtn = document.getElementById('clearSequenceBtn');

    // Populate dropdown with Talmud Bavli volumes
    if (select && typeof talmud_bavli_masechtot !== 'undefined') {
        talmud_bavli_masechtot.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name;
            opt.innerText = m.name;
            select.appendChild(opt);
        });
    }

    addToSequenceBtn?.addEventListener('click', () => {
        onAddToSequence();
    });

    clearSequenceBtn?.addEventListener('click', () => {
        onClearSequence();
    });
}

// --- Action Dock Component ---
export function setupActionDock({ onGenerate, onExportExcel, onExportICal }) {
    const generateBtn = document.getElementById('generateBtn');
    const icalBtn = document.getElementById('exportToICalBtn');
    const exportBtn = document.getElementById('exportToExcelBtn');
    const printBtn = document.getElementById('printBtn');
    
    generateBtn?.addEventListener('click', async () => {
        await onGenerate();
        const listContainer = document.getElementById('bookSequenceList');
        if (listContainer && listContainer.children.length > 0) {
            document.getElementById('calendarContainer')?.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
    });

    icalBtn?.addEventListener('click', () => { onExportICal(); });
    exportBtn?.addEventListener('click', () => { onExportExcel(); });
    printBtn?.addEventListener('click', () => window.print());
}

// --- Backup Management ---
export function setupBackupManagement({onExport, onImport, onResetSettings, onResetStudyStatusOverrides}) {
    const backupExportBtn = document.getElementById('backupExportBtn');
    const backupImportBtn = document.getElementById('backupImportBtn');
    const backupFileInput = document.getElementById('backupFileInput');
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');
    const resetStudyStatusOverridesBtn = document.getElementById('resetStudyStatusOverridesBtn');

    backupExportBtn?.addEventListener('click', onExport);
    backupImportBtn?.addEventListener('click', () => backupFileInput.click());
    backupFileInput?.addEventListener('change', onImport);
    resetSettingsBtn?.addEventListener('click', onResetSettings);
    resetStudyStatusOverridesBtn?.addEventListener('click', onResetStudyStatusOverrides);
}

// --- Calendar View Mode Toggle ---
export function setupViewModeToggle({ onGenerate, onUpdateUserPreference, onUpdateViewToggle, getCalendarViewMode }) {
    const toggleBtn = document.getElementById('toggleCalendarViewModeBtn');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        const currentMode = getCalendarViewMode() || 'paginated';
        const nextMode = currentMode === 'paginated' ? 'continuous' : 'paginated';
        onUpdateUserPreference('calendarViewMode', nextMode);
        onUpdateViewToggle(nextMode);
        onGenerate();
    });
}