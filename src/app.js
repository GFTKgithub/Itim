import { numberToHebrew, formatHebrewMonthTitle } from './utils.js';
import { masechtot } from './data.js';
import { hydrateHtmlFromAppState, toggleInputs, updateTrackSequenceUI, renderDateLabels, renderCalendar } from './ui.js';
import { addToSequence, removeFromSequence, clearSequence } from './track-sequence.js';
import { generateSchedule, cycleDateOverride } from './scheduler.js';
import { initPersistence, saveToLocalStorage, loadFromLocalStorage, exportStateBackup, importStateBackup } from './persistence.js';

let AppState = {
    trackSequence: [],      // Masechet sequence list
    schedule: [],           // Data of the entire schedule
    manualOverrides: {},    // Manual overrides of calendar days study status (0 = Default, 1 = Force Break, 2 = Force Study)
    calendarData: {},       // Data of special calendar events (DD.YY.MM)
    userSettings: {         // User Settings (with default values)
        includeShabbat: true,
        includeHolidays: false,
        startDate: new Date().toISOString().split('T')[0],
        targetDate: '',
        startDaf: 'ב',
        startAmud: 'א',
        pace: 1,
        breakDays: 0,
        method: 'pace',
        calendarType: 'hebrew'
    }
}

/* 
    Page initiation logic
*/

// Setups all event listeners in the page
function setupEventListeners() {
    // Cache DOM elements up front to prevent repeated DOM queries
    const generateBtn = document.getElementById('generateBtn');
    const addToSequenceBtn = document.getElementById('addToSequenceBtn');
    const clearSequenceBtn = document.getElementById('clearSequenceBtn');

    const exportBtn = document.getElementById('exportToExcelBtn');
    const printBtn = document.getElementById('printBtn');
    const sequenceList = document.getElementById('trackSequenceList');
    const calendarContainer = document.getElementById('calendarContainer');

    const backupExportBtn = document.getElementById('backupExportBtn');
    const backupImportBtn = document.getElementById('backupImportBtn');
    const backupFileInput = document.getElementById('backupFileInput');

    // User settings elements
    const calcMethod = document.getElementById('calcMethod');
    const calendarType = document.getElementById('calendarType');
    const includeShabbatInput = document.getElementById('includeShabbatInput');
    const includeHolidaysInput = document.getElementById('includeHolidaysInput');
    const breakDaysInput = document.getElementById('breakDaysInput');
    const startDateInput = document.getElementById('startDateInput');
    const targetDateInput = document.getElementById('targetDateInput');
    const paceInput = document.getElementById('paceInput');
    const startDafInput = document.getElementById('startDafInput');
    const startAmudInput = document.getElementById('startAmudInput');

    // --- Action Listeners ---
    // generateBtn.addEventListener('click', generate);
    generateBtn.addEventListener('click', handleScheduleGeneration);

    addToSequenceBtn.addEventListener('click', () => {
        AppState.trackSequence = addToSequence(AppState.trackSequence);
        saveToLocalStorage();
    });

    clearSequenceBtn.addEventListener('click', () => 
    {
        AppState.trackSequence = clearSequence(AppState.trackSequence);
        saveToLocalStorage();
    });
    
    exportBtn.addEventListener('click', exportScheduleToExcel);
    printBtn.addEventListener('click', () => window.print());

    // --- Backup Action Listeners ---
    backupExportBtn.addEventListener('click', exportStateBackup);

    // Clicking our styled button triggers the hidden file input
    backupImportBtn.addEventListener('click', () => backupFileInput.click());

    // When a file is chosen, pass the event to your import function
    backupFileInput.addEventListener('change', importStateBackup);

    // --- Event Delegation ---
    sequenceList.addEventListener('click', (event) => {
        const removeBtn = event.target.closest('.remove-btn');
        if (removeBtn) {
            AppState.trackSequence = removeFromSequence(AppState.trackSequence, Number(removeBtn.dataset.index));
            saveToLocalStorage();
        }
    });

    calendarContainer.addEventListener('click', (event) => {
        const calendarDay = event.target.closest('.calendar-day');
        if (calendarDay?.dataset.date) {
            cycleDateOverride(calendarDay.dataset.date);
        }
    });

    // --- App Settings Sync Listeners ---
    calcMethod.addEventListener('change', (e) => {
        AppState.userSettings.method = e.target.value;
        toggleInputs();
        saveToLocalStorage();
    });

    calendarType.addEventListener('change', (e) => {
        AppState.userSettings.calendarType = e.target.value;
        // generate();
        handleScheduleGeneration();
        saveToLocalStorage();
    });

    includeShabbatInput.addEventListener('change', (e) => {
        AppState.userSettings.includeShabbat = e.target.checked;
        saveToLocalStorage();
    });

    includeHolidaysInput.addEventListener('change', (e) => {
        AppState.userSettings.includeHolidays = e.target.checked;
        saveToLocalStorage();
    });

    breakDaysInput.addEventListener('input', (e) => {
        AppState.userSettings.breakDays = parseInt(e.target.value, 10) || 0;
        saveToLocalStorage();
    });

    startDafInput.addEventListener('change', (e) => {
        AppState.userSettings.startDaf = e.target.value;
        saveToLocalStorage();
    });

    startAmudInput.addEventListener('change', (e) => {
        AppState.userSettings.startAmud = e.target.value;
        saveToLocalStorage();
    });

    paceInput.addEventListener('change', (e) => {
        AppState.userSettings.pace = e.target.value;
        saveToLocalStorage();
    })

    // --- Date Inputs Sync ---
    const handleDateChange = () => {
        AppState.userSettings.startDate = startDateInput.value;
        AppState.userSettings.targetDate = targetDateInput.value;
        renderDateLabels(AppState.userSettings.startDate, AppState.userSettings.targetDate);
        saveToLocalStorage();
    };

    startDateInput.addEventListener('change', handleDateChange);
    targetDateInput.addEventListener('change', handleDateChange);
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

    hydrateHtmlFromAppState(AppState);

    toggleInputs();
    renderDateLabels(AppState.userSettings.startDate, AppState.userSettings.targetDate);

    updateTrackSequenceUI(AppState.trackSequence);

    if (AppState.trackSequence.length > 0) {
        // generate();
        handleScheduleGeneration();
    }
}

