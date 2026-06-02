import { fetchCalendarEvents } from './api.js';
import { talmud_bavli_masechtot } from './data.js';

// utils
import { hebrewToNumber } from './utils/gematria.js';
import { indexToDaf, getTotalAmudim } from './utils/talmud.js';
import { formatDateToIL } from './utils/dates.js';

/* 
    Core generation functions 
*/

// Main function to generate the full schedule based on user settings, book sequence, manual overrides, and calendar data. It orchestrates the entire process from building the master amud pool to mapping content onto the timeline and adding necessary padding for calendar grid display.
export async function generateSchedule({ bookSequence, userSettings, manualOverrides, calendarData }) {
    if (!bookSequence || bookSequence.length === 0) return [];

    const { startDate, startDaf, startAmud, calendarType } = userSettings;
    if (!startDate) throw new Error("נא לבחור תאריך התחלה");

    const startInputDate = new Date(startDate);
    startInputDate.setHours(0, 0, 0, 0);

    // Step 1: Flatten All Amudim Into a Single Master Pool
    const masterAmudPool = buildMasterAmudPool(bookSequence, startDaf, startAmud);

    // Step 2: Fetch Calendar Events dynamically based on pacing math
    await ensureCalendarData(startInputDate, userSettings, bookSequence, masterAmudPool, calendarData);

    // Step 3: Build the Strict Timeline Map (Target Date vs. Pace)
    const timelineDays = generateTimelineDays(startInputDate, userSettings, bookSequence, masterAmudPool, manualOverrides, calendarData);

    // Step 4: Map Text Progression Content onto Timeline Slots
    const outputSchedule = [];
    let amudPointer = 0;
    let currentActiveBook = "-";

    timelineDays.forEach(day => {
        const isShabbat = day.date.getDay() === 6;
        const traits = calendarData[day.dateString]?.traits || {};

        let dayData = {
            date: day.date,
            dateString: day.dateString,
            book: "-",
            isShabbat: isShabbat || traits.isParasha,
            isHoliday: !!calendarData[day.dateString]?.displayText,
            holidayTitle: calendarData[day.dateString]?.displayText || "",
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
            dayData.book = day.reviewBook || currentActiveBook;
            dayData.content = "חזרה";
        } else if (day.isStudyDay || day.amudimToCount > 0) {
            let count = day.amudimToCount;
            if (count > 0 && amudPointer < masterAmudPool.length) {
                let startAmud = masterAmudPool[amudPointer];
                let lastAvailableIdx = Math.min(amudPointer + count - 1, masterAmudPool.length - 1);
                let endAmud = masterAmudPool[lastAvailableIdx];

                dayData.book = startAmud.book;
                currentActiveBook = startAmud.book;

                dayData.content = (startAmud.amudIdx === endAmud.amudIdx && startAmud.bookIdx === endAmud.bookIdx)
                    ? indexToDaf(startAmud.amudIdx)
                    : `${indexToDaf(startAmud.amudIdx)} - ${indexToDaf(endAmud.amudIdx)}`;

                dayData.pages = count / 2;

                const totalAmudimForThisTrack = getTotalAmudim(startAmud.book);
                if (endAmud.amudIdx === totalAmudimForThisTrack - 1) {
                    dayData.isSiyum = true;
                }

                amudPointer += count;
            } else {
                dayData.book = currentActiveBook;
                dayData.content = "חזרה";
            }
        }
        outputSchedule.push(dayData);
    });

    // Step 5: Inject Grid UI Padding (Front & Back padding)
    addCalendarGridPadding(outputSchedule, timelineDays, startInputDate, calendarType, calendarData);

    return outputSchedule;
}

