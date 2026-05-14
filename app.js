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

function getHebrewDate(date) {
    return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        day: 'numeric',
        month: 'long'
    }).format(date);
}

function getGregorianDate(date) {
    return new Intl.DateTimeFormat('he-IL', {
        day: 'numeric',
        month: 'long'
    }).format(date);
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

    // Handle thousands recursively
    if (num >= 1000) {
        return numberToHebrew(Math.floor(num / 1000)) + numberToHebrew(num % 1000);
    }

    // Special cases for 15 and 16
    if (num === 15) return "טו";
    if (num === 16) return "טז";

    let result = "";
    const keys = Object.keys(gematriaMap).sort((a, b) => gematriaMap[b] - gematriaMap[a]);

    for (let char of keys) {
        let value = gematriaMap[char];
        while (num >= value) {
            result += char;
            num -= value;
        }
    }
    return result;
}

function formatGematria(num, rawHebrew) {
    if (!rawHebrew) return "";

    let result = rawHebrew;

    // 1. Handle Thousands Apostrophe
    // If > 1000, find the index where thousands end and rest begins
    if (num >= 1000) {
        const thousandPartLen = numberToHebrew(Math.floor(num / 1000)).length;
        result = result.slice(0, thousandPartLen) + "׳" + result.slice(thousandPartLen);
    }

    // 2. Handle Gershayim (Double tick) or Geresh (Single tick) for the remainder
    const remainder = num % 1000;
    if (remainder > 0) {
        // If the remainder is a single letter, add a single tick (e.g., 5000 + 3 = ה׳ג׳)
        // If the remainder is multiple letters, add double tick before last letter (e.g., ה׳תשפ״ד)
        const output = numberToHebrew(remainder);

        if (output.length === 1) {
            result += "׳";
        } else {
            // Insert " before the last character
            const lastTickIndex = result.length - 1;
            result = result.slice(0, lastTickIndex) + "״" + result.slice(lastTickIndex);
        }
    }

    return result;
}

