import { hebrewToNumber, numberToHebrew, formatGematria, formatHebrewMonthTitle, indexToDaf, formatDateToIL } from './utils.js';
import { masechtot, getTotalAmudim } from './data.js';
import { fetchCalendarEvents } from './api.js';
import { updateSequenceUI, toggleInputs, updateHebrewLabel, renderCalendar } from './ui.js';

let sequence = []; // Keeps the masechet sequence list
let schedule = []; // Keeps the data of the entire schedule
let manualOverrides = {}; // Keeps track of all manual overrides of calendar days (0 = Default, 1 = Force Break, 2 = Force Study)
let calendarEventsData = {}; // Keeps titles intact for rendering
let dayTypesData = {};  // Holds structural traits for schedule calculations

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
    const traits = dayTypesData[dateString] || {};
    const isShabbatDay = dateObj.getDay() === 6;

    // Rule 4: Standard Chagim -> Controlled by includeHolidays setting
    if (traits.isChag && !includeHolidays) return true;
    
    // Rule 1: Shabbat or Parashat dates -> Controlled by includeShabbat setting
    if ((isShabbatDay || traits.isParasha) && !includeShabbat) return true;

    // Rule 3: Rosh Chodesh -> Always Study (Never Rest)
    if (traits.isRoshChodesh) return false;

    // Rule 5: Modern Exceptions -> Always Study (Never Rest)
    if (traits.isModernException) return false;
    
    // Default catch-all: Keep studying
    return false;
}

/*
    Masechet sequence list logic
*/ 

// Adds the selected masechet into the Track's masechet sequence list
function addToSequence() {
    const val = document.getElementById('masechetSelect').value;
    sequence.push(val);
    updateSequenceUI(sequence);
}

// Removes the selected masechet from the Track's masechet sequence list
function removeFromSequence(index) {
    sequence.splice(index, 1);
    updateSequenceUI(sequence);
}

// Clears the entire sequence of masechtot from the Track's masechet sequence list
function clearSequence() {
    if (confirm("האם למחוק את כל המסכתות מהמסלול?")) {
        sequence = [];
        updateSequenceUI([]);
    }
}