// Main page initiation function
function init() {
    console.log("HTML page initialized succesfully");

    initPersistence(AppState);

    loadFromLocalStorage();

    setupEventListeners();

    window.addEventListener('load', initUserConfigPanel);
}

// Executes main initiation function upon page load
document.addEventListener('DOMContentLoaded', init);

//
async function handleScheduleGeneration() {
    try {
        // 1. Core Logic Pipeline Execution (Independent calculation)
        const updatedSchedule = await generateSchedule({
            trackSequence: AppState.trackSequence,
            userSettings: AppState.userSettings,
            manualOverrides: AppState.manualOverrides,
            calendarData: AppState.calendarData
        });

        // 2. Synchronize calculated timeline back into internal state 
        AppState.schedule = updatedSchedule;

        // 3. Command interface rendering safely down inside the UI engine layer
        renderCalendar('calendarContainer', AppState.schedule, {
            calendarType: AppState.userSettings.calendarType,
            overrides: AppState.manualOverrides
        });

        // Reveal view component wrapper
        document.getElementById('output').classList.remove('hidden');

    } catch (error) {
        // Pure error handler catch boundary interface logic
        alert(error.message);
    }
}

// Generates the Track's study calendar
// async function generate() {
//     if (AppState.trackSequence.length === 0) return alert("נא להוסיף לפחות מסכת אחת למסלול");

//     const includeShabbat = AppState.userSettings.includeShabbat;
//     const includeHolidays = AppState.userSettings.includeHolidays;
//     const breakDays = AppState.userSettings.breakDays;
//     const method = AppState.userSettings.method;
//     const calendarType = AppState.userSettings.calendarType;

//     AppState.schedule = [];

//     const startDateValue = AppState.userSettings.startDate;
//     if (!startDateValue) return alert("נא לבחור תאריך התחלה");

//     const startInputDate = new Date(startDateValue);
//     startInputDate.setHours(0, 0, 0, 0);

//     // --- Step 1: Flatten All Amudim Into a Single Master Pool ---
//     let masterAmudPool = [];
//     let initialAmudOffset = 0;

//     AppState.trackSequence.forEach((name, idx) => {
//         let startIdx = 0;
//         if (idx === 0) {
//             const startDafHeb = AppState.userSettings.startDaf.trim();
//             if (startDafHeb) {
//                 startIdx = Math.max(0, (hebrewToNumber(startDafHeb) * 2) - 4);
//                 if (AppState.userSettings.startAmud === "ב") startIdx += 1;
//             }
//             initialAmudOffset = startIdx;
//         }

//         const totalAmudim = getTotalAmudim(name);
//         for (let i = startIdx; i < totalAmudim; i++) {
//             masterAmudPool.push({ masechet: name, amudIdx: i });
//         }
//     });

//     // --- Step 2: Fetch Calendar Events ---
//     const startYear = startInputDate.getFullYear();
//     let endYear = startYear;