// --- Strategy A: Target Date ---
function generateTargetDateTimeline(startInputDate, userSettings, bookSequence, masterAmudPool, manualOverrides, calendarData) {
    const { targetDate, studyDays, includeHolidays } = userSettings;
    const endDate = new Date(targetDate);
    endDate.setHours(0, 0, 0, 0);

    if (endDate < startInputDate) throw new Error("תאריך היעד חייב להיות אחרי תאריך ההתחלה");

    let timelineDays = [];
    let currentDate = new Date(startInputDate);
    const totalReviewDays = bookSequence.reduce((sum, entry) => sum + ((typeof entry === 'object' ? entry.reviewDays : 0) || 0), 0);

    while (currentDate <= endDate) {
        const dateString = formatDateToIL(currentDate);
        const overrideState = manualOverrides[dateString] || 0;
        let isRestDay = (overrideState === 1) || (overrideState !== 2 && shouldDayBeRest(currentDate, studyDays, includeHolidays, calendarData));

        timelineDays.push({
            date: new Date(currentDate),
            dateString: dateString,
            isRestDay: isRestDay,
            isStudyDay: !isRestDay,
            isReviewDay: false,
            overrideState: overrideState,
            amudimToCount: 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }

    let activeStudyDays = timelineDays.filter(d => d.isStudyDay);
    if (activeStudyDays.length <= totalReviewDays) {
        throw new Error("אין מספיק ימי לימוד בטווח התאריכים המבוקש כדי להכיל את ימי החזרה.");
    }

    const netStudyDaysCount = activeStudyDays.length - totalReviewDays;
    const totalAmudim = masterAmudPool.length;

    const bookProfiles = bookSequence.map((entry, idx) => {
        const bookName = typeof entry === 'string' ? entry : entry.name;
        const rDays = (typeof entry === 'object' && entry?.reviewDays) ? parseInt(entry.reviewDays, 10) || 0 : 0;
        const count = masterAmudPool.filter(a => a.bookIdx === idx).length;
        return { name: bookName, bookIdx: idx, count: count, reviewDays: rDays, allocatedDays: 0 };
    }).filter(m => m.count > 0);

    let totalAllocatedDays = 0;
    bookProfiles.forEach(m => {
        const exactDays = netStudyDaysCount * (m.count / totalAmudim);
        m.allocatedDays = Math.max(1, Math.floor(exactDays));
        totalAllocatedDays += m.allocatedDays;
    });

    let daysToDistribute = netStudyDaysCount - totalAllocatedDays;
    if (daysToDistribute > 0) {
        for (let i = 0; i < daysToDistribute; i++) {
            bookProfiles[i % bookProfiles.length].allocatedDays++;
        }
    } else if (daysToDistribute < 0) {
        for (let i = 0; i < Math.abs(daysToDistribute); i++) {
            bookProfiles.sort((a, b) => b.allocatedDays - a.allocatedDays);
            if (bookProfiles[0].allocatedDays > 1) bookProfiles[0].allocatedDays--;
        }
    }

    let sequentialPlan = [];
    bookProfiles.forEach((m) => {
        const baseAmudim = Math.floor(m.count / m.allocatedDays);
        const remainder = m.count % m.allocatedDays;

        for (let i = 0; i < m.allocatedDays; i++) {
            const extra = (i >= m.allocatedDays - remainder) ? 1 : 0;
            sequentialPlan.push({ type: 'study', count: baseAmudim + extra, book: m.name });
        }

        for (let r = 0; r < m.reviewDays; r++) {
            sequentialPlan.push({ type: 'review', count: 0, book: m.name });
        }
    });

    let planPointer = 0;
    timelineDays.forEach(day => {
        if (day.isStudyDay) {
            if (planPointer < sequentialPlan.length) {
                const currentPlan = sequentialPlan[planPointer];
                if (currentPlan.type === 'review') {
                    day.isStudyDay = false;
                    day.isReviewDay = true;
                    day.reviewBook = currentPlan.book;
                } else {
                    day.amudimToCount = currentPlan.count;
                }
                planPointer++;
            } else {
                day.isStudyDay = false;
                day.isReviewDay = true;
            }
        }
    });

    return timelineDays;
}

// --- Strategy B: Daily Pace ---
function generatePaceTimeline(startInputDate, userSettings, bookSequence, masterAmudPool, manualOverrides, calendarData) {
    const { pace, studyDays, includeHolidays } = userSettings;
    let amudPoolCopy = [...masterAmudPool];
    let currentDate = new Date(startInputDate);
    let timelineDays = [];

    const parsedPace = parseFloat(pace);
    const enforcedPace = parsedPace < 0.5 ? 0.5 : parsedPace;
    const dailyAmudimPace = Math.max(1, Math.ceil(enforcedPace * 2));

    let safetyLoopCount = 0;
    const maxSafetyIterations = masterAmudPool.length * 10 + 5000;

    while (amudPoolCopy.length > 0 && safetyLoopCount < maxSafetyIterations) {
        safetyLoopCount++;

        const dateString = formatDateToIL(currentDate);
        const overrideState = manualOverrides[dateString] || 0;
        let isRestDay = (overrideState === 1) || (overrideState !== 2 && shouldDayBeRest(currentDate, studyDays, includeHolidays, calendarData));

        let amudimToCountForDay = 0;
        let triggerReviewPhase = false;
        let currentBookIdx = amudPoolCopy[0].bookIdx;

        if (!isRestDay) {
            let limit = 0;
            while (limit < dailyAmudimPace && limit < amudPoolCopy.length && amudPoolCopy[limit].bookIdx === currentBookIdx) {
                limit++;
            }

            let drained = amudPoolCopy.splice(0, limit);
            amudimToCountForDay = drained.length;

            if (amudPoolCopy.length === 0 || amudPoolCopy[0].bookIdx !== currentBookIdx) {
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
            amudimToCount: amudimToCountForDay
        });

        if (triggerReviewPhase) {
            const finishedEntry = bookSequence[currentBookIdx];
            const reviewDaysCount = (typeof finishedEntry === 'object' && finishedEntry?.reviewDays) ? parseInt(finishedEntry.reviewDays, 10) || 0 : 0;

            let r = 0;
            while (r < reviewDaysCount) {
                currentDate.setDate(currentDate.getDate() + 1);
                const rStr = formatDateToIL(currentDate);
                const rOverride = manualOverrides[rStr] || 0;
                let rIsRest = (rOverride === 1) || (rOverride !== 2 && shouldDayBeRest(currentDate, studyDays, includeHolidays, calendarData));

                if (rIsRest) {
                    timelineDays.push({
                        date: new Date(currentDate), dateString: rStr,
                        isRestDay: true, isStudyDay: false, isReviewDay: false, overrideState: rOverride, amudimToCount: 0
                    });
                } else {
                    timelineDays.push({
                        date: new Date(currentDate), dateString: rStr,
                        isRestDay: false, isStudyDay: false, isReviewDay: true, overrideState: rOverride, amudimToCount: 0,
                        reviewBook: typeof finishedEntry === 'string' ? finishedEntry : finishedEntry.name
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


// Main dispatcher to select the appropriate timeline generation strategy based on user settings
function generateTimelineDays(startInputDate, userSettings, bookSequence, masterAmudPool, manualOverrides, calendarData) {
    if (userSettings.method === 'targetDate') {
        return generateTargetDateTimeline(startInputDate, userSettings, bookSequence, masterAmudPool, manualOverrides, calendarData);
    } else {
        return generatePaceTimeline(startInputDate, userSettings, bookSequence, masterAmudPool, manualOverrides, calendarData);
    }
}

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

// Pre-fetches calendar events for all years that fall within the schedule's potential range based on user settings and strategy.
async function ensureCalendarData(startInputDate, userSettings, bookSequence, masterAmudPool, calendarData) {
    const { method, targetDate, pace } = userSettings;
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
        await fetchCalendarEvents(y, calendarData);
    }
}

// Adds empty padding days to the start and end of the schedule to ensure full monthly calendar grid rows, based on the calendar type and the actual scheduled timeline.
function addCalendarGridPadding(outputSchedule, timelineDays, startInputDate, calendarType, calendarData) {
    // Front Padding
    let tempDate = new Date(startInputDate);
    if (calendarType === 'hebrew') {
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
            isShabbat: tempDate.getDay() === 6, isHoliday: !!calendarData[dStr]?.displayText,
            holidayTitle: calendarData[dStr]?.displayText, isEmpty: true, content: "", pages: 0
        });
        tempDate.setDate(tempDate.getDate() + 1);
    }
    outputSchedule.unshift(...frontPadding);

    // Back Padding
    const isEndOfMonth = (d) => {
        const nextDay = new Date(d);
        nextDay.setDate(nextDay.getDate() + 1);
        if (calendarType === 'hebrew') {
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
                isShabbat: runnerDate.getDay() === 6, isHoliday: !!calendarData[ds]?.displayText,
                holidayTitle: calendarData[ds]?.displayText, isEmpty: true, content: "", pages: 0
            });
        }
    }
}

// Determines whether a given date should be treated as a rest day based on the user's selected study days, holiday inclusion preference, and the calendar traits of that specific day.
function shouldDayBeRest(dateObj, studyDays, includeHolidays, calendarData) {
    const dateString = formatDateToIL(dateObj);
    const day = calendarData[dateString];
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

// Handles cycling through manual override states for a given date string, returning a new overrides object with the updated state. The cycle goes: 0 (no override) → 1 (force rest) → 2 (force study) → back to 0.
export function cycleDateOverride(currentOverrides, dateString) {
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