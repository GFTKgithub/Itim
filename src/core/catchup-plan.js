import { getTotalAmudim } from '../utils/talmud.js';
import { indexToDaf } from '../utils/talmud.js';
import { formatDateToIL } from '../utils/dates.js';
import { shouldDayBeRest } from './scheduler.js';

export function generateAdjustedSchedule(
    baselineSchedule,
    catchUpPlan,
    bookSequence,
    trackSettings,
    studyStatusOverrides,
    calendarEvents
) {
    if (!baselineSchedule || baselineSchedule.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const adjusted = baselineSchedule.map(day => ({ ...day, date: new Date(day.date) }));
    const bookInfo = buildBookInfo(bookSequence);
    const amudStatesMap = buildAmudStatesMap(bookSequence);

    if (!catchUpPlan || !catchUpPlan.isActive) {
        return processDefault(
            adjusted, bookInfo, amudStatesMap, bookSequence,
            today, trackSettings, studyStatusOverrides, calendarEvents
        );
    }

    return processWithCatchup(
        adjusted, catchUpPlan, bookInfo, amudStatesMap, bookSequence,
        today, trackSettings, studyStatusOverrides, calendarEvents
    );
}

function buildBookInfo(bookSequence) {
    const info = {};
    bookSequence.forEach((book) => {
        const n = typeof book === 'string' ? book : book.name;
        info[n] = {
            totalAmudim: getTotalAmudim(n),
            calcMethod: typeof book === 'object' ? book.calcMethod : 'pace',
            paceValue: typeof book === 'object' ? parseFloat(book.paceValue) || 1 : 1,
            targetDate: typeof book === 'object' ? book.targetDate : null,
        };
    });
    return info;
}

function buildAmudStatesMap(bookSequence) {
    const map = {};
    bookSequence.forEach((book) => {
        const n = typeof book === 'string' ? book : book.name;
        const total = getTotalAmudim(n);
        const raw = (typeof book === 'object' && book.amudStates) ? book.amudStates : [];
        const s = new Array(total).fill(0);
        for (let i = 0; i < Math.min(raw.length, total); i++) s[i] = raw[i] || 0;
        map[n] = s;
    });
    return map;
}

function buildQueue(states, limit) {
    const q = [];
    for (let a = 0; a < limit; a++) {
        const s = a < states.length ? states[a] : 0;
        if (s !== 1 && s !== 2) q.push(a);
    }
    return q;
}

function countStudyDays(schedule, name, fromIdx, endDate, today) {
    let c = 0;
    for (let j = fromIdx; j < schedule.length; j++) {
        const jd = schedule[j];
        const jdt = new Date(jd.date);
        jdt.setHours(0, 0, 0, 0);
        if (endDate && jdt > endDate) break;
        if (jd.book === name && !jd.isEmpty && !jd.isRestDay && !jd.isReviewDay && jdt >= today) c++;
    }
    return c;
}

/**
 * ====================================================================
 * DEFAULT SCHEDULE
 * ====================================================================
 */
function processDefault(
    schedule, bookInfo, amudStatesMap, bookSequence,
    today, trackSettings, studyStatusOverrides, calendarEvents
) {
    for (const d of schedule) {
        d.isSiyum = false;
        d.isAbruptStop = false;
        d.isMissed = false;
        delete d.abruptStopMsg;
    }

    const queues = {};
    for (const [n] of Object.entries(bookInfo)) queues[n] = buildQueue(amudStatesMap[n], bookInfo[n].totalAmudim);

    const nextBookStart = {};
    for (let b = 0; b < bookSequence.length; b++) {
        const n = typeof bookSequence[b] === 'string' ? bookSequence[b] : bookSequence[b].name;
        if (b < bookSequence.length - 1) {
            const nn = typeof bookSequence[b + 1] === 'string' ? bookSequence[b + 1] : bookSequence[b + 1].name;
            let s = null;
            for (let j = 0; j < schedule.length; j++) {
                if (schedule[j].book === nn && !schedule[j].isEmpty) {
                    s = new Date(schedule[j].date);
                    s.setHours(0, 0, 0, 0);
                    break;
                }
            }
            nextBookStart[n] = s;
        } else {
            nextBookStart[n] = null;
        }
    }

    for (let i = 0; i < schedule.length; i++) {
        const day = schedule[i];
        const d = new Date(day.date);
        d.setHours(0, 0, 0, 0);

        if (day.book === '-' || day.isEmpty || day.isReviewDay || day.isRestDay) continue;

        const n = day.book, info = bookInfo[n], q = queues[n];
        if (!info) continue;

        if (d < today) { day.content = ""; day.pages = 0; day.isEmpty = true; day.isMissed = false; continue; }
        if (q.length === 0) { day.content = "חזרה"; day.pages = 0; day.isEmpty = true; continue; }

        let end = null;
        if (info.calcMethod === 'targetDate' && info.targetDate) {
            end = new Date(info.targetDate);
            end.setHours(0, 0, 0, 0);
        }

        const daysLeft = countStudyDays(schedule, n, i, end, today);
        let amt = end
            ? (daysLeft > 0 ? Math.ceil(q.length / daysLeft) : q.length)
            : Math.max(1, Math.ceil(info.paceValue * 2));
        amt = Math.min(amt, q.length);
        if (amt <= 0) { day.content = "חזרה"; day.pages = 0; day.isEmpty = true; continue; }

        const taken = q.splice(0, amt);
        day.content = taken.length === 1
            ? indexToDaf(taken[0])
            : `${indexToDaf(taken[0])} - ${indexToDaf(taken[taken.length - 1])}`;
        day.pages = amt / 2;
        day.isEmpty = false;
    }

    schedule.sort((a, b) => a.date - b.date);
    let lastDate = schedule.length > 0 ? new Date(schedule[schedule.length - 1].date) : new Date(today);

    for (const [n, info] of Object.entries(bookInfo)) {
        const q = queues[n];
        if (q.length === 0 || info.calcMethod === 'targetDate') continue;

        const pace = Math.max(1, Math.ceil(info.paceValue * 2)), ns = nextBookStart[n];
        let li = -1;
        for (let i = schedule.length - 1; i >= 0; i--) {
            const sd = schedule[i], dd = new Date(sd.date);
            dd.setHours(0, 0, 0, 0);
            if (sd.book === n && !sd.isEmpty && dd >= today) { li = i; break; }
        }

        if (q.length > 0) {
            for (let i = li + 1; i < schedule.length && q.length > 0; i++) {
                const day = schedule[i], dd = new Date(day.date);
                dd.setHours(0, 0, 0, 0);
                if (day.book !== '-' && day.book !== n && !day.isEmpty) continue;
                if (day.isRestDay || day.isReviewDay || shouldDayBeRest(dd, trackSettings.studyDays, trackSettings.includeHolidays, trackSettings.includeBeinHazmanim, calendarEvents)) continue;
                if (ns && dd >= ns) break;
                if (dd < today) continue;

                const a = Math.min(pace, q.length);
                const g = q.splice(0, a);
                day.book = n;
                day.isEmpty = false;
                day.content = g.length === 1 ? indexToDaf(g[0]) : `${indexToDaf(g[0])} - ${indexToDaf(g[g.length - 1])}`;
                day.pages = a / 2;
            }

            if (q.length > 0) {
                let cur = new Date(lastDate);
                while (q.length > 0) {
                    cur.setDate(cur.getDate() + 1);
                    if (ns && cur >= ns) break;

                    if (shouldDayBeRest(cur, trackSettings.studyDays, trackSettings.includeHolidays, trackSettings.includeBeinHazmanim, calendarEvents)) {
                        schedule.push({
                            date: new Date(cur), dateString: formatDateToIL(cur), book: "-",
                            isShabbat: cur.getDay() === 6, isHoliday: false, holidayTitle: "",
                            isEmpty: true, override: 0, content: "", pages: 0,
                            isReviewDay: false, isSiyum: false, isMissed: false,
                        });
                    } else {
                        const a = Math.min(pace, q.length);
                        const g = q.splice(0, a);
                        schedule.push({
                            date: new Date(cur), dateString: formatDateToIL(cur), book: n,
                            isShabbat: cur.getDay() === 6, isHoliday: false, holidayTitle: "",
                            isEmpty: false, override: 0,
                            content: g.length === 1 ? indexToDaf(g[0]) : `${indexToDaf(g[0])} - ${indexToDaf(g[g.length - 1])}`,
                            pages: a / 2, isReviewDay: false, isSiyum: false, isMissed: false,
                        });
                    }
                    lastDate = new Date(cur);
                }
            }
        }
    }

    schedule.sort((a, b) => a.date - b.date);
    for (const n of Object.keys(bookInfo)) {
        let last = null;
        for (let i = schedule.length - 1; i >= 0; i--) {
            if (schedule[i].book === n && !schedule[i].isEmpty) { last = schedule[i]; break; }
        }
        if (!last) continue;

        if (queues[n]?.length === 0) {
            last.isSiyum = true;
            last.isAbruptStop = false;
        } else {
            last.isSiyum = false;
            last.isAbruptStop = true;
            last.abruptStopMsg = "עצר באמצע";
        }
    }

    return schedule;
}

/**
 * ====================================================================
 * SCHEDULE WITH CATCHUP PLAN
 * ====================================================================
 *
 * The schedule goes through a single processing pass. For each future
 * study day of a catchup book:
 *
 * 1. Compute the BASELINE pace (what the original schedule would assign).
 * 2. If within catchup period, add EXTRA on top.
 * 3. Consume from a shared queue.
 *
 * The baseline for pace mode = ceil(paceValue * 2) (FIXED).
 * The baseline for target-date mode = ceil(queue / daysLeft) (dynamic).
 *
 * For sprint: extra = ceil(deficit / N) per day, last day gets remainder.
 * For increase-pace: extra = addAmudimValue per day, last day gets remainder.
 * For squeeze/move-target: no extra, all material redistributed.
 *
 * For target-date books on sprint/increase-pace, the dynamic baseline is
 * driven by an "ideal" (as-if-never-behind) remaining count rather than
 * the real queue. The real queue already reflects being behind, so basing
 * the dynamic baseline on it would smooth the deficit back in on its own —
 * double-counting the same catchup that "extra" is explicitly paying off,
 * and causing the plan to finish before the target date. The ideal count
 * only ever absorbs the baseline portion consumed each day, so "extra" is
 * the sole mechanism clearing the deficit, and once it's paid off the
 * dynamic baseline settles back to the exact steady pace that lands on
 * the target date.
 */
function processWithCatchup(
    schedule, catchUpPlan, bookInfo, amudStatesMap, bookSequence,
    today, trackSettings, studyStatusOverrides, calendarEvents
) {
    const planBooks = catchUpPlan.books || {};
    for (const d of schedule) {
        d.isSiyum = false;
        d.isAbruptStop = false;
        d.isMissed = false;
        delete d.abruptStopMsg;
    }

    // Build strategy map
    const strategies = {};
    for (const [idxStr, p] of Object.entries(planBooks)) {
        const idx = parseInt(idxStr, 10);
        const entry = bookSequence[idx];
        if (!entry) continue;
        strategies[typeof entry === 'string' ? entry : entry.name] = { ...p, bookIdx: idx };
    }

    // Build queues (ONE shared queue per book, consumed through the entire process)
    const queues = {};
    for (const [n, info] of Object.entries(bookInfo)) queues[n] = buildQueue(amudStatesMap[n], info.totalAmudim);

    // Pre-compute extra arrays for sprint/increase-pace
    const extras = {}; // bookName -> [extraAmudim...]
    const idealRemaining = {}; // bookName -> ideal (never-behind) remaining amudim, target-date books only

    for (const [n, s] of Object.entries(strategies)) {
        if (!bookInfo[n]) continue;

        const deficit = s.deficitAmount || 0;
        if (deficit <= 0 || (s.strategy !== 'sprint' && s.strategy !== 'increase-pace')) continue;

        const arr = [];
        let rem = deficit;

        if (s.strategy === 'increase-pace') {
            // Each day gets exactly the user-specified addAmudimValue extra
            // (fractions / 0.5 daf preserved); the last (partial) day only
            // takes whatever remains.
            const perDay = parseFloat(s.addAmudimValue) || 1;
            while (rem > 0) {
                const take = Math.min(perDay, rem);
                arr.push(take);
                rem -= take;
            }
        } else {
            // sprint: spread the deficit evenly across the user-chosen number
            // of days, remainder on the last day.
            const nDays = Math.max(1, parseInt(s.sprintDays, 10) || 1);
            for (let d = 0; d < nDays; d++) {
                const amt = d === nDays - 1 ? rem : Math.ceil(deficit / nDays);
                arr.push(amt);
                rem -= amt;
            }
        }

        extras[n] = arr;

        // For target-date books only: track a parallel "ideal" (as-if-never-behind)
        // remaining count. It starts at (current queue - deficit) and is decremented
        // only by the baseline portion consumed each day (never by the extra). This
        // keeps the dynamic baseline (queue / daysLeft) at a steady, un-inflated pace
        // instead of it silently re-absorbing the same deficit that "extra" is already
        // paying off — which was causing the plan to finish early / drift off-target.
        const initialQLen = queues[n] ? queues[n].length : 0;
        idealRemaining[n] = Math.max(0, initialQLen - Math.min(deficit, initialQLen));
    }

    // ================================================================
    // PHASE 1: move-target — extend schedule and claim days
    // ================================================================
    for (const [n, s] of Object.entries(strategies)) {
        if (s.strategy !== 'move-target') continue;

        const nd = s.newTargetDate ? new Date(s.newTargetDate) : null;
        if (!nd) continue;
        nd.setHours(0, 0, 0, 0);

        if (schedule.length > 0) {
            let cur = new Date(schedule[schedule.length - 1].date);
            cur.setHours(0, 0, 0, 0);
            while (cur < nd) {
                cur.setDate(cur.getDate() + 1);
                schedule.push({
                    date: new Date(cur), dateString: formatDateToIL(cur), book: "-",
                    isShabbat: cur.getDay() === 6, isHoliday: false, holidayTitle: "",
                    isEmpty: true, override: 0, content: "", pages: 0,
                    isReviewDay: false, isSiyum: false, isMissed: false,
                });
            }
        }

        for (const day of schedule) {
            const d = new Date(day.date);
            d.setHours(0, 0, 0, 0);
            if (d < today) continue;
            if (d > nd) break;
            if (!shouldDayBeRest(d, trackSettings.studyDays, trackSettings.includeHolidays, trackSettings.includeBeinHazmanim, calendarEvents) && !day.isReviewDay) {
                day.book = n;
                day.isEmpty = false;
            }
        }
    }

    schedule.sort((a, b) => a.date - b.date);

    // ================================================================
    // PHASE 2: Single walk through all days, consuming from queues
    // ================================================================
    const extraPos = {}; // bookName -> position in extras array
    const lastContent = {};

    for (let i = 0; i < schedule.length; i++) {
        const day = schedule[i];
        const d = new Date(day.date);
        d.setHours(0, 0, 0, 0);

        // Past days: leave blank
        if (d < today) {
            if (day.book !== '-' && !day.isEmpty && !day.isReviewDay && !day.isRestDay) {
                day.content = "";
                day.pages = 0;
                day.isEmpty = true;
                day.isMissed = false;
            }
            continue;
        }

        if (day.book === '-' || day.isEmpty || day.isReviewDay || day.isRestDay) continue;

        const n = day.book;
        if (!bookInfo[n]) continue;

        const info = bookInfo[n], q = queues[n], s = strategies[n];
        if (q.length === 0) { day.content = "חזרה"; day.pages = 0; day.isEmpty = true; continue; }

        // Determine end date for squeeze calculations
        let endDate = null;
        if (s && s.strategy === 'move-target') endDate = s.newTargetDate ? new Date(s.newTargetDate) : null;
        else if (s && s.strategy === 'squeeze') endDate = info.targetDate ? new Date(info.targetDate) : null;
        else if (info.calcMethod === 'targetDate' && info.targetDate) endDate = new Date(info.targetDate);
        if (endDate) endDate.setHours(0, 0, 0, 0);

        // Compute baseline pace
        let baseline;
        if (endDate) {
            const daysLeft = countStudyDays(schedule, n, i, endDate, today);
            // If this book has an ideal (never-behind) tracker — i.e. it's on a
            // sprint/increase-pace catchup — base the pace on that instead of the
            // real queue, so "extra" is the only thing paying off the deficit.
            // Otherwise (no active catchup extra for this book) use the real queue,
            // exactly as the default schedule generator does.
            const remBase = idealRemaining[n] !== undefined ? idealRemaining[n] : q.length;
            baseline = daysLeft > 0 ? Math.ceil(remBase / daysLeft) : remBase;
        } else {
            baseline = Math.max(1, Math.ceil(info.paceValue * 2));
        }

        // Apply extra if in catchup period
        let total = baseline;
        if (s && extras[n]) {
            const pos = extraPos[n] || 0;
            if (pos < extras[n].length) {
                total = baseline + extras[n][pos];
                extraPos[n] = pos + 1;
            }
        }

        total = Math.min(total, q.length);
        if (total <= 0) { day.content = "חזרה"; day.pages = 0; day.isEmpty = true; continue; }

        if (endDate && idealRemaining[n] !== undefined) {
            const baselinePortion = Math.min(baseline, total);
            idealRemaining[n] = Math.max(0, idealRemaining[n] - baselinePortion);
        }

        const taken = q.splice(0, total);
        day.content = taken.length === 1
            ? indexToDaf(taken[0])
            : `${indexToDaf(taken[0])} - ${indexToDaf(taken[taken.length - 1])}`;
        day.pages = total / 2;
        day.isEmpty = false;
        lastContent[n] = i;
    }

    // ================================================================
    // PHASE 3: Extend pace-mode books with remaining queue
    // ================================================================
    schedule.sort((a, b) => a.date - b.date);
    let lastDate = schedule.length > 0 ? new Date(schedule[schedule.length - 1].date) : new Date(today);

    const nextBookStart = {};
    for (let b = 0; b < bookSequence.length; b++) {
        const n = typeof bookSequence[b] === 'string' ? bookSequence[b] : bookSequence[b].name;
        if (b < bookSequence.length - 1) {
            const nn = typeof bookSequence[b + 1] === 'string' ? bookSequence[b + 1] : bookSequence[b + 1].name;
            let s = null;
            for (let j = 0; j < schedule.length; j++) {
                if (schedule[j].book === nn && !schedule[j].isEmpty) {
                    s = new Date(schedule[j].date);
                    s.setHours(0, 0, 0, 0);
                    break;
                }
            }
            nextBookStart[n] = s;
        } else {
            nextBookStart[n] = null;
        }
    }

    for (const [n, info] of Object.entries(bookInfo)) {
        const q = queues[n];
        if (q.length === 0 || info.calcMethod === 'targetDate') continue;

        const s = strategies[n];
        if (s && (s.strategy === 'move-target' || s.strategy === 'squeeze')) continue;

        const pace = Math.max(1, Math.ceil(info.paceValue * 2)), ns = nextBookStart[n];
        let li = -1;
        for (let i = schedule.length - 1; i >= 0; i--) {
            const sd = schedule[i], dd = new Date(sd.date);
            dd.setHours(0, 0, 0, 0);
            if (sd.book === n && !sd.isEmpty && dd >= today) { li = i; break; }
        }

        if (q.length > 0) {
            for (let i = li + 1; i < schedule.length && q.length > 0; i++) {
                const day = schedule[i], dd = new Date(day.date);
                dd.setHours(0, 0, 0, 0);
                if (day.book !== '-' && day.book !== n && !day.isEmpty) continue;
                if (day.isRestDay || day.isReviewDay || shouldDayBeRest(dd, trackSettings.studyDays, trackSettings.includeHolidays, trackSettings.includeBeinHazmanim, calendarEvents)) continue;
                if (ns && dd >= ns) break;
                if (dd < today) continue;

                const a = Math.min(pace, q.length);
                const g = q.splice(0, a);
                day.book = n;
                day.isEmpty = false;
                day.content = g.length === 1 ? indexToDaf(g[0]) : `${indexToDaf(g[0])} - ${indexToDaf(g[g.length - 1])}`;
                day.pages = a / 2;
            }

            if (q.length > 0) {
                let cur = new Date(lastDate);
                while (q.length > 0) {
                    cur.setDate(cur.getDate() + 1);
                    if (ns && cur >= ns) break;

                    if (shouldDayBeRest(cur, trackSettings.studyDays, trackSettings.includeHolidays, trackSettings.includeBeinHazmanim, calendarEvents)) {
                        schedule.push({
                            date: new Date(cur), dateString: formatDateToIL(cur), book: "-",
                            isShabbat: cur.getDay() === 6, isHoliday: false, holidayTitle: "",
                            isEmpty: true, override: 0, content: "", pages: 0,
                            isReviewDay: false, isSiyum: false, isMissed: false,
                        });
                    } else {
                        const a = Math.min(pace, q.length);
                        const g = q.splice(0, a);
                        schedule.push({
                            date: new Date(cur), dateString: formatDateToIL(cur), book: n,
                            isShabbat: cur.getDay() === 6, isHoliday: false, holidayTitle: "",
                            isEmpty: false, override: 0,
                            content: g.length === 1 ? indexToDaf(g[0]) : `${indexToDaf(g[0])} - ${indexToDaf(g[g.length - 1])}`,
                            pages: a / 2, isReviewDay: false, isSiyum: false, isMissed: false,
                        });
                    }
                    lastDate = new Date(cur);
                }
            }
        }
    }

    // ================================================================
    // FINAL: Mark siyum
    // ================================================================
    schedule.sort((a, b) => a.date - b.date);
    for (const [n, idx] of Object.entries(lastContent)) {
        if (queues[n]?.length === 0) schedule[idx].isSiyum = true;
    }
    for (const n of Object.keys(bookInfo)) {
        if (lastContent[n]) continue;
        if (queues[n]?.length === 0) {
            for (let i = schedule.length - 1; i >= 0; i--) {
                if (schedule[i].book === n && !schedule[i].isEmpty) { schedule[i].isSiyum = true; break; }
            }
        }
    }

    return schedule;
}

export function computeProgressDeficit(bookSequence, baselineSchedule) {
    const todayStr = new Date().toISOString().split('T')[0];
    const books = {};
    let totalDeficit = 0, totalSurplus = 0;

    bookSequence.forEach((book, idx) => {
        const n = typeof book === 'string' ? book : book.name;
        const total = getTotalAmudim(n);
        const st = (typeof book === 'object' && book.amudStates) ? book.amudStates : [];
        const learned = st.filter(s => s === 1).length;
        const cl = st.filter(s => s === 2).length;
        const remaining = total - learned - cl;
        const tgt = typeof book === 'object' ? book.targetDate : null;
        const tgtPassed = tgt ? new Date(tgt) < new Date(todayStr) : false;

        let expected = 0;
        if (baselineSchedule) {
            for (const day of baselineSchedule) {
                if (day.dateString >= todayStr) break;
                if (day.book === n && !day.isEmpty && !day.isReviewDay) expected += Math.round((day.pages || 0) * 2);
            }
        }

        const deficit = expected - learned;
        const behind = deficit > 0, ahead = deficit < 0;

        let remDays = 0;
        if (baselineSchedule) {
            let c = false;
            for (const day of baselineSchedule) {
                if (day.dateString === todayStr) c = true;
                if (!c) continue;
                if (tgt && day.dateString > tgt) break;
                if (day.book === n && !day.isEmpty && !day.isRestDay && !day.isReviewDay) remDays++;
            }
        }

        books[idx] = {
            bookName: n, totalAmudim: total, learned, completeLater: cl,
            remainingAmudim: remaining, expected, deficit, isBehind: behind, isAhead: ahead,
            calcMethod: typeof book === 'object' ? book.calcMethod : 'pace',
            paceValue: typeof book === 'object' ? book.paceValue : 1,
            targetDate: tgt, targetDatePassed: tgtPassed, remainingStudyDays: remDays,
        };

        if (behind) totalDeficit += deficit;
        if (ahead) totalSurplus += Math.abs(deficit);
    });

    return { books, totalDeficit, totalSurplus, isAnyBehind: totalDeficit > 0, isAnyAhead: totalSurplus > 0 };
}

export function computeRemainingDays(baselineSchedule, bookName) {
    const todayStr = new Date().toISOString().split('T')[0];
    let study = 0, cal = 0, c = false;

    for (const day of baselineSchedule) {
        if (day.dateString === todayStr) c = true;
        if (!c) continue;
        cal++;
        if (day.book === bookName && !day.isEmpty && !day.isRestDay && !day.isReviewDay) study++;
    }

    return { remainingStudyDays: study, remainingCalendarDays: cal };
}