//     if (method === 'targetDate') {
//         const targetDateInput = AppState.userSettings.targetDate;
//         if (!targetDateInput) return alert("נא לבחור תאריך יעד");
//         endYear = new Date(targetDateInput).getFullYear();
//     } else {
//         const dailyAmudimPace = Math.round(parseFloat(AppState.userSettings.pace) * 2);
//         if (dailyAmudimPace > 0) {
//             const estimatedStudyDays = Math.ceil(masterAmudPool.length / dailyAmudimPace);
//             const totalStructuralBreakDays = breakDays * (AppState.trackSequence.length - 1);
//             const totalProjectedDays = (estimatedStudyDays + totalStructuralBreakDays) * 1.4;

//             const projectedEndDate = new Date(startInputDate);
//             projectedEndDate.setDate(projectedEndDate.getDate() + Math.ceil(totalProjectedDays));
//             endYear = projectedEndDate.getFullYear();
//         } else {
//             endYear = startYear + 1;
//         }
//     }

//     for (let y = startYear - 1; y <= endYear + 1; y++) {
//         await fetchCalendarEvents(y, AppState.calendarData);
//     }

//     // --- Step 3: Build Front Padding First ---
//     let tempDate = new Date(startInputDate);
//     if (calendarType === 'hebrew') {
//         while (parseInt(new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' }).format(tempDate)) > 1) {
//             tempDate.setDate(tempDate.getDate() - 1);
//         }
//     } else {
//         tempDate.setDate(1);
//     }

//     while (tempDate < startInputDate) {
//         const dStr = formatDateToIL(tempDate);
//         AppState.schedule.push({
//             date: new Date(tempDate), dateString: dStr, masechet: "-",
//             isShabbat: tempDate.getDay() === 6, isHoliday: !!AppState.calendarData[dStr]?.displayText,
//             holidayTitle: AppState.calendarData[dStr]?.displayText, isEmpty: true, content: "", pages: 0
//         });
//         tempDate.setDate(tempDate.getDate() + 1);
//     }

//     // --- Step 4: Build the Strict Timeline Map ---
//     let timelineDays = [];
//     let currentDate = new Date(startInputDate);

//     if (method === 'targetDate') {
//         const targetDateInput = AppState.userSettings.targetDate;
//         const endDate = new Date(targetDateInput);
//         endDate.setHours(0, 0, 0, 0);

//         if (endDate < startInputDate) return alert("תאריך היעד חייב להיות אחרי תאריך ההתחלה");

//         while (currentDate <= endDate) {
//             const dateString = formatDateToIL(currentDate);
//             const overrideState = AppState.manualOverrides[dateString] || 0;
//             let isRestDay = (overrideState === 1) || (overrideState !== 2 && shouldDayBeRest(currentDate, includeShabbat, includeHolidays, AppState.calendarData));

//             timelineDays.push({
//                 date: new Date(currentDate),
//                 dateString: dateString,
//                 isRestDay: isRestDay,
//                 isBreakDay: false,
//                 isStudyDay: !isRestDay,
//                 overrideState: overrideState,
//                 amudimToCount: 0
//             });
//             currentDate.setDate(currentDate.getDate() + 1);
//         }

//         // Account for structural inter-masechet break days inside target window
//         let estimatedBreaksCount = breakDays * (AppState.trackSequence.length - 1);
//         let activeStudyDays = timelineDays.filter(d => d.isStudyDay);
//         let actualStudyDaysCount = activeStudyDays.length - estimatedBreaksCount;

//         if (actualStudyDaysCount <= 0) {
//             actualStudyDaysCount = activeStudyDays.length;
//         } else {
//             let breakConverted = 0;
//             for (let i = timelineDays.length - 1; i >= 0; i--) {
//                 if (breakConverted >= estimatedBreaksCount) break;
//                 if (timelineDays[i].isStudyDay) {
//                     timelineDays[i].isStudyDay = false;
//                     timelineDays[i].isBreakDay = true;
//                     breakConverted++;
//                 }
//             }
//         }

//         let trueStudyDays = timelineDays.filter(d => d.isStudyDay);
//         if (trueStudyDays.length === 0) return alert("אין מספיק ימי לימוד בטווח התאריכים המבוקש");

//         let baseAmudimPerDay = Math.floor(masterAmudPool.length / trueStudyDays.length);
//         let leftoverAmudim = masterAmudPool.length % trueStudyDays.length;

//         trueStudyDays.forEach(d => d.amudimToCount = baseAmudimPerDay);

//         let distributedLeftovers = 0;
//         for (let i = trueStudyDays.length - 1; i >= 0; i--) {
//             if (distributedLeftovers >= leftoverAmudim) break;
//             trueStudyDays[i].amudimToCount += 1;
//             distributedLeftovers++;
//         }
//     } else {
//         // Pace Mode
//         let amudPoolCopy = [...masterAmudPool];
//         const dailyAmudimPace = Math.round(parseFloat(AppState.userSettings.pace) * 2);

