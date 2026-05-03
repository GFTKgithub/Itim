const masechtot = [
    { name: "ברכות", end: { daf: "סד", amud: "א" } },
    { name: "שבת", end: { daf: "קנז", amud: "ב" } },
    { name: "תענית", end: { daf: "לא", amud: "א" } },
];

const gematriaMap = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
    'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90,
    'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
};

function hebrewToNumber(str) {
    let sum = 0;
    for (let char of str) { if (gematriaMap[char]) sum += gematriaMap[char]; }
    return sum;
}

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

function getTotalAmudim(masechetName) {
    const masechet = masechtot.find(m => m.name === masechetName);
    if (!masechet) return 0;
    const dafNum = hebrewToNumber(masechet.end.daf);
    let total = (dafNum * 2) - 2;
    if (masechet.end.amud === "א") total -= 1;
    return total;
}

function indexToDaf(index) {
    const dafNum = Math.floor(index / 2) + 2;
    const amud = (index % 2 === 0) ? "." : ":";
    return `${numberToHebrew(dafNum)}${amud}`;
}

function toggleInputs() {
    const method = document.getElementById('calcMethod').value;
    document.getElementById('paceSection').classList.toggle('hidden', method === 'targetDate');
    document.getElementById('targetDateSection').classList.toggle('hidden', method === 'pace');
}

function countStudyDays(startDate, endDate, includeShabbat) {
    let count = 0;
    let curr = new Date(startDate);
    while (curr <= endDate) {
        if (includeShabbat || curr.getDay() !== 6) count++;
        curr.setDate(curr.getDate() + 1);
    }
    return count;
}

function generate() {
    const masechetName = document.getElementById('masechetSelect').value;
    const includeShabbat = document.getElementById('IncludeShabbatInput').checked;
    const method = document.getElementById('calcMethod').value;
    
    const startDateVal = document.getElementById('startDateInput').value;
    let startDate = startDateVal ? new Date(startDateVal) : new Date();
    startDate.setHours(0,0,0,0);

    const startDafHeb = document.getElementById('startDafInput').value.trim();
    const startAmudHeb = document.getElementById('startAmudSelect').value;
    let startIdx = 0;
    if (startDafHeb) {
        startIdx = Math.max(0, (hebrewToNumber(startDafHeb) * 2) - 4);
        if (startAmudHeb === "ב") startIdx += 1;
    }

    const totalAmudim = getTotalAmudim(masechetName);
    const remainingAmudim = totalAmudim - startIdx;

    if (remainingAmudim <= 0) return alert("דף מחוץ לטווח");

    let paceAmudim;
    if (method === 'targetDate') {
        const endDateVal = document.getElementById('targetDateInput').value;
        if (!endDateVal) return alert("בחר תאריך סיום");
        const studyDays = countStudyDays(startDate, new Date(endDateVal), includeShabbat);
        paceAmudim = Math.ceil(remainingAmudim / studyDays);
    } else {
        paceAmudim = Math.round(parseFloat(document.getElementById('paceInput').value) * 2);
    }

    const schedule = [];
    let currentAmud = startIdx;
    let currentDate = new Date(startDate);

    while (currentAmud < totalAmudim) {
        const isShabbat = currentDate.getDay() === 6;
        if (isShabbat && !includeShabbat) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        let end = Math.min(currentAmud + paceAmudim, totalAmudim);
        
        schedule.push({
            date: new Date(currentDate),
            content: `${indexToDaf(currentAmud)} - ${indexToDaf(end - 1)}`,
            pages: (end - currentAmud) / 2,
            isShabbat: isShabbat
        });

        currentAmud = end;
        currentDate.setDate(currentDate.getDate() + 1);
    }

    renderCalendar(schedule);
    document.getElementById('printBtn').classList.remove('hidden');
}

function renderCalendar(schedule) {
    const container = document.getElementById('calendarContainer');
    const masechetName = document.getElementById('masechetSelect').value; // שליפת שם המסכת
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
        
        // יצירת הכותרת עם שם החודש ושם המסכת
        monthWrapper.innerHTML = `
            <div class="month-header">
                <span class="text-xl font-bold">${key}</span>
                <span class="text-lg font-medium opacity-90 italic">מסכת ${masechetName}</span>
            </div>
        `;

        const grid = document.createElement('div');
        grid.className = "calendar-grid";
        
        // כותרות ימים
        ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].forEach(d => {
            grid.innerHTML += `<div class="bg-gray-100 p-2 text-center text-xs font-bold border-b border-l border-gray-200">${d}</div>`;
        });

        // ימים ריקים
        const firstDayOfWeek = monthData[0].date.getDay();
        for (let i = 0; i < firstDayOfWeek; i++) {
            grid.innerHTML += `<div class="calendar-day bg-gray-50 border-b border-l border-gray-100"></div>`;
        }

        // ימי הלימוד
        monthData.forEach(day => {
            grid.innerHTML += `
                <div class="calendar-day border-b border-l border-gray-100 ${day.isShabbat ? 'shabbat-bg' : ''}">
                    <div class="text-xs font-bold text-gray-400">${day.date.getDate()}</div>
                    <div class="text-sm font-bold text-center mt-1 text-slate-800">${day.content}</div>
                    <div class="mt-auto text-[10px] text-blue-600 font-bold">${day.pages} דף</div>
                </div>`;
        });

        monthWrapper.appendChild(grid);
        container.appendChild(monthWrapper);
    }
}