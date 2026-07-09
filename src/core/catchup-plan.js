import { getTotalAmudim } from '../utils/talmud.js';
import { indexToDaf } from '../utils/talmud.js';
import { formatDateToIL } from '../utils/dates.js';
import { checkIsBeinHazmanim } from '../utils/dates.js';

/**
 * Determine if a given date should be a rest day based on user preferences.
 * Mirrors the logic from scheduler.js's shouldDayBeRest().
 */
function isRestDay(dateObj, trackSettings, studyStatusOverrides, calendarEvents) {
    const dateString = formatDateToIL(dateObj);
    const overrideState = studyStatusOverrides[dateString] || 0;

    // Force rest override takes precedence
    if (overrideState === 1) return true;
    // Force study override overrides rest
    if (overrideState === 2) return false;

    const { studyDays, includeHolidays, includeBeinHazmanim } = trackSettings;
    const day = calendarEvents[dateString];
    const traits = day?.traits || {};
    const dayOfWeek = dateObj.getDay();

    // 1. Force break on Standard Chagim if includeHolidays is false
    if (traits.isChag && !includeHolidays) return true;

    // 2. Force break on Bein Hazmanim if includeBeinHazmanim is false
    if (!includeBeinHazmanim) {
        if (checkIsBeinHazmanim(dateObj)) return true;
    }

    // 3. Check if this weekday is NOT in the user's selected study days array
    if (!studyDays.includes(dayOfWeek)) return true;

    return false;
}