//         while (amudPoolCopy.length > 0) {
//             const dateString = formatDateToIL(currentDate);
//             const overrideState = AppState.manualOverrides[dateString] || 0;
//             let isRestDay = (overrideState === 1) || (overrideState !== 2 && shouldDayBeRest(currentDate, includeShabbat, includeHolidays, AppState.calendarData));

//             timelineDays.push({
//                 date: new Date(currentDate),
//                 dateString: dateString,
//                 isRestDay: isRestDay,
//                 isBreakDay: false,
//                 isStudyDay: !isRestDay,
//                 overrideState: overrideState,
//                 amudimToCount: isRestDay ? 0 : dailyAmudimPace
//             });

//             if (!isRestDay) {
//                 let drained = amudPoolCopy.splice(0, dailyAmudimPace);
//                 if (drained.length > 0 && amudPoolCopy.length > 0 && drained[drained.length - 1].masechet !== amudPoolCopy[0].masechet) {
//                     for (let b = 0; b < breakDays; b++) {
//                         currentDate.setDate(currentDate.getDate() + 1);
//                         const bStr = formatDateToIL(currentDate);
//                         timelineDays.push({
//                             date: new Date(currentDate), dateString: bStr,
//                             isRestDay: false, isBreakDay: true, isStudyDay: false, overrideState: 0, amudimToCount: 0
//                         });
//                     }
//                 }
//             }
//             currentDate.setDate(currentDate.getDate() + 1);
//         }
//     }

//     // --- Step 5: Process Main Timeline Mapping ---
//     let amudPointer = 0;

//     timelineDays.forEach(day => {
//         const isShabbat = day.date.getDay() === 6;
//         const traits = AppState.calendarData[day.dateString]?.traits || {};

//         let dayData = {
//             date: day.date,
//             dateString: day.dateString,
//             masechet: "-",
//             isShabbat: isShabbat || traits.isParasha,
//             isHoliday: !!AppState.calendarData[day.dateString]?.displayText,
//             holidayTitle: AppState.calendarData[day.dateString]?.displayText || "",
//             isEmpty: day.isRestDay || day.isBreakDay,
//             override: day.overrideState,
//             content: "",
//             pages: 0
//         };

//         if (day.isRestDay) {
//             dayData.content = (day.overrideState === 1) ? "הפסקה" : "";
//         } else if (day.isBreakDay) {
//             dayData.masechet = "הפסקה";
//             dayData.content = "";
//         } else if (day.isStudyDay || day.amudimToCount > 0) {
//             let count = day.amudimToCount;
//             if (count > 0 && amudPointer < masterAmudPool.length) {
//                 let startAmud = masterAmudPool[amudPointer];
//                 let endAmud = masterAmudPool[Math.min(amudPointer + count - 1, masterAmudPool.length - 1)];

//                 dayData.masechet = startAmud.masechet;
//                 dayData.content = (startAmud.amudIdx === endAmud.amudIdx && startAmud.masechet === endAmud.masechet)
//                     ? indexToDaf(startAmud.amudIdx)
//                     : `${indexToDaf(startAmud.amudIdx)} - ${indexToDaf(endAmud.amudIdx)}`;

//                 dayData.pages = count / 2;
//                 amudPointer += count;
//             } else {
//                 dayData.content = "חזרה";
//             }
//         }

//         AppState.schedule.push(dayData);
//     });

//     // --- Step 6: Back Monthly Layout Padding ---
//     const isEndOfMonth = (d) => {
//         const nextDay = new Date(d);
//         nextDay.setDate(nextDay.getDate() + 1);
//         if (calendarType === 'hebrew') {
//             const m1 = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'numeric' }).format(d);
//             const m2 = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'numeric' }).format(nextDay);
//             return m1 !== m2;
//         }
//         return nextDay.getDate() === 1;
//     };

//     let lastScheduledDay = timelineDays[timelineDays.length - 1];
//     if (lastScheduledDay) {
//         let runnerDate = new Date(lastScheduledDay.date);
//         while (!isEndOfMonth(runnerDate)) {
//             runnerDate.setDate(runnerDate.getDate() + 1);
//             const ds = formatDateToIL(runnerDate);
//             AppState.schedule.push({
//                 date: new Date(runnerDate), dateString: ds, masechet: "-",
//                 isShabbat: runnerDate.getDay() === 6, isHoliday: !!AppState.calendarData[ds]?.displayText,
//                 holidayTitle: AppState.calendarData[ds]?.displayText, isEmpty: true, content: "", pages: 0
//             });
//         }
//     }

//     renderCalendar('calendarContainer', AppState.schedule, {
//         calendarType: calendarType,
//         overrides: AppState.manualOverrides
//     });
//     document.getElementById('output').classList.remove('hidden');
// }

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