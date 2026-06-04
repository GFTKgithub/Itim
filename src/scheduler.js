import { fetchCalendarEvents } from './api.js';
import { talmud_bavli_masechtot } from './data.js';

// utils
import { hebrewToNumber } from './utils/gematria.js';
import { indexToDaf, getTotalAmudim } from './utils/talmud.js';
import { formatDateToIL, formatDateToISO } from './utils/dates.js';

/* 
    Core generation functions 
*/

// Orchestrates generating the timeline and formatting it into a padded grid array for calendar UI rendering.
export async function generateStudyCalendar({ trackSettings, bookSequence, studyStatusOverrides, calendarEvents }) {
    // 1. Calculate the core chronological study progression
    const { studyTimeline, comprehensiveTimeline } = await generateStudyTimeline({
        trackSettings,
        bookSequence,
        studyStatusOverrides,
        calendarEvents
    });

    if (studyTimeline.length === 0) return [];

    // 2. Clone the timeline to ensure we do not cause unsafe side-effects during mutation
    const monthlyCalendarGrid = [...studyTimeline];

    // 3. Inject structural padding grid spaces (Front & Back padding)
    addCalendarGridPadding(
        monthlyCalendarGrid, 
        comprehensiveTimeline, 
        new Date(trackSettings.startDate), 
        trackSettings.calendarSystem, 
        calendarEvents
    );

    return monthlyCalendarGrid;
}

// Generates a continuous, gap-free chronological timeline of study progress data.
export async function generateStudyTimeline({ trackSettings, bookSequence, studyStatusOverrides, calendarEvents }) {
    if (!bookSequence || bookSequence.length === 0) return [];

    const { startDate } = trackSettings;
    if (!startDate) throw new Error("נא לבחור תאריך התחלה");

    let currentTimelineStart = new Date(startDate);
    currentTimelineStart.setHours(0, 0, 0, 0);

    let comprehensiveTimeline = [];

    // Step 1 & 2: Process sequentially book-by-book
    for (let i = 0; i < bookSequence.length; i++) {
        let entry = bookSequence[i];
        
        // Normalize book to object wrapper structure
        const bookObj = typeof entry === 'string' ? { name: entry, calcMethod: 'pace', paceValue: 1, reviewDays: 0 } : entry;
        
        // Build isolated single-book amud pool sequence layout
        const singleBookPool = buildMasterAmudPool([bookObj]); 

        // Ensure localized cache frames for the current date boundaries are available 
        await ensureCalendarEvents(currentTimelineStart, trackSettings, [bookObj], singleBookPool, calendarEvents);

        // Calculate specific schedule step maps
        let bookTimeline = [];
        if (bookObj.calcMethod === 'targetDate') {
            bookTimeline = generateTargetDateTimeline(currentTimelineStart, bookObj, singleBookPool, studyStatusOverrides, calendarEvents, trackSettings);
        } else {
            bookTimeline = generatePaceTimeline(currentTimelineStart, bookObj, singleBookPool, studyStatusOverrides, calendarEvents, trackSettings);
        }

        if (bookTimeline.length > 0) {
            comprehensiveTimeline = comprehensiveTimeline.concat(bookTimeline);
            
            // Set the start date of the next book to the day after the current book finishes
            let lastDayOfBook = bookTimeline[bookTimeline.length - 1].date;
            currentTimelineStart = new Date(lastDayOfBook);
            currentTimelineStart.setDate(currentTimelineStart.getDate() + 1);
        }
    }

    // Step 3: Map textual progress onto active days
    const studyTimeline = [];
    let bookPointers = {}; 

    comprehensiveTimeline.forEach(day => {
        const isShabbat = day.date.getDay() === 6;
        const traits = calendarEvents[day.dateString]?.traits || {};

        let dayData = {
            date: day.date,
            dateString: day.dateString,
            book: day.targetBook || "-",
            isShabbat: isShabbat || traits.isParasha,
            isHoliday: !!calendarEvents[day.dateString]?.displayText,
            holidayTitle: calendarEvents[day.dateString]?.displayText || "",
            isEmpty: day.isRestDay || day.isReviewDay,
            override: day.overrideState,
            content: "",
            pages: 0,
            isReviewDay: day.isReviewDay,
            isSiyum: false
        };

        if (day.isRestDay) {
            dayData.content = (day.overrideState === 1) ? "הפסקה" : "";
        } else if (day.isReviewDay) {
            dayData.content = "חזרה";
        } else if (day.amudimToCount > 0) {
            const bKey = day.targetBook;
            if (bookPointers[bKey] === undefined) bookPointers[bKey] = 0;

            const targetPool = buildMasterAmudPool([{ name: bKey }]);
            let pointer = bookPointers[bKey];

            if (pointer < targetPool.length) {
                let startAmud = targetPool[pointer];
                let lastAvailableIdx = Math.min(pointer + day.amudimToCount - 1, targetPool.length - 1);
                let endAmud = targetPool[lastAvailableIdx];

                dayData.content = (startAmud.amudIdx === endAmud.amudIdx)
                    ? indexToDaf(startAmud.amudIdx)
                    : `${indexToDaf(startAmud.amudIdx)} - ${indexToDaf(endAmud.amudIdx)}`;

                dayData.pages = day.amudimToCount / 2;

                const totalAmudimForThisTrack = getTotalAmudim(bKey);
                if (endAmud.amudIdx === totalAmudimForThisTrack - 1) {
                    dayData.isSiyum = true;
                }

                bookPointers[bKey] += day.amudimToCount;
            } else {
                dayData.content = "חזרה";
            }
        }
        studyTimeline.push(dayData);
    });

    // Return both the mapped timeline AND the underlying timeline metadata needed by the padding utility
    return { studyTimeline, comprehensiveTimeline };
}

