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

    // --- Step 1: Flatten All Amudim Into a Single Master Pool ---
    let masterAmudPool = [];

    trackSequence.forEach((name, idx) => {
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
            masterAmudPool.push({ masechet: name, amudIdx: i });
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
            const estimatedStudyDays = Math.ceil(masterAmudPool.length / dailyAmudimPace);
            const totalStructuralBreakDays = breakDays * (trackSequence.length - 1);
            const totalProjectedDays = (estimatedStudyDays + totalStructuralBreakDays) * 1.4;

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

        let estimatedBreaksCount = breakDays * (trackSequence.length - 1);
        let activeStudyDays = timelineDays.filter(d => d.isStudyDay);
        let actualStudyDaysCount = activeStudyDays.length - estimatedBreaksCount;

        if (actualStudyDaysCount <= 0) {
            actualStudyDaysCount = activeStudyDays.length;
        } else {
            let breakConverted = 0;
            for (let i = timelineDays.length - 1; i >= 0; i--) {
                if (breakConverted >= estimatedBreaksCount) break;
                if (timelineDays[i].isStudyDay) {
                    timelineDays[i].isStudyDay = false;
                    timelineDays[i].isBreakDay = true;
                    breakConverted++;
                }
            }
        }

        let trueStudyDays = timelineDays.filter(d => d.isStudyDay);
        if (trueStudyDays.length === 0) throw new Error("אין מספיק ימי לימוד בטווח התאריכים המבוקש");

        const minAmudimPerDay = 1; // Minimum floor: 0.5 daf per day
        const maxDaysNeeded = Math.ceil(masterAmudPool.length / minAmudimPerDay);

        // Check if the timeline is sparse enough to hit the floor pace limit
        if (trueStudyDays.length > maxDaysNeeded) {
            let studyDayCounter = 0;
            timelineDays.forEach(day => {
                if (day.isStudyDay) {
                    if (studyDayCounter < maxDaysNeeded) {
                        day.amudimToCount = minAmudimPerDay;
                        studyDayCounter++;
                    } else {
                        // Overflow days are explicitly set to review to preserve front-loaded pacing
                        day.isStudyDay = false;
                        day.isReviewDay = true;
                    }
                }
            });
        } else {
            // Rule 1 Enforcement: Ensure day availability handles masechet count
            if (trueStudyDays.length < trackSequence.length) {
                throw new Error("אין מספיק ימי לימוד כדי להקצות לפחות יום אחד לכל מסכת.");
            }

            const masechetCounts = [];
            trackSequence.forEach(trackName => {
                const count = masterAmudPool.filter(a => a.masechet === trackName).length;
                if (count > 0) {
                    masechetCounts.push({ name: trackName, count: count });
                }
            });

            const totalAmudim = masterAmudPool.length;
            const totalDays = trueStudyDays.length;

            // Rule 2: Proportional Day Allocation
            let totalAllocatedDays = 0;
            masechetCounts.forEach(m => {
                m.exactDays = totalDays * (m.count / totalAmudim);
                m.allocatedDays = Math.floor(m.exactDays);
                if (m.allocatedDays === 0) m.allocatedDays = 1;
                totalAllocatedDays += m.allocatedDays;
            });

            let daysToDistribute = totalDays - totalAllocatedDays;

            if (daysToDistribute < 0) {
                for (let i = 0; i < Math.abs(daysToDistribute); i++) {
                    masechetCounts.sort((a, b) => (a.allocatedDays - a.exactDays) - (b.allocatedDays - b.exactDays));
                    let target = masechetCounts.find(m => m.allocatedDays > 1);
                    if (target) target.allocatedDays--;
                }
            } else if (daysToDistribute > 0) {
                // Largest Remainder Method distribution
                masechetCounts.sort((a, b) => (b.exactDays - b.allocatedDays) - (a.exactDays - a.allocatedDays));
                for (let i = 0; i < daysToDistribute; i++) {
                    masechetCounts[i % masechetCounts.length].allocatedDays++;
                }
            }

            const scheduleSequence = masechetCounts.sort((a, b) => trackSequence.indexOf(a.name) - trackSequence.indexOf(b.name));

            // Rule 3: Distribute amudim within fixed spaces (back-loading remainders)
            let dayPlans = [];
            scheduleSequence.forEach(m => {
                const baseAmudim = Math.floor(m.count / m.allocatedDays);
                const remainder = m.count % m.allocatedDays;

                for (let i = 0; i < m.allocatedDays; i++) {
                    const extra = (i >= m.allocatedDays - remainder) ? 1 : 0;
                    dayPlans.push(baseAmudim + extra);
                }
            });

            trueStudyDays.forEach((d, idx) => {
                d.amudimToCount = dayPlans[idx];
            });
        }
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

            timelineDays.push({
                date: new Date(currentDate),
                dateString: dateString,
                isRestDay: isRestDay,
                isBreakDay: false,
                isStudyDay: !isRestDay,
                isReviewDay: false,
                overrideState: overrideState,
                amudimToCount: isRestDay ? 0 : dailyAmudimPace
            });

            if (!isRestDay) {
                let drained = amudPoolCopy.splice(0, dailyAmudimPace);

                if (drained.length > 0 && amudPoolCopy.length > 0 && drained[drained.length - 1].masechet !== amudPoolCopy[0].masechet) {
                    for (let b = 0; b < breakDays; b++) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        const bStr = formatDateToIL(currentDate);
                        timelineDays.push({
                            date: new Date(currentDate), dateString: bStr,
                            isRestDay: false, isBreakDay: true, isStudyDay: false, isReviewDay: false, overrideState: 0, amudimToCount: 0
                        });
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    // --- Step 5: Process Main Timeline Mapping ---
    let amudPointer = 0;
    let currentActiveMasechet = "-"; // Track the last active masechet for subsequent review days

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
            isReviewDay: day.isReviewDay // Flag sent to frontend for conditional greyed-out styling
        };

        if (day.isRestDay) {
            dayData.content = (day.overrideState === 1) ? "הפסקה" : "";
        } else if (day.isBreakDay) {
            dayData.masechet = "הפסקה";
            dayData.content = "";
        } else if (day.isReviewDay) {
            dayData.masechet = currentActiveMasechet; // Assign the completed masechet name to the cell header
            dayData.content = "חזרה";
        } else if (day.isStudyDay || day.amudimToCount > 0) {
            let count = day.amudimToCount;
            if (count > 0 && amudPointer < masterAmudPool.length) {
                let startAmud = masterAmudPool[amudPointer];
                let endAmud = masterAmudPool[Math.min(amudPointer + count - 1, masterAmudPool.length - 1)];

                dayData.masechet = startAmud.masechet;
                currentActiveMasechet = startAmud.masechet; // Update tracking context

                dayData.content = (startAmud.amudIdx === endAmud.amudIdx && startAmud.masechet === endAmud.masechet)
                    ? indexToDaf(startAmud.amudIdx)
                    : `${indexToDaf(startAmud.amudIdx)} - ${indexToDaf(endAmud.amudIdx)}`;

                dayData.pages = count / 2;
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