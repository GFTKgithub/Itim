// utils
import { numberToHebrew, formatGematria } from './utils/gematria.js';
import { formatHebrewMonthTitle } from './utils/dates.js';

// Hydrates the user configuration panel elements with saved data
export function hydrateHtmlFromAppState(AppState) {
    document.getElementById('calcMethod').value = AppState.userSettings.method;
    document.getElementById('calendarType').value = AppState.userSettings.calendarType;
    document.getElementById('includeHolidaysInput').checked = AppState.userSettings.includeHolidays;
    document.getElementById('startDateInput').value = AppState.userSettings.startDate;
    document.getElementById('targetDateInput').value = AppState.userSettings.targetDate;
    document.getElementById('paceInput').value = AppState.userSettings.pace;
    document.getElementById('startDafInput').value = AppState.userSettings.startDaf;
    document.getElementById('startAmudInput').value = AppState.userSettings.startAmud;

    // Synchronize Weekday Selection checkboxes
    const activeDays = AppState.userSettings.studyDays || [];
    document.querySelectorAll('input[name="studyDays"]').forEach(checkbox => {
        checkbox.checked = activeDays.includes(parseInt(checkbox.value, 10));
    });
}

// Updates UI of Book sequence 
export function updateBookSequenceUI(sequence) {
    const list = document.getElementById('bookSequenceList');

    if (!sequence || sequence.length === 0) {
        list.className = "max-h-56 overflow-y-auto bg-slate-50 p-4 rounded-xl border-2 border-dashed border-slate-300 min-h-[80px]";
        list.innerHTML = `
            <div class="text-center text-slate-400 text-sm italic">
                אין מסכתות ברשימה. בחר מסכת מלמעלה והוסף אותה.
            </div>`;
        return;
    }

    list.className = "ordered-book-list space-y-2 max-h-56 overflow-y-auto bg-slate-50 py-3 px-2 rounded-xl border-2 border-dashed border-slate-300 min-h-[80px] touch-pan-y";

    list.innerHTML = sequence.map((m, i) => {
        // Handle both string (old) and object (new) formats for backward compatibility during dev
        const bookName = typeof m === 'string' ? m : m.name;

        // Progress bar calculation
        const amudStates = (typeof m === 'object' && m.amudStates) ? m.amudStates : [];
        const total = amudStates.length;
        const learned = amudStates.filter(s => s === 1).length;
        const percent = total > 0 ? Math.round((learned / total) * 100) : 0;
        const progressBar = total > 0 ? `
            <div class="flex items-center gap-1.5 px-1 mt-1.5 mb-0.5">
                <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full bg-emerald-400 rounded-full transition-all duration-300" style="width: ${percent}%"></div>
                </div>
                <span class="text-[9px] text-slate-400 font-medium tabular-nums w-7 text-left">${percent}%</span>
            </div>` : '';

        return `
        <div data-index="${i}" class="drag-row flex items-center gap-2 select-none w-full py-0.5 touch-pan-y">
            <span class="static-index text-slate-400 font-bold text-xs w-5 text-center select-none pointer-events-none tracking-tight"></span>

            <li class="drag-item flex-1 flex justify-between items-center bg-white border border-slate-200 hover:border-blue-300 px-4 py-2.5 rounded-xl shadow-xs transition-all duration-150 relative touch-pan-y">
                
                <div class="flex flex-col flex-1 gap-0 min-w-0">
                    <div class="flex items-center gap-3">
                        <div class="drag-handle text-slate-400 hover:text-slate-600 flex flex-col gap-0.5 justify-center leading-none select-none cursor-grab p-2 touch-none">
                            <span class="block">•••</span>
                            <span class="block -mt-1.5">•••</span>
                        </div>
                        <span class="font-bold text-slate-700">
                            מסכת ${bookName}
                        </span>
                    </div>
                    ${progressBar}
                </div>
                
                <div class="flex items-center gap-1 shrink-0 mr-2">
                    <button data-index="${i}" class="configure-btn flex items-center gap-1.5 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-slate-200 hover:border-blue-200" title="הגדרת התקדמות וחזרות">
                        <span>הגדר</span>
                        <span class="text-sm">⚙️</span>
                    </button>

                    <button data-index="${i}" class="remove-btn text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors z-10" title="הסר מהרשימה">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </li>
        </div>`;
    }).join('');
}

