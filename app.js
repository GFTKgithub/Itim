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
        <li class="flex justify-between items-center bg-blue-100 px-3 py-1 rounded text-sm font-bold">
            <span>${i + 1}. מסכת ${m}</span>
            <button onclick="removeFromSequence(${i})" class="text-red-500 hover:text-red-700">✕</button>
        </li>
    `).join('');
}

// Generates the Track's study calendar
async function generate() {
    if (sequence.length === 0) return alert("נא להוסיף לפחות מסכת אחת למסלול");

    const includeShabbat = document.getElementById('IncludeShabbatInput').checked;
    const breakDays = parseInt(document.getElementById('breakDaysInput').value) || 0;
    const method = document.getElementById('calcMethod').value;
    const schedule = [];

    const startDateInput = document.getElementById('startDateInput').value;
    let currentDate = new Date(startDateInput);
    currentDate.setHours(0, 0, 0, 0);

    // Fetches data for the relevant year (and the next one)  
    const startYear = currentDate.getFullYear();
    await fetchHolidays(startYear);
    await fetchHolidays(startYear + 1);

    // Calculates the total net pages per track (for rate by deadline)
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

    // Sets the study pace
    let paceAmudim;
    if (method === 'targetDate') {
        const endDate = new Date(document.getElementById('targetDateInput').value);
        const totalDays = Math.ceil((endDate - currentDate) / (1000 * 60 * 60 * 24)) + 1;
        // Calculate net study days (approximate for rate purposes)
        const netStudyDays = totalDays - (breakDays * (sequence.length - 1));
        paceAmudim = Math.ceil(totalAmudimInSequence / Math.max(1, netStudyDays));
    } else {
        paceAmudim = Math.round(parseFloat(document.getElementById('paceInput').value) * 2);
    }

    // Calendar creation
    sequence.forEach((masechetName, mIdx) => {
        const totalAmudim = getTotalAmudim(masechetName);
        let currentAmud = 0;

        if (mIdx === 0) {
            const startDafHeb = document.getElementById('startDafInput').value.trim();
            if (startDafHeb) {
                currentAmud = Math.max(0, (hebrewToNumber(startDafHeb) * 2) - 4);
                if (document.getElementById('startAmudSelect').value === "ב") currentAmud += 1;
            }
        }

        // Study days per masechet
        // Inside generate() loop:
        while (currentAmud < totalAmudim) {
            const dateString = currentDate.toISOString().split('T')[0];
            const holidayName = holidaysData[dateString];
            const isShabbat = currentDate.getDay() === 6;
            const includeHolidays = document.getElementById('includeHolidaysInput').checked;
            const includeShabbat = document.getElementById('IncludeShabbatInput').checked;

            const overrideState = manualOverrides[dateString] || 0;

            let isNonStudyDay;
            if (overrideState === 1) {
                isNonStudyDay = true;  // Forced Break
            } else if (overrideState === 2) {
                isNonStudyDay = false; // Forced Study
            } else {
                // Standard Logic
                isNonStudyDay = (isShabbat && !includeShabbat) || (holidayName && !includeHolidays);
            }

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
    });

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
        monthWrapper.className = "calendar-month bg-white shadow rounded-lg overflow-hidden mb-8";
        monthWrapper.innerHTML = `<div class="bg-blue-900 text-white p-3 text-center font-bold text-xl">${key}</div>`;

        const grid = document.createElement('div');
        grid.className = "calendar-grid border-r border-t border-gray-200";

        ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].forEach(d => {
            grid.innerHTML += `<div class="bg-gray-100 p-2 text-center text-[10px] font-bold border-b border-l border-gray-200">${d}</div>`;
        });

        const firstDayOfWeek = monthData[0].date.getDay();
        for (let i = 0; i < firstDayOfWeek; i++) {
            grid.innerHTML += `<div class="calendar-day bg-gray-50 border-b border-l border-gray-100"></div>`;
        }

        monthData.forEach(day => {
            const state = day.override;
            let statusClass = "";
            let indicator = "";

            if (state === 1) {
                statusClass = "bg-red-50 ring-2 ring-red-300 ring-inset";
                indicator = '<span class="absolute top-1 left-1 text-red-500 text-[14px] leading-none">✖</span>';
            } else if (state === 2) {
                statusClass = "bg-green-50 ring-2 ring-green-300 ring-inset";
                indicator = '<span class="absolute top-1 left-1 text-green-500 text-[14px] leading-none">✔</span>';
            }

            grid.innerHTML += `
            <div onclick="toggleDate('${day.dateString}')" 
                class="calendar-day cursor-pointer relative ${statusClass} ${day.isShabbat ? 'shabbat-bg' : ''} ${day.isHoliday ? 'holiday-bg' : ''}">
                
                <div class="flex justify-between items-start pointer-events-none">
                    <span class="text-[10px] font-bold text-gray-400">${day.date.getDate()}</span>
                    <span class="text-[9px] text-blue-700 font-bold">${day.masechet}</span>
                </div>
                
                ${indicator} <!-- Indicator is now absolute and won't push the title -->
                
                <div class="text-[11px] font-bold text-center mt-1 leading-tight pointer-events-none ${day.isEmpty ? 'text-gray-400 italic' : 'text-slate-800'}">
                    ${day.isHoliday ? `<span class="holiday-label-small">${day.holidayTitle}</span>` : ''}
                    ${day.content}
                </div>
                
                <div class="mt-auto text-[9px] text-gray-400 text-right pointer-events-none">
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