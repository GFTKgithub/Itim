import { numberToHebrew, formatGematria, formatHebrewMonthTitle } from './utils.js';

// Updates UI of Track sequence 
export function updateTrackSequenceUI(sequence) {
    const list = document.getElementById('sequenceList');
    list.innerHTML = sequence.map((m, i) => `
        <li class="flex justify-between items-center bg-white border border-blue-100 px-4 py-2 rounded-lg shadow-sm">
            <span class="font-bold text-blue-900"><span class="text-slate-400 ml-2">${i + 1}.</span>מסכת ${m}</span>
            <button data-index="${i}" class="remove-btn text-red-400 hover:text-red-600 transition">✕</button>
        </li>
    `).join('');
}

// Toggles from Deadline (targetDate) goal to Daily Pace (pace)
export function toggleInputs() {
    const method = document.getElementById('calcMethod').value;
    document.getElementById('paceSection').classList.toggle('hidden', method === 'targetDate');
    document.getElementById('targetDateSection').classList.toggle('hidden', method === 'pace');
}

// Updates a Hebrew date label based on a gregorian date element
export function updateHebrewLabel(input, label) {
    if (!label) return;

    if (!input.value) {
        label.textContent = "";
        return;
    }

    try {
        const selectedDate = new Date(input.value);

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

// Renders the Hebrew date labels
export function renderDateLabels(startDate, targetDate) {
    const startDateLabel = document.getElementById('startDateHebrewLabel');
    const targetDateLabel = document.getElementById('targetDateHebrewLabel');

    // Helper to format the date exactly like your old updateHebrewLabel function
    const getHebrewLabelText = (dateInput) => {
        if (!dateInput) return "";

        // Handle both raw string inputs (from HTML elements) and Date objects safely
        const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);

        // Check for an invalid date
        if (isNaN(dateObj.getTime())) return "";

        try {
            // Extract components using Intl.DateTimeFormat
            const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }).formatToParts(dateObj);

            const dayNum = parseInt(parts.find(p => p.type === 'day').value, 10);
            let yearNum = parseInt(parts.find(p => p.type === 'year').value, 10);
            const monthName = parts.find(p => p.type === 'month').value;

            // Standardize 4-digit Hebrew year
            if (yearNum < 1000) yearNum += 5000;

            // Convert to Hebrew letters and apply gematria formatting rules
            const dayHebrew = formatGematria(dayNum, numberToHebrew(dayNum));
            const yearHebrew = formatGematria(yearNum, numberToHebrew(yearNum));

            // Return the identical output string format
            return `${dayHebrew} ב${monthName} ${yearHebrew}`;
        } catch (e) {
            console.error("Error generating custom Hebrew date format string", e);
            return "";
        }
    };

    // Update the Start Date UI Label
    if (startDateLabel) {
        startDateLabel.textContent = getHebrewLabelText(startDate);
    }

    // Update the Target Date UI Label
    if (targetDateLabel) {
        targetDateLabel.textContent = targetDate ? getHebrewLabelText(targetDate) : '';
    }
}

// Renders the calendar UI
export function renderCalendar(containerId, schedule, config={calendarType, overrides}) {
    const { calendarType = 'hebrew', overrides = {} } = config;
    
    const container = document.getElementById(containerId);

    container.innerHTML = "";
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
            const state = overrides[day.dateString] || 0;
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