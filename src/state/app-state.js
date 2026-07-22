import { DEFAULT_TRACK_SETTINGS, createNewTrack, getActiveTrack } from '../core/track.js';
import { talmud_bavli_masechtot } from '../core/data.js';
import { addToSequence } from '../core/book-sequence.js';
import { generateStudyCalendar, cycleStudyStatusOverride, computeDaySlots } from '../core/scheduler.js';
import { computeProgressDeficit, generateAdjustedSchedule } from '../core/catchup-plan.js';
import { initPersistence, saveState, loadFromLocalStorage, exportStateBackup, importStateBackup, loadFromFirebase } from '../services/persistence.js';
import { exportScheduleToExcel, exportScheduleToICal } from '../services/exports.js';
import { registerUser, loginUser, logoutUser } from '../services/auth.js';
import { getFriendlyFirebaseErrorMessage } from '../utils/errors.js';
import { showDialog } from '../ui/components/dialog.js';

import { hydrateHtmlFromAppState, renderDateLabels, renderTrackSwitcher } from '../ui/components/track-settings-panel.js';
import { updateBookSequenceUI } from '../ui/components/book-sequence-list.js';
import { renderCalendar } from '../ui/components/calendar.js';

const DEFAULT_USER_PREFERENCES = {
    minimalCalendar: false,
    calendarViewMode: 'paginated',
    syncUserPreferences: true
}

/**
 * Central application state container.
 * Manages tracks, active track, user preferences, and all orchestration handlers.
 */
