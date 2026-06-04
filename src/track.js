export const DEFAULT_TRACK_SETTINGS = {
    method: 'pace',
    pace: 1,
    startDate: new Date().toISOString().split('T')[0],
    targetDate: '',
    startDaf: 'ב',
    startAmud: 'א',
    studyDays: [0, 1, 2, 3, 4, 5], // Default: Sun-Fri (0-5), Shabbat (6) excluded
    includeHolidays: false,
    calendarSystem: 'hebrew',
}

export function createNewTrack(name) {
    const id = `track-${Date.now()}`;
    return {
        id: id,
        name: name,
        createdAt: new Date().toISOString(),
        settings: { ...DEFAULT_TRACK_SETTINGS },
        studySchedule: {}, // dateStr -> { events, traits, displayText }
        bookSequence: [], // Array of { bookName, reviewDays, amudStates }
        studyStatusOverrides: {}, // dateStr -> { status: 0 = default | 1 = force skip | 2 = force study }
        calendarEvents: {}
    };
}

export function getActiveTrack(state, tracks) {
    if (!tracks || !state?.activeTrackId) return null;
    return tracks.find(track => track.id === state.activeTrackId) || null;
}