// Convert a Hebrew year number to gematria
function formatHebrewMonthTitle(date) {
    const monthName = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'long' }).format(date);
    const hebrewYearFull = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { year: 'numeric' }).format(date);

    // חילוץ המספר (למשל 5786)
    const yearNum = parseInt(hebrewYearFull.replace(/\D/g, ''));

    return `${monthName} ${formatGematria(yearNum, numberToHebrew(yearNum))}`;
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
    const calendarType = document.getElementById('calendarType').value;

    schedule = []; // איפוס המערך הגלובלי

    const startDateValue = document.getElementById('startDateInput').value;
    if (!startDateValue) return alert("נא לבחור תאריך התחלה");

    const startInputDate = new Date(startDateValue);
    startInputDate.setHours(0, 0, 0, 0);

    // טעינת חגים לשנה הרלוונטית
    await fetchHolidays(startInputDate.getFullYear());

    // --- שלב 1: השלמת תחילת החודש הראשון (Padding) ---
    let tempDate = new Date(startInputDate);
    if (calendarType === 'hebrew') {
        // הולכים אחורה עד א' בחודש
        while (parseInt(new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' }).format(tempDate)) > 1) {
            tempDate.setDate(tempDate.getDate() - 1);
        }
    } else {
        // הולכים אחורה עד ה-1 לחודש
        tempDate.setDate(1);
    }

    while (tempDate < startInputDate) {
        schedule.push({
            date: new Date(tempDate),
            dateString: tempDate.toISOString().split('T')[0],
            masechet: "-",
            isEmpty: true,
            content: "",
            pages: 0,
            override: 0
        });
        tempDate.setDate(tempDate.getDate() + 1);
    }

    // --- שלב 2: חישוב קצב הלימוד ---
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

    let paceAmudim;
    if (method === 'targetDate') {
        const targetDateInput = document.getElementById('targetDateInput').value;
        if (!targetDateInput) return alert("נא לבחור תאריך יעד");
        const endDate = new Date(targetDateInput);
        const totalDays = Math.ceil((endDate - startInputDate) / (1000 * 60 * 60 * 24)) + 1;
        const totalBreakDays = breakDays * (sequence.length - 1);
        const netStudyDays = totalDays - totalBreakDays;
        paceAmudim = Math.ceil(totalAmudimInSequence / Math.max(1, netStudyDays));
    } else {
        paceAmudim = Math.round(parseFloat(document.getElementById('paceInput').value) * 2);
    }

    // --- שלב 3: בניית רצף הלימוד (ללא השלמות באמצע) ---
    let currentDate = new Date(startInputDate);

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

        // הוספת ימי הפסקה בין מסכתות
        if (mIdx < sequence.length - 1 && breakDays > 0) {
            for (let i = 0; i < breakDays; i++) {
                const isShabbat = currentDate.getDay() === 6; // בדיקה אם יום המנוחה הוא שבת
                schedule.push({
                    date: new Date(currentDate),
                    dateString: currentDate.toISOString().split('T')[0],
                    masechet: "הפסקה",
                    isShabbat: isShabbat, // הוספת המאפיין לצביעת הרקע
                    isEmpty: true,
                    content: isShabbat ? "שבת קודש" : "מנוחה",
                    pages: 0,
                    override: 0
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }
    }

    // --- שלב 4: השלמה לסוף חודש מלא (גרסה סופית ויציבה) ---

    // 1. פונקציית עזר לבדיקה
    const isEndOfMonth = (d) => {
        const nextDay = new Date(d);
        nextDay.setDate(nextDay.getDate() + 1);
        if (calendarType === 'hebrew') {
            const m1 = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'numeric' }).format(d);
            const m2 = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'numeric' }).format(nextDay);
            return m1 !== m2;
        } else {
            return nextDay.getDate() === 1;
        }
    };

    // 2. זיהוי היום האחרון שנוסף (סוף הלימוד)
    let lastDay = schedule[schedule.length - 1];

    if (lastDay) {
        let runnerDate = new Date(lastDay.date);

        // 3. רק אם היום האחרון הוא לא סוף חודש, נתחיל להוסיף ימים
        if (!isEndOfMonth(runnerDate)) {
            // מקדמים ליום הבא כדי להתחיל למלא
            runnerDate.setDate(runnerDate.getDate() + 1);

            while (true) {
                const dateString = runnerDate.toISOString().split('T')[0];
                const isShabbat = runnerDate.getDay() === 6;

                schedule.push({
                    date: new Date(runnerDate),
                    dateString: dateString,
                    masechet: "-",
                    isShabbat: isShabbat,
                    isEmpty: true,
                    content: isShabbat ? "שבת קודש" : "",
                    pages: 0,
                    override: 0
                });

                // אם הגענו לסוף החודש - עוצרים מיד
                if (isEndOfMonth(runnerDate)) break;

                runnerDate.setDate(runnerDate.getDate() + 1);
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
    const calendarType = document.getElementById('calendarType').value;
    const months = {};

    schedule.forEach(day => {
        let monthKey;
        if (calendarType === 'hebrew') {
            // שימוש בפונקציה החדשה לכותרת
            monthKey = formatHebrewMonthTitle(day.date);
        } else {
            monthKey = day.date.toLocaleString('he-IL', { month: 'long', year: 'numeric' });
        }
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
            const state = manualOverrides[day.dateString] || 0;
            let statusClass = "";
            let indicator = "";
            if (state === 1) {
                statusClass = "force-break";
                indicator = '<span class="absolute bottom-1 right-1 text-red-500 font-bold text-[10px]">✕</span>';
            } else if (state === 2) {
                statusClass = "force-study";
                indicator = '<span class="absolute bottom-1 right-1 text-blue-600 font-bold text-[10px]">✎</span>';
            }

            let mainDateDisplay;
            let secondaryDateDisplay;
            const hebrewDayNum = parseInt(new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' }).format(day.date));

            if (calendarType === 'hebrew') {
                mainDateDisplay = formatGematria(hebrewDayNum, numberToHebrew(hebrewDayNum));
                secondaryDateDisplay = day.date.getDate() + "." + (day.date.getMonth() + 1);
            } else {
                mainDateDisplay = day.date.getDate();
                secondaryDateDisplay = formatGematria(hebrewDayNum, numberToHebrew(hebrewDayNum));
            }

            grid.innerHTML += `
            <div onclick="toggleDate('${day.dateString}')" 
                class="calendar-day cursor-pointer relative ${statusClass} ${day.isShabbat ? 'shabbat-bg' : ''} ${day.isHoliday ? 'holiday-bg' : ''} border-b border-l border-gray-100">
                
                <div class="flex justify-between items-start mb-1">
                    <div class="flex flex-col">
                        <span class="text-xs font-bold ${day.date.getDay() === 6 ? 'text-blue-700' : 'text-slate-800'}">${mainDateDisplay}</span>
                        <span class="text-[9px] text-slate-400 font-normal leading-none">${secondaryDateDisplay}</span>
                    </div>
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

async function exportToExcel() {
    if (!schedule || schedule.length === 0) return alert("יש ליצור לוח לימוד קודם");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('תכנית לימוד', {
        views: [{ rightToLeft: true }]
    });

    const calendarType = document.getElementById('calendarType').value;
    const RTL_MARK = '\u200F';
    worksheet.columns = Array(7).fill({ width: 25 });

    let currentRow = 1;

    // קיבוץ לפי חודשים בהתאם לבחירת המשתמש
    const months = {};
    schedule.forEach(day => {
        let monthName;
        if (calendarType === 'hebrew') {
            monthName = formatHebrewMonthTitle(day.date);
        } else {
            monthName = day.date.toLocaleString('he-IL', { month: 'long', year: 'numeric' });
        }
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

        // כותרות ימי השבוע
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

        // מילוי ימים ריקים בתחילת החודש (Padding)
        const firstDayInMonth = days[0].date.getDay();
        for (let i = 0; i < firstDayInMonth; i++) {
            const cell = worksheet.getCell(weekRow, i + 1);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }

        days.forEach(day => {
            const col = (day.date.getDay() + 1);
            const cell = worksheet.getCell(weekRow, col);

            // חישוב תאריכים להצגה (ראשי ומשני)
            let mainDate, secDate;
            const hebrewDayNum = parseInt(new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' }).format(day.date));

            if (calendarType === 'hebrew') {
                mainDate = numberToHebrew(hebrewDayNum);
                secDate = day.date.getDate() + "." + (day.date.getMonth() + 1);
            } else {
                mainDate = day.date.getDate();
                secDate = numberToHebrew(hebrewDayNum);
            }

            // בניית תוכן התא
            let cellContent = `${RTL_MARK}${mainDate} (${secDate})\n`;

            if (!day.isEmpty) {
                cellContent += `${RTL_MARK}${day.masechet}\n${RTL_MARK}${day.content}`;
            } else if (day.holidayTitle) {
                cellContent += `${RTL_MARK}${day.holidayTitle}`;
            } else if (day.isShabbat) {
                cellContent += `${RTL_MARK}שבת קודש`;
            } else if (day.content) {
                cellContent += `${RTL_MARK}${day.content}`;
            }

            cell.value = cellContent;
            cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center', readingOrder: 2 };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            // צביעת תאים
            if (day.override === 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
            } else if (day.override === 2) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF5FF' } };
            } else if (day.isShabbat) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBE6F3' } }; // כחול שבת
            } else if (day.isHoliday) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9EFD5' } };
            }

            if (col === 7) {
                worksheet.getRow(weekRow).height = 65;
                weekRow++;
            }
        });

        // סגירת שורת השבוע האחרונה בחודש
        worksheet.getRow(weekRow).height = 65;
        currentRow = weekRow + 2;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'עיתים_תכנית_לימוד.xlsx');
}