// Generates the Track's study calendar
async function generate() {
    if (sequence.length === 0) return alert("נא להוסיף לפחות מסכת אחת למסלול");

    const includeShabbat = document.getElementById('includeShabbatInput').checked;
    const includeHolidays = document.getElementById('includeHolidaysInput').checked;
    const breakDays = parseInt(document.getElementById('breakDaysInput').value) || 0;
    const method = document.getElementById('calcMethod').value;
    const calendarType = document.getElementById('calendarType').value;

    schedule = [];

    const startDateValue = document.getElementById('startDateInput').value;
    if (!startDateValue) return alert("נא לבחור תאריך התחלה");

    const startInputDate = new Date(startDateValue);
    startInputDate.setHours(0, 0, 0, 0);

    // --- Step 1: Calculate Total Amudim ---
    let totalAmudimInSequence = 0;
    let initialAmudOffset = 0;

    sequence.forEach((name, idx) => {
        let startIdx = 0;
        if (idx === 0) {
            const startDafHeb = document.getElementById('startDafInput').value.trim();
            if (startDafHeb) {
                startIdx = Math.max(0, (hebrewToNumber(startDafHeb) * 2) - 4);
                if (document.getElementById('startAmudSelect').value === "ב") startIdx += 1;
            }
            initialAmudOffset = startIdx;
        }
        totalAmudimInSequence += (getTotalAmudim(name) - (idx === 0 ? startIdx : 0));
    });

    // --- Step 2: Fetch Calendar Events dynamically based on actual schedule span ---
    const startYear = startInputDate.getFullYear();
    let endYear = startYear;

    if (method === 'targetDate') {
        const targetDateInput = document.getElementById('targetDateInput').value;
        if (!targetDateInput) return alert("נא לבחור תאריך יעד");
        endYear = new Date(targetDateInput).getFullYear();
    } else {
        const dailyAmudimPace = Math.round(parseFloat(document.getElementById('paceInput').value) * 2);

        if (dailyAmudimPace > 0) {
            // Est. study days needed (total amudim / daily pace)
            const estimatedStudyDays = Math.ceil(totalAmudimInSequence / dailyAmudimPace);

            // Factor in structural break days between tractates
            const totalStructuralBreakDays = breakDays * (sequence.length - 1);

            // Rough multiplier (e.g., 1.4) to account for skipped Shabbats/Holidays inflating the timeline
            const totalProjectedDays = (estimatedStudyDays + totalStructuralBreakDays) * 1.4;

            // Calculate project end date object to extract its calendar year
            const projectedEndDate = new Date(startInputDate);
            projectedEndDate.setDate(projectedEndDate.getDate() + Math.ceil(totalProjectedDays));
            endYear = projectedEndDate.getFullYear();
        } else {
            endYear = startYear + 1; // Fallback safety
        }
    }

    // Pad fetching by 1 year on both sides to prevent any timezone/boundary overlap issues
    for (let y = startYear - 1; y <= endYear + 1; y++) {
        await fetchCalendarEvents(y, calendarEventsData, dayTypesData);
    }

    // --- Step 3: Handle Target Date Mode Map Allocation ---
    let studyDaysSequence = []; // Will hold an object for every valid study day

    if (method === 'targetDate') {
        const targetDateInput = document.getElementById('targetDateInput').value;
        const endDate = new Date(targetDateInput);
        endDate.setHours(0, 0, 0, 0);

        if (endDate < startInputDate) return alert("תאריך היעד חייב להיות אחרי תאריך ההתחלה");

        // 1st Pass: Discover every calendar date that qualifies for study
        let scanDate = new Date(startInputDate);
        while (scanDate <= endDate) {
            const dateString = formatDateToIL(scanDate);
            const overrideState = manualOverrides[dateString] || 0;
            let isRestDay = (overrideState === 1) || (overrideState !== 2 && shouldDayBeRest(scanDate, includeShabbat, includeHolidays));

            if (!isRestDay) {
                studyDaysSequence.push({
                    dateString: dateString,
                    amudimToLearn: 0 // Will fill this in a second
                });
            }
            scanDate.setDate(scanDate.getDate() + 1);
        }

        // Account for structural inter-masechet break days by removing them from total study pooling
        const totalBreakDays = breakDays * (sequence.length - 1);
        let actualStudyDaysCount = studyDaysSequence.length - totalBreakDays;

        if (actualStudyDaysCount <= 0) return alert("אין מספיק ימי לימוד בטווח התאריכים המבוקש");

        // Mathematical Distribution Strategy (Matches your exact logic)
        let baseAmudimPerDay = Math.floor(totalAmudimInSequence / actualStudyDaysCount);
        let leftoverAmudim = totalAmudimInSequence % actualStudyDaysCount;

        // Populate study array from left to right with base floor rate
        // Skip trailing slots that will be overwritten as inter-masechet breaks during generation pass
        let assignCount = 0;
        for (let i = 0; i < studyDaysSequence.length; i++) {
            studyDaysSequence[i].amudimToLearn = baseAmudimPerDay;
        }

        // Add 1 amud to the endmost available study days for the remainder distribution
        // This spreads the remainder safely backward from the final target day
        let distributedLeftovers = 0;
        for (let i = studyDaysSequence.length - 1; i >= 0; i--) {
            if (distributedLeftovers >= leftoverAmudim) break;
            studyDaysSequence[i].amudimToLearn += 1;
            distributedLeftovers++;
        }
    }

    // --- Step 4: Front Padding ---
    let tempDate = new Date(startInputDate);
    if (calendarType === 'hebrew') {
        while (parseInt(new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' }).format(tempDate)) > 1) {
            tempDate.setDate(tempDate.getDate() - 1);
        }
    } else {
        tempDate.setDate(1);
    }
    let paddingDate = new Date(tempDate);
    while (paddingDate < startInputDate) {
        const dStr = formatDateToIL(paddingDate);
        schedule.push({
            date: new Date(paddingDate), dateString: dStr, masechet: "-",
            isShabbat: paddingDate.getDay() === 6, isHoliday: !!calendarEventsData[dStr],
            holidayTitle: calendarEventsData[dStr], isEmpty: true, content: "", pages: 0
        });
        paddingDate.setDate(paddingDate.getDate() + 1);
    }

    // --- Step 5: Process Main Sequence Mapping ---
    let currentDate = new Date(startInputDate);
    let studyDayPointer = 0;

    for (let mIdx = 0; mIdx < sequence.length; mIdx++) {
        const masechetName = sequence[mIdx];
        const totalMasechetAmudim = getTotalAmudim(masechetName);
        let currentAmud = (mIdx === 0) ? initialAmudOffset : 0;

        while (currentAmud < totalMasechetAmudim) {
            const dateString = formatDateToIL(currentDate);
            const isShabbat = currentDate.getDay() === 6;
            const overrideState = manualOverrides[dateString] || 0;
            const traits = dayTypesData[dateString] || {};
            let isNonStudyDay = (overrideState === 1) || (overrideState !== 2 && shouldDayBeRest(currentDate, includeShabbat, includeHolidays));

            const dayData = {
                date: new Date(currentDate), dateString: dateString, masechet: masechetName,
                isShabbat: isShabbat || traits.isParasha, isHoliday: !!calendarEventsData[dateString],
                holidayTitle: calendarEventsData[dateString] || "", isEmpty: isNonStudyDay, override: overrideState
            };

            if (isNonStudyDay) {
                dayData.content = (overrideState === 1) ? "הפסקה" : "";
                dayData.pages = 0;
            } else {
                let amudimToLearnToday = 0;

                if (method === 'targetDate') {
                    // Extract precalculated distribution array value 
                    amudimToLearnToday = studyDaysSequence[studyDayPointer] ? studyDaysSequence[studyDayPointer].amudimToLearn : 0;
                    studyDayPointer++;
                } else {
                    amudimToLearnToday = Math.round(parseFloat(document.getElementById('paceInput').value) * 2);
                }

                let end = Math.min(currentAmud + amudimToLearnToday, totalMasechetAmudim);
                dayData.content = (currentAmud === end) ? "חזרה" : `${indexToDaf(currentAmud)} - ${indexToDaf(end - 1)}`;
                dayData.pages = (end - currentAmud) / 2;
                currentAmud = end;
            }

            schedule.push(dayData);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Inter-masechet breaks allocation tracking
        if (mIdx < sequence.length - 1 && breakDays > 0) {
            for (let i = 0; i < breakDays; i++) {
                const dStr = formatDateToIL(currentDate);
                const overrideState = manualOverrides[dStr] || 0;
                let isRestDay = (overrideState === 1) || (overrideState !== 2 && shouldDayBeRest(currentDate, includeShabbat, includeHolidays));

                // If a break day falls on a natural non-study day anyway, don't waste an active pointer index count on it
                if (!isRestDay && method === 'targetDate') {
                    studyDayPointer++;
                }

                schedule.push({
                    date: new Date(currentDate), dateString: dStr, masechet: "הפסקה",
                    isShabbat: currentDate.getDay() === 6, isHoliday: !!calendarEventsData[dStr],
                    holidayTitle: calendarEventsData[dStr] || "", isEmpty: true, content: "", pages: 0
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }
    }

    // --- Step 6: Back Padding ---
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

    let lastDay = schedule[schedule.length - 1];
    if (lastDay) {
        let runnerDate = new Date(lastDay.date);
        while (!isEndOfMonth(runnerDate)) {
            runnerDate.setDate(runnerDate.getDate() + 1);
            const ds = formatDateToIL(runnerDate);
            schedule.push({
                date: new Date(runnerDate), dateString: ds, masechet: "-",
                isShabbat: runnerDate.getDay() === 6, isHoliday: !!calendarEventsData[ds],
                holidayTitle: calendarEventsData[ds], isEmpty: true, content: "", pages: 0
            });
        }
    }

    renderCalendar('calendarContainer', schedule, {
        calendarType: calendarType,
        overrides: manualOverrides
    });
    document.getElementById('output').classList.remove('hidden');
}

// Cycles the date's manual schedule override: Default -> Force Break -> Force Study -> Reset.
function cycleDateOverride(dateString) {
    // Cycle: 0 (default) -> 1 (force break) -> 2 (force study) -> 0...
    if (!manualOverrides[dateString]) {
        manualOverrides[dateString] = 1;
    } else if (manualOverrides[dateString] === 1) {
        manualOverrides[dateString] = 2;
    } else {
        delete manualOverrides[dateString];
    }

    generate();
}

// Generates an RTL grid-structured workbook and downloads the schedule as an Excel file.
async function exportScheduleToExcel() {
    if (!schedule || schedule.length === 0) return alert("יש ליצור לוח לימוד קודם");

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
    schedule.forEach(day => {
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