import { fetchCalendarEvents } from './api.js';
import { masechtot } from './data.js';

// utils
import { hebrewToNumber } from './utils/gematria.js';
import { indexToDaf, getTotalAmudim } from './utils/talmud.js';
import { formatDateToIL } from './utils/dates.js';


// Calculate if a given day should be marked as a rest day based on settings
export function shouldDayBeRest(dateObj, studyDays, includeHolidays, calendarData) {
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

// Generate a full schedule data array of day objects based on user input
export async function generateSchedule({ trackSequence, userSettings, manualOverrides, calendarData }) {
    if (trackSequence.length === 0) {
        return [];
    }

    const { studyDays, includeHolidays, method, calendarType, startDate, targetDate, startDaf, startAmud, pace } = userSettings;

    if (!startDate) {
        throw new Error("נא לבחור תאריך התחלה");
    }

    const startInputDate = new Date(startDate);
    startInputDate.setHours(0, 0, 0, 0);

    // --- Step 1: Flatten All Amudim Into a Single Master Pool with Instance Tracking ---
    let masterAmudPool = [];

    trackSequence.forEach((entry, idx) => {
        const name = typeof entry === 'string' ? entry : entry.name;

        let startIdx = 0;
        if (idx === 0) {
            const startDafHeb = startDaf.trim();
            if (startDafHeb) {
                startIdx = Math.max(0, (hebrewToNumber(startDafHeb) * 2) - 4);
                if (startAmud === "ב") startIdx += 1;
            }
        }

        const totalAmudim = getTotalAmudim(name);
        for (let i = startIdx; i < totalAmudim; i++) {
            masterAmudPool.push({ masechet: name, amudIdx: i, trackIdx: idx });
        }
    });

    // --- Step 2: Fetch Calendar Events ---
    const startYear = startInputDate.getFullYear();
    let endYear = startYear;

    if (method === 'targetDate') {
        if (!targetDate) throw new Error("נא לבחור תאריך יעד");
        endYear = new Date(targetDate).getFullYear();
    } else {
        const dailyAmudimPace = Math.max(1, Math.ceil(parseFloat(pace) * 2));
        if (dailyAmudimPace > 0) {
            // Rough estimation of years to parse
            const totalReviewDays = trackSequence.reduce((sum, entry) => sum + ((typeof entry === 'object' ? entry.reviewDays : 0) || 0), 0);
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

    const outputSchedule = [];

    // --- Step 3: Build Front Padding First ---
    let tempDate = new Date(startInputDate);
    if (calendarType === 'hebrew') {
        while (parseInt(new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' }).format(tempDate)) > 1) {
            tempDate.setDate(tempDate.getDate() - 1);
        }
    } else {
        tempDate.setDate(1);
    }

    while (tempDate < startInputDate) {
        const dStr = formatDateToIL(tempDate);
        outputSchedule.push({
            date: new Date(tempDate), dateString: dStr, masechet: "-",
            isShabbat: tempDate.getDay() === 6, isHoliday: !!calendarData[dStr]?.displayText,
            holidayTitle: calendarData[dStr]?.displayText, isEmpty: true, content: "", pages: 0
        });
        tempDate.setDate(tempDate.getDate() + 1);
    }

    // --- Step 4: Build the Strict Timeline Map ---
    let timelineDays = [];
    let currentDate = new Date(startInputDate);

    if (method === 'targetDate') {
        const endDate = new Date(targetDate);
        endDate.setHours(0, 0, 0, 0);

        if (endDate < startInputDate) throw new Error("תאריך היעד חייב להיות אחרי תאריך ההתחלה");

        // Collect overall counts of reviews to safely deduct from total active capacity
        const totalReviewDays = trackSequence.reduce((sum, entry) => sum + ((typeof entry === 'object' ? entry.reviewDays : 0) || 0), 0);

        // Build continuous base timeline days
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

        // Calculate dynamic mathematical load ratio for the active slots
        const netStudyDaysCount = activeStudyDays.length - totalReviewDays;
        const totalAmudim = masterAmudPool.length;

        // Build precise item profiles
        const masechetProfiles = trackSequence.map((entry, idx) => {
            const trackName = typeof entry === 'string' ? entry : entry.name;
            const rDays = (typeof entry === 'object' && entry?.reviewDays) ? parseInt(entry.reviewDays, 10) || 0 : 0;
            const count = masterAmudPool.filter(a => a.trackIdx === idx).length;
            return { name: trackName, trackIdx: idx, count: count, reviewDays: rDays, allocatedDays: 0 };
        }).filter(m => m.count > 0);

        // Distribute net study days proportionally across text targets
        let totalAllocatedDays = 0;
        masechetProfiles.forEach(m => {
            const exactDays = netStudyDaysCount * (m.count / totalAmudim);
            m.allocatedDays = Math.max(1, Math.floor(exactDays));
            totalAllocatedDays += m.allocatedDays;
        });

        // Distribute remainder variations
        let daysToDistribute = netStudyDaysCount - totalAllocatedDays;
        if (daysToDistribute > 0) {
            for (let i = 0; i < daysToDistribute; i++) {
                masechetProfiles[i % masechetProfiles.length].allocatedDays++;
            }
        } else if (daysToDistribute < 0) {
            for (let i = 0; i < Math.abs(daysToDistribute); i++) {
                masechetProfiles.sort((a, b) => b.allocatedDays - a.allocatedDays);
                if (masechetProfiles[0].allocatedDays > 1) masechetProfiles[0].allocatedDays--;
            }
        }

        // Translate calculated profiles directly into a flat linear sequence plan array
        let sequentialPlan = [];
        masechetProfiles.forEach((m) => {
            const baseAmudim = Math.floor(m.count / m.allocatedDays);
            const remainder = m.count % m.allocatedDays;

            // 1. Push actual text study quotas
            for (let i = 0; i < m.allocatedDays; i++) {
                const extra = (i >= m.allocatedDays - remainder) ? 1 : 0;
                sequentialPlan.push({ type: 'study', count: baseAmudim + extra, masechet: m.name });
            }

            // 2. Inject dedicated localized reviews immediately following completion
            for (let r = 0; r < m.reviewDays; r++) {
                sequentialPlan.push({ type: 'review', count: 0, masechet: m.name });
            }
        });

        // Map sequential items to the timeline slots
        let planPointer = 0;
        timelineDays.forEach(day => {
            if (day.isStudyDay) {
                if (planPointer < sequentialPlan.length) {
                    const currentPlan = sequentialPlan[planPointer];
                    if (currentPlan.type === 'review') {
                        day.isStudyDay = false;
                        day.isReviewDay = true;
                        day.reviewMasechet = currentPlan.masechet;
                    } else {
                        day.amudimToCount = currentPlan.count;
                    }
                    planPointer++;
                } else {
                    // Fallback extra buffer
                    day.isStudyDay = false;
                    day.isReviewDay = true;
                }
            }
        });

    } else {
        // Pace Mode
        let amudPoolCopy = [...masterAmudPool];
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
            let currentTrackIdx = amudPoolCopy[0].trackIdx;

            if (!isRestDay) {
                let limit = 0;
                while (limit < dailyAmudimPace && limit < amudPoolCopy.length && amudPoolCopy[limit].trackIdx === currentTrackIdx) {
                    limit++;
                }

                let drained = amudPoolCopy.splice(0, limit);
                amudimToCountForDay = drained.length;

                if (amudPoolCopy.length === 0 || amudPoolCopy[0].trackIdx !== currentTrackIdx) {
                    triggerReviewPhase = true;
                }
            }

            // Push the actual study day (or study rest day)
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
                // Direct sequential inline execution for localized tracking (skip non-study days)
                const finishedEntry = trackSequence[currentTrackIdx];
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
                            reviewMasechet: typeof finishedEntry === 'string' ? finishedEntry : finishedEntry.name
                        });
                        r++; // Only count down a review day if it was actually available for reviewing
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    // --- Step 5: Process Main Timeline Mapping ---
    let amudPointer = 0;
    let currentActiveMasechet = "-";

    timelineDays.forEach(day => {
        const isShabbat = day.date.getDay() === 6;
        const traits = calendarData[day.dateString]?.traits || {};

        let dayData = {
            date: day.date,
            dateString: day.dateString,
            masechet: "-",
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
            dayData.masechet = day.reviewMasechet || currentActiveMasechet;
            dayData.content = "חזרה";
        } else if (day.isStudyDay || day.amudimToCount > 0) {
            let count = day.amudimToCount;
            if (count > 0 && amudPointer < masterAmudPool.length) {
                let startAmud = masterAmudPool[amudPointer];
                let lastAvailableIdx = Math.min(amudPointer + count - 1, masterAmudPool.length - 1);
                let endAmud = masterAmudPool[lastAvailableIdx];

                dayData.masechet = startAmud.masechet;
                currentActiveMasechet = startAmud.masechet;

                dayData.content = (startAmud.amudIdx === endAmud.amudIdx && startAmud.trackIdx === endAmud.trackIdx)
                    ? indexToDaf(startAmud.amudIdx)
                    : `${indexToDaf(startAmud.amudIdx)} - ${indexToDaf(endAmud.amudIdx)}`;

                dayData.pages = count / 2;

                const totalAmudimForThisTrack = getTotalAmudim(startAmud.masechet);
                if (endAmud.amudIdx === totalAmudimForThisTrack - 1) {
                    dayData.isSiyum = true;
                }

                amudPointer += count;
            } else {
                dayData.masechet = currentActiveMasechet;
                dayData.content = "חזרה";
            }
        }

        outputSchedule.push(dayData);
    });

    // --- Step 6: Back Monthly Layout Padding ---
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
                date: new Date(runnerDate), dateString: ds, masechet: "-",
                isShabbat: runnerDate.getDay() === 6, isHoliday: !!calendarData[ds]?.displayText,
                holidayTitle: calendarData[ds]?.displayText, isEmpty: true, content: "", pages: 0
            });
        }
    }

    return outputSchedule;
}