// Renders the interactive Amud Grid inside the configuration modal
export function renderAmudGrid(containerId, amudStates, isBunched = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const htmlBuffer = [];

    amudStates.forEach((state, i) => {
        // Bunched mode: one button per daf — only render even indices (amud א), skip amud ב
        if (isBunched && i % 2 !== 0) return;

        const dafNum = Math.floor(i / 2) + 2;
        const dafGematria = numberToHebrew(dafNum);

        let label, colorClass;

        if (isBunched) {
            // In bunched mode, combine state of both amudim: learned if both are 1, skipped if both are 2, else unlearned
            const stateB = amudStates[i + 1]; // may be undefined on last daf
            const combinedLearned = state === 1 && (stateB === 1 || stateB === undefined);
            const combinedSkipped = state === 2 && (stateB === 2 || stateB === undefined);
            label = dafGematria;
            colorClass = combinedLearned
                ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                : combinedSkipped
                    ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                    : "bg-slate-100 text-slate-400 border-slate-200";
        } else {
            const amudSuffix = (i % 2 === 0) ? '.' : ':';
            label = `${dafGematria}${amudSuffix}`;
            colorClass = state === 1
                ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                : state === 2
                    ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                    : "bg-slate-100 text-slate-400 border-slate-200";
        }

        htmlBuffer.push(`
            <button data-amud-idx="${i}"
                class="amud-btn h-10 rounded-lg border-b-2 font-bold text-xs transition-all active:scale-95 ${colorClass}">
                ${label}
            </button>
        `);
    });

    container.innerHTML = htmlBuffer.join('');
}

// Renders the daily study requirement view — one button per scheduled day for this Book, colored by progress and with badges for today and completion status
export function renderDailyView(containerId, daySlots, amudStates) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!daySlots || daySlots.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 italic text-sm py-8">
            אין ימי לימוד מתוכננים. יש ליצור לוח לימוד תחילה.
        </div>`;
        return;
    }

    const today = new Date().toISOString().split('T')[0];

    const html = daySlots.map((slot, idx) => {
        let learnedCount = 0, skippedCount = 0;
        for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
            if (i < amudStates.length) {
                if (amudStates[i] === 1) learnedCount++;
                else if (amudStates[i] === 2) skippedCount++;
            }
        }
        const isFullyLearned = learnedCount === slot.amudCount;
        const isFullySkipped = skippedCount === slot.amudCount;
        const isPartial = (learnedCount > 0 || skippedCount > 0) && !isFullyLearned && !isFullySkipped;
        const isToday = slot.dateString === today;
        const isPast = slot.dateString < today;

        // Badge row is always rendered at fixed height to prevent layout shift
        let badgeText, badgeColor;
        if (isFullyLearned)      { badgeText = '✓';    badgeColor = 'text-emerald-500'; }
        else if (isFullySkipped) { badgeText = 'דלג';  badgeColor = 'text-amber-500'; }
        else if (isPartial)      { badgeText = `${learnedCount}/${slot.amudCount}`; badgeColor = 'text-blue-500'; }
        else if (isToday)        { badgeText = 'היום'; badgeColor = 'text-blue-600'; }
        else                     { badgeText = '\u00A0'; badgeColor = ''; } // non-breaking space holds the row height

        let bg, border, textColor;
        if (isFullyLearned)      { bg = 'bg-emerald-50'; border = 'border-emerald-300'; textColor = 'text-emerald-800'; }
        else if (isFullySkipped) { bg = 'bg-amber-50';   border = 'border-amber-300';   textColor = 'text-amber-800'; }
        else if (isPartial)      { bg = 'bg-blue-50';    border = 'border-blue-300';     textColor = 'text-blue-800'; }
        else if (isToday)        { bg = 'bg-blue-50';    border = 'border-blue-400';     textColor = 'text-blue-800'; }
        else if (isPast)         { bg = 'bg-slate-50';   border = 'border-slate-200';    textColor = 'text-slate-400'; }
        else                     { bg = 'bg-white';      border = 'border-slate-200';    textColor = 'text-slate-600'; }

        const [, m, d] = slot.dateString.split('-');
        const dateLabel = `${d}/${m}`;
        const dafRange = slot.label.split('—')[1]?.trim() || '';

        return `<button data-slot-idx="${idx}"
            class="day-slot-btn flex flex-col items-center justify-between p-2 rounded-xl border-2 ${bg} ${border} transition-all active:scale-95 hover:shadow-sm h-16 w-full">
            <span class="text-[11px] font-bold ${textColor} leading-tight">${dateLabel}</span>
            <span class="text-[9px] ${textColor} opacity-70 leading-tight text-center max-w-full truncate px-0.5">${dafRange}</span>
            <span class="text-[10px] font-bold ${badgeColor} leading-tight">${badgeText}</span>
        </button>`;
    }).join('');

    container.innerHTML = `<div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">${html}</div>`;
}

