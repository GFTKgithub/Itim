import { hebrewToNumber, numberToHebrew, formatGematria, formatHebrewMonthTitle, indexToDaf, formatDateToIL } from './utils.js';

// Data for all masechtot
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

let schedule = []; // Keeps the data of the entire schedule
let manualOverrides = {}; // Keeps track of all manual overrides of calendar days (0 = Default, 1 = Force Break, 2 = Force Study)
let calendarEventsData = {}; // Keeps titles intact for rendering
let dayTypesData = {};  // Holds structural traits for schedule calculations

// Fetches calendar event data of a given year from Hebcal API
async function fetchCalendarEvents(year) {
    if (Object.keys(calendarEventsData).some(key => key.startsWith(year))) return;

    try {
        const response = await fetch(`https://www.hebcal.com/hebcal?v=1&cfg=json&year=${year}&yt=G&i=on&maj=on&min=on&nx=on&mf=on&ss=on&mvch=off&mod=on&s=on&mm=0&lg=h&c=off&geo=none&zip=&geonameid=&b=18&M=on&td=&m=&ue=off&leyning=off`);
        const data = await response.json();

        data.items.forEach(item => {
            const dateStr = formatDateToIL(new Date(item.date));
            const category = item.category || "";
            const subcat = item.subcat || "";
            const hebrewName = item.hebrew || "";

            // Initialize day logic traits for this date if not already present
            if (!dayTypesData[dateStr]) {
                dayTypesData[dateStr] = {
                    isParasha: false,
                    isRoshChodesh: false,
                    isChag: false,
                    isModernException: false
                };
            }

            // --- Define Structuring Rules ---

            // Rule 1: Normal Weekly Torah Portions
            if (category === "parashat") {
                dayTypesData[dateStr].isParasha = true;
            }

            // Rule 3: Rosh Chodesh
            if (category === "roshchodesh") {
                dayTypesData[dateStr].isRoshChodesh = true;
            }

            // Rule 5: Modern Day Exceptions List
            const exceptions = [
                "יום השפה העברית", "יום העליה", "יום הרצל", "יום ז׳בוטינסקי",
                "שמירת בית הספר ליום העליה", "יום הזכרון ליצחק רבין",
                "חג הסיגד", "יום בן־גוריון", "יום המשפחה"
            ];
            const isException = exceptions.some(name => hebrewName.includes(name));

            if (subcat === "modern" && isException) {
                dayTypesData[dateStr].isModernException = true;
            }
            // Rule 4: Standard Chagim (Major, Minor, Fast, or standard Modern days not in exception list)
            else if (category === "holiday") {
                if(subcat === "shabbat")
                    dayTypesData[dateStr].isSpecialShabbat = true;
                else dayTypesData[dateStr].isChag = true;
            }

            // Populate text layout normally (keeps multiple labels visible e.g. "ראש חודש / פרשת...")
            if (calendarEventsData[dateStr]) {
                calendarEventsData[dateStr] += " / " + hebrewName;
            } else {
                calendarEventsData[dateStr] = hebrewName;
            }
        });
    } catch (e) {
        console.error("שגיאה בטעינת חגים", e);
    }
}

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

