import { getTotalAmudim } from './utils/talmud.js';
import { fetchCalendarEvents } from './api.js';

// utils
import { hebrewToNumber } from './utils/gematria.js';
import { indexToDaf } from './utils/talmud.js';
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

    const { studyDays, includeHolidays, breakDays, method, calendarType, startDate, targetDate, startDaf, startAmud, pace } = userSettings;

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
            const totalStructuralBreakDays = breakDays * (trackSequence.length - 1);
            const totalProjectedDays = (estimatedStudyDays + totalStructuralBreakDays + totalReviewDays) * 1.4;

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

        // Collect overall counts of breaks and reviews to safely deduct from total active capacity
        let totalBreaksCount = breakDays * (trackSequence.length - 1);
        const totalReviewDays = trackSequence.reduce((sum, entry) => sum + ((typeof entry === 'object' ? entry.reviewDays : 0) || 0), 0);
        const totalReservedDays = totalBreaksCount + totalReviewDays;

        // Build continuous base timeline days
        while (currentDate <= endDate) {
            const dateString = formatDateToIL(currentDate);
            const overrideState = manualOverrides[dateString] || 0;
            let isRestDay = (overrideState === 1) || (overrideState !== 2 && shouldDayBeRest(currentDate, studyDays, includeHolidays, calendarData));

            timelineDays.push({
                date: new Date(currentDate),
                dateString: dateString,
                isRestDay: isRestDay,
                isBreakDay: false,
                isStudyDay: !isRestDay,
                isReviewDay: false,
                overrideState: overrideState,
                amudimToCount: 0
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        let activeStudyDays = timelineDays.filter(d => d.isStudyDay);
        if (activeStudyDays.length <= totalReservedDays) {
            throw new Error("אין מספיק ימי לימוד בטווח התאריכים המבוקש כדי להכיל את ימי החזרה וההפסקות.");
        }

        // Calculate dynamic mathematical load ratio for the active slots
        const netStudyDaysCount = activeStudyDays.length - totalReservedDays;
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

        // Translate the calculated load matrix maps directly into a flat linear sequence plan array
        let sequentialPlan = [];
        masechetProfiles.forEach((m, profileIdx) => {
            const baseAmudim = Math.floor(m.count / m.allocatedDays);
            const remainder = m.count % m.allocatedDays;

            // 1. Push actual text study quotas
            for (let i = 0; i < m.allocatedDays; i++) {
                const extra = (i >= m.allocatedDays - remainder) ? 1 : 0;
                sequentialPlan.push({ type: 'study', count: baseAmudim + extra, masechet: m.name });
            }

            // 2. Inject structural structural intermissions immediately following completion
            if (profileIdx < masechetProfiles.length - 1) {
                for (let b = 0; b < breakDays; b++) {
                    sequentialPlan.push({ type: 'break', count: 0, masechet: "הפסקה" });
                }
            }

            // 3. Inject dedicated localized reviews immediately following completion
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
                    if (currentPlan.type === 'break') {
                        day.isStudyDay = false;
                        day.isBreakDay = true;
                    } else if (currentPlan.type === 'review') {
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
            let triggerBreak = false;
            let currentTrackIdx = amudPoolCopy[0].trackIdx;

            if (!isRestDay) {
                let limit = 0;
                while (limit < dailyAmudimPace && limit < amudPoolCopy.length && amudPoolCopy[limit].trackIdx === currentTrackIdx) {
                    limit++;
                }

                let drained = amudPoolCopy.splice(0, limit);
                amudimToCountForDay = drained.length;

                if (amudPoolCopy.length === 0 || amudPoolCopy[0].trackIdx !== currentTrackIdx) {
                    triggerBreak = true;
                }
            }

            // Push the actual study day (or study rest day)
            timelineDays.push({
                date: new Date(currentDate),
                dateString: dateString,
                isRestDay: isRestDay,
                isBreakDay: false,
                isStudyDay: !isRestDay,
                isReviewDay: false,
                overrideState: overrideState,
                amudimToCount: amudimToCountForDay
            });

            if (triggerBreak) {
                // 1. Structural break management between tracks (skip non-study days)
                const isAbsoluteLast = (currentTrackIdx === trackSequence.length - 1);
                if (!isAbsoluteLast) {
                    let b = 0;
                    while (b < breakDays) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        const bStr = formatDateToIL(currentDate);
                        const bOverride = manualOverrides[bStr] || 0;
                        let bIsRest = (bOverride === 1) || (bOverride !== 2 && shouldDayBeRest(currentDate, studyDays, includeHolidays, calendarData));

                        if (bIsRest) {
                            timelineDays.push({
                                date: new Date(currentDate), dateString: bStr,
                                isRestDay: true, isBreakDay: false, isStudyDay: false, isReviewDay: false, overrideState: bOverride, amudimToCount: 0
                            });
                        } else {
                            timelineDays.push({
                                date: new Date(currentDate), dateString: bStr,
                                isRestDay: false, isBreakDay: true, isStudyDay: false, isReviewDay: false, overrideState: bOverride, amudimToCount: 0
                            });
                            b++; // Only count towards break days if it's a valid structural day
                        }
                    }
                }

                // 2. Direct sequential inline execution for localized tracking (skip non-study days)
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
                            isRestDay: true, isBreakDay: false, isStudyDay: false, isReviewDay: false, overrideState: rOverride, amudimToCount: 0
                        });
                    } else {
                        timelineDays.push({
                            date: new Date(currentDate), dateString: rStr,
                            isRestDay: false, isBreakDay: false, isStudyDay: false, isReviewDay: true, overrideState: rOverride, amudimToCount: 0,
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
            isEmpty: day.isRestDay || day.isBreakDay || day.isReviewDay,
            override: day.overrideState,
            content: "",
            pages: 0,
            isReviewDay: day.isReviewDay,
            isSiyum: false
        };

        if (day.isRestDay) {
            dayData.content = (day.overrideState === 1) ? "הפסקה" : "";
        } else if (day.isBreakDay) {
            dayData.masechet = "הפסקה";
            dayData.content = "";
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