// Simple helper to refresh just the progress text in the modal header
export function updateModalProgressStats(amudStates) {
    const learned = amudStates.filter(s => s === 1).length;
    const total = amudStates.length;
    const percent = total > 0 ? Math.round((learned / total) * 100) : 0;
    const infoEl = document.getElementById('configModalProgressInfo');
    if (infoEl) {
        infoEl.innerText = `התקדמות: ${learned}/${total} עמודים (${percent}%)`;
    }
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

        if (yearNum < 1000) yearNum += 5000;

        const rawDayHebrew = numberToHebrew(dayNum);
        const rawYearHebrew = numberToHebrew(yearNum);

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

    const getHebrewLabelText = (dateInput) => {
        if (!dateInput) return "";

        const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);

        // Check for an invalid date
        if (isNaN(dateObj.getTime())) return "";

        try {
            const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }).formatToParts(dateObj);

            const dayNum = parseInt(parts.find(p => p.type === 'day').value, 10);
            let yearNum = parseInt(parts.find(p => p.type === 'year').value, 10);
            const monthName = parts.find(p => p.type === 'month').value;

            if (yearNum < 1000) yearNum += 5000;

            const dayHebrew = formatGematria(dayNum, numberToHebrew(dayNum));
            const yearHebrew = formatGematria(yearNum, numberToHebrew(yearNum));

            return `${dayHebrew} ב${monthName} ${yearHebrew}`;
        } catch (e) {
            console.error("Error generating custom Hebrew date format string", e);
            return "";
        }
    };

    if (startDateLabel) {
        startDateLabel.textContent = getHebrewLabelText(startDate);
    }

    if (targetDateLabel) {
        targetDateLabel.textContent = targetDate ? getHebrewLabelText(targetDate) : '';
    }
}

