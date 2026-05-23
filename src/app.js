import { hebrewToNumber, numberToHebrew, formatGematria, formatHebrewMonthTitle, indexToDaf, formatDateToIL } from './utils.js';
import { masechtot, getTotalAmudim } from './data.js';
import { fetchCalendarEvents } from './api.js';
import { updateSequenceUI, toggleInputs, updateHebrewLabel, renderCalendar } from './ui.js';

let AppState = {
    sequence: [], // Keeps the masechet sequence list
    schedule: [], // Keeps the data of the entire schedule
    manualOverrides: {}, // Keeps all manual overrides of calendar days study status (0 = Default, 1 = Force Break, 2 = Force Study)
    calendarData: {} // Keeps data of special calendar events (DD.YY.MM)
}

/* 
    Page initiation logic
*/

// Setups all event listeners in the page
function setupEventListeners() {
    // Simple On-click Listeners
    document.getElementById('generateBtn').addEventListener('click', generate);
    document.getElementById('addToSequenceBtn').addEventListener('click', addToSequence);
    document.getElementById('clearSequenceBtn').addEventListener('click', clearSequence);
    document.getElementById('exportBtn').addEventListener('click', exportScheduleToExcel);
    document.getElementById('printBtn').addEventListener('click', () => {
        window.print();
    });

    // Other On-click Listeners
    // Handle removing from sequence
    document.getElementById('sequenceList').addEventListener('click', (event) => {
        // Check if the clicked element (or its parent) is our remove button
        const removeBtn = event.target.closest('.remove-btn');

        if (removeBtn) {
            // Grab the index from the data attribute (comes as string, convert to Number)
            const index = Number(removeBtn.dataset.index);
            removeFromSequence(index);
        }
    });

    // Calendar grid onClick
    document.getElementById('calendarContainer').addEventListener('click', (event) => {
        // Look for the closest element with the 'calendar-day' class
        const calendarDay = event.target.closest('.calendar-day');

        if (calendarDay && calendarDay.dataset.date) {
            const dateString = calendarDay.dataset.date;
            cycleDateOverride(dateString);
        }
    });

    // On-change Listeners
    document.getElementById('calcMethod').addEventListener('change', () => {
        toggleInputs();
    });

    document.getElementById('targetDateInput').addEventListener('change', (event) => {
        updateHebrewLabel(event.target, document.getElementById('targetDateHebrewLabel'));
    });

    document.getElementById('startDateInput').addEventListener('change', (event) => {
        updateHebrewLabel(event.target, document.getElementById('startDateHebrewLabel'));
    });

    document.getElementById('calendarType').addEventListener('change', () => {
        generate();
    });
}

// Initiate calendar configuration control panel
function initUserConfigPanel() {
    // 1. Populate Masechet dropdown select element
    const select = document.getElementById('masechetSelect');
    masechtot.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.innerText = m.name;
        select.appendChild(opt);
    });

    // 2. Set Today as default starting date
    const startDateInput = document.getElementById('startDateInput');
    startDateInput.valueAsDate = new Date();

    const startDateHebrewLabel = document.getElementById('startDateHebrewLabel');
    const targetDateHebrewLabel = document.getElementById('targetDateHebrewLabel');

    // Fix 1: Fire the label generator function immediately for the initial state
    updateHebrewLabel(startDateInput, startDateHebrewLabel);

    // 3. Attach standard Change Events for real-time label updates
    startDateInput.addEventListener('input', () => {
        updateHebrewLabel(startDateInput, startDateHebrewLabel);
    });

    const targetDateInput = document.getElementById('targetDateInput');
    targetDateInput.addEventListener('input', () => {
        updateHebrewLabel(targetDateInput, targetDateHebrewLabel);
    });

    // Fix 2: Toggling logic ensuring UI blocks clean up nicely
    const calcMethod = document.getElementById('calcMethod');
    const paceSection = document.getElementById('paceSection');
    const targetDateSection = document.getElementById('targetDateSection');

    calcMethod.addEventListener('change', () => {
        if (calcMethod.value === 'pace') {
            paceSection.classList.remove('hidden');
            targetDateSection.classList.add('hidden');
        } else {
            paceSection.classList.add('hidden');
            targetDateSection.classList.remove('hidden');
        }
    });
}