// Gets the number of total amudim from a masechet
function getTotalAmudim(masechetName) {
    const masechet = masechtot.find(m => m.name === masechetName);
    if (!masechet) return 0;
    const dafNum = hebrewToNumber(masechet.end.daf);
    let total = (dafNum * 2) - 2;
    if (masechet.end.amud === "א") total -= 1;
    return total;
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

/*
    Handling of masechet sequence list logic
*/ 

let sequence = [];

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
            <button data-index="${i}" class="remove-btn text-red-400 hover:text-red-600 transition">✕</button>
        </li>
    `).join('');
}

// Updates a Hebrew date label based on a gregorian date element
function updateHebrewLabel(inputElement, labelId) {
    const label = document.getElementById(labelId);
    if (!label) return;

    if (!inputElement.value) {
        label.textContent = "";
        return;
    }

    try {
        const selectedDate = new Date(inputElement.value);

        // Use he-IL with hebrew calendar to extract precise localized strings and numeric values
        const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).formatToParts(selectedDate);

        const dayNum = parseInt(parts.find(p => p.type === 'day').value, 10);
        let yearNum = parseInt(parts.find(p => p.type === 'year').value, 10);

        // Dynamically pull the exact Hebrew month name string directly from the browser's engine
        const monthName = parts.find(p => p.type === 'month').value;

        // Standardize 4-digit Hebrew year integer format (e.g., 5786)
        if (yearNum < 1000) yearNum += 5000;

        // Generate the raw sequences using your utilities
        const rawDayHebrew = numberToHebrew(dayNum);
        const rawYearHebrew = numberToHebrew(yearNum);

        // Apply grammatical punctuation rules via your formatGematria function
        const dayHebrew = formatGematria(dayNum, rawDayHebrew);
        const yearHebrew = formatGematria(yearNum, rawYearHebrew);

        // Update display text formatting
        label.textContent = `(${dayHebrew} ב${monthName} ${yearHebrew})`;

    } catch (e) {
        console.error("Error generating custom Hebrew date format string", e);
        label.textContent = "";
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

    // --- Step 2: Calculate Internal Pace (In Amudim) ---
    let paceAmudim;
    if (method === 'targetDate') {
        const targetDateInput = document.getElementById('targetDateInput').value;
        if (!targetDateInput) return alert("נא לבחור תאריך יעד");

        const endDate = new Date(targetDateInput);
        endDate.setHours(0, 0, 0, 0);

        if (endDate < startInputDate) return alert("תאריך היעד אינו יכול להיות לפני תאריך ההתחלה");

        // 1. Fetch holidays for the target range early to ensure accurate mapping
        const startYear = startInputDate.getFullYear();
        const endYear = endDate.getFullYear();
        const holidayPromises = [];
        for (let y = startYear - 1; y <= endYear + 1; y++) {
            holidayPromises.push(fetchCalendarEvents(y));
        }
        await Promise.all(holidayPromises);

        // 2. Loop through the exact date range to count actual, valid study days
        let netStudyDays = 0;
        let scanDate = new Date(startInputDate);

        // Track how many tractate breaks will interrupt this period
        const totalBreakDays = breakDays * (sequence.length - 1);

        while (scanDate <= endDate) {
            const dateString = formatDateToIL(scanDate);
            const overrideState = manualOverrides[dateString] || 0;

            // Evaluate rest status using the new rules engine
            let isRestDay = (overrideState === 1) ||
                (overrideState !== 2 && shouldDayBeRest(scanDate, includeShabbat, includeHolidays));

            if (!isRestDay) {
                netStudyDays++;
            }

            scanDate.setDate(scanDate.getDate() + 1);
        }

        // Deduct the structural break days between tractates from the available study days
        netStudyDays -= totalBreakDays;

        if (netStudyDays <= 0) return alert("אין מספיק ימי לימוד בטווח התאריכים שהוגדר (כולל ימי מנוחה והפסקות)");

        // 3. Divide total amudim by actual remaining study days
        paceAmudim = Math.ceil(totalAmudimInSequence / netStudyDays);
    } else {
        paceAmudim = Math.round(parseFloat(document.getElementById('paceInput').value) * 2);
    }

    // --- Step 3: Fetch Holidays Dynamically ---
    const startYear = startInputDate.getFullYear();
    let endYear = startYear;

    if (method === 'targetDate') {
        const targetDateInput = document.getElementById('targetDateInput').value;
        if (targetDateInput) endYear = new Date(targetDateInput).getFullYear();
    } else {
        const totalDaysEstimate = Math.ceil(totalAmudimInSequence / paceAmudim) + (breakDays * sequence.length);
        const endEstimateDate = new Date(startInputDate);
        endEstimateDate.setDate(endEstimateDate.getDate() + totalDaysEstimate + 60);
        endYear = endEstimateDate.getFullYear();
    }

    const holidayPromises = [];
    for (let y = startYear - 1; y <= endYear + 1; y++) {
        holidayPromises.push(fetchCalendarEvents(y));
    }
    await Promise.all(holidayPromises);

    // --- Step 4: Calculate Calendar Front Padding ---
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
        const dateString = formatDateToIL(paddingDate);
        const holidayName = calendarEventsData[dateString];
        const isShabbat = paddingDate.getDay() === 6;

        schedule.push({
            date: new Date(paddingDate),
            dateString: dateString,
            masechet: "-",
            isShabbat: isShabbat,
            isHoliday: !!holidayName,
            holidayTitle: holidayName,
            isEmpty: true,
            content: "", // FIXED: No default labels
            pages: 0,
            override: manualOverrides[dateString] || 0
        });
        paddingDate.setDate(paddingDate.getDate() + 1);
    }

    // --- Step 5: Process Main Study Sequence ---
    let currentDate = new Date(startInputDate);

    for (let mIdx = 0; mIdx < sequence.length; mIdx++) {
        const masechetName = sequence[mIdx];
        const totalAmudim = getTotalAmudim(masechetName);
        let currentAmud = (mIdx === 0) ? initialAmudOffset : 0;

        while (currentAmud < totalAmudim) {
            const dateString = formatDateToIL(currentDate);
            const holidayName = calendarEventsData[dateString] || "";
            const isShabbat = currentDate.getDay() === 6;
            const overrideState = manualOverrides[dateString] || 0;
            const traits = dayTypesData[dateString] || {};

            let isNonStudyDay = (overrideState === 1) ||
                (overrideState !== 2 && shouldDayBeRest(currentDate, includeShabbat, includeHolidays));

            const dayData = {
                date: new Date(currentDate),
                dateString: dateString,
                masechet: masechetName,
                isShabbat: isShabbat || traits.isParasha,
                isHoliday: holidayName !== "",
                holidayTitle: holidayName,
                isEmpty: isNonStudyDay,
                override: overrideState
            };

            if (isNonStudyDay) {
                // FIXED: Explicitly outputs "מנוחה" only on manual forced override; otherwise blank
                dayData.content = (overrideState === 1) ? "הפסקה" : "";
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

        // Add break days between tractates
        if (mIdx < sequence.length - 1 && breakDays > 0) {
            for (let i = 0; i < breakDays; i++) {
                const dateString = formatDateToIL(currentDate);
                const holidayName = calendarEventsData[dateString];
                const isShabbat = currentDate.getDay() === 6;
                const overrideState = manualOverrides[dateString] || 0;

                schedule.push({
                    date: new Date(currentDate),
                    dateString: dateString,
                    masechet: "הפסקה",
                    isShabbat: isShabbat,
                    isHoliday: !!holidayName,
                    holidayTitle: holidayName,
                    isEmpty: true,
                    content: (overrideState === 1) ? "הפסקה" : "",
                    pages: 0,
                    override: overrideState
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }
    }

    // --- Step 6: Calendar Back Padding ---
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

    let lastDay = schedule[schedule.length - 1];
    if (lastDay) {
        let runnerDate = new Date(lastDay.date);

        while (!isEndOfMonth(runnerDate)) {
            runnerDate.setDate(runnerDate.getDate() + 1);
            const dateString = formatDateToIL(runnerDate);
            const holidayName = calendarEventsData[dateString];
            const isShabbat = runnerDate.getDay() === 6;

            schedule.push({
                date: new Date(runnerDate),
                dateString: dateString,
                masechet: "-",
                isShabbat: isShabbat,
                isHoliday: !!holidayName,
                holidayTitle: holidayName,
                isEmpty: true,
                content: "", // FIXED: No default labels
                pages: 0,
                override: manualOverrides[dateString] || 0
            });
        }
    }

    renderCalendar(schedule);
    document.getElementById('output').classList.remove('hidden');
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
        monthWrapper.className = "calendar-month bg-white shadow-xl rounded-2xl border border-slate-200 mb-10 overflow-hidden";

        // Month Title
        monthWrapper.innerHTML = `<div class="bg-slate-800 text-white p-4 text-center font-bold text-xl">${key}</div>`;

        // --- FIX: Add the Scroll Container Wrapper ---
        const scrollWrapper = document.createElement('div');
        scrollWrapper.className = "calendar-scroll-container";

        const grid = document.createElement('div');
        grid.className = "calendar-grid";

        // Headers
        ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].forEach(d => {
            grid.innerHTML += `<div class="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500 border-b border-gray-200">${d}</div>`;
        });

        // Padding for start of month
        const firstDayOfWeek = monthData[0].date.getDay();
        for (let i = 0; i < firstDayOfWeek; i++) {
            grid.innerHTML += `<div class="calendar-day bg-slate-50/50"></div>`;
        }

        // Days
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

            // Changed: Replaced onclick with data-date
            grid.innerHTML += `
            <div data-date="${day.dateString}" 
                class="calendar-day cursor-pointer relative ${statusClass} ${day.isShabbat ? 'shabbat-bg' : ''} ${day.isHoliday ? 'holiday-bg' : ''} border-b border-l border-gray-100">
                
                <div class="flex justify-between items-start mb-1">
                    <div class="flex flex-col">
                        <span class="text-xs font-bold ${day.date.getDay() === 6 ? 'text-blue-700' : 'text-slate-800'}">${mainDateDisplay}</span>
                        <span class="text-[9px] text-slate-400 font-normal leading-none">${secondaryDateDisplay}</span>
                    </div>
                    <span class="text-[10px] text-blue-800 font-bold truncate max-w-[40px]">${day.masechet}</span>
                </div>
                
                ${indicator}
                
                <div class="text-[10px] font-bold text-center mt-1 leading-tight ${day.isEmpty ? 'text-slate-400 italic' : 'text-slate-800'}">
                    ${day.isHoliday ? `<span class="holiday-label-small">${day.holidayTitle}</span>` : ''}
                    ${day.content}
                </div>
                
                <div class="mt-auto text-[8px] text-slate-400 text-left">
                    ${!day.isEmpty ? `${day.pages} דף` : ''}
                </div>
            </div>`;
        });

        // Assemble
        scrollWrapper.appendChild(grid);
        monthWrapper.appendChild(scrollWrapper);
        container.appendChild(monthWrapper);
    }
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
        updateHebrewLabel(event.target, 'targetDateHebrewLabel');
    });

    document.getElementById('startDateInput').addEventListener('change', (event) => {
        updateHebrewLabel(event.target, 'startDateHebrewLabel');
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

    // Fix 1: Fire the label generator function immediately for the initial state
    updateHebrewLabel(startDateInput, 'startDateHebrewLabel');

    // 3. Attach standard Change Events for real-time label updates
    startDateInput.addEventListener('input', () => {
        updateHebrewLabel(startDateInput, 'startDateHebrewLabel');
    });

    const targetDateInput = document.getElementById('targetDateInput');
    targetDateInput.addEventListener('input', () => {
        updateHebrewLabel(targetDateInput, 'targetDateHebrewLabel');
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