// Renders the calendar UI
export function renderCalendar(containerId, schedule, config = {}) {
    const { calendarType = 'hebrew', overrides = {} } = config;
    const container = document.getElementById(containerId);
    if (!container) return;

    const existingDays = container.querySelectorAll('.calendar-day[data-date]');

    // --- Path A: Optimized Partial Update ---
    if (existingDays.length > 0 && existingDays.length === schedule.length) {
        schedule.forEach((day, index) => {
            const dayEl = existingDays[index];
            if (!dayEl) return;

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

            // Sync structural background classes safely across updates
            if (day.isSiyum) {
                dayEl.classList.add('siyum-bg', 'bg-amber-50', 'border-amber-400', 'shadow-inner');
                dayEl.classList.remove('shabbat-bg', 'holiday-bg', 'review-bg');
            } else if (day.isReviewDay) {
                dayEl.classList.add('review-bg');
                dayEl.classList.remove('siyum-bg', 'bg-amber-50', 'border-amber-400', 'shadow-inner', 'shabbat-bg', 'holiday-bg');
            } else {
                dayEl.classList.remove('siyum-bg', 'bg-amber-50', 'border-amber-400', 'shadow-inner', 'review-bg');
                if (day.isShabbat) {
                    dayEl.classList.add('shabbat-bg');
                    dayEl.classList.remove('holiday-bg');
                } else if (day.isHoliday) {
                    dayEl.classList.add('holiday-bg');
                    dayEl.classList.remove('shabbat-bg');
                } else {
                    dayEl.classList.remove('shabbat-bg', 'holiday-bg');
                }
            }

            // Update book element classes dynamically for review mode tracking
            const bookEl = dayEl.querySelector('[data-book-label]');
            if (bookEl) {
                if (bookEl.textContent !== day.book) {
                    bookEl.textContent = day.book;
                }
                bookEl.className = `text-[10px] font-bold whitespace-nowrap ${day.isReviewDay ? 'text-slate-500 font-medium' : 'text-blue-800'}`;
            }

            const contentEl = dayEl.querySelector('.text-center.mt-1');
            if (contentEl) {
                contentEl.className = `text-[10px] font-bold text-center mt-1 leading-tight ${day.isEmpty ? 'text-slate-400 italic' : 'text-slate-800'}`;

                // Guaranteed uniform display string for both path matches
                const siyumBadge = day.isSiyum ? `<span class="block text-[9px] text-amber-800 font-extrabold tracking-wide z-10">★ סיום מסכת ★</span>` : '';

                const newContentHTML = day.isHoliday
                    ? `<span class="holiday-label-small">${day.holidayTitle}</span>\n${day.content}${siyumBadge}`
                    : `${siyumBadge}${day.content}`;

                if (contentEl.innerHTML.trim() !== newContentHTML.trim()) {
                    contentEl.innerHTML = newContentHTML;
                }
            }

            // Update page numbers dynamic printout
            const pagesEl = dayEl.querySelector('.mt-auto.text-\\[8px\\]');
            if (pagesEl) {
                const newPagesHTML = !day.isEmpty ? `${day.pages} דף` : '';
                if (pagesEl.innerHTML.trim() !== newPagesHTML.trim()) {
                    pagesEl.innerHTML = newPagesHTML;
                }
            }
        });

        return;
    }

    // --- Path B: Full Layout Render ---
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

            // Clean background selection waterfall logic
            let dayBgClass = '';
            if (day.isSiyum) {
                dayBgClass = 'siyum-bg bg-amber-50 border-amber-400 shadow-inner';
            } else if (day.isShabbat) {
                dayBgClass = 'shabbat-bg';
            } else if (day.isHoliday) {
                dayBgClass = 'holiday-bg';
            } else if (day.isReviewDay) {
                dayBgClass = 'review-bg';
            } else {
                dayBgClass = statusClass;
            }

            const siyumBadge = day.isSiyum ? `<span class="block text-[9px] text-amber-800 font-extrabold tracking-wide z-10">★ סיום מסכת ★</span>` : '';

            htmlBuffer.push(`
            <div data-date="${day.dateString}" 
                class="calendar-day cursor-pointer relative ${dayBgClass} border-b border-l border-gray-100">
                <div class="flex justify-between items-start mb-1">
                    <div class="flex flex-col">
                        <span class="text-xs font-bold ${day.date.getDay() === 6 ? 'text-blue-700' : 'text-slate-800'}">
                            ${mainDateDisplay}
                        </span>
                        <span class="text-[9px] text-slate-400 font-normal leading-none">
                            ${secondaryDateDisplay}
                        </span>
                    </div>
                    <span data-book-label class="text-[10px] font-bold whitespace-nowrap ${day.isReviewDay ? 'text-slate-500 font-medium' : 'text-blue-800'}">
                        ${day.book}
                    </span>
                </div>
                
                ${indicator}

                <div class="text-[10px] font-bold text-center mt-1 leading-tight ${day.isEmpty ? 'text-slate-400 italic' : 'text-slate-800'}">
                    ${day.isHoliday ? `<span class="holiday-label-small">${day.holidayTitle}</span>` : ''}
                    ${siyumBadge}
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
        const overlay = document.getElementById('customDialogOverlay');
        const dialogBox = document.getElementById('customDialogBox');
        const titleEl = document.getElementById('dialogTitle');
        const messageEl = document.getElementById('dialogMessage');
        const iconEl = document.getElementById('dialogIcon');
        const confirmBtn = document.getElementById('dialogConfirmBtn');
        const cancelBtn = document.getElementById('dialogCancelBtn');

        titleEl.textContent = title;
        messageEl.textContent = message;
        iconEl.innerHTML = icon;
        confirmBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;

        if (showCancel) {
            cancelBtn.classList.remove('hidden');
        } else {
            cancelBtn.classList.add('hidden');
        }

        function closeDialog(result) {
            overlay.classList.remove('opacity-100');
            dialogBox.classList.remove('scale-100');
            overlay.classList.add('opacity-0');
            dialogBox.classList.add('scale-95');

            setTimeout(() => {
                overlay.classList.add('hidden');
                confirmBtn.replaceWith(confirmBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                resolve(result);
            }, 200);
        }

        document.getElementById('dialogConfirmBtn').addEventListener('click', () => closeDialog(true));
        document.getElementById('dialogCancelBtn').addEventListener('click', () => closeDialog(false));

        overlay.classList.remove('hidden');
        setTimeout(() => {
            overlay.classList.remove('opacity-0', 'scale-95');
            overlay.classList.add('opacity-100', 'scale-100');
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