// Main page initiation function
function init() {
    console.log("HTML page initialized succesfully");

    setupEventListeners();

    window.addEventListener('load', initUserConfigPanel);
}

// Executes main initiation function upon page load
document.addEventListener('DOMContentLoaded', init);

// Calculates if a given date should be rest or study (pre-override)
function shouldDayBeRest(dateObj, includeShabbat, includeHolidays) {

    const dateString = formatDateToIL(dateObj);

    const day = AppState.calendarData[dateString];

    const traits = day?.traits || {};

    const isShabbatDay = dateObj.getDay() === 6;

    // Standard Chagim
    if (traits.isChag && !includeHolidays) {
        return true;
    }

    // Shabbat / Parasha
    if ((isShabbatDay || traits.isParasha) && !includeShabbat) {
        return true;
    }

    // Always study on Rosh Chodesh
    if (traits.isRoshChodesh) {
        return false;
    }

    // Always study on modern exceptions
    if (traits.isModernException) {
        return false;
    }

    return false;
}

/*
    Masechet sequence list logic
*/ 

// Adds the selected masechet into the Track's masechet sequence list
function addToSequence() {
    const val = document.getElementById('masechetSelect').value;
    AppState.sequence.push(val);
    updateSequenceUI(AppState.sequence);
}

// Removes the selected masechet from the Track's masechet sequence list
function removeFromSequence(index) {
    AppState.sequence.splice(index, 1);
    updateSequenceUI(AppState.sequence);
}

// Clears the entire sequence of masechtot from the Track's masechet sequence list
function clearSequence() {
    if (confirm("האם למחוק את כל המסכתות מהמסלול?")) {
        AppState.sequence = [];
        updateSequenceUI([]);
    }
}

