// scheduler.js
import { hebrewToNumber, indexToDaf, formatDateToIL } from './utils.js';
import { getTotalAmudim } from './data.js';
import { fetchCalendarEvents } from './api.js';

// Calculate if a given day should be marked as a rest day based on settings
export function shouldDayBeRest(dateObj, includeShabbat, includeHolidays, calendarData) {
    const dateString = formatDateToIL(dateObj);
    const day = calendarData[dateString];
    const traits = day?.traits || {};
    const isShabbatDay = dateObj.getDay() === 6;

    if (traits.isChag && !includeHolidays) return true;     // Force break on Standard Chagim
    if ((isShabbatDay || traits.isParasha)
        && !includeShabbat) return true;     // Force break on Shabbat / Parasha

    if (traits.isRoshChodesh) return false;     // Study by default on Rosh Chodesh
    if (traits.isModernException) return false;     // Study by default on Modern Exceptions

    return false;   // Not rest day by default
}

// Generate a full schedule data array of day objects based on user input
export async function generateSchedule({ trackSequence, userSettings, manualOverrides, calendarData }) {
    if (trackSequence.length === 0) {
        throw new Error("נא להוסיף לפחות מסכת אחת למסלול");
    }

    const { includeShabbat, includeHolidays, breakDays, method, calendarType, startDate, targetDate, startDaf, startAmud, pace } = userSettings;

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
        const dailyAmudimPace = Math.round(parseFloat(pace) * 2);
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
            let isRestDay = (overrideState === 1) || (overrideState !== 2 && shouldDayBeRest(currentDate, includeShabbat, includeHolidays, calendarData));

            timelineDays.push({
                date: new Date(currentDate),
                dateString: dateString,
                isRestDay: isRestDay,
                isBreakDay: false,
                isStudyDay: !isRestDay,
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

        let baseAmudimPerDay = Math.floor(masterAmudPool.length / trueStudyDays.length);
        let leftoverAmudim = masterAmudPool.length % trueStudyDays.length;

        trueStudyDays.forEach(d => d.amudimToCount = baseAmudimPerDay);

        let distributedLeftovers = 0;
        for (let i = trueStudyDays.length - 1; i >= 0; i--) {
            if (distributedLeftovers >= leftoverAmudim) break;
            trueStudyDays[i].amudimToCount += 1;
            distributedLeftovers++;
        }
    } else {
        // Pace Mode
        let amudPoolCopy = [...masterAmudPool];
        const dailyAmudimPace = Math.round(parseFloat(pace) * 2);

        while (amudPoolCopy.length > 0) {
            const dateString = formatDateToIL(currentDate);
            const overrideState = manualOverrides[dateString] || 0;
            let isRestDay = (overrideState === 1) || (overrideState !== 2 && shouldDayBeRest(currentDate, includeShabbat, includeHolidays, calendarData));

            timelineDays.push({
                date: new Date(currentDate),
                dateString: dateString,
                isRestDay: isRestDay,
                isBreakDay: false,
                isStudyDay: !isRestDay,
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
                            isRestDay: false, isBreakDay: true, isStudyDay: false, overrideState: 0, amudimToCount: 0
                        });
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    // --- Step 5: Process Main Timeline Mapping ---
    let amudPointer = 0;

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
            isEmpty: day.isRestDay || day.isBreakDay,
            override: day.overrideState,
            content: "",
            pages: 0
        };

        if (day.isRestDay) {
            dayData.content = (day.overrideState === 1) ? "הפסקה" : "";
        } else if (day.isBreakDay) {
            dayData.masechet = "הפסקה";
            dayData.content = "";
        } else if (day.isStudyDay || day.amudimToCount > 0) {
            let count = day.amudimToCount;
            if (count > 0 && amudPointer < masterAmudPool.length) {
                let startAmud = masterAmudPool[amudPointer];
                let endAmud = masterAmudPool[Math.min(amudPointer + count - 1, masterAmudPool.length - 1)];

                dayData.masechet = startAmud.masechet;
                dayData.content = (startAmud.amudIdx === endAmud.amudIdx && startAmud.masechet === endAmud.masechet)
                    ? indexToDaf(startAmud.amudIdx)
                    : `${indexToDaf(startAmud.amudIdx)} - ${indexToDaf(endAmud.amudIdx)}`;

                dayData.pages = count / 2;
                amudPointer += count;
            } else {
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