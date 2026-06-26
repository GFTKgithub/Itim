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
        
        // Timezone-safe local YYYY-MM-DD date formatter
        const getLocalDateString = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        if (bookObj.startDate) {
            let overriddenStart = new Date(bookObj.startDate);
            overriddenStart.setHours(0, 0, 0, 0);

            // If the user's set date falls before the previous book ended, it's an invasion.
            if (overriddenStart < currentTimelineStart) {
                const correctedDateStr = getLocalDateString(currentTimelineStart);
                
                // If it's a string, upgrade it to an object so the property sticks
                if (typeof bookSequence[i] === 'string') {
                    bookSequence[i] = { name: bookSequence[i] };
                }
                bookSequence[i].startDate = correctedDateStr;
                bookObj.startDate = correctedDateStr;
            } 
            // If it's strictly in the future, fill the empty gap days up to it.
            else if (overriddenStart > currentTimelineStart) {
                while (currentTimelineStart < overriddenStart) {
                    const dateString = formatDateToIL(currentTimelineStart);
                    const overrideState = studyStatusOverrides[dateString] || 0;

                    comprehensiveTimeline.push({
                        date: new Date(currentTimelineStart),
                        dateString: dateString,
                        isRestDay: true,
                        isStudyDay: false,
                        isReviewDay: false,
                        overrideState: overrideState,
                        amudimToCount: 0,
                        targetBook: "-",
                        bookIndex: i
                    });

                    currentTimelineStart.setDate(currentTimelineStart.getDate() + 1);
                }
            }
        } else if (i > 0) {
            // If a book has no explicit start date, calculate it and assign it back safely
            const correctedDateStr = getLocalDateString(currentTimelineStart);
            if (typeof bookSequence[i] === 'string') {
                bookSequence[i] = { name: bookSequence[i] };
            }
            bookSequence[i].startDate = correctedDateStr;
            bookObj.startDate = correctedDateStr;
        }

        // Always ensure our local tracking pointer is synchronized with the finalized bookObj state
        if (bookObj.startDate) {
            currentTimelineStart = new Date(bookObj.startDate);
            currentTimelineStart.setHours(0, 0, 0, 0);
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

/*
 * Periodic Review — Anchor-Based Helpers
 *
 * "calendar" mode: every N calendar days from the anchor date, the day is a review day.
 * "weekdays"  mode: every occurrence of the specified weekdays (0=Sun … 6=Sat) from the anchor.
 * Both are fixed to the calendar: manual overrides and config changes do NOT shift them.
 * The only way to suppress a review is overrideState === 1 (force rest).
 */

/** Resolve the effective anchor date for periodic review */
function resolvePeriodicAnchor(bookObj, trackStartDate) {
    return bookObj.startDate || trackStartDate;
}

/** Pre-compute a Set of dateStrings that are anchored review days for a range [rangeStart, rangeEnd] */
function computeAnchoredReviewDays(periodic, anchorDateStr, rangeStart, rangeEnd) {
    const anchored = new Set();
    if (!periodic || !periodic.enabled) return anchored;

    const anchor = new Date(anchorDateStr);
    anchor.setHours(0, 0, 0, 0);

    const start = new Date(rangeStart);
    start.setHours(0, 0, 0, 0);
    // For weekdays mode, start from max(anchor, rangeStart)
    const effectiveStart = new Date(Math.max(start.getTime(), anchor.getTime()));

    const end = new Date(rangeEnd);
    end.setHours(0, 0, 0, 0);

    if (effectiveStart > end) return anchored;

    const mode = periodic.mode;

    if (mode === 'calendar') {
        const freq = periodic.frequency || 7;
        const amount = periodic.amount || 1;

        let cursor = new Date(effectiveStart);
        while (cursor <= end) {
            const daysSinceAnchor = Math.floor((cursor - anchor) / (24 * 60 * 60 * 1000));
            if (daysSinceAnchor > 0 && daysSinceAnchor % freq === 0) {
                for (let a = 0; a < amount; a++) {
                    const rd = new Date(cursor);
                    rd.setDate(rd.getDate() + a);
                    if (rd <= end) {
                        anchored.add(formatDateToIL(rd));
                    }
                }
            }
            cursor.setDate(cursor.getDate() + 1);
        }
    } else if (mode === 'weekdays') {
        const weekdays = periodic.weekdays || [];

        // If no weekdays selected, treat all days as potential review days (defensive)
        const targetDays = weekdays.length > 0 ? weekdays : [];

        let cursor = new Date(effectiveStart);
        while (cursor <= end) {
            if (targetDays.length === 0 || targetDays.includes(cursor.getDay())) {
                anchored.add(formatDateToIL(cursor));
            }
            cursor.setDate(cursor.getDate() + 1);
        }
    }

    return anchored;
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

    // Periodic review config
    const periodic = bookObj.periodicReview;
    const hasPeriodicReviews = periodic && periodic.enabled && (
        (periodic.mode === 'weekdays' && periodic.weekdays && periodic.weekdays.length > 0) ||
        (periodic.mode !== 'weekdays' && periodic.frequency > 0)
    );
    const isTimeBased = periodic && periodic.enabled && (periodic.mode === 'calendar' || periodic.mode === 'weekdays');

    // Precompute anchored review days for time-based periodic modes
    let anchoredReviewDays = new Set();
    if (hasPeriodicReviews && isTimeBased) {
        const anchorStr = resolvePeriodicAnchor(bookObj, formatDateToISO(startDate));
        anchoredReviewDays = computeAnchoredReviewDays(periodic, anchorStr, startDate, endDate);
    }

    // 1. Gather all calendar days in the range
    while (currentDate <= endDate) {
        const dateString = formatDateToIL(currentDate);
        const overrideState = studyStatusOverrides[dateString] || 0;

        let isRestDay;
        let isAnchoredReview = false;

        // Time-anchored periodic reviews override rest day checks (unless force-rest)
        if (anchoredReviewDays.has(dateString) && overrideState !== 1) {
            isAnchoredReview = true;
            isRestDay = false;
        } else if (anchoredReviewDays.has(dateString) && overrideState === 1) {
            // Force rest overrides anchored review
            isRestDay = true;
        } else {
            isRestDay = (overrideState === 1) || (overrideState !== 2 && 
                shouldDayBeRest(currentDate, studyDays, includeHolidays, includeBeinHazmanim, calendarEvents)
            );
        }

        timelineDays.push({
            date: new Date(currentDate),
            dateString: dateString,
            isRestDay: isRestDay,
            isStudyDay: !isRestDay && !isAnchoredReview,
            isReviewDay: isAnchoredReview,
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

    // 2. Count periodic review days and adjust net study day count
    let periodicReviewCount = 0;
    if (hasPeriodicReviews && !isTimeBased) {
        // Only count non-time-based periodic reviews for study day adjustment
        let studyCounter = 0;
        let pendingReview = 0;
        let cumAmudim = 0;
        const totalDays = activeStudyDays.length;

        if (periodic.mode === 'days') {
            for (let d = 1; d <= totalDays; d++) {
                if (pendingReview > 0) {
                    periodicReviewCount++;
                    pendingReview--;
                } else {
                    // Check if this upcoming slot should be a review day instead of a study day
                    if (studyCounter > 0 && (studyCounter + 1) % periodic.frequency === 0) {
                        periodicReviewCount++;
                        pendingReview += (periodic.amount || 1) - 1;
                        studyCounter = 0; // Reset
                    } else {
                        studyCounter++;
                    }
                }
            }
        } else if (periodic.mode === 'dafs') {
            const totalAmudim = singleBookPool.length;
            const perDay = Math.floor(totalAmudim / totalDays);
            const remainder = totalAmudim % totalDays;
            for (let d = 0; d < totalDays; d++) {
                if (pendingReview > 0) {
                    periodicReviewCount++;
                    pendingReview--;
                } else {
                    cumAmudim += perDay + (d >= totalDays - remainder ? 1 : 0);
                    if (cumAmudim / 2 >= periodic.frequency) {
                        pendingReview += (periodic.amount || 1);
                        cumAmudim = 0;
                    }
                }
            }
        }
    } else if (isTimeBased) {
        // For time-based, count the anchored review days that fall within our timeline
        periodicReviewCount = timelineDays.filter(d => d.isReviewDay).length;
    }

    const totalAmudim = singleBookPool.length;
    // Net study days available for new material = total study days - trailing review days - periodic review days
    const netStudyDaysCount = Math.max(1, activeStudyDays.length - reviewDaysCount - periodicReviewCount);

    const baseAmudim = Math.floor(totalAmudim / netStudyDaysCount);
    
    let planSlots = [];

    // 3. EDGE CASE: The target date is too far away (Pace drops below 1 Amud per day)
    if (baseAmudim < 1) {
        const requiredStudyDays = totalAmudim; 
        for (let i = 0; i < requiredStudyDays; i++) {
            planSlots.push({ type: 'study', count: 1 });
        }
        const totalRemainingActiveDays = activeStudyDays.length - requiredStudyDays;
        for (let r = 0; r < totalRemainingActiveDays; r++) {
            planSlots.push({ type: 'review', count: 0 });
        }
    } 
    // 4. NORMAL CASE: Distribute material evenly across the timeline
    else {
        const remainder = totalAmudim % netStudyDaysCount;
        for (let i = 0; i < netStudyDaysCount; i++) {
            let extra = (i >= netStudyDaysCount - remainder) ? 1 : 0;
            planSlots.push({ type: 'study', count: baseAmudim + extra });
        }
        // Append explicit user-requested trailing review days
        for (let r = 0; r < reviewDaysCount; r++) {
            planSlots.push({ type: 'review', count: 0 });
        }
        // Append periodic review days (these will be distributed among the study days)
        for (let p = 0; p < periodicReviewCount; p++) {
            planSlots.push({ type: 'review', count: 0 });
        }
    }

    // 5. Build a reordered list of plan slots by interleaving periodic reviews
    let orderedSlots = [];
    if (hasPeriodicReviews && !isTimeBased && periodic.mode === 'days') {
        // Interleave study slots with periodic review slots (legacy study-day-based mode)
        let studySlotPointer = 0;
        let studyCounterTrack = 0;
        let pendingReview = 0;

        // Split out trailing review slots and periodic review slots
        const trailingReviewSlots = planSlots.slice(netStudyDaysCount, netStudyDaysCount + reviewDaysCount);
        const periodicReviewSlots = planSlots.slice(netStudyDaysCount + reviewDaysCount);

        studyCounterTrack = 0;
        for (let d = 0; d < activeStudyDays.length; d++) {
            if (pendingReview > 0) {
                if (periodicReviewSlots.length > 0) {
                    orderedSlots.push(periodicReviewSlots.shift());
                }
                pendingReview--;
            } else if (studySlotPointer < netStudyDaysCount) {
                if (studyCounterTrack > 0 && (studyCounterTrack + 1) % periodic.frequency === 0) {
                    if (periodicReviewSlots.length > 0) {
                        orderedSlots.push(periodicReviewSlots.shift());
                    }
                    pendingReview += (periodic.amount || 1) - 1;
                    studyCounterTrack = 0;
                } else {
                    orderedSlots.push(planSlots[studySlotPointer]);
                    studySlotPointer++;
                    studyCounterTrack++;
                }
            }
        }
        while (periodicReviewSlots.length > 0) {
            orderedSlots.push(periodicReviewSlots.shift());
        }
        orderedSlots = orderedSlots.concat(trailingReviewSlots);
    } else if (hasPeriodicReviews && !isTimeBased && periodic.mode === 'dafs') {
        orderedSlots = [...planSlots];
    } else {
        orderedSlots = [...planSlots];
    }

    // 6. Map the ordered slots onto the actual timeline days
    let planPointer = 0;
    timelineDays.forEach(day => {
        if (day.isStudyDay) {
            if (planPointer < orderedSlots.length) {
                const currentSlot = orderedSlots[planPointer];
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

    // Periodic review configuration
    const periodic = bookObj.periodicReview;
    const hasPeriodicReviews = periodic && periodic.enabled && (
        (periodic.mode === 'weekdays' && periodic.weekdays && periodic.weekdays.length > 0) ||
        (periodic.mode !== 'weekdays' && periodic.frequency > 0)
    );
    const isTimeBased = periodic && periodic.enabled && (periodic.mode === 'calendar' || periodic.mode === 'weekdays');

    // Precompute anchored review days for time-based periodic modes
    // We need to estimate an end date first, or compute on the fly.
    // Since pace mode doesn't have a fixed end, we'll compute anchored reviews
    // up to a projected end date (similar to ensureCalendarEvents logic).
    let anchoredReviewDays = new Set();
    if (hasPeriodicReviews && isTimeBased) {
        const anchorStr = resolvePeriodicAnchor(bookObj, formatDateToISO(startDate));
        // Project a reasonable end: totalAmudim / pace * 1.5 buffer + review days
        const totalAmudim = singleBookPool.length;
        const projectedStudyDays = Math.ceil(totalAmudim / dailyAmudimPace) + 30; // generous buffer
        const projectedEnd = new Date(startDate);
        projectedEnd.setDate(projectedEnd.getDate() + projectedStudyDays);
        anchoredReviewDays = computeAnchoredReviewDays(periodic, anchorStr, startDate, projectedEnd);
    }

    let studyDayCounter = 0;
    let cumulativeAmudim = 0;
    let pendingReviewDays = 0;

    while (amudPoolCopy.length > 0) {
        const dateString = formatDateToIL(currentDate);
        const overrideState = studyStatusOverrides[dateString] || 0;

        let isRestDay;
        let isReviewDay = false;
        let isAnchoredReview = false;

        // Time-anchored periodic reviews override rest day checks (unless force-rest)
        if (anchoredReviewDays.has(dateString) && overrideState !== 1) {
            isAnchoredReview = true;
            isRestDay = false;
            isReviewDay = true;
        } else if (anchoredReviewDays.has(dateString) && overrideState === 1) {
            isRestDay = true;
        } else {
            isRestDay = (overrideState === 1) || (overrideState !== 2 && 
                shouldDayBeRest(currentDate, studyDays, includeHolidays, includeBeinHazmanim, calendarEvents)
            );
        }

        let amudimToCountForDay = 0;
        let triggerReviewPhase = false;

        if (!isRestDay && !isAnchoredReview) {
            if (pendingReviewDays > 0) {
                isReviewDay = true;
                pendingReviewDays--;
            } else if (hasPeriodicReviews && !isTimeBased) {
                if (periodic.mode === 'days') {
                    // Check if the NEXT day should be the review day (e.g., 6 days studied, 7th is review)
                    if (studyDayCounter > 0 && (studyDayCounter + 1) % periodic.frequency === 0) {
                        isReviewDay = true;
                        // Since this day is already turning into a review day, add any EXTRA review days needed
                        pendingReviewDays += (periodic.amount || 1) - 1; 
                        studyDayCounter = 0; // Reset counter for the next cycle
                    }
                }
            }

            if (!isReviewDay && amudPoolCopy.length > 0) {
                let limit = Math.min(dailyAmudimPace, amudPoolCopy.length);
                let drained = amudPoolCopy.splice(0, limit);
                amudimToCountForDay = drained.length;
                studyDayCounter++;
                cumulativeAmudim += amudimToCountForDay;

                if (hasPeriodicReviews && !isTimeBased && periodic.mode === 'dafs') {
                    const dafsCompleted = cumulativeAmudim / 2;
                    if (dafsCompleted >= periodic.frequency) {
                        pendingReviewDays += (periodic.amount || 1);
                        cumulativeAmudim = 0;
                    }
                }

                if (amudPoolCopy.length === 0) {
                    triggerReviewPhase = true;
                }
            }
        }

        timelineDays.push({
            date: new Date(currentDate),
            dateString: dateString,
            isRestDay: isRestDay,
            isStudyDay: !isRestDay && !isReviewDay,
            isReviewDay: isReviewDay,
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

    // Flush any remaining pending periodic review days (non-time-based only)
    while (pendingReviewDays > 0 && !isTimeBased) {
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
            isReviewDay: !isRestDay,
            overrideState: overrideState,
            amudimToCount: 0,
            targetBook: bookObj.name,
            bookIndex: bookIndex
        });
        if (!isRestDay) pendingReviewDays--;
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