const masechtot = [
    // Zeraim
    { name: "ברכות", end: { daf: "סד", amud: "א" } },

    // Moed
    { name: "שבת", end: { daf: "קנז", amud: "ב" } },
    { name: "עירובין", end: { daf: "קה", amud: "א" } },
    { name: "פסחים", end: { daf: "קכא", amud: "א" } },
    { name: "יומא", end: { daf: "פח", amud: "א" } },
    { name: "סוכה", end: { daf: "נו", amud: "א" } },
    { name: "ביצה", end: { daf: "מ", amud: "א" } },
    { name: "ראש השנה", end: { daf: "לה", amud: "א" } },
    { name: "תענית", end: { daf: "לא", amud: "א" } },
    { name: "מגילה", end: { daf: "לב", amud: "א" } },
    { name: "מועד קטן", end: { daf: "כח", amud: "ב" } },
    { name: "חגיגה", end: { daf: "כז", amud: "א" } },

    // Nashim
    { name: "יבמות", end: { daf: "קכב", amud: "א" } },
    { name: "כתובות", end: { daf: "קיב", amud: "ב" } },
    { name: "נדרים", end: { daf: "צא", amud: "א" } },
    { name: "נזיר", end: { daf: "סו", amud: "ב" } },
    { name: "סוטה", end: { daf: "מט", amud: "א" } },
    { name: "גיטין", end: { daf: "צ", amud: "א" } },
    { name: "קידושין", end: { daf: "פב", amud: "א" } },

    // Nezikin
    { name: "בבא קמא", end: { daf: "קיט", amud: "א" } },
    { name: "בבא מציעא", end: { daf: "קיט", amud: "א" } },
    { name: "בבא בתרא", end: { daf: "קעו", amud: "א" } },
    { name: "סנהדרין", end: { daf: "קיג", amud: "א" } },
    { name: "מכות", end: { daf: "כד", amud: "א" } },
    { name: "שבועות", end: { daf: "מט", amud: "א" } },
    { name: "עבודה זרה", end: { daf: "עו", amud: "א" } },
    { name: "הוריות", end: { daf: "יד", amud: "א" } },

    // Kodashim
    { name: "זבחים", end: { daf: "קכ", amud: "א" } },
    { name: "מנחות", end: { daf: "קי", amud: "א" } },
    { name: "חולין", end: { daf: "קמב", amud: "א" } },
    { name: "בכורות", end: { daf: "סא", amud: "א" } },
    { name: "ערכין", end: { daf: "לד", amud: "א" } },
    { name: "תמורה", end: { daf: "לד", amud: "א" } },
    { name: "כריתות", end: { daf: "כח", amud: "א" } },
    { name: "מעילה", end: { daf: "כב", amud: "א" } },
    { name: "תמיד", end: { daf: "לג", amud: "ב" } },

    // Tahorot
    { name: "נדה", end: { daf: "עג", amud: "א" } }
];

const gematriaMap = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
    'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90,
    'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
};

let schedule = [];

// 0 = Default, 1 = Force Break, 2 = Force Study
let manualOverrides = {};

// Load holiday days
let holidaysData = {};

async function fetchHolidays(year) {
    // Skip loading current year if it's already loaded
    if (Object.keys(holidaysData).some(key => key.startsWith(year))) return;

    try {
        const response = await fetch(`https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&mod=off&nx=off&year=${year}&month=x&ss=off&mf=off&c=off&geo=none`);
        const data = await response.json();
        data.items.forEach(item => {
            // API returns date in YYYY-MM-DD format
            holidaysData[item.date] = item.hebrew;
        });
    } catch (e) {
        console.error("שגיאה בטעינת חגים", e);
    }
}

// Convert Hebrew letter sequence into its gematria
function hebrewToNumber(str) {
    let sum = 0;
    for (let char of str) { if (gematriaMap[char]) sum += gematriaMap[char]; }
    return sum;
}

// Convert gematria into a Hebrew letter sequence
function numberToHebrew(num) {
    if (num <= 0) return "";
    if (num === 15) return "טו";
    if (num === 16) return "טז";
    let result = "";
    const keys = Object.keys(gematriaMap).reverse();
    for (let char of keys) {
        let value = gematriaMap[char];
        while (num >= value) { result += char; num -= value; }
    }
    return result;
}

