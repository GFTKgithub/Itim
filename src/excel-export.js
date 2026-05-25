import { numberToHebrew, formatHebrewMonthTitle } from "./utils.js";

// Generates an RTL grid-structured workbook and downloads the schedule as an Excel file.
export async function exportScheduleToExcel(schedule) {
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

        if (days[days.length - 1].date.getDay() !== 6) {
            weekRow++;
        }

        currentRow = weekRow + 2; // Leave spacing before starting the next calendar block layout
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'עיתים_תכנית_לימוד.xlsx');
}