export function createAppState() {
    const state = {
        userPreferences: { ...DEFAULT_USER_PREFERENCES },
        activeTrackId: null,
        activeMonthIndex: 0
    };

    let activeTrack = null;
    let tracks = [];

    /* ---- Track Hydrator (for persistence) ---- */

    async function trackHydratorRule(leanTrack) {
        const trackCalendarEvents = {};
        const calculatedSchedule = await generateStudyCalendar({
            trackSettings: leanTrack.trackSettings || leanTrack.settings,
            bookSequence: leanTrack.bookSequence,
            studyStatusOverrides: leanTrack.studyStatusOverrides,
            calendarEvents: trackCalendarEvents
        });
        return {
            ...leanTrack,
            calendarEvents: trackCalendarEvents,
            studySchedule: calculatedSchedule
        };
    }

    /* ---- Internal helpers ---- */

    function resolveActiveTrack() {
        return getActiveTrack(state, tracks);
    }

    /* ---- Public API ---- */

    return {
        // State references (for persistence to bind to)
        getStateRef: () => state,
        getTracksRef: () => tracks,
        getActiveTrack: () => activeTrack,
        getTrackHydrator: () => trackHydratorRule,

        getBookRangeLimitsForIndex: function (index) {
            if (!activeTrack) return { minDate: '' };

            // 1. If it's the first book, the limit is simply the track's start date
            if (index === 0) {
                return { minDate: activeTrack.settings.startDate };
            }

            // 2. Safely grab the previous book entry
            const previousBook = activeTrack.bookSequence[index - 1];
            if (!previousBook) {
                return { minDate: activeTrack.settings.startDate };
            }

            const previousBookName = typeof previousBook === 'string' ? previousBook : previousBook.name;
            
            // 3. Find the final day allocated to that previous book
            const previousBookDays = activeTrack.studySchedule.filter(day => day.book === previousBookName);
            
            if (previousBookDays.length > 0) {
                const lastDay = previousBookDays[previousBookDays.length - 1].dateString;
                
                // Calculate next available calendar day safely
                const nextAvailableDate = new Date(lastDay);
                nextAvailableDate.setDate(nextAvailableDate.getDate() + 1);
                
                return { minDate: nextAvailableDate.toISOString().split('T')[0] };
            }

            // Fallback default
            return { minDate: activeTrack.settings.startDate };
        },

        /** Full initialization — call once on DOMContentLoaded */
        init: async function () {
            console.log("App state initializing...");

            initPersistence(state, tracks, trackHydratorRule);
            await loadFromLocalStorage();

            if (tracks.length === 0) {
                console.log("No tracks found in storage. Creating default track.");
                const defaultTrack = createNewTrack("מסלול לימוד ראשי");
                tracks.push(defaultTrack);
                state.activeTrackId = defaultTrack.id;
            }

            activeTrack = resolveActiveTrack();
        },

        /** Refresh the active track pointer after mutations */
        syncActiveTrack: function () {
            activeTrack = resolveActiveTrack();
        },

        /** Ensure activeTrack is populated — call after persistence load */
        ensureActiveTrack: function () {
            if (!activeTrack) {
                activeTrack = resolveActiveTrack();
            }
            return activeTrack;
        },

        /* ---- Handlers ---- */

        /** Compute a lightweight summary of the current schedule for the live summary bar */
        computeScheduleSummary: function () {
            if (!activeTrack || !activeTrack.studySchedule || activeTrack.studySchedule.length === 0) {
                return { endDate: null, totalDays: 0, avgPagesPerDay: 0 };
            }

            const schedule = activeTrack.studySchedule;
            const studyDays = schedule.filter(d => !d.isEmpty && !d.isShabbat && !d.isHoliday);
            const totalDays = studyDays.length;
            
            // Find last non-empty day
            let lastStudyDay = null;
            for (let i = schedule.length - 1; i >= 0; i--) {
                if (!schedule[i].isEmpty) {
                    lastStudyDay = schedule[i];
                    break;
                }
            }

            const endDate = lastStudyDay ? lastStudyDay.dateString : null;

            // Calculate average pages per study day
            const totalPages = studyDays.reduce((sum, d) => sum + (d.pages || 0), 0);
            const avgPagesPerDay = totalDays > 0 ? Math.round((totalPages / totalDays) * 10) / 10 : 0;

            return { endDate, totalDays, avgPagesPerDay };
        },

        /** Update the live summary bar in the planner page */
        updateScheduleSummaryBar: function () {
            const summaryBar = document.getElementById('scheduleSummaryBar');
            const endDateEl = document.getElementById('summaryEndDate');
            const avgPagesEl = document.getElementById('summaryAvgPages');
            const totalDaysEl = document.getElementById('summaryTotalDays');
            const lastGeneratedHint = document.getElementById('lastGeneratedHint');
            const lastGeneratedTime = document.getElementById('lastGeneratedTime');
            const generateBtnText = document.getElementById('generateBtnText');
            const generateIcon = document.getElementById('generateIcon');

            if (!summaryBar) return;

            const summary = this.computeScheduleSummary();

            if (summary.endDate && summary.totalDays > 0) {
                // Format end date nicely
                const endDateObj = new Date(summary.endDate);
                const formattedDate = endDateObj.toLocaleDateString('he-IL', { 
                    year: 'numeric', month: 'long', day: 'numeric' 
                });
                if (endDateEl) endDateEl.textContent = formattedDate;
                if (avgPagesEl) avgPagesEl.textContent = `~${summary.avgPagesPerDay} דפים`;
                if (totalDaysEl) totalDaysEl.textContent = `${summary.totalDays} ימים`;
                summaryBar.classList.remove('hidden');

                // Update last generated hint
                if (lastGeneratedHint) {
                    lastGeneratedHint.classList.remove('hidden');
                    if (lastGeneratedTime) {
                        const now = new Date();
                        lastGeneratedTime.textContent = now.toLocaleTimeString('he-IL', { 
                            hour: '2-digit', minute: '2-digit' 
                        });
                    }
                }

                // Update generate button text
                if (generateBtnText) generateBtnText.textContent = 'רענן לוח לימוד';
                if (generateIcon) {
                    generateIcon.innerHTML = `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    `;
                }
            } else {
                summaryBar.classList.add('hidden');
                if (lastGeneratedHint) lastGeneratedHint.classList.add('hidden');
                if (generateBtnText) generateBtnText.textContent = 'צור לוח לימוד מותאם אישית';
                if (generateIcon) {
                    generateIcon.innerHTML = `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    `;
                }
            }
        },

        /** Show generation progress animation */
        showGenerationProgress: function () {
            const progressContainer = document.getElementById('generationProgress');
            const progressBar = document.getElementById('generationProgressBar');
            const progressText = document.getElementById('generationProgressText');
            if (!progressContainer || !progressBar) return;

            progressContainer.classList.remove('invisible');
            progressContainer.classList.add('visible', 'active');

            // Animate from 0 to 90% (last 10% jumps to 100 on completion)
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 15 + 5;
                if (progress >= 90) {
                    progress = 90;
                    clearInterval(interval);
                }
                progressBar.style.width = `${Math.min(progress, 90)}%`;
                if (progressText) progressText.textContent = `${Math.round(Math.min(progress, 90))}%`;
            }, 200);
            
            return interval; // Return interval so caller can clear it
        },

        /** Complete generation progress (jump to 100% and hide) */
        completeGenerationProgress: function (interval) {
            const progressContainer = document.getElementById('generationProgress');
            const progressBar = document.getElementById('generationProgressBar');
            const progressText = document.getElementById('generationProgressText');
            
            if (interval) clearInterval(interval);
            
            if (progressBar) progressBar.style.width = '100%';
            if (progressText) progressText.textContent = '100%';
            
            // Hide after a brief delay
            setTimeout(() => {
                if (progressContainer) {
                    progressContainer.classList.add('invisible');
                    progressContainer.classList.remove('visible', 'active');
                }
                if (progressBar) progressBar.style.width = '0%';
                if (progressText) progressText.textContent = '0%';
            }, 600);
        },

        handleScheduleGeneration: async function () {
            if (!activeTrack.bookSequence || activeTrack.bookSequence.length === 0) {
                activeTrack.studySchedule = [];
                const container = document.getElementById('calendarContainer');
                if (container) {
                    container.innerHTML = `
                        <div class="text-center p-8 text-slate-400 italic">
                            טרם נבחר חומר לימוד. נא לבחור לפחות מסכת אחת כדי להציג לוח לימוד.
                        </div>
                    `;
                }
                document.getElementById('action-dock')?.classList.add('hidden');
                this.updateScheduleSummaryBar();
                return;
            }

            // Show progress animation
            const progressInterval = this.showGenerationProgress();

            try {
                const updatedSchedule = await generateStudyCalendar({
                    trackSettings: activeTrack.settings,
                    bookSequence: activeTrack.bookSequence,
                    studyStatusOverrides: activeTrack.studyStatusOverrides,
                    calendarEvents: activeTrack.calendarEvents
                });

                activeTrack.studySchedule = updatedSchedule;

                activeTrack.siyumEvents = updatedSchedule
                    .filter(day => day.isSiyum)
                    .map(day => ({
                        dateString: day.dateString,
                        date: day.date,
                        book: day.book,
                        title: `סיום מסכת ${day.book}`
                    }));

                const isMinimal = state.userPreferences?.minimalCalendar === true ||
                    state.userPreferences?.minimalCalendar === 'true';

                const currentCalendarViewMode = state.userPreferences?.calendarViewMode || 'paginated';

                // Determine which calendar container to render to based on current page
                const calendarContainerId = state.currentPage === 'progress' ? 'progressCalendarContainer' : 'calendarContainer';
                const calendarContainer = document.getElementById(calendarContainerId);
                
                if (calendarContainer) {
                    // On the progress page, always show the reality-adjusted schedule
                    // which accounts for actual amudStates (learned/skipped progress)
                    const scheduleToRender = (state.currentPage === 'progress')
                        ? this.getCatchUpSchedule()
                        : activeTrack.studySchedule;

                    renderCalendar(calendarContainerId, scheduleToRender, {
                        calendarSystem: activeTrack.settings.calendarSystem,
                        overrides: activeTrack.studyStatusOverrides,
                        isMinimal: isMinimal,
                        calendarViewMode: currentCalendarViewMode,
                        activeMonthIndex: state.activeMonthIndex,
                        onMonthChange: (direction) => {
                            state.activeMonthIndex = Math.max(0, (state.activeMonthIndex || 0) + direction);
                            this.handleScheduleGeneration();
                        }
                    });
                }

                if (state.currentPage !== 'progress') {
                    document.getElementById('action-dock')?.classList.remove('hidden');
                }

                // Update summary bar after generation
                this.updateScheduleSummaryBar();

            } catch (error) {
                alert(error.message);
            } finally {
                this.completeGenerationProgress(progressInterval);
            }
        },

        refreshTrackConfigPanel: async function () {
            // Only hydrate planner DOM if the elements exist (we're on planner page)
            if (document.getElementById('calendarSystem')) {
                hydrateHtmlFromAppState(state, tracks);
            }
            // Only render track switcher if dropdown exists
            if (document.getElementById('trackSelectDropdown')) {
                renderTrackSwitcher(tracks, state.activeTrackId);
            }
            renderDateLabels(activeTrack.settings.startDate, activeTrack.settings.targetDate);
            // Only update book sequence list if the element exists
            if (document.getElementById('bookSequenceList')) {
                updateBookSequenceUI(activeTrack.bookSequence);
            }
            await this.handleScheduleGeneration();
        },

        handleAddNewTrack: async function (trackName) {
            if (!trackName || trackName.trim() === "") {
                trackName = `מסלול חדש #${tracks.length + 1}`;
            }
            const newTrack = createNewTrack(trackName);
            tracks.push(newTrack);
            state.activeTrackId = newTrack.id;
            activeTrack = newTrack;
            await saveState();
            await this.refreshTrackConfigPanel();
            renderTrackSwitcher(tracks, state.activeTrackId);
        },

        handleDeleteTrack: async function (trackId) {
            const trackToDelete = tracks.find(t => t.id === trackId);
            if (!trackToDelete) return;

            // Prevent deleting the last track
            if (tracks.length <= 1) {
                await showDialog({
                    title: 'לא ניתן למחוק',
                    message: 'חייב להישאר לפחות מסלול לימוד אחד פעיל.',
                    icon: '⚠️',
                    confirmText: 'הבנתי'
                });
                return;
            }

            const confirmed = await showDialog({
                title: 'מחיקת מסלול לימוד',
                message: `האם אתה בטוח שברצונך למחוק את המסלול "${trackToDelete.name}" לצמיתות?`,
                icon: '🗑️',
                showCancel: true,
                confirmText: 'כן, מחק מסלול',
                cancelText: 'ביטול'
            });
            if (!confirmed) return;

            const wasActive = trackToDelete.id === state.activeTrackId;

            // Remove the track from the array
            const index = tracks.findIndex(t => t.id === trackId);
            if (index !== -1) tracks.splice(index, 1);

            // If the deleted track was active, switch to another track
            if (wasActive) {
                const nextTrack = tracks[Math.min(index, tracks.length - 1)] || tracks[0];
                state.activeTrackId = nextTrack.id;
                state.activeMonthIndex = 0;
                activeTrack = nextTrack;
            }

            await saveState();
            await this.refreshTrackConfigPanel();
            renderTrackSwitcher(tracks, state.activeTrackId);
        },

        handleSwitchTrack: async function (trackId) {
            const selectedTrack = tracks.find(t => t.id === trackId);
            if (!selectedTrack) {
                alert("המסלול שנבחר לא נמצא.");
                return;
            }

            state.activeTrackId = trackId;
            state.activeMonthIndex = 0;
            activeTrack = selectedTrack;
            await saveState();
            await this.refreshTrackConfigPanel();
            renderTrackSwitcher(tracks, state.activeTrackId);
        },

        handleUpdateUserPreference: function (key, value) {
            state.userPreferences[key] = value;
            saveState();
        },

        handleUpdateTrackSetting: function (key, value) {
            activeTrack.settings[key] = value;
            saveState();
        },

        handleStudyStatusOverride: function (dateString) {
            activeTrack.studyStatusOverrides = cycleStudyStatusOverride(activeTrack.studyStatusOverrides, dateString);
            saveState();
            this.handleScheduleGeneration();
        },

        handleResetSettings: async function () {
            const confirmed = await showDialog({
                title: 'איפוס הגדרות לברירת מחדל',
                message: 'האם אתה בטוח שברצונך לאפס את כל ההגדרות והקצב לברירת המחדל?',
                icon: '🗑️',
                showCancel: true,
                confirmText: 'כן, אפס הכל',
                cancelText: 'לא, התחרטתי'
            });
            if (!confirmed) return;

            activeTrack.settings = { ...DEFAULT_TRACK_SETTINGS };
            activeTrack.bookSequence = [];
            saveState();
            await this.refreshTrackConfigPanel();
            updateBookSequenceUI(activeTrack.bookSequence);
            this.handleScheduleGeneration();
        },

        handleResetStudyStatusOverrides: async function () {
            if (Object.keys(activeTrack.studyStatusOverrides).length === 0) {
                await showDialog({
                    title: 'פעולה התבטלה',
                    message: 'לא נמצאו שינויים ידניים בלוח הקיים.',
                    icon: '🔄',
                    confirmText: 'המשך'
                });
                return;
            }
            const confirmed = await showDialog({
                title: 'איפוס שינויים ידניים',
                message: 'האם אתה בטוח שברצונך לאפס את כל השינויים הידניים שעשית ללוח הזמנים?',
                icon: '🗑️',
                showCancel: true,
                confirmText: 'כן, אפס הכל',
                cancelText: 'לא, התחרטתי'
            });
            if (!confirmed) return;

            activeTrack.studyStatusOverrides = {};
            saveState();
            this.handleScheduleGeneration();
        },

        handleAddToSequence: function(selectedName) {
            if (!selectedName) return;
            activeTrack.bookSequence = addToSequence(activeTrack.bookSequence, selectedName);
            saveState();
            updateBookSequenceUI(activeTrack.bookSequence);
            this.handleScheduleGeneration();
        },

        handleRemoveFromSequence: function (indexToRemove) {
            activeTrack.bookSequence.splice(indexToRemove, 1);
            saveState();
            updateBookSequenceUI(activeTrack.bookSequence);
            this.handleScheduleGeneration();
        },

        handleClearSequence: async function() {
            const confirmed = await showDialog({
                title: 'ניקוי רשימת הספרים במסלול',
                message: 'האם אתה בטוח שברצונך לנקות את רשימת הספרים במסלול?',
                icon: '🗑️',
                showCancel: true,
                confirmText: 'כן, נקה הכל',
                cancelText: 'לא, התחרטתי'
            });
            
            if (!confirmed) return; // Guard clause approach keeps code flatter

            const track = this.getActiveTrack();
            track.bookSequence = [];
            
            saveState();
            updateBookSequenceUI(track.bookSequence);
            this.handleScheduleGeneration();
        },

        handleBookSequenceReorder: function (newOrderOfIndices) {
            activeTrack.bookSequence = newOrderOfIndices.map(oldIndex => {
                const entry = activeTrack.bookSequence[oldIndex];
                return typeof entry === 'string'
                    ? { name: entry, reviewDays: 0, amudStates: [] }
                    : entry;
            });
            saveState();
            updateBookSequenceUI(activeTrack.bookSequence);
        },

        handleSyncToToday: async function () {
            if (!activeTrack.studySchedule || activeTrack.studySchedule.length === 0) {
                await showDialog({ title: 'אין נתונים', message: 'יש ליצור לוח לימוד קודם כדי לסנכרן.', icon: '📅', confirmText: 'הבנתי' });
                return;
            }

            const confirmed = await showDialog({
                title: 'סנכרן עד היום',
                message: 'פעולה זו תסמן את כל ימי הלימוד שעברו (עד היום) בכל הספרים כנלמדו. להמשיך?',
                icon: '🔄',
                showCancel: true,
                confirmText: 'כן, סנכרן',
                cancelText: 'ביטול'
            });
            if (!confirmed) return;

            const todayStr = new Date().toISOString().split('T')[0];
            let hasChanges = false;

            activeTrack.bookSequence.forEach((book, bookIdx) => {
                if (typeof book === 'string') {
                    book = { name: book, reviewDays: 0, amudStates: [] };
                    activeTrack.bookSequence[bookIdx] = book;
                }

                const bookName = book.name || "לא ידוע";
                const targetData = talmud_bavli_masechtot.find(m => m.name === bookName);
                const totalAmudim = targetData ? (targetData.amudCount || 120) : 120;

                if (!book.amudStates || book.amudStates.length === 0) {
                    book.amudStates = new Array(totalAmudim).fill(0);
                }

                const slots = computeDaySlots(activeTrack.studySchedule, bookName, bookIdx, activeTrack.bookSequence);

                slots.forEach(slot => {
                    if (slot.dateString <= todayStr) {
                        for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
                            if (i < book.amudStates.length && book.amudStates[i] !== 2) {
                                book.amudStates[i] = 1;
                                hasChanges = true;
                            }
                        }
                    }
                });
            });

            if (hasChanges) {
                saveState();
                updateBookSequenceUI(activeTrack.bookSequence);
                this.handleScheduleGeneration();
            }
        },

        /* ---- Book Config Modal ---- */
        computeDaySlots: computeDaySlots,

        handleSaveBookConfig: function ({ index, calcMethod, paceValue, targetDate, startDate, reviewDays, amudStates, startAmudIdx, endAmudIdx, periodicReview }) {
            let book = activeTrack.bookSequence[index];
            if (typeof book === 'string') {
                book = { name: book };
            }

            // Only update fields that are explicitly provided (not undefined)
            if (calcMethod !== undefined) book.calcMethod = calcMethod;
            if (paceValue !== undefined) book.paceValue = paceValue;
            if (targetDate !== undefined) book.targetDate = targetDate;
            if (reviewDays !== undefined) book.reviewDays = reviewDays;
            if (amudStates !== undefined) {
                book.amudStates = amudStates;
            } else if (!book.amudStates) {
                book.amudStates = [];
            }
            if (startAmudIdx !== undefined) book.startAmudIdx = startAmudIdx;
            if (endAmudIdx !== undefined) book.endAmudIdx = endAmudIdx;

            if (startDate !== undefined) {
                if (startDate) {
                    book.startDate = startDate;
                } else {
                    delete book.startDate;
                }
            }

            // Save periodic review config if provided
            if (periodicReview !== undefined) {
                if (periodicReview) {
                    book.periodicReview = periodicReview;
                } else {
                    delete book.periodicReview;
                }
            }

            activeTrack.bookSequence[index] = book;

            // Persist the modified bookSequence
            saveState();
            
            // Only schedule generate and update UI if we're on the planner page
            if (document.getElementById('bookSequenceList')) {
                this.handleScheduleGeneration();
                updateBookSequenceUI(activeTrack.bookSequence);
            }
        },

        /* ---- Cloud Auth Integration ---- */

        handleCloudRegister: async function (email, password, nickname) {
            try {
                await registerUser(email, password, nickname);
                alert("החשבון נוצר וחובר בהצלחה!");
            } catch (err) {
                console.error(err);
                const errorMsg = err.code ? getFriendlyFirebaseErrorMessage(err.code) : err.message;
                alert(`שגיאת רישום: ${errorMsg}`);
            }
        },

        handleCloudLogin: async function (email, password) {
            try {
                await loginUser(email, password);
            } catch (err) {
                alert(`שגיאת התחברות: ${getFriendlyFirebaseErrorMessage(err.code)}`);
            }
        },

        handleCloudLogout: function () {
            logoutUser();
        },

        handleCloudFetchData: async function () {
            if (await loadFromFirebase()) {
                alert("הנתונים נמשכו מהענן בהצלחה! העמוד יתעדכן.");
                activeTrack = resolveActiveTrack();
                await this.refreshTrackConfigPanel();
                await this.handleScheduleGeneration();
            } else {
                alert("לא נמצאו נתונים שמורים בענן עבור משתמש זה.");
            }
        },

        /* ---- Exports ---- */

        handleExportExcel: function () {
            exportScheduleToExcel(activeTrack.studySchedule);
        },

        handleExportICal: function () {
            exportScheduleToICal(activeTrack.studySchedule);
        },

        handleExportBackup: function () {
            exportStateBackup();
        },

        handleImportBackup: function (event) {
            importStateBackup(event);
        },

        /* ---- Catch-Up Plan ---- */

        /**
         * Calculate the deficit (amudim behind) for each book in the track.
         * Compares amudStates (actual learned) vs baseline schedule (expected learned up to today).
         * Uses the new catchup-plan module for robust computation.
         * @returns {Object} { books: { [bookIndex]: { bookName, totalAmudim, learned, expected, deficit, isBehind, calcMethod, ... } }, totalDeficit, isAnyBehind }
         */
        getCatchUpDeficit: function () {
            if (!activeTrack || !activeTrack.studySchedule || activeTrack.studySchedule.length === 0) {
                return { books: {}, totalDeficit: 0, isAnyBehind: false };
            }
            return computeProgressDeficit(activeTrack.bookSequence, activeTrack.studySchedule);
        },

        /**
         * Create or update a catch-up plan for the active track.
         * The catch-up plan is stored separately from the baseline schedule and never modifies it.
         * 
         * Supported strategies:
         *   - 'move-target': Set a new target date for a targetDate-mode book
         *   - 'squeeze': Redistribute remaining material evenly over remaining study days
         *   - 'sprint': Temporarily increase pace for N days, then resume normal pace
         *
         * @param {Object} planConfig - { books: { [bookIndex]: { strategy, ... } } }
         */
        handleCreateCatchUpPlan: async function (planConfig) {
            if (!activeTrack) return;

            const now = new Date().toISOString().split('T')[0];
            const plan = {
                isActive: true,
                startDate: now,
                createdAt: new Date().toISOString(),
                books: {}
            };

            for (const [bookIdx, config] of Object.entries(planConfig.books || {})) {
                const bookEntry = activeTrack.bookSequence[parseInt(bookIdx)];
                if (!bookEntry) continue;
                const bookName = typeof bookEntry === 'string' ? bookEntry : bookEntry.name;

                if (config.strategy === 'move-target') {
                    // Move target date: user sets a new target date
                    plan.books[bookIdx] = {
                        strategy: 'move-target',
                        newTargetDate: config.newTargetDate || null
                    };
                } else if (config.strategy === 'squeeze') {
                    // Squeeze: redistribute remaining material evenly over remaining study days
                    plan.books[bookIdx] = {
                        strategy: 'squeeze'
                    };
                } else if (config.strategy === 'sprint') {
                    // Sprint: temporarily increase pace for N days to close the deficit
                    const sprintDays = Math.max(1, parseInt(config.sprintDays) || 7);
                    plan.books[bookIdx] = {
                        strategy: 'sprint',
                        sprintDays: sprintDays,
                        deficitAmount: parseInt(config.deficitAmount) || 0
                    };
                } else if (config.strategy === 'increase-pace') {
                    // Increase pace: add X amudim per day until the deficit is closed
                    const addAmudimValue = parseFloat(config.addAmudimValue) || 1;
                    plan.books[bookIdx] = {
                        strategy: 'increase-pace',
                        addAmudimValue: addAmudimValue,
                        deficitAmount: parseInt(config.deficitAmount) || 0
                    };
                }
            }

            activeTrack.catchUpPlan = plan;
            saveState();
        },

        /**
         * Cancel and remove the active catch-up plan.
         * @param {boolean} skipConfirmation - If true, skip the confirmation dialog
         */
        handleCancelCatchUpPlan: async function (skipConfirmation) {
            if (!activeTrack) return;

            if (!skipConfirmation) {
                const confirmed = await showDialog({
                    title: 'ביטול תכנית השלמה',
                    message: 'האם אתה בטוח שברצונך לבטל את תכנית ההשלמה הנוכחית?',
                    icon: '🔄',
                    showCancel: true,
                    confirmText: 'כן, בטל תכנית',
                    cancelText: 'לא, השאר'
                });

                if (!confirmed) return;
            }

            activeTrack.catchUpPlan = null;
            saveState();
        },

        /**
         * Get the adjusted schedule for display on the progress page.
         * Uses the new catchup-plan module which properly accounts for:
         * - Actual amudStates (learned/skipped progress)
         * - Discontinuous study patterns
         * - Active catch-up strategies (move-target, squeeze, sprint)
         * 
         * The baseline schedule is NEVER modified.
         * 
         * @returns {Array} The adjusted schedule with catch-up overlays applied
         */
        getCatchUpSchedule: function () {
            if (!activeTrack) return [];
            return generateAdjustedSchedule(
                activeTrack.studySchedule,
                activeTrack.catchUpPlan,
                activeTrack.bookSequence,
                activeTrack.settings,
                activeTrack.studyStatusOverrides,
                activeTrack.calendarEvents
            );
        }
    };
}
