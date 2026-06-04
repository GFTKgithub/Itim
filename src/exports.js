// utils
import { formatHebrewMonthTitle } from "./utils/dates.js";
import { numberToHebrew } from "./utils/gematria.js";
import { showDialog } from "./ui.js";

// Generates an RTL grid-structured workbook and downloads the schedule as an Excel file.
export async function exportScheduleToExcel(schedule) {
    if (!schedule || schedule.length === 0) return await showDialog({
        title: 'אזהרה',
        message: 'יש ליצור לוח לימוד קודם',
        icon: '⚠️',
        confirmText: 'המשך'
    });

    const isMinimalActive = document.getElementById('calendarContainer')?.classList.contains('minimal-calendar');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('תכנית לימוד', {
        views: [{ rightToLeft: true }]
    });

    const calendarSystem = document.getElementById('calendarSystem').value;
    const RTL_MARK = '\u200F';
    worksheet.columns = Array(7).fill({ width: 25 });

    let currentRow = 1;

    // Group schedule array records by their formatted Hebrew or Gregorian month string tokens
    const months = {};
    schedule.forEach(day => {
        let monthName = (calendarSystem === 'hebrew')
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
        
        titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: isMinimalActive ? 'FF1E293B' : 'FFFFFFFF' } };
        titleCell.fill = { 
            type: 'pattern', 
            pattern: 'solid', 
            fgColor: { argb: isMinimalActive ? 'FFF1F5F9' : 'FF1E40AF' } 
        };
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

            if (calendarSystem === 'hebrew') {
                mainDate = numberToHebrew(hebrewDayNum);
                secDate = day.date.getDate() + "." + (day.date.getMonth() + 1);
            } else {
                mainDate = day.date.getDate();
                secDate = numberToHebrew(hebrewDayNum);
            }

            let cellLines = [`${mainDate} (${secDate})`];

            // הוספת חגים
            if (day.holidayTitle) {
                cellLines.push(`${day.holidayTitle}`);
            }
            
            // הוספת סיומים
            if (day.isSiyum || day.siyumTitle) {
                cellLines.push('★ סיום מסכת ★');
            }

            // ניהול תוכן מרכזי + הזרקת איקונים של ידני (Overrides)
            if (day.override === 1) {
                // ❌ יום הפסקה מוגדר ידנית
                cellLines.push('❌ הפסקה');
            } else {
                let textPrefix = '';
                // ✏️ אם הוגדר ידנית כיום לימוד חובה/מאולץ
                if (day.override === 2) {
                    textPrefix = '✏️ ';
                }

                if (!day.isEmpty && day.book) {
                    let studyLine = `${textPrefix}${day.book} ${day.content || ''}`.trim();
                    if (day.isReview) studyLine += ' (חזרה)';
                    cellLines.push(studyLine);
                } else if (day.content) {
                    cellLines.push(`${textPrefix}${day.content}`);
                }
            }

            cell.value = cellLines.map(line => RTL_MARK + line).join('\n');
            cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center', readingOrder: 2 };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            let cellColor = 'FFFFFFFF';

            if (!isMinimalActive) {
                // מצב רגיל - צבעים מלאים לפי ה-CSS
                if (day.override === 1) {
                    cellColor = 'FFFFF2F2'; // force-break
                } else if (day.override === 2) {
                    cellColor = 'FFF0F7FF'; // force-study
                } else if (day.isSiyum) {
                    cellColor = 'remoteFFFEFCE8'; // תוקן מ-FEFCE8 ל-FFFEFCE8 לתאימות ExcelJS
                } else if (day.isReview) {
                    cellColor = 'FFF0FDF4'; // review-bg
                } else if (day.isHoliday) {
                    cellColor = 'FFF3EFF4'; // holiday-bg
                } else if (day.isShabbat) {
                    cellColor = 'FFEFF6FF'; // shabbat-bg
                }
            } else {
                // מצב מינימליסטי - שומר על ניקיון ומשתמש באיקונים שהזרקנו למעלה
                if (day.override === 1) cellColor = 'FFF9FAFB'; 
                if (day.isShabbat) cellColor = 'FFF8FAFC';     
            }

            cell.fill = { 
                type: 'pattern', 
                pattern: 'solid', 
                fgColor: { argb: cellColor } 
            };

            worksheet.getRow(weekRow).height = Math.max(65, cellLines.length * 18);

            if (col === 7) {
                weekRow++;
            }
        });

        if (days[days.length - 1].date.getDay() !== 6) {
            weekRow++;
        }

        currentRow = weekRow + 2;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'עיתים_תכנית_לימוד.xlsx');
}

