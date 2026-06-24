import { fetchCalendarEvents } from '../services/api.js';
import { talmud_bavli_masechtot } from './data.js';

// utils
import { hebrewToNumber } from '../utils/gematria.js';
import { indexToDaf, getTotalAmudim } from '../utils/talmud.js';
import { formatDateToIL, formatDateToISO, checkIsBeinHazmanim } from '../utils/dates.js';

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

// Generates a continuous, chronological timeline of study progress data.
export async function generateStudyTimeline({ trackSettings, bookSequence, studyStatusOverrides, calendarEvents }) {
    if (!bookSequence || bookSequence.length === 0) return [];

    const { startDate } = trackSettings;
    if (!startDate) throw new Error("נא לבחור תאריך התחלה");

    let currentTimelineStart = new Date(startDate);
    currentTimelineStart.setHours(0, 0, 0, 0);

    let comprehensiveTimeline = [];

    for (let i = 0; i < bookSequence.length; i++) {
        let entry = bookSequence[i];
        
        const bookObj = typeof entry === 'string' 
            ? { name: entry, calcMethod: 'pace', paceValue: 1, reviewDays: 0, startAmudIdx: 0, endAmudIdx: getTotalAmudim(entry) - 1 } 
            : { 
                ...entry, 
                startAmudIdx: entry.startAmudIdx !== undefined ? entry.startAmudIdx : 0, 
                endAmudIdx: entry.endAmudIdx !== undefined ? entry.endAmudIdx : (getTotalAmudim(entry.name) - 1) 
              };
        
        if (bookObj.startDate) {
            let overriddenStart = new Date(bookObj.startDate);
            overriddenStart.setHours(0, 0, 0, 0);

            // If the overridden start date is strictly after our current tracking pointer,
            // we must explicitly populate the "gap" days as rest/empty days in the timeline.
            while (currentTimelineStart < overriddenStart) {
                const dateString = formatDateToIL(currentTimelineStart);
                const overrideState = studyStatusOverrides[dateString] || 0;

                comprehensiveTimeline.push({
                    date: new Date(currentTimelineStart),
                    dateString: dateString,
                    isRestDay: true, // Force it to be an empty gap day
                    isStudyDay: false,
                    isReviewDay: false,
                    overrideState: overrideState,
                    amudimToCount: 0,
                    targetBook: "-", // No book assigned to this gap
                    bookIndex: i
                });

                currentTimelineStart.setDate(currentTimelineStart.getDate() + 1);
            }
            
            // Sync the tracking pointer precisely to the override date
            currentTimelineStart = overriddenStart;
        }

        const singleBookPool = buildMasterAmudPool([bookObj]); 
        await ensureCalendarEvents(currentTimelineStart, trackSettings, [bookObj], singleBookPool, calendarEvents);

        let bookTimeline = [];
        if (bookObj.calcMethod === 'targetDate') {
            bookTimeline = generateTargetDateTimeline(currentTimelineStart, bookObj, singleBookPool, studyStatusOverrides, calendarEvents, trackSettings, i);
        } else {
            bookTimeline = generatePaceTimeline(currentTimelineStart, bookObj, singleBookPool, studyStatusOverrides, calendarEvents, trackSettings, i);
        }

        if (bookTimeline.length > 0) {
            comprehensiveTimeline = comprehensiveTimeline.concat(bookTimeline);
            
            // Set the fallback start date of the next book to the day after the current book finishes
            let lastDayOfBook = bookTimeline[bookTimeline.length - 1].date;
            currentTimelineStart = new Date(lastDayOfBook);
            currentTimelineStart.setDate(currentTimelineStart.getDate() + 1);
        }
    }

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
            isEmpty: day.isRestDay || day.isReviewDay || day.targetBook === "-",
            override: day.overrideState,
            content: "",
            pages: 0,
            isReviewDay: day.isReviewDay,
            isSiyum: false
        };

        if (day.isRestDay) {
            if (day.overrideState === 1) dayData.content = "הפסקה";
            else if (checkIsBeinHazmanim(day.date)) dayData.content = "בין הזמנים";
            else dayData.content = ""; // Structural breaks will cleanly hit this empty state
        } else if (day.isReviewDay) {
            dayData.content = "חזרה";
        } else if (day.amudimToCount > 0 && day.targetBook !== "-") {
            const bKey = `${day.targetBook}_${day.bookIndex ?? 0}`;
            if (bookPointers[bKey] === undefined) bookPointers[bKey] = 0;

            const currentEntry = bookSequence[day.bookIndex];
            const startAmudIdx = (currentEntry && currentEntry.startAmudIdx !== undefined) ? currentEntry.startAmudIdx : 0;
            const endAmudIdx = (currentEntry && currentEntry.endAmudIdx !== undefined) ? currentEntry.endAmudIdx : (getTotalAmudim(day.targetBook) - 1);

            const targetPool = buildMasterAmudPool([{ name: day.targetBook, startAmudIdx, endAmudIdx }]); 
            let pointer = bookPointers[bKey];

            if (pointer < targetPool.length) {
                let startAmud = targetPool[pointer];
                let lastAvailableIdx = Math.min(pointer + day.amudimToCount - 1, targetPool.length - 1);
                let endAmud = targetPool[lastAvailableIdx];

                dayData.content = (startAmud.amudIdx === endAmud.amudIdx)
                    ? indexToDaf(startAmud.amudIdx)
                    : `${indexToDaf(startAmud.amudIdx)} - ${indexToDaf(endAmud.amudIdx)}`;

                dayData.pages = day.amudimToCount / 2;

                // Siyum occurs when reaching the defined end limit for this run
                if (endAmud.amudIdx === endAmudIdx) {
                    dayData.isSiyum = true;
                }

                bookPointers[bKey] += day.amudimToCount;
            } else {
                dayData.content = "חזרה";
            }
        }
        studyTimeline.push(dayData);
    });

    return { studyTimeline, comprehensiveTimeline };
}

