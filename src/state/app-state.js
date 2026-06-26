import { DEFAULT_TRACK_SETTINGS, createNewTrack, getActiveTrack } from '../core/track.js';
import { talmud_bavli_masechtot } from '../core/data.js';
import { addToSequence } from '../core/book-sequence.js';
import { generateStudyCalendar, cycleStudyStatusOverride, computeDaySlots } from '../core/scheduler.js';
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
                return;
            }

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

                renderCalendar('calendarContainer', activeTrack.studySchedule, {
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

                document.getElementById('action-dock')?.classList.remove('hidden');

            } catch (error) {
                alert(error.message);
            }
        },

        refreshTrackConfigPanel: async function () {
            hydrateHtmlFromAppState(state, tracks);
            renderTrackSwitcher(tracks, state.activeTrackId);
            renderDateLabels(activeTrack.settings.startDate, activeTrack.settings.targetDate);
            updateBookSequenceUI(activeTrack.bookSequence);
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
                title: 'ניקוי רשימת המסכתות במסלול',
                message: 'האם אתה בטוח שברצונך לנקות את רשימת המסכתות במסלול?',
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
                message: 'פעולה זו תסמן את כל ימי הלימוד שעברו (עד היום) בכל המסכתות כנלמדו. להמשיך?',
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

        handleSaveBookConfig: function ({ index, calcMethod, paceValue, targetDate, startDate, reviewDays, amudStates, startAmudIdx, endAmudIdx }) {
            let book = activeTrack.bookSequence[index];
            if (typeof book === 'string') {
                book = { name: book };
            }

            book.calcMethod = calcMethod;
            book.paceValue = paceValue;
            book.targetDate = targetDate;
            book.reviewDays = reviewDays;
            book.amudStates = amudStates || [];
            book.startAmudIdx = startAmudIdx;
            book.endAmudIdx = endAmudIdx;

            if (startDate) {
                book.startDate = startDate;
            } else {
                delete book.startDate;
            }

            activeTrack.bookSequence[index] = book;

            // Run schedule generation FIRST so cascading items write back down into bookSequence
            this.handleScheduleGeneration();
            
            // Now persist the modified bookSequence containing clean rippled dates
            saveState();
            updateBookSequenceUI(activeTrack.bookSequence);
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
        }
    };
}