// Generates a standard universal iCal (.ics) file from the computed schedule array.
export async function exportScheduleToICal(schedule) {
    if (!schedule || schedule.length === 0) {
        return await showDialog({
            title: 'אזהרה',
            message: 'יש ליצור לוח לימוד קודם',
            icon: '⚠️',
            confirmText: 'המשך'
        });
    }

    let icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Itim//Torah Study Scheduler//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH"
    ];

    // Formats a JS Date object to strict iCal All-Day Date format: YYYYMMDD
    const formatICalAllDayDate = (dateObj) => {
        const pad = (num) => String(num).padStart(2, '0');
        return "" + 
            dateObj.getFullYear() + 
            pad(dateObj.getMonth() + 1) + 
            pad(dateObj.getDate());
    };

    schedule.forEach((day) => {
        // Skip empty spacer/padding days
        if (day.isEmpty && day.content !== "חזרה") {
            return; 
        }

        // 1. Calculate inclusive start date
        const startDate = new Date(day.date);
        const startDateFormatted = formatICalAllDayDate(startDate);

        // 2. Calculate the non-inclusive end date (Advance exactly by +1 day)
        const nextDate = new Date(startDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const endDateFormatted = formatICalAllDayDate(nextDate);

        let summary = "עיתים: ";
        let description = "";

        if (day.content === "חזרה") {
            summary += `חזרה - ${day.book}`;
            description = `זמן חזרה מתוכנן עבור מסכת ${day.book}.`;
        } else {
            summary += `${day.book} (${day.content})`;
            description = `לימוד יומי מתוכנן בתוכנית עיתים.\\nספר/מסכת: ${day.book}\\nהספק: ${day.content}`;
        }

        if (day.isSiyum) {
            summary = `🎉 סיום! ${summary}`;
            description += `\\n\\nמזל טוב! הגעת לסיום של ${day.book}!`;
        }

        if (day.holidayTitle) {
            description += `\\nמועד: ${day.holidayTitle}`;
        }

        const dStr = day.dateString || startDateFormatted;

        // 3. Output structural components utilizing the implicit VALUE=DATE selector flags
        icsContent.push(
            "BEGIN:VEVENT",
            `UID:itim-slot-${dStr}@studyscheduler`,
            `DTSTAMP:${formatICalAllDayDate(new Date())}T000000Z`,
            `DTSTART;VALUE=DATE:${startDateFormatted}`,
            `DTEND;VALUE=DATE:${endDateFormatted}`,
            `SUMMARY:${summary}`,
            `DESCRIPTION:${description}`,
            "STATUS:CONFIRMED",
            "END:VEVENT"
        );
    });

    icsContent.push("END:VCALENDAR");

    const finalIcsString = icsContent.join("\r\n") + "\r\n";
    
    try {
        const blob = new Blob([finalIcsString], { type: "text/calendar;charset=utf-8;" });
        const link = document.createElement("a");
        
        link.href = URL.createObjectURL(blob);
        link.download = `עיתים_תכנית_לימוד_${new Date().toISOString().slice(0,10)}.ics`;
        
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }, 100);
        
    } catch (error) {
        console.error("iCal generation failed:", error);
    }
}