// --- Strategy A: Target Date ---
function generateTargetDateTimeline(startDate, bookObj, singleBookPool, studyStatusOverrides, calendarEvents, trackSettings, bookIndex) {
    const { studyDays, includeHolidays, includeBeinHazmanim } = trackSettings;
    const targetDateVal = bookObj.targetDate || formatDateToISO(startDate);
    const endDate = new Date(targetDateVal);
    endDate.setHours(0, 0, 0, 0);

    if (endDate < startDate) {
        endDate.setTime(startDate.getTime() + (7 * 24 * 60 * 60 * 1000));
    }

    let timelineDays = [];
    let currentDate = new Date(startDate);
    const reviewDaysCount = parseInt(bookObj.reviewDays, 10) || 0;

    // 1. Gather all calendar days in the range
    while (currentDate <= endDate) {
        const dateString = formatDateToIL(currentDate);
        const overrideState = studyStatusOverrides[dateString] || 0;
        
        let isRestDay = (overrideState === 1) || (overrideState !== 2 && 
            shouldDayBeRest(currentDate, studyDays, includeHolidays, includeBeinHazmanim, calendarEvents)
        );

        timelineDays.push({
            date: new Date(currentDate),
            dateString: dateString,
            isRestDay: isRestDay,
            isStudyDay: !isRestDay,
            isReviewDay: false,
            overrideState: overrideState,
            amudimToCount: 0,
            targetBook: bookObj.name,
            bookIndex: bookIndex
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }

    let activeStudyDays = timelineDays.filter(d => d.isStudyDay);
    if (activeStudyDays.length <= reviewDaysCount) {
        return generatePaceTimeline(startDate, { ...bookObj, calcMethod: 'pace', paceValue: 1 }, singleBookPool, studyStatusOverrides, calendarEvents, trackSettings, bookIndex);
    }

    const netStudyDaysCount = activeStudyDays.length - reviewDaysCount;
    const totalAmudim = singleBookPool.length;

    const baseAmudim = Math.floor(totalAmudim / netStudyDaysCount);
    
    let planSlots = [];

    // 2. EDGE CASE: The target date is too far away (Pace drops below 1 Amud per day)
    if (baseAmudim < 1) {
        // We force a minimum pace of 1 amud per day
        const requiredStudyDays = totalAmudim; 
        
        // Push the study slots to the very beginning
        for (let i = 0; i < requiredStudyDays; i++) {
            planSlots.push({ type: 'study', count: 1 });
        }
        
        // Fill ALL remaining active days in the timeline with review days
        const totalRemainingActiveDays = activeStudyDays.length - requiredStudyDays;
        for (let r = 0; r < totalRemainingActiveDays; r++) {
            planSlots.push({ type: 'review', count: 0 });
        }
    } 
    // 3. NORMAL CASE: Distribute material evenly across the timeline
    else {
        const remainder = totalAmudim % netStudyDaysCount;

        for (let i = 0; i < netStudyDaysCount; i++) {
            let extra = (i >= netStudyDaysCount - remainder) ? 1 : 0;
            planSlots.push({ type: 'study', count: baseAmudim + extra });
        }
        
        // Append explicit user-requested review days at the end
        for (let r = 0; r < reviewDaysCount; r++) {
            planSlots.push({ type: 'review', count: 0 });
        }
    }

    // 4. Map the planned slots onto the actual timeline days
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
function generatePaceTimeline(startDate, bookObj, singleBookPool, studyStatusOverrides, calendarEvents, trackSettings, bookIndex) {
    const { studyDays, includeHolidays, includeBeinHazmanim } = trackSettings;
    let amudPoolCopy = [...singleBookPool];
    let currentDate = new Date(startDate);
    let timelineDays = [];

    const parsedPace = parseFloat(bookObj.paceValue) || 1;
    const dailyAmudimPace = Math.max(1, Math.ceil(parsedPace * 2));

    while (amudPoolCopy.length > 0) {
        const dateString = formatDateToIL(currentDate);
        const overrideState = studyStatusOverrides[dateString] || 0;
        
        let isRestDay = (overrideState === 1) || (overrideState !== 2 && 
            shouldDayBeRest(currentDate, studyDays, includeHolidays, includeBeinHazmanim, calendarEvents)
        );

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
            targetBook: bookObj.name,
            bookIndex: bookIndex
        });

        if (triggerReviewPhase) {
            const reviewDaysCount = parseInt(bookObj.reviewDays, 10) || 0;
            let r = 0;
            while (r < reviewDaysCount) {
                currentDate.setDate(currentDate.getDate() + 1);
                const rStr = formatDateToIL(currentDate);
                const rOverride = studyStatusOverrides[rStr] || 0;
                
                let rIsRest = (rOverride === 1) || (rOverride !== 2 && 
                    shouldDayBeRest(currentDate, studyDays, includeHolidays, includeBeinHazmanim, calendarEvents)
                );

                if (rIsRest) {
                    timelineDays.push({
                        date: new Date(currentDate), dateString: rStr,
                        isRestDay: true, isStudyDay: false, isReviewDay: false, overrideState: rOverride, amudimToCount: 0, targetBook: bookObj.name, bookIndex: bookIndex
                    });
                } else {
                    timelineDays.push({
                        date: new Date(currentDate), dateString: rStr,
                        isRestDay: false, isStudyDay: false, isReviewDay: true, overrideState: rOverride, amudimToCount: 0, targetBook: bookObj.name, bookIndex: bookIndex
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
function buildMasterAmudPool(bookSequence) {
    if (!bookSequence || bookSequence.length === 0) return [];
    
    let masterAmudPool = [];
    bookSequence.forEach((entry, idx) => {
        const name = typeof entry === 'string' ? entry : entry.name;
        
        // Extract boundaries if explicit object configs exist
        let startIdx = (entry && entry.startAmudIdx !== undefined) ? entry.startAmudIdx : 0;
        let endIdx = (entry && entry.endAmudIdx !== undefined) ? entry.endAmudIdx : (getTotalAmudim(name) - 1);

        for (let i = startIdx; i <= endIdx; i++) {
            masterAmudPool.push({ book: name, amudIdx: i, bookIdx: entry.bookIdx ?? idx });
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
function shouldDayBeRest(dateObj, studyDays, includeHolidays, includeBeinHazmanim, calendarEvents) {
    const dateString = formatDateToIL(dateObj);
    const day = calendarEvents[dateString];
    const traits = day?.traits || {};
    const dayOfWeek = dateObj.getDay(); 

    // 1. Force break on Standard Chagim if includeHolidays is false
    if (traits.isChag && !includeHolidays) return true;

    // 2. Force break on Bein Hazmanim if includeBeinHazmanim is false
    if (!includeBeinHazmanim) {
        const isBeinHazmanimDay = checkIsBeinHazmanim(dateObj);
        if (isBeinHazmanimDay) return true;
    }
    
    // 3. Check if this weekday is NOT in the user's selected study days array
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