// Gets the number of total amudim from a masechet
function getTotalAmudim(masechetName) {
    const masechet = masechtot.find(m => m.name === masechetName);
    if (!masechet) return 0;
    const dafNum = hebrewToNumber(masechet.end.daf);
    let total = (dafNum * 2) - 2;
    if (masechet.end.amud === "א") total -= 1;
    return total;
}

// Takes an amud index and converts it to a Daf and Amud string
function indexToDaf(index) {
    const dafNum = Math.floor(index / 2) + 2;
    const amud = (index % 2 === 0) ? "." : ":";
    return `${numberToHebrew(dafNum)}${amud}`;
}

// Toggles from Deadline goal to Daily Study
function toggleInputs() {
    const method = document.getElementById('calcMethod').value;
    document.getElementById('paceSection').classList.toggle('hidden', method === 'targetDate');
    document.getElementById('targetDateSection').classList.toggle('hidden', method === 'pace');
}

// Counts the amount of study days between a start and end date
function countStudyDays(startDate, endDate, includeShabbat) {
    let count = 0;
    let curr = new Date(startDate);
    while (curr <= endDate) {
        if (includeShabbat || curr.getDay() !== 6) count++;
        curr.setDate(curr.getDate() + 1);
    }
    return count;
}

let sequence = [];

// Initiation of Masechet Select screen
window.onload = () => {
    const select = document.getElementById('masechetSelect');
    masechtot.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.innerText = m.name;
        select.appendChild(opt);
    });
    // Setting of Today as default
    document.getElementById('startDateInput').valueAsDate = new Date();
};

// Adds the selected masechet into the Track list
function addToSequence() {
    const val = document.getElementById('masechetSelect').value;
    sequence.push(val);
    updateSequenceUI();
}

// Removes the selected masechet from the Track list
function removeFromSequence(index) {
    sequence.splice(index, 1);
    updateSequenceUI();
}

// Clears the entire sequence of masechtot from the Track
function clearSequence() {
    if (confirm("האם למחוק את כל המסכתות מהמסלול?")) {
        sequence = [];
        updateSequenceUI();
    }
}

// Updates UI of Track sequence 
function updateSequenceUI() {
    const list = document.getElementById('sequenceList');
    list.innerHTML = sequence.map((m, i) => `
        <li class="flex justify-between items-center bg-white border border-blue-100 px-4 py-2 rounded-lg shadow-sm">
            <span class="font-bold text-blue-900"><span class="text-slate-400 ml-2">${i + 1}.</span>מסכת ${m}</span>
            <button onclick="removeFromSequence(${i})" class="text-red-400 hover:text-red-600 transition">✕</button>
        </li>
    `).join('');
}