// Generates the Track's study calendar
async function generate() {
    if (AppState.sequence.length === 0) return alert("נא להוסיף לפחות מסכת אחת למסלול");

    const includeShabbat = document.getElementById('includeShabbatInput').checked;
    const includeHolidays = document.getElementById('includeHolidaysInput').checked;
    const breakDays = parseInt(document.getElementById('breakDaysInput').value) || 0;
    const method = document.getElementById('calcMethod').value;
    const calendarType = document.getElementById('calendarType').value;

    AppState.schedule = [];

    const startDateValue = document.getElementById('startDateInput').value;
    if (!startDateValue) return alert("נא לבחור תאריך התחלה");

    const startInputDate = new Date(startDateValue);
    startInputDate.setHours(0, 0, 0, 0);

    // --- Step 1: Flatten All Amudim Into a Single Master Pool ---
    let masterAmudPool = [];
    let initialAmudOffset = 0;

    AppState.sequence.forEach((name, idx) => {
        let startIdx = 0;
        if (idx === 0) {
            const startDafHeb = document.getElementById('startDafInput').value.trim();
            if (startDafHeb) {
                startIdx = Math.max(0, (hebrewToNumber(startDafHeb) * 2) - 4);
                if (document.getElementById('startAmudSelect').value === "ב") startIdx += 1;
            }
            initialAmudOffset = startIdx;
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
        const targetDateInput = document.getElementById('targetDateInput').value;
        if (!targetDateInput) return alert("נא לבחור תאריך יעד");
        endYear = new Date(targetDateInput).getFullYear();
    } else {
        const dailyAmudimPace = Math.round(parseFloat(document.getElementById('paceInput').value) * 2);
        if (dailyAmudimPace > 0) {
            const estimatedStudyDays = Math.ceil(masterAmudPool.length / dailyAmudimPace);
            const totalStructuralBreakDays = breakDays * (AppState.sequence.length - 1);
            const totalProjectedDays = (estimatedStudyDays + totalStructuralBreakDays) * 1.4;

            const projectedEndDate = new Date(startInputDate);
            projectedEndDate.setDate(projectedEndDate.getDate() + Math.ceil(totalProjectedDays));
            endYear = projectedEndDate.getFullYear();
        } else {
            endYear = startYear + 1;
        }
    }

    for (let y = startYear - 1; y <= endYear + 1; y++) {
        await fetchCalendarEvents(y, AppState.calendarData);
    }

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
        AppState.schedule.push({
            date: new Date(tempDate), dateString: dStr, masechet: "-",
            isShabbat: tempDate.getDay() === 6, isHoliday: !!AppState.calendarData[dStr]?.displayText,
            holidayTitle: AppState.calendarData[dStr]?.displayText, isEmpty: true, content: "", pages: 0
        });
        tempDate.setDate(tempDate.getDate() + 1);
    }

    // --- Step 4: Build the Strict Timeline Map ---
    let timelineDays = [];
    let currentDate = new Date(startInputDate);

    if (method === 'targetDate') {
        const targetDateInput = document.getElementById('targetDateInput').value;
        const endDate = new Date(targetDateInput);
        endDate.setHours(0, 0, 0, 0);

        if (endDate < startInputDate) return alert("תאריך היעד חייב להיות אחרי תאריך ההתחלה");

        while (currentDate <= endDate) {
            const dateString = formatDateToIL(currentDate);
            const overrideState = AppState.manualOverrides[dateString] || 0;
            let isRestDay = (overrideState === 1) || (overrideState !== 2 && shouldDayBeRest(currentDate, includeShabbat, includeHolidays));

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

        // Account for structural inter-masechet break days inside target window
        let estimatedBreaksCount = breakDays * (AppState.sequence.length - 1);
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
        if (trueStudyDays.length === 0) return alert("אין מספיק ימי לימוד בטווח התאריכים המבוקש");

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
        const dailyAmudimPace = Math.round(parseFloat(document.getElementById('paceInput').value) * 2);

        while (amudPoolCopy.length > 0) {
            const dateString = formatDateToIL(currentDate);
            const overrideState = AppState.manualOverrides[dateString] || 0;
            let isRestDay = (overrideState === 1) || (overrideState !== 2 && shouldDayBeRest(currentDate, includeShabbat, includeHolidays));

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
        const traits = AppState.calendarData[day.dateString]?.traits || {};

        let dayData = {
            date: day.date,
            dateString: day.dateString,
            masechet: "-",
            isShabbat: isShabbat || traits.isParasha,
            isHoliday: !!AppState.calendarData[day.dateString]?.displayText,
            holidayTitle: AppState.calendarData[day.dateString]?.displayText || "",
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

        AppState.schedule.push(dayData);
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
            AppState.schedule.push({
                date: new Date(runnerDate), dateString: ds, masechet: "-",
                isShabbat: runnerDate.getDay() === 6, isHoliday: !!AppState.calendarData[ds]?.displayText,
                holidayTitle: AppState.calendarData[ds]?.displayText, isEmpty: true, content: "", pages: 0
            });
        }
    }

    renderCalendar('calendarContainer', AppState.schedule, {
        calendarType: calendarType,
        overrides: AppState.manualOverrides
    });
    document.getElementById('output').classList.remove('hidden');
}

// Cycles the date's manual schedule override: Default -> Force Break -> Force Study -> Reset.
function cycleDateOverride(dateString) {
    const current = AppState.manualOverrides[dateString] || 0;

    // Cycle logic: 0 -> 1 -> 2 -> 0
    const next = (current + 1) % 3;

    if (next === 0) {
        delete AppState.manualOverrides[dateString];
    } else {
        AppState.manualOverrides[dateString] = next;
    }

    generate();
}


// Generates an RTL grid-structured workbook and downloads the schedule as an Excel file.
async function exportScheduleToExcel() {
    if (!AppState.schedule || AppState.schedule.length === 0) return alert("יש ליצור לוח לימוד קודם");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('תכנית לימוד', {
        views: [{ rightToLeft: true }]
    });

    const calendarType = document.getElementById('calendarType').value;
    const RTL_MARK = '\u200F';
    worksheet.columns = Array(7).fill({ width: 25 });

    let currentRow = 1;

    // Group schedule array records by their formatted Hebrew or Gregorian month string tokens
    const months = {};
    AppState.schedule.forEach(day => {
        let monthName = (calendarType === 'hebrew')
            ? formatHebrewMonthTitle(day.date)
            : day.date.toLocaleString('he-IL', { month: 'long', year: 'numeric' });

        if (!months[monthName]) months[monthName] = [];
        months[monthName].push(day);
    });

    // Build the structural grid UI month-by-month inside the spreadsheet
    for (const [monthName, days] of Object.entries(months)) {
        // 1. Render Top Banner Header Box
        worksheet.mergeCells(currentRow, 1, currentRow, 7);
        const titleCell = worksheet.getCell(currentRow, 1);
        titleCell.value = RTL_MARK + monthName;
        titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(currentRow).height = 30;
        currentRow++;

        // 2. Render Weekdays Sub-header Bar (Sunday -> Saturday)
        const daysHeader = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
        daysHeader.forEach((d, i) => {
            const cell = worksheet.getCell(currentRow, i + 1);
            cell.value = RTL_MARK + d;
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
            cell.alignment = { horizontal: 'center' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        currentRow++;

        let weekRow = currentRow;

        // 3. Render Empty Padding Cells for Offset Leading Days
        const firstDayInMonth = days[0].date.getDay();
        for (let i = 0; i < firstDayInMonth; i++) {
            const cell = worksheet.getCell(weekRow, i + 1);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }

        // 4. Populate Matrix Grid Content Items
        days.forEach(day => {
            const col = (day.date.getDay() + 1);
            const cell = worksheet.getCell(weekRow, col);

            let mainDate, secDate;
            const hebrewDayNum = parseInt(new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' }).format(day.date));

            if (calendarType === 'hebrew') {
                mainDate = numberToHebrew(hebrewDayNum);
                secDate = day.date.getDate() + "." + (day.date.getMonth() + 1);
            } else {
                mainDate = day.date.getDate();
                secDate = numberToHebrew(hebrewDayNum);
            }

            let cellContent = `${RTL_MARK}${mainDate} (${secDate})\n`;

            if (!day.isEmpty) {
                cellContent += `${RTL_MARK}${day.masechet}\n${RTL_MARK}${day.content}`;
            } else if (day.override === 1) {
                cellContent += `${RTL_MARK}הפסקה`;
            } else if (day.holidayTitle) {
                cellContent += `${RTL_MARK}${day.holidayTitle}`;
            } else if (day.content) {
                cellContent += `${RTL_MARK}${day.content}`;
            }

            cell.value = cellContent;
            cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center', readingOrder: 2 };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            // Apply contextual color highlights based on scheduling type overrides
            if (day.override === 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } }; // Force Break
            } else if (day.override === 2) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF5FF' } }; // Force Study
            } else if (day.isShabbat) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBE6F3' } }; // Shabbat
            } else if (day.isHoliday) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9EFD5' } }; // Holidays
            }

            // Set default cell grid row bounds dimension structure mapping safely
            worksheet.getRow(weekRow).height = 65;

            if (col === 7) {
                weekRow++;
            }
        });

        // FIX: If the month ended on any day except Saturday, ensure we push the pointer to the next row anyway
        if (days[days.length - 1].date.getDay() !== 6) {
            weekRow++;
        }

        currentRow = weekRow + 2; // Leave spacing before starting the next calendar block layout
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'עיתים_תכנית_לימוד.xlsx');
}