// Cycles the date's manual schedule override: Default -> Force Break -> Force Study -> Reset.
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
// belonging to a specific masechet entry (identified by its index in trackSequence).
// Works by replaying the amud pointer across the schedule in order.
export function computeDaySlots(schedule, masechetName, trackIdx, trackSequence) {
    if (!schedule || schedule.length === 0) return [];

    // Compute the global amud offset where this masechet's block starts.
    // Each masechet before it in the sequence consumes amudCount amudim.
    let blockStart = 0;
    for (let i = 0; i < trackIdx; i++) {
        const entry = trackSequence[i];
        const name = typeof entry === 'string' ? entry : entry.name;
        const data = masechtot.find(m => m.name === name);
        if (data) blockStart += (data.amudCount || 0);
    }

    const targetEntry = trackSequence[trackIdx];
    const targetName  = typeof targetEntry === 'string' ? targetEntry : targetEntry?.name;
    const targetData  = masechtot.find(m => m.name === targetName);
    const blockEnd    = blockStart + (targetData?.amudCount || 0);

    const slots = [];
    let globalPointer = 0; // Tracks position in the full masterAmudPool across the schedule

    for (const day of schedule) {
        if (day.isEmpty || day.isReviewDay || !day.pages || day.pages <= 0) continue;

        const amudCount = Math.round(day.pages * 2);

        // Check whether this day's amud range overlaps our target block
        if (day.masechet === masechetName && globalPointer >= blockStart && globalPointer < blockEnd) {
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