// Generates the Track's study calendar
async function generate() {
    if (sequence.length === 0) return alert("נא להוסיף לפחות מסכת אחת למסלול");

    const includeShabbat = document.getElementById('IncludeShabbatInput').checked;
    const includeHolidays = document.getElementById('includeHolidaysInput').checked;
    const breakDays = parseInt(document.getElementById('breakDaysInput').value) || 0;
    const method = document.getElementById('calcMethod').value;

    schedule = []; // איפוס המשתנה הגלובלי

    const startDateInput = document.getElementById('startDateInput').value;
    let currentDate = new Date(startDateInput);
    currentDate.setHours(0, 0, 0, 0);

    const startYear = currentDate.getFullYear();
    await fetchHolidays(startYear);
    await fetchHolidays(startYear + 1);

    // 1. חישוב סך כל הדפים בנטו לכל המסלול
    let totalAmudimInSequence = 0;
    sequence.forEach((name, idx) => {
        let startIdx = 0;
        if (idx === 0) {
            const startDafHeb = document.getElementById('startDafInput').value.trim();
            if (startDafHeb) {
                startIdx = Math.max(0, (hebrewToNumber(startDafHeb) * 2) - 4);
                if (document.getElementById('startAmudSelect').value === "ב") startIdx += 1;
            }
        }
        totalAmudimInSequence += (getTotalAmudim(name) - startIdx);
    });

    // 2. קביעת קצב הלימוד
    let paceAmudim;
    if (method === 'targetDate') {
        const endDate = new Date(document.getElementById('targetDateInput').value);
        const totalDays = Math.ceil((endDate - currentDate) / (1000 * 60 * 60 * 24)) + 1;
        // חישוב ימי לימוד נטו: סך הימים פחות ימי ההפסקה בין המסכתות
        const totalBreakDays = breakDays * (sequence.length - 1);
        const netStudyDays = totalDays - totalBreakDays;
        paceAmudim = Math.ceil(totalAmudimInSequence / Math.max(1, netStudyDays));
    } else {
        paceAmudim = Math.round(parseFloat(document.getElementById('paceInput').value) * 2);
    }

    // 3. בניית הלוח
    for (let mIdx = 0; mIdx < sequence.length; mIdx++) {
        const masechetName = sequence[mIdx];
        const totalAmudim = getTotalAmudim(masechetName);
        let currentAmud = 0;

        if (mIdx === 0) {
            const startDafHeb = document.getElementById('startDafInput').value.trim();
            if (startDafHeb) {
                currentAmud = Math.max(0, (hebrewToNumber(startDafHeb) * 2) - 4);
                if (document.getElementById('startAmudSelect').value === "ב") currentAmud += 1;
            }
        }

        while (currentAmud < totalAmudim) {
            const dateString = currentDate.toISOString().split('T')[0];
            const holidayName = holidaysData[dateString];
            const isShabbat = currentDate.getDay() === 6;
            const overrideState = manualOverrides[dateString] || 0;

            let isNonStudyDay = (overrideState === 1) ||
                (overrideState !== 2 && ((isShabbat && !includeShabbat) || (holidayName && !includeHolidays)));

            const dayData = {
                date: new Date(currentDate),
                dateString: dateString,
                masechet: masechetName,
                isShabbat: isShabbat,
                isHoliday: !!holidayName,
                holidayTitle: holidayName,
                isEmpty: isNonStudyDay,
                override: overrideState
            };

            if (isNonStudyDay) {
                dayData.content = holidayName || (isShabbat ? "שבת קודש" : "מנוחה");
                dayData.pages = 0;
            } else {
                let end = Math.min(currentAmud + paceAmudim, totalAmudim);
                dayData.content = `${indexToDaf(currentAmud)} - ${indexToDaf(end - 1)}`;
                dayData.pages = (end - currentAmud) / 2;
                currentAmud = end;
            }

            schedule.push(dayData);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // 4. הוספת ימי הפסקה בין מסכתות (פרט למסכת האחרונה)
        if (mIdx < sequence.length - 1 && breakDays > 0) {
            for (let i = 0; i < breakDays; i++) {
                const dateString = currentDate.toISOString().split('T')[0];
                schedule.push({
                    date: new Date(currentDate),
                    dateString: dateString,
                    masechet: "הפסקה",
                    isShabbat: currentDate.getDay() === 6,
                    isHoliday: !!holidaysData[dateString],
                    holidayTitle: holidaysData[dateString],
                    isEmpty: true,
                    content: "מנוחה בין מסכתות",
                    pages: 0,
                    override: 0
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }
    }

    renderCalendar(schedule);
    document.getElementById('printBtn').classList.remove('hidden');
}

// Renders the calendar UI
function renderCalendar(schedule) {
    const container = document.getElementById('calendarContainer');
    container.innerHTML = "";
    const months = {};

    schedule.forEach(day => {
        const monthKey = day.date.toLocaleString('he-IL', { month: 'long', year: 'numeric' });
        if (!months[monthKey]) months[monthKey] = [];
        months[monthKey].push(day);
    });

    for (const key in months) {
        const monthData = months[key];
        const monthWrapper = document.createElement('div');
        monthWrapper.className = "calendar-month bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200";
        monthWrapper.innerHTML = `<div class="bg-slate-800 text-white p-4 text-center font-bold text-xl">${key}</div>`;

        const grid = document.createElement('div');
        grid.className = "calendar-grid";

        ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].forEach(d => {
            grid.innerHTML += `<div class="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500 border-b border-gray-200">${d}</div>`;
        });

        const firstDayOfWeek = monthData[0].date.getDay();
        for (let i = 0; i < firstDayOfWeek; i++) {
            grid.innerHTML += `<div class="calendar-day bg-slate-50/50"></div>`;
        }

        monthData.forEach(day => {
            const state = day.override;
            let statusClass = "";
            let indicator = "";

            if (state === 1) { // מנוחה מאולצת
                statusClass = "force-break";
                indicator = '<span class="absolute top-1 left-1 text-red-500 font-bold">✕</span>';
            } else if (state === 2) { // למידה מאולצת (כחול כפי שביקשת)
                statusClass = "force-study";
                indicator = '<span class="absolute top-1 left-1 text-blue-600 font-bold">✎</span>';
            }

            grid.innerHTML += `
            <div onclick="toggleDate('${day.dateString}')" 
                class="calendar-day cursor-pointer relative ${statusClass} ${day.isShabbat ? 'shabbat-bg' : ''} ${day.isHoliday ? 'holiday-bg' : ''} border-b border-l border-gray-100">
                
                <div class="flex justify-between items-start mb-1">
                    <span class="text-xs font-bold ${day.date.getDay() === 6 ? 'text-blue-700' : 'text-slate-400'}">${day.date.getDate()}</span>
                    <span class="text-[10px] text-blue-800 font-bold truncate max-w-[50px]">${day.masechet}</span>
                </div>
                
                ${indicator}
                
                <div class="text-[11px] font-bold text-center mt-1 leading-tight ${day.isEmpty ? 'text-slate-400 italic' : 'text-slate-800'}">
                    ${day.isHoliday ? `<span class="holiday-label-small">${day.holidayTitle}</span>` : ''}
                    ${day.content}
                </div>
                
                <div class="mt-auto text-[9px] text-slate-400 text-left">
                    ${!day.isEmpty ? `${day.pages} דף` : ''}
                </div>
            </div>`;
        });

        monthWrapper.appendChild(grid);
        container.appendChild(monthWrapper);
    }
}

function toggleDate(dateString) {
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

async function exportBeautifulExcel() {
    if (!schedule || schedule.length === 0) return alert("יש ליצור לוח לימוד קודם");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('תכנית לימוד', {
        views: [{ rightToLeft: true }]
    });

    // תו בקרה לכיווניות ימין לשמאל (RTL Mark)
    const RTL_MARK = '\u200F';

    worksheet.columns = Array(7).fill({ width: 22 });

    let currentRow = 1;

    const months = {};
    schedule.forEach(day => {
        const monthName = day.date.toLocaleString('he-IL', { month: 'long', year: 'numeric' });
        if (!months[monthName]) months[monthName] = [];
        months[monthName].push(day);
    });

    for (const [monthName, days] of Object.entries(months)) {
        // כותרת חודש
        worksheet.mergeCells(currentRow, 1, currentRow, 7);
        const titleCell = worksheet.getCell(currentRow, 1);
        titleCell.value = RTL_MARK + monthName;
        titleCell.font = { name: 'Arial', bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(currentRow).height = 30;
        currentRow++;

        // ימי השבוע
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
        const firstDay = days[0].date.getDay();
        for (let i = 0; i < firstDay; i++) {
            worksheet.getCell(weekRow, i + 1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            worksheet.getCell(weekRow, i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        }

        days.forEach(day => {
            const col = (day.date.getDay() + 1);
            const cell = worksheet.getCell(weekRow, col);

            // יצירת טקסט עם תו RTL בתחילת כל שורה כדי לשמור על סדר הפיסוק
            let lines = [];
            lines.push(RTL_MARK + day.date.getDate());

            if (day.isEmpty) {
                if (day.isHoliday) lines.push(RTL_MARK + day.holidayTitle);
                lines.push(RTL_MARK + day.content);
            } else {
                lines.push(RTL_MARK + day.masechet);
                lines.push(RTL_MARK + day.content);
            }

            cell.value = lines.join('\n');

            // יישור טקסט: מרכז (לבקשתך) עם הגדרות כיווניות
            cell.alignment = {
                wrapText: true,
                vertical: 'top',
                horizontal: 'center', // ממרכז את הטקסט באמצע התא
                readingOrder: 2      // אומר לאקסל שהכיוון הכללי הוא RTL
            };

            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            // צבעים
            if (day.override === 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } }; // אדום בהיר
            } else if (day.override === 2) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF5FF' } }; // כחול בהיר (במקום ירוק)
            } else if (day.isShabbat) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBE6F3' } };
            } else if (day.isHoliday) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9EFD5' } };
            }

            if (col === 7) {
                worksheet.getRow(weekRow).height = 60;
                weekRow++;
            }
        });

        worksheet.getRow(weekRow).height = 60;
        currentRow = weekRow + 2;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'תכנית_לימוד_מעוצבת.xlsx');
}