// --- Strategy A: Target Date ---
function generateTargetDateTimeline(startDate, bookObj, singleBookPool, studyStatusOverrides, calendarEvents, trackSettings) {
    const { studyDays, includeHolidays } = trackSettings;
    const targetDateVal = bookObj.targetDate || formatDateToISO(startDate);
    const endDate = new Date(targetDateVal);
    endDate.setHours(0, 0, 0, 0);

    if (endDate < startDate) {
        // Fallback constraint protection
        endDate.setTime(startDate.getTime() + (7 * 24 * 60 * 60 * 1000));
    }

    let timelineDays = [];
    let currentDate = new Date(startDate);
    const reviewDaysCount = parseInt(bookObj.reviewDays, 10) || 0;

    while (currentDate <= endDate) {
        const dateString = formatDateToIL(currentDate);
        const overrideState = studyStatusOverrides[dateString] || 0;
        let isRestDay = (overrideState === 1) || (overrideState !== 2 && shouldDayBeRest(currentDate, studyDays, includeHolidays, calendarEvents));

        timelineDays.push({
            date: new Date(currentDate),
            dateString: dateString,
            isRestDay: isRestDay,
            isStudyDay: !isRestDay,
            isReviewDay: false,
            overrideState: overrideState,
            amudimToCount: 0,
            targetBook: bookObj.name
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }

    let activeStudyDays = timelineDays.filter(d => d.isStudyDay);
    if (activeStudyDays.length <= reviewDaysCount) {
        return generatePaceTimeline(startDate, { ...bookObj, calcMethod: 'pace', paceValue: 1 }, singleBookPool, studyStatusOverrides, calendarEvents, trackSettings);
    }

    const netStudyDaysCount = activeStudyDays.length - reviewDaysCount;
    const totalAmudim = singleBookPool.length;

    const baseAmudim = Math.floor(totalAmudim / netStudyDaysCount);
    const remainder = totalAmudim % netStudyDaysCount;

    let planSlots = [];
    for (let i = 0; i < netStudyDaysCount; i++) {
        // FIXED: The extra remaining amudim are now added to the final days of the track 
        // instead of the initial ones, matching your original progression logic.
        let extra = (i >= netStudyDaysCount - remainder) ? 1 : 0;
        planSlots.push({ type: 'study', count: baseAmudim + extra });
    }
    
    // Review days appended immediately after structural study slots
    for (let r = 0; r < reviewDaysCount; r++) {
        planSlots.push({ type: 'review', count: 0 });
    }

    let planPointer = 0;
    timelineDays.forEach(day => {
        if (day.isStudyDay) {
            if (planPointer < planSlots.length) {
                const currentSlot = planSlots[planPointer];
                if (currentSlot.type === 'review') {
                    day.isStudyDay = false;
                    day.isReviewDay = true;
                } else {
                    day.amudimToCount = currentSlot.count;
                }
                planPointer++;
            }
        }
    });

    return timelineDays;
}

// --- Strategy B: Daily Pace ---
function generatePaceTimeline(startDate, bookObj, singleBookPool, studyStatusOverrides, calendarEvents, trackSettings) {
    const { studyDays, includeHolidays } = trackSettings;
    let amudPoolCopy = [...singleBookPool];
    let currentDate = new Date(startDate);
    let timelineDays = [];

    const parsedPace = parseFloat(bookObj.paceValue) || 1;
    const dailyAmudimPace = Math.max(1, Math.ceil(parsedPace * 2));

    while (amudPoolCopy.length > 0) {
        const dateString = formatDateToIL(currentDate);
        const overrideState = studyStatusOverrides[dateString] || 0;
        let isRestDay = (overrideState === 1) || (overrideState !== 2 && shouldDayBeRest(currentDate, studyDays, includeHolidays, calendarEvents));

        let amudimToCountForDay = 0;
        let triggerReviewPhase = false;

        if (!isRestDay) {
            let limit = Math.min(dailyAmudimPace, amudPoolCopy.length);
            let drained = amudPoolCopy.splice(0, limit);
            amudimToCountForDay = drained.length;

            if (amudPoolCopy.length === 0) {
                triggerReviewPhase = true;
            }
        }

        timelineDays.push({
            date: new Date(currentDate),
            dateString: dateString,
            isRestDay: isRestDay,
            isStudyDay: !isRestDay,
            isReviewDay: false,
            overrideState: overrideState,
            amudimToCount: amudimToCountForDay,
            targetBook: bookObj.name
        });

        if (triggerReviewPhase) {
            const reviewDaysCount = parseInt(bookObj.reviewDays, 10) || 0;
            let r = 0;
            while (r < reviewDaysCount) {
                currentDate.setDate(currentDate.getDate() + 1);
                const rStr = formatDateToIL(currentDate);
                const rOverride = studyStatusOverrides[rStr] || 0;
                let rIsRest = (rOverride === 1) || (rOverride !== 2 && shouldDayBeRest(currentDate, studyDays, includeHolidays, calendarEvents));

                if (rIsRest) {
                    timelineDays.push({
                        date: new Date(currentDate), dateString: rStr,
                        isRestDay: true, isStudyDay: false, isReviewDay: false, overrideState: rOverride, amudimToCount: 0, targetBook: bookObj.name
                    });
                } else {
                    timelineDays.push({
                        date: new Date(currentDate), dateString: rStr,
                        isRestDay: false, isStudyDay: false, isReviewDay: true, overrideState: rOverride, amudimToCount: 0, targetBook: bookObj.name
                    });
                    r++;
                }
            }
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return timelineDays;
}

/* 
    Helper functions for schedule generation and mapping
*/

// Builds a flat master pool of all amudim across the selected books, starting from the specified daf/amud if given.
function buildMasterAmudPool(bookSequence, startDaf, startAmud) {
    if (!bookSequence || bookSequence.length === 0) return [];
    
    let masterAmudPool = [];
    bookSequence.forEach((entry, idx) => {
        const name = typeof entry === 'string' ? entry : entry.name;

        let startIdx = 0;
        if (idx === 0 && startDaf) {
            const startDafHeb = startDaf.trim();
            if (startDafHeb) {
                startIdx = Math.max(0, (hebrewToNumber(startDafHeb) * 2) - 4);
                if (startAmud === "ב") startIdx += 1;
            }
        }

        const totalAmudim = getTotalAmudim(name);
        for (let i = startIdx; i < totalAmudim; i++) {
            masterAmudPool.push({ book: name, amudIdx: i, bookIdx: idx });
        }
    });
    return masterAmudPool;
}

// Pre-fetches calendar events for all years that fall within the schedule's potential range based on track settings and strategy.
async function ensureCalendarEvents(startInputDate, trackSettings, bookSequence, masterAmudPool, calendarEvents) {
    const { method, targetDate, pace } = trackSettings;
    const startYear = startInputDate.getFullYear();
    let endYear = startYear;

    if (method === 'targetDate') {
        if (!targetDate) throw new Error("נא לבחור תאריך יעד");
        endYear = new Date(targetDate).getFullYear();
    } else {
        const dailyAmudimPace = Math.max(1, Math.ceil(parseFloat(pace) * 2));
        if (dailyAmudimPace > 0) {
            const totalReviewDays = bookSequence.reduce((sum, entry) => sum + ((typeof entry === 'object' ? entry.reviewDays : 0) || 0), 0);
            const estimatedStudyDays = Math.ceil(masterAmudPool.length / dailyAmudimPace);
            const totalProjectedDays = (estimatedStudyDays + totalReviewDays) * 1.4;

            const projectedEndDate = new Date(startInputDate);
            projectedEndDate.setDate(projectedEndDate.getDate() + Math.ceil(totalProjectedDays));
            endYear = projectedEndDate.getFullYear();
        } else {
            endYear = startYear + 1;
        }
    }

    for (let y = startYear - 1; y <= endYear + 1; y++) {
        await fetchCalendarEvents(y, calendarEvents);
    }
}

// Adds empty padding days to the start and end of a study schedule to ensure full monthly calendar grid rows, based on the calendar system and the actual scheduled timeline.
function addCalendarGridPadding(outputSchedule, timelineDays, startInputDate, calendarSystem, calendarEvents) {
    // Front Padding
    let tempDate = new Date(startInputDate);
    if (calendarSystem === 'hebrew') {
        while (parseInt(new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' }).format(tempDate)) > 1) {
            tempDate.setDate(tempDate.getDate() - 1);
        }
    } else {
        tempDate.setDate(1);
    }

    const frontPadding = [];
    while (tempDate < startInputDate) {
        const dStr = formatDateToIL(tempDate);
        frontPadding.push({
            date: new Date(tempDate), dateString: dStr, book: "-",
            isShabbat: tempDate.getDay() === 6, isHoliday: !!calendarEvents[dStr]?.displayText,
            holidayTitle: calendarEvents[dStr]?.displayText, isEmpty: true, content: "", pages: 0
        });
        tempDate.setDate(tempDate.getDate() + 1);
    }
    outputSchedule.unshift(...frontPadding);

    // Back Padding
    const isEndOfMonth = (d) => {
        const nextDay = new Date(d);
        nextDay.setDate(nextDay.getDate() + 1);
        if (calendarSystem === 'hebrew') {
            const m1 = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'numeric' }).format(d);
            const m2 = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'numeric' }).format(nextDay);
            return m1 !== m2;
        }
        return nextDay.getDate() === 1;
    };

    let lastScheduledDay = timelineDays[timelineDays.length - 1];
    if (lastScheduledDay) {
        let runnerDate = new Date(lastScheduledDay.date);
        while (!isEndOfMonth(runnerDate)) {
            runnerDate.setDate(runnerDate.getDate() + 1);
            const ds = formatDateToIL(runnerDate);
            outputSchedule.push({
                date: new Date(runnerDate), dateString: ds, book: "-",
                isShabbat: runnerDate.getDay() === 6, isHoliday: !!calendarEvents[ds]?.displayText,
                holidayTitle: calendarEvents[ds]?.displayText, isEmpty: true, content: "", pages: 0
            });
        }
    }
}

// Determines whether a given date should be treated as a rest day based on the user's selected study days, holiday inclusion preference, and the calendar traits of that specific day.
function shouldDayBeRest(dateObj, studyDays, includeHolidays, calendarEvents) {
    const dateString = formatDateToIL(dateObj);
    const day = calendarEvents[dateString];
    const traits = day?.traits || {};
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Shabbat

    // 1. Force break on Standard Chagim if includeHolidays is false
    if (traits.isChag && !includeHolidays) return true;

    // 2. Check if this weekday is NOT in the user's selected study days array
    // (Also treats calendar-marked Parasha days as Shabbat if Saturday is unchecked)
    const isScheduledStudyDay = studyDays.includes(dayOfWeek);
    if (!isScheduledStudyDay) return true;

    if (traits.isRoshChodesh) return false;     // Study by default on Rosh Chodesh
    if (traits.isModernException) return false;     // Study by default on Modern Exceptions

    return false;   // Not rest day by default
}

// Handles cycling through study status override states for a given date string, returning a new overrides object with the updated state. The cycle goes: 0 (no override) → 1 (force rest) → 2 (force study) → back to 0.
export function cycleStudyStatusOverride(currentOverrides, dateString) {
    // 1. Shallow copy the overrides to prevent direct state mutation bugs
    const updatedOverrides = { ...currentOverrides };

    const current = updatedOverrides[dateString] || 0;
    const next = (current + 1) % 3;

    if (next === 0) {
        delete updatedOverrides[dateString];
    } else {
        updatedOverrides[dateString] = next;
    }

    // 2. Return the new calculated data state
    return updatedOverrides;
}

// Builds a flat list of { dateString, label, amudStart, amudCount } for each study day
// belonging to a specific book entry (identified by its index in bookSequence).
// Works by replaying the amud pointer across the schedule in order.
export function computeDaySlots(schedule, bookName, bookIdx, bookSequence) {
    if (!schedule || schedule.length === 0) return [];

    // Compute the global amud offset where this book's block starts.
    // Each book before it in the sequence consumes amudCount amudim.
    let blockStart = 0;
    for (let i = 0; i < bookIdx; i++) {
        const entry = bookSequence[i];
        const name = typeof entry === 'string' ? entry : entry.name;
        const data = talmud_bavli_masechtot.find(m => m.name === name);
        if (data) blockStart += (data.amudCount || 0);
    }

    const targetEntry = bookSequence[bookIdx];
    const targetName  = typeof targetEntry === 'string' ? targetEntry : targetEntry?.name;
    const targetData  = talmud_bavli_masechtot.find(m => m.name === targetName);
    const blockEnd    = blockStart + (targetData?.amudCount || 0);

    const slots = [];
    let globalPointer = 0; // Tracks position in the full masterAmudPool across the schedule

    for (const day of schedule) {
        if (day.isEmpty || day.isReviewDay || !day.pages || day.pages <= 0) continue;

        const amudCount = Math.round(day.pages * 2);

        // Check whether this day's amud range overlaps our target block
        if (day.book === bookName && globalPointer >= blockStart && globalPointer < blockEnd) {
            const localStart = globalPointer - blockStart;
            slots.push({
                dateString: day.dateString,
                label: `${day.dateString} — ${day.content}`,
                amudStart: localStart,
                amudCount: Math.min(amudCount, blockEnd - globalPointer)
            });
        }

        globalPointer += amudCount;
    }

    return slots;
}