export function generateAdjustedSchedule(baselineSchedule, catchUpPlan, bookSequence, trackSettings, studyStatusOverrides, calendarEvents) {
    if (!baselineSchedule || baselineSchedule.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const adjusted = baselineSchedule.map(day => ({
        ...day,
        date: new Date(day.date)
    }));

    const bookInfo = buildBookInfo(bookSequence);
    const amudStatesMap = buildAmudStatesMap(bookSequence);

    if (!catchUpPlan || !catchUpPlan.isActive) {
        return processScheduleAuto(adjusted, bookInfo, amudStatesMap, bookSequence, today, trackSettings, studyStatusOverrides, calendarEvents);
    }

    return processScheduleWithPlan(adjusted, catchUpPlan, bookInfo, amudStatesMap, bookSequence, today, trackSettings, studyStatusOverrides, calendarEvents);
}

function buildBookInfo(bookSequence) {
    const info = {};
    bookSequence.forEach((book) => {
        const bookName = typeof book === 'string' ? book : book.name;
        info[bookName] = {
            totalAmudim: getTotalAmudim(bookName),
            learned: 0,
            skipped: 0,
            calcMethod: typeof book === 'object' ? book.calcMethod : 'pace',
            paceValue: typeof book === 'object' ? parseFloat(book.paceValue) || 1 : 1,
            targetDate: typeof book === 'object' ? book.targetDate : null
        };
    });
    return info;
}

function buildAmudStatesMap(bookSequence) {
    const map = {};
    bookSequence.forEach((book) => {
        const bookName = typeof book === 'string' ? book : book.name;
        const totalAmudim = getTotalAmudim(bookName);
        const rawStates = (typeof book === 'object' && book.amudStates) ? book.amudStates : [];
        const states = new Array(totalAmudim).fill(0);
        for (let i = 0; i < Math.min(rawStates.length, totalAmudim); i++) {
            states[i] = rawStates[i] || 0;
        }
        map[bookName] = states;
    });
    return map;
}

function processScheduleAuto(schedule, bookInfo, amudStatesMap, bookSequence, today, trackSettings, studyStatusOverrides, calendarEvents) {
    const expectedPointers = {};
    Object.keys(bookInfo).forEach(name => { expectedPointers[name] = 0; });

    // Clear any stale siyum/abrupt-stop flags from baseline before reprocessing
    for (const day of schedule) {
        day.isSiyum = false;
        day.isAbruptStop = false;
        delete day.abruptStopMsg;
    }

    // Pre-compute remaining study days for target-date books (without a catchup plan)
    // so Phase 2 can use squeeze-style redistribution
    const targetDateSqueezeInfo = {};
    for (const [bookName, info] of Object.entries(bookInfo)) {
        if (info.calcMethod === 'targetDate' && info.targetDate) {
            const targetDate = new Date(info.targetDate);
            targetDate.setHours(0, 0, 0, 0);
            if (targetDate < today) continue; // target passed, handled by deficit notice

            const states = amudStatesMap[bookName];
            const unlearnedCount = states.filter(s => s !== 1).length;
            if (unlearnedCount === 0) continue;

            let remainingStudyDays = 0;
            for (const day of schedule) {
                const dayDate = new Date(day.date);
                dayDate.setHours(0, 0, 0, 0);
                if (dayDate < today) continue;
                if (dayDate > targetDate) break;
                if (day.book === bookName && !day.isEmpty && !day.isRestDay && !day.isReviewDay) {
                    remainingStudyDays++;
                }
            }

            targetDateSqueezeInfo[bookName] = {
                remainingStudyDays: remainingStudyDays,
                unlearnedCount: unlearnedCount
            };
        }
    }

    // Pace extension logic: extend the current book's timeline
    // For pace-mode books without a catchup plan, we extend the timeline to finish the book
    // but stop abruptly if the next book starts before we can finish
    for (const [bookName, info] of Object.entries(bookInfo)) {
        if (info.calcMethod !== 'targetDate') {
            // Pace-mode book: extend the timeline
            let lastIdx = -1;
            for (let i = schedule.length - 1; i >= 0; i--) {
                if (schedule[i].book === bookName) {
                    lastIdx = i;
                    break;
                }
            }

            if (lastIdx !== -1) {
                const states = amudStatesMap[bookName];
                const unlearnedCount = states.filter(s => s !== 1).length;
                
                // Find the next book in sequence (if any)
                const bookIdx = bookSequence.findIndex(b => 
                    (typeof b === 'string' ? b : b.name) === bookName
                );
                const nextBook = bookIdx >= 0 && bookIdx < bookSequence.length - 1 
                    ? bookSequence[bookIdx + 1] 
                    : null;
                const nextBookName = nextBook ? (typeof nextBook === 'string' ? nextBook : nextBook.name) : null;
                
                // Find when the next book starts in the schedule
                let nextBookStartIdx = -1;
                if (nextBookName) {
                    for (let i = lastIdx + 1; i < schedule.length; i++) {
                        if (schedule[i].book === nextBookName && !schedule[i].isEmpty && !schedule[i].isRestDay && !schedule[i].isReviewDay) {
                            nextBookStartIdx = i;
                            break;
                        }
                    }
                }

                // Calculate remaining study days from today until the next book starts (or end of schedule)
                let remainingStudyDays = 0;
                for (let i = lastIdx + 1; i < schedule.length; i++) {
                    const dayDate = new Date(schedule[i].date);
                    dayDate.setHours(0, 0, 0, 0);
                    if (dayDate < today) continue;
                    
                    // Stop counting if we hit the next book's start
                    if (nextBookStartIdx >= 0 && i >= nextBookStartIdx) break;
                    
                    if (schedule[i].book === bookName && !schedule[i].isEmpty && !schedule[i].isRestDay && !schedule[i].isReviewDay) {
                        remainingStudyDays++;
                    }
                }

                const dailyAmudimPace = Math.max(1, Math.ceil(info.paceValue * 2));
                const daysNeeded = Math.ceil(unlearnedCount / dailyAmudimPace);
                let extraDays = daysNeeded - remainingStudyDays;

                // If we have extra days to add, check if we can add them without hitting the next book
                let cursorIdx = lastIdx + 1;
                while (extraDays > 0) {
                    // Check if we would hit the next book
                    if (nextBookStartIdx >= 0 && cursorIdx >= nextBookStartIdx) {
                        // We've reached the point where the next book starts - stop abruptly
                        break;
                    }
                    
                    if (cursorIdx < schedule.length) {
                        const nextDay = schedule[cursorIdx];
                        const dayDate = new Date(nextDay.date);
                        dayDate.setHours(0, 0, 0, 0);
                        
                        // Only extend if this day is empty or belongs to this book
                        if (nextDay.book === bookName || nextDay.isEmpty || nextDay.book === '-') {
                            // Check user preferences: is this a valid study day?
                            if (!isRestDay(dayDate, trackSettings, studyStatusOverrides, calendarEvents) && !nextDay.isReviewDay) {
                                nextDay.book = bookName;
                                nextDay.isEmpty = false;
                                nextDay.pages = dailyAmudimPace / 2;
                                extraDays--;
                            }
                        }
                        cursorIdx++;
                    } else {
                        // Beyond array limits, safely append
                        const prevDate = new Date(schedule[schedule.length - 1].date);
                        const cursorDate = new Date(prevDate);
                        cursorDate.setDate(cursorDate.getDate() + 1);

                        const isRest = isRestDay(cursorDate, trackSettings, studyStatusOverrides, calendarEvents);
                        schedule.push({
                            date: new Date(cursorDate),
                            dateString: formatDateToIL(cursorDate),
                            book: isRest ? "-" : bookName,
                            isShabbat: cursorDate.getDay() === 6,
                            isHoliday: false,
                            holidayTitle: "",
                            isEmpty: isRest,
                            override: 0,
                            content: "",
                            pages: isRest ? 0 : dailyAmudimPace / 2,
                            isReviewDay: false,
                            isSiyum: false,
                            isMissed: false
                        });
                        if (!isRest) extraDays--;
                        cursorIdx++;
                    }
                }
            }
        }
    }

    schedule.sort((a, b) => a.date - b.date);

    // Track the last day where content was actually assigned for each book
    const lastContentDay = {};

    for (let i = 0; i < schedule.length; i++) {
        const day = schedule[i];
        const dayDate = new Date(day.date);
        dayDate.setHours(0, 0, 0, 0);

        if (day.book === '-' || day.isEmpty || day.isReviewDay || day.isRestDay) continue;

        const bookName = day.book;
        if (!bookInfo[bookName]) continue;

        const endLimit = bookInfo[bookName].totalAmudim;
        const baselineAmudim = Math.round((day.pages || 0) * 2);
        const baselineStartAmud = expectedPointers[bookName];
        const baselineEndAmud = Math.min(baselineStartAmud + baselineAmudim, endLimit);
        expectedPointers[bookName] = baselineEndAmud;

        const states = amudStatesMap[bookName];

        if (dayDate < today) {
            let allLearned = true;
            for (let a = baselineStartAmud; a < baselineEndAmud && a < endLimit; a++) {
                if (a >= states.length || states[a] !== 1) {
                    allLearned = false;
                    break;
                }
            }

            if (!allLearned) {
                day.isMissed = true;
                day.content = "פספסת";
                day.pages = baselineAmudim / 2;
            }
        } else {
            // For pace-mode books without catchup plan, just show remaining unlearned pages
            const unlearnedAmudim = [];
            for (let a = 0; a < endLimit; a++) {
                if (a >= states.length || states[a] !== 1) {
                    unlearnedAmudim.push(a);
                }
            }

            if (unlearnedAmudim.length === 0) {
                day.content = "חזרה";
                day.pages = 0;
                day.isEmpty = true;
                continue;
            }

            // For target-date books without a catchup plan, use squeeze-style redistribution
            // to fit all remaining material before the original target date
            let amudimToStudy = baselineAmudim;
            const squeeze = targetDateSqueezeInfo[bookName];
            if (squeeze && squeeze.remainingStudyDays > 0) {
                const remaining = unlearnedAmudim.length;
                amudimToStudy = Math.min(Math.ceil(remaining / squeeze.remainingStudyDays), unlearnedAmudim.length);
                squeeze.remainingStudyDays--;
            }
            amudimToStudy = Math.min(amudimToStudy, unlearnedAmudim.length);

            if (amudimToStudy <= 0) {
                day.content = "חזרה";
                day.pages = 0;
                day.isEmpty = true;
                continue;
            }

            const assignedAmudim = unlearnedAmudim.slice(0, amudimToStudy);
            const startAmud = assignedAmudim[0];
            const endAmud = assignedAmudim[assignedAmudim.length - 1];

            day.content = (startAmud === endAmud)
                ? indexToDaf(startAmud)
                : `${indexToDaf(startAmud)} - ${indexToDaf(endAmud)}`;
            day.pages = amudimToStudy / 2;

            for (const a of assignedAmudim) {
                if (a < states.length) {
                    states[a] = 1;
                }
            }

            // Track this as the last day with actual content for this book
            lastContentDay[bookName] = i;
        }
    }

    // Second pass: assign siyum/abrupt-stop on the last content day for each book
    for (const [bookName, lastIdx] of Object.entries(lastContentDay)) {
        const day = schedule[lastIdx];
        const endLimit = bookInfo[bookName].totalAmudim;
        const endAmud = expectedPointers[bookName] - 1; // last amud assigned

        if (endAmud >= endLimit - 1) {
            day.isSiyum = true;
        } else {
            day.isAbruptStop = true;
            day.abruptStopMsg = "עצר באמצע";
        }
    }

    return schedule;
}

function processScheduleWithPlan(schedule, catchUpPlan, bookInfo, amudStatesMap, bookSequence, today, trackSettings, studyStatusOverrides, calendarEvents) {
    const planBooks = catchUpPlan.books || {};

    // Clear any stale siyum/abrupt-stop flags from baseline before reprocessing
    for (const day of schedule) {
        day.isSiyum = false;
        day.isAbruptStop = false;
        delete day.abruptStopMsg;
    }

    const bookStrategies = {};
    for (const [bookIdxStr, plan] of Object.entries(planBooks)) {
        const bookIdx = parseInt(bookIdxStr, 10);
        const bookEntry = bookSequence[bookIdx];
        if (!bookEntry) continue;
        const bookName = typeof bookEntry === 'string' ? bookEntry : bookEntry.name;
        bookStrategies[bookName] = { ...plan, bookIdx };
    }

    const expectedPointers = {};
    Object.keys(bookInfo).forEach(name => { expectedPointers[name] = 0; });

    const sprintInfo = {};
    for (const [bookName, strategy] of Object.entries(bookStrategies)) {
        if (strategy.strategy === 'sprint') {
            const states = amudStatesMap[bookName];
            const learnedCount = states.filter(s => s === 1).length;
            const todayStr = today.toISOString().split('T')[0];
            const baselinePtr = {};
            Object.keys(bookInfo).forEach(name => { baselinePtr[name] = 0; });

            for (const day of schedule) {
                if (day.book === '-' || day.isEmpty || day.isReviewDay || day.isRestDay) continue;
                if (!bookInfo[day.book]) continue;
                const bName = day.book;
                const amudim = Math.round((day.pages || 0) * 2);
                if (day.dateString <= todayStr) {
                    baselinePtr[bName] += amudim;
                }
            }

            const shouldHaveLearned = baselinePtr[bookName] || 0;
            const deficit = Math.max(0, shouldHaveLearned - learnedCount);
            const sprintDays = strategy.sprintDays || 7;
            const extraAmudimPerDay = sprintDays > 0 ? Math.ceil(deficit / sprintDays) : 0;

            sprintInfo[bookName] = {
                sprintDays: sprintDays,
                sprintDaysConsumed: 0,
                extraAmudimPerDay: extraAmudimPerDay,
                deficit: deficit
            };
        } else if (strategy.strategy === 'move-target' || strategy.strategy === 'squeeze') {
            const states = amudStatesMap[bookName];

            // Setup new date limits and firmly claim the timeline for this book
            let tDate = null;
            if (strategy.strategy === 'move-target' && strategy.newTargetDate) {
                tDate = new Date(strategy.newTargetDate);
                tDate.setHours(0, 0, 0, 0);

                if (schedule.length > 0) {
                    const lastDay = schedule[schedule.length - 1];
                    let cursor = new Date(lastDay.date);
                    cursor.setHours(0, 0, 0, 0);
                    while (cursor < tDate) {
                        cursor.setDate(cursor.getDate() + 1);
                        const isRest = isRestDay(cursor, trackSettings, studyStatusOverrides, calendarEvents);
                        schedule.push({
                            date: new Date(cursor),
                            dateString: formatDateToIL(cursor),
                            book: "-",
                            isShabbat: cursor.getDay() === 6,
                            isHoliday: false,
                            holidayTitle: "",
                            isEmpty: true,
                            override: 0,
                            content: "",
                            pages: 0,
                            isReviewDay: false,
                            isSiyum: false,
                            isMissed: false
                        });
                    }
                }

                for (const day of schedule) {
                    const dayDate = new Date(day.date);
                    dayDate.setHours(0, 0, 0, 0);
                    if (dayDate < today) continue;
                    if (dayDate > tDate) break;

                    // Only claim days that are valid study days per user preferences
                    if (!isRestDay(dayDate, trackSettings, studyStatusOverrides, calendarEvents) && !day.isReviewDay) {
                        if (day.book === bookName || day.isEmpty || day.book === '-') {
                            day.book = bookName;
                            day.isEmpty = false;
                        }
                    }
                }
            }

            // Calculate remaining study days from TODAY to the target date
            let remainingStudyDays = 0;
            for (const day of schedule) {
                const dayDate = new Date(day.date);
                dayDate.setHours(0, 0, 0, 0);
                if (dayDate < today) continue;

                if (tDate && dayDate > tDate) break;

                if (day.book === bookName && !day.isEmpty && !day.isRestDay && !day.isReviewDay) {
                    remainingStudyDays++;
                }
            }
            
            // Get unlearned count - this is the number of pages missed + remaining unlearned
            const unlearnedCount = states.filter(s => s !== 1).length;
            
            sprintInfo[bookName] = {
                type: 'redistribute',
                remainingStudyDays: remainingStudyDays,
                unlearnedCount: unlearnedCount,
                daysConsumed: 0
            };
        }
    }

    schedule.sort((a, b) => a.date - b.date);

    // Track the last day where content was actually assigned for each book
    const lastContentDay = {};

    for (let i = 0; i < schedule.length; i++) {
        const day = schedule[i];
        const dayDate = new Date(day.date);
        dayDate.setHours(0, 0, 0, 0);

        if (day.book === '-' || day.isEmpty || day.isReviewDay || day.isRestDay) continue;

        const bookName = day.book;
        if (!bookInfo[bookName]) continue;

        const endLimit = bookInfo[bookName].totalAmudim;
        const baselineAmudim = Math.round((day.pages || 0) * 2);
        const baselineStartAmud = expectedPointers[bookName];
        const baselineEndAmud = Math.min(baselineStartAmud + baselineAmudim, endLimit);
        expectedPointers[bookName] = baselineEndAmud;

        const states = amudStatesMap[bookName];

        if (dayDate < today) {
            let allLearned = true;
            for (let a = baselineStartAmud; a < baselineEndAmud && a < endLimit; a++) {
                if (a >= states.length || states[a] !== 1) {
                    allLearned = false;
                    break;
                }
            }
            if (!allLearned) {
                day.isMissed = true;
                day.content = "פספסת";
                day.pages = baselineAmudim / 2;
            }
        } else {
            const strategy = bookStrategies[bookName];
            const sprint = sprintInfo[bookName];

            const unlearnedAmudim = [];
            for (let a = 0; a < endLimit; a++) {
                if (a >= states.length || states[a] !== 1) {
                    unlearnedAmudim.push(a);
                }
            }

            if (unlearnedAmudim.length === 0) {
                day.content = "חזרה";
                day.pages = 0;
                day.isEmpty = true;
                continue;
            }

            let amudimToStudy = baselineAmudim;

            // Increase-pace strategy: use the new higher pace value for all future days
            if (strategy && strategy.strategy === 'increase-pace') {
                const newPaceAmudim = Math.max(1, Math.ceil((strategy.newPaceValue || 1) * 2));
                amudimToStudy = newPaceAmudim;
            } else if (sprint && sprint.type === 'redistribute') {
                // For move-target/squeeze: distribute ALL unlearned pages evenly from TODAY to target date
                if (sprint.remainingStudyDays > 0) {
                    const remaining = unlearnedAmudim.length;
                    amudimToStudy = Math.min(Math.ceil(remaining / sprint.remainingStudyDays), unlearnedAmudim.length);
                    sprint.remainingStudyDays--;
                }
            } else if (sprint && sprint.extraAmudimPerDay !== undefined) {
                if (sprint.sprintDaysConsumed < sprint.sprintDays) {
                    amudimToStudy = baselineAmudim + sprint.extraAmudimPerDay;
                    sprint.sprintDaysConsumed++;
                }
            }

            amudimToStudy = Math.min(amudimToStudy, unlearnedAmudim.length);

            if (amudimToStudy <= 0) {
                day.content = "חזרה";
                day.pages = 0;
                day.isEmpty = true;
                continue;
            }

            const assignedAmudim = unlearnedAmudim.slice(0, amudimToStudy);
            const startAmud = assignedAmudim[0];
            const endAmud = assignedAmudim[assignedAmudim.length - 1];

            day.content = (startAmud === endAmud)
                ? indexToDaf(startAmud)
                : `${indexToDaf(startAmud)} - ${indexToDaf(endAmud)}`;
            day.pages = amudimToStudy / 2;

            for (const a of assignedAmudim) {
                if (a < states.length) {
                    states[a] = 1;
                }
            }

            // Track this as the last day with actual content for this book
            lastContentDay[bookName] = i;
        }
    }

    // Second pass: assign siyum/abrupt-stop on the last content day for each book
    for (const [bookName, lastIdx] of Object.entries(lastContentDay)) {
        const day = schedule[lastIdx];
        const endLimit = bookInfo[bookName].totalAmudim;
        const endAmud = expectedPointers[bookName] - 1; // last amud assigned

        if (endAmud >= endLimit - 1) {
            day.isSiyum = true;
        } else {
            day.isAbruptStop = true;
            day.abruptStopMsg = "עצר באמצע";
        }
    }

    return schedule;
}

export function computeProgressDeficit(bookSequence, baselineSchedule) {
    const todayStr = new Date().toISOString().split('T')[0];
    const books = {};
    let totalDeficit = 0;

    bookSequence.forEach((book, bookIdx) => {
        const bookName = typeof book === 'string' ? book : book.name;
        const totalAmudim = getTotalAmudim(bookName);
        const amudStates = (typeof book === 'object' && book.amudStates) ? book.amudStates : [];

        const learned = amudStates.filter(s => s === 1).length;

        const targetDate = typeof book === 'object' ? book.targetDate : null;
        const targetDatePassed = targetDate ? new Date(targetDate) < new Date(todayStr) : false;

        let expected = 0;

        // Force maximum expectation if target date has passed, locking the deficit
        if (targetDatePassed) {
            expected = totalAmudim;
        } else if (baselineSchedule) {
            for (const day of baselineSchedule) {
                if (day.dateString > todayStr) break;
                if (day.book === bookName && !day.isEmpty && !day.isReviewDay) {
                    expected += Math.round((day.pages || 0) * 2);
                }
            }
        }

        const deficit = Math.max(0, expected - learned);
        const isBehind = deficit > 0;

        books[bookIdx] = {
            bookName,
            totalAmudim,
            learned,
            expected,
            deficit,
            isBehind,
            calcMethod: typeof book === 'object' ? book.calcMethod : 'pace',
            paceValue: typeof book === 'object' ? book.paceValue : 1,
            targetDate: targetDate,
            targetDatePassed: targetDatePassed,
            startAmudIdx: typeof book === 'object' ? book.startAmudIdx : undefined,
            endAmudIdx: typeof book === 'object' ? book.endAmudIdx : undefined
        };

        if (isBehind) totalDeficit += deficit;
    });

    return { books, totalDeficit, isAnyBehind: totalDeficit > 0 };
}

export function computeRemainingDays(baselineSchedule, bookName) {
    const todayStr = new Date().toISOString().split('T')[0];
    let remainingStudyDays = 0;
    let remainingCalendarDays = 0;
    let counting = false;

    for (const day of baselineSchedule) {
        if (day.dateString === todayStr) {
            counting = true;
        }
        if (!counting) continue;

        remainingCalendarDays++;
        if (day.book === bookName && !day.isEmpty && !day.isRestDay && !day.isReviewDay) {
            remainingStudyDays++;
        }
    }

    return { remainingStudyDays, remainingCalendarDays };
}