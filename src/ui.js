import { numberToHebrew, formatGematria, formatHebrewMonthTitle } from './utils.js';

const hebrewDayFormatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' });

// Hydrates the user configuration panel elements with saved data
export function hydrateHtmlFromAppState(AppState) {
    document.getElementById('calcMethod').value = AppState.userSettings.method;
    document.getElementById('calendarType').value = AppState.userSettings.calendarType;
    document.getElementById('includeShabbatInput').checked = AppState.userSettings.includeShabbat;
    document.getElementById('includeHolidaysInput').checked = AppState.userSettings.includeHolidays;
    document.getElementById('breakDaysInput').value = AppState.userSettings.breakDays;
    document.getElementById('startDateInput').value = AppState.userSettings.startDate;
    document.getElementById('targetDateInput').value = AppState.userSettings.targetDate;
    document.getElementById('paceInput').value = AppState.userSettings.pace;
    document.getElementById('startDafInput').value = AppState.userSettings.startDaf;
    document.getElementById('startAmudInput').value = AppState.userSettings.startAmud;
}

// Updates UI of Track sequence 
export function updateTrackSequenceUI(sequence) {
    const list = document.getElementById('trackSequenceList');

    if (sequence.length === 0) {
        list.innerHTML = `
            <div class="text-center p-4 text-slate-400 text-sm italic">
                אין מסכתות ברשימה. בחר מסכת מלמעלה והוסף אותה.
            </div>`;
        return;
    }

    list.innerHTML = sequence.map((m, i) => `
        <li draggable="true" data-index="${i}" 
            class="drag-item flex justify-between items-center bg-white border border-slate-200 hover:border-blue-300 px-4 py-2.5 rounded-xl shadow-xs cursor-grab active:cursor-grabbing transition-all duration-150 select-none">
            
            <div class="flex items-center gap-3">
                <div class="text-slate-400 hover:text-slate-600 flex flex-col gap-0.5 justify-center leading-none select-none">
                    <span class="block">•••</span>
                    <span class="block -mt-1.5">•••</span>
                </div>
                <span class="font-bold text-slate-700">
                    <span class="text-slate-400 ml-1 font-medium text-xs">${i + 1}.</span> 
                    מסכת ${m}
                </span>
            </div>
            
            <button data-index="${i}" class="remove-btn text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="הסר מהרשימה">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
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
export function renderCalendar(containerId, schedule, config = { calendarType, overrides }) {
    const { calendarType = 'hebrew', overrides = {} } = config;
    const container = document.getElementById(containerId);
    if (!container) return;

    const existingDays = container.querySelectorAll('.calendar-day[data-date]');

    if (existingDays.length > 0 && existingDays.length === schedule.length) {
        // SUCCESS: Structure matches perfectly. Update content and state classes in-place.
        schedule.forEach((day, index) => {
            const dayEl = existingDays[index];
            if (!dayEl) return;

            // Update state classes and indicators
            const state = overrides[day.dateString] || 0;
            dayEl.classList.remove('force-break', 'force-study');

            let indicatorEl = dayEl.querySelector('.absolute.bottom-1.right-1');

            if (state === 1) {
                dayEl.classList.add('force-break');
                if (!indicatorEl) {
                    dayEl.insertAdjacentHTML('beforeend', '<span class="absolute bottom-1 right-1 text-red-500 font-bold text-[10px]">✕</span>');
                } else {
                    indicatorEl.className = "absolute bottom-1 right-1 text-red-500 font-bold text-[10px]";
                    indicatorEl.textContent = "✕";
                }
            } else if (state === 2) {
                dayEl.classList.add('force-study');
                if (!indicatorEl) {
                    dayEl.insertAdjacentHTML('beforeend', '<span class="absolute bottom-1 right-1 text-blue-600 font-bold text-[10px]">✎</span>');
                } else {
                    indicatorEl.className = "absolute bottom-1 right-1 text-blue-600 font-bold text-[10px]";
                    indicatorEl.textContent = "✎";
                }
            } else if (indicatorEl) {
                indicatorEl.remove();
            }

            // Update Masechet label
            const masechetEl = dayEl.querySelector('.text-blue-800');
            if (masechetEl && masechetEl.textContent !== day.masechet) {
                masechetEl.textContent = day.masechet;
            }

            // Update content text AND dynamic styling classes
            const contentEl = dayEl.querySelector('.text-center.mt-1');
            if (contentEl) {
                // Synchronize the classes exactly as defined in your template layout
                contentEl.className = `text-[10px] font-bold text-center mt-1 leading-tight ${day.isEmpty ? 'text-slate-400 italic' : 'text-slate-800'}`;

                const newContentHTML = day.isHoliday
                    ? `<span class="holiday-label-small">${day.holidayTitle}</span>\n${day.content}`
                    : day.content;
                if (contentEl.innerHTML.trim() !== newContentHTML.trim()) {
                    contentEl.innerHTML = newContentHTML;
                }
            }

            // Update Page Count numbers
            const pagesEl = dayEl.querySelector('.mt-auto');
            const newPagesText = !day.isEmpty ? `${day.pages} דף` : '';
            if (pagesEl && pagesEl.textContent.trim() !== newPagesText) {
                pagesEl.textContent = newPagesText;
            }
        });

        return;
    }

    // --- 2. FALLBACK PATH: Structural Generation ---
    const savedGlobalY = window.scrollY;
    const scrollSnapshots = {};
    container.querySelectorAll('.calendar-month').forEach(monthEl => {
        const titleEl = monthEl.querySelector('.bg-slate-800');
        const scrollContainer = monthEl.querySelector('.calendar-scroll-container');
        if (titleEl && scrollContainer) {
            scrollSnapshots[titleEl.textContent.trim()] = scrollContainer.scrollLeft;
        }
    });

    container.innerHTML = "";

    const months = {};
    schedule.forEach(day => {
        let monthKey = (calendarType === 'hebrew')
            ? formatHebrewMonthTitle(day.date)
            : day.date.toLocaleString('he-IL', { month: 'long', year: 'numeric' });

        if (!months[monthKey]) months[monthKey] = [];
        months[monthKey].push(day);
    });

    for (const key in months) {
        const monthData = months[key];
        const monthWrapper = document.createElement('div');
        monthWrapper.className = "calendar-month bg-white shadow-xl rounded-2xl border border-slate-200 mb-10 overflow-hidden";

        const htmlBuffer = [];
        htmlBuffer.push(`<div class="bg-slate-800 text-white p-4 text-center font-bold text-xl">${key}</div>`);
        htmlBuffer.push(`<div class="calendar-scroll-container">`);
        htmlBuffer.push(`<div class="calendar-grid">`);

        ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].forEach(d => {
            htmlBuffer.push(`<div class="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500 border-b border-gray-200">${d}</div>`);
        });

        const firstDayOfWeek = monthData[0].date.getDay();
        for (let i = 0; i < firstDayOfWeek; i++) {
            htmlBuffer.push(`<div class="calendar-day bg-slate-50/50"></div>`);
        }

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

            htmlBuffer.push(`
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
            </div>`);
        });

        htmlBuffer.push(`</div></div>`);
        monthWrapper.innerHTML = htmlBuffer.join('');
        container.appendChild(monthWrapper);

        const scrollWrapper = monthWrapper.querySelector('.calendar-scroll-container');
        if (scrollWrapper && scrollSnapshots[key] !== undefined) {
            scrollWrapper.scrollLeft = scrollSnapshots[key];
        }
    }

    window.scrollTo(window.scrollX, savedGlobalY);
}

// Create custom dialog message
export function showDialog({
    title,
    message,
    icon = '⚠️',
    showCancel = false,
    confirmText = 'אישור',
    cancelText = 'ביטול'
}) {
    return new Promise((resolve) => {
        // שליפת האלמנטים מה-DOM
        const overlay = document.getElementById('customDialogOverlay');
        const dialogBox = document.getElementById('customDialogBox');
        const titleEl = document.getElementById('dialogTitle');
        const messageEl = document.getElementById('dialogMessage');
        const iconEl = document.getElementById('dialogIcon');
        const confirmBtn = document.getElementById('dialogConfirmBtn');
        const cancelBtn = document.getElementById('dialogCancelBtn');

        // עדכון התוכן בדיאלוג
        titleEl.textContent = title;
        messageEl.textContent = message;
        iconEl.innerHTML = icon;
        confirmBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;

        // הצגה/הסתרה של כפתור הביטול בהתאם לצורך
        if (showCancel) {
            cancelBtn.classList.remove('hidden');
        } else {
            cancelBtn.classList.add('hidden');
        }

        // פונקציית סגירה עם אנימציה
        function closeDialog(result) {
            // אנימציית יציאה
            overlay.classList.remove('opacity-100');
            dialogBox.classList.remove('scale-100');
            overlay.classList.add('opacity-0');
            dialogBox.classList.add('scale-95');

            setTimeout(() => {
                overlay.classList.add('hidden');
                // ניקוי האזנת אירועים כדי למנוע כפילויות בעתיד
                confirmBtn.replaceWith(confirmBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                overlay.replaceWith(overlay.cloneNode(true));

                // החזרת התשובה
                resolve(result);
            }, 200); // תואם לזמן ה-duration של Tailwind (200ms)
        }

        // הצגת החלונית עם אנימציה (שימוש ב-setTimeout קצר מאפשר ל-Transition לעבוד)
        overlay.classList.remove('hidden');
        setTimeout(() => {
            overlay.classList.remove('opacity-0', 'scale-95');
            overlay.classList.add('opacity-100');
            dialogBox.classList.remove('scale-95');
            dialogBox.classList.add('scale-100');
        }, 10);

        // האזנה ללחיצות על הכפתורים החדשים (שנבנו מחדש בתוך closeDialog)
        document.getElementById('dialogConfirmBtn').addEventListener('click', () => closeDialog(true));
        document.getElementById('dialogCancelBtn').addEventListener('click', () => closeDialog(false));

        // סגירה בלחיצה מחוץ לקופסה (על הרקע הכהה)
        document.getElementById('customDialogOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('customDialogOverlay')) {
                closeDialog(false);
            }
        });
    });
}