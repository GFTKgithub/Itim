import { numberToHebrew, formatGematria } from '../../utils/gematria.js';
import { formatHebrewMonthTitle } from '../../utils/dates.js';

// Internal fallback state tracker for when config.activeMonthIndex isn't managed externally
let internalMonthIndex = 0;

// Orchestrates the rendering of the calendar UI
export function renderCalendar(containerId, studySchedule, config = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 1. Sync container presentation class
    container.classList.toggle('minimal-calendar', !!config.isMinimal);

    // 2. Always fully re-render to handle view mode transitions and structural changes reliably.
    //    Avoid fragile patching that can't handle month additions/removals.
    renderFullCalendarLayout(container, studySchedule, config);
}

// Create a calendar day cell HTML templates
function createDayHTML(day, state, mainDateDisplay, secondaryDateDisplay) {
    // 1. Resolve status override properties
    let statusClass = "";
    let indicatorHtml = "";
    
    if (state === 1) {
        statusClass = "force-break";
        indicatorHtml = '<span class="absolute bottom-1 right-1 text-red-500 font-bold text-[10px]">✕</span>';
    } else if (state === 2) {
        statusClass = "force-study";
        indicatorHtml = '<span class="absolute bottom-1 right-1 text-blue-600 font-bold text-[10px]">✎</span>';
    }

    // 2. Resolve background styling waterfall
    let dayBgClass = '';
    if (day.isSiyum) {
        dayBgClass = 'siyum-bg bg-amber-50 border-amber-400 shadow-inner';
    } else if (state === 1 || state === 2) {
        dayBgClass = statusClass; 
    } else if (day.isShabbat) {
        dayBgClass = 'shabbat-bg';
    } else if (day.isHoliday) {
        dayBgClass = 'holiday-bg';
    } else if (day.isReviewDay) {
        dayBgClass = 'review-bg';
    }

    // 3. Prepare component snippets
    const siyumBadge = day.isSiyum 
        ? '<span class="block text-[9px] text-amber-800 font-extrabold tracking-wide z-10">★ סיום מסכת ★</span>' 
        : '';

    const holidayBadge = day.isHoliday 
        ? `<span class="holiday-label-small">${day.holidayTitle}</span>` 
        : '';

    const bookTextClass = day.isReviewDay 
        ? 'text-slate-500 font-medium' 
        : 'text-blue-800';

    const contentTextClass = day.isEmpty 
        ? 'text-slate-400 italic' 
        : 'text-slate-800';

    const mainDateColorClass = day.date.getDay() === 6 
        ? 'text-blue-700' 
        : 'text-slate-800';

    const pagesText = !day.isEmpty 
        ? `${day.pages} דף` 
        : '';

    // 4. Return the assembled HTML template literal
    return `
        <div data-date="${day.dateString}" 
             class="calendar-day cursor-pointer relative ${dayBgClass} border-b border-l border-gray-100 select-none">
            
            <div class="flex justify-between items-start mb-1">
                <div class="flex flex-col">
                    <span class="text-xs font-bold ${mainDateColorClass}">
                        ${mainDateDisplay}
                    </span>
                    <span class="text-[9px] text-slate-400 font-normal leading-none">
                        ${secondaryDateDisplay}
                    </span>
                </div>
                <span data-book-label class="text-[10px] font-bold whitespace-nowrap ${bookTextClass}">
                    ${day.book}
                </span>
            </div>
            
            ${indicatorHtml}

            <div class="text-[10px] font-bold text-center mt-1 leading-tight ${contentTextClass}">
                ${holidayBadge}
                ${siyumBadge}
                ${day.content}
            </div>

            <div class="mt-auto text-[8px] text-slate-400 text-left">
                ${pagesText}
            </div>
        </div>
    `.trim();
}

// Patches existing calendar day elements
function patchExistingCalendarDays(existingDays, studySchedule, overrides) {
    studySchedule.forEach((day, index) => {
        const dayEl = existingDays[index];
        if (!dayEl) return;

        const state = overrides[day.dateString] || 0;

        // 1. Update State Classes & Indicators
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

        // 2. Sync Background Colors (Clearing baseline styles safely)
        dayEl.classList.remove('siyum-bg', 'bg-amber-50', 'border-amber-400', 'shadow-inner', 'review-bg', 'shabbat-bg', 'holiday-bg');
        
        if (day.isSiyum) {
            dayEl.classList.add('siyum-bg', 'bg-amber-50', 'border-amber-400', 'shadow-inner');
        } else if (day.isReviewDay) {
            dayEl.classList.add('review-bg');
        } else if (day.isShabbat) {
            dayEl.classList.add('shabbat-bg');
        } else if (day.isHoliday) {
            dayEl.classList.add('holiday-bg');
        } else if (state === 1) {
            dayEl.classList.add('force-break');
        } else if (state === 2) {
            dayEl.classList.add('force-study');
        }

        // 3. Update Book Label
        const bookEl = dayEl.querySelector('[data-book-label]');
        if (bookEl) {
            if (bookEl.textContent !== day.book) bookEl.textContent = day.book;
            bookEl.className = `text-[10px] font-bold whitespace-nowrap ${day.isReviewDay ? 'text-slate-500 font-medium' : 'text-blue-800'}`;
        }

        // 4. Update Main Content HTML
        const contentEl = dayEl.querySelector('.text-center.mt-1');
        if (contentEl) {
            contentEl.className = `text-[10px] font-bold text-center mt-1 leading-tight ${day.isEmpty ? 'text-slate-400 italic' : 'text-slate-800'}`;

            const siyumBadge = day.isSiyum ? `<span class="block text-[9px] text-amber-800 font-extrabold tracking-wide z-10">★ סיום מסכת ★</span>` : '';
            const newContentHTML = day.isHoliday
                ? `<span class="holiday-label-small">${day.holidayTitle}</span>\n${day.content}${siyumBadge}`
                : `${siyumBadge}${day.content}`;

            if (contentEl.innerHTML.trim() !== newContentHTML.trim()) {
                contentEl.innerHTML = newContentHTML;
            }
        }

        // 5. Update Pages
        const pagesEl = dayEl.querySelector('.mt-auto.text-\\[8px\\]');
        if (pagesEl) {
            const newPagesHTML = !day.isEmpty ? `${day.pages} דף` : '';
            if (pagesEl.innerHTML.trim() !== newPagesHTML.trim()) {
                pagesEl.innerHTML = newPagesHTML;
            }
        }
    });
}

// Completes recreates the calendar grid UI layout and renders
function renderFullCalendarLayout(container, studySchedule, config) {
    const { calendarSystem = 'hebrew', overrides = {}, calendarViewMode = 'paginated' } = config;
    
    // Fall back to our module pointer if the app isn't driving activeMonthIndex explicitly
    const activeMonthIndex = config.activeMonthIndex !== undefined ? config.activeMonthIndex : internalMonthIndex;

    // 1. Capture user UI scroll states before destruction
    const savedGlobalY = window.scrollY;
    const scrollSnapshots = captureScrollStates(container);

    container.innerHTML = "";

    // 2. Group study days into months
    const months = {};
    studySchedule.forEach(day => {
        const monthKey = (calendarSystem === 'hebrew')
            ? formatHebrewMonthTitle(day.date)
            : day.date.toLocaleString('he-IL', { month: 'long', year: 'numeric' });

        if (!months[monthKey]) months[monthKey] = [];
        months[monthKey].push(day);
    });

    // Extract targeted keys depending on layout mode configuration parameters
    const monthKeys = Object.keys(months);
    const validatedIndex = Math.max(0, Math.min(activeMonthIndex, monthKeys.length - 1));
    
    // Synchronize tracking index internally 
    internalMonthIndex = validatedIndex;

    const targetedKeys = calendarViewMode === 'paginated' 
        ? [monthKeys[validatedIndex]] 
        : monthKeys;

    // 3. Render HTML blocks for each month group
    targetedKeys.forEach(key => {
        const monthData = months[key];
        if (!monthData || monthData.length === 0) return;

        const monthWrapper = document.createElement('div');
        monthWrapper.className = "calendar-month bg-white shadow-xl rounded-2xl border border-slate-200 mb-10 overflow-hidden";

        const htmlBuffer = [];
        
        // Render headers containing navigation triggers only when running single-month views
        if (calendarViewMode === 'paginated') {
            htmlBuffer.push(`
                <div class="bg-slate-800 text-white p-4 flex justify-between items-center font-bold text-xl select-none no-print">
                    <button data-nav="prev" class="cursor-pointer px-2 opacity-80 hover:opacity-100 no-print">&rarr;</button>
                    <span>${key}</span>
                    <button data-nav="next" class="cursor-pointer px-2 opacity-80 hover:opacity-100 no-print">&larr;</button>
                </div>
            `);
        } else {
            htmlBuffer.push(`<div class="bg-slate-800 text-white p-4 text-center font-bold text-xl">${key}</div>`);
        }
        
        htmlBuffer.push(`<div class="calendar-scroll-container">`);
        htmlBuffer.push(`<div class="calendar-grid">`);

        // Render Hebrew weekday column headers
        ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].forEach(d => {
            htmlBuffer.push(`<div class="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500 border-b border-gray-200 select-none">${d}</div>`);
        });

        // Pad front grid slots before month begins
        const firstDayOfWeek = monthData[0].date.getDay();
        for (let i = 0; i < firstDayOfWeek; i++) {
            htmlBuffer.push(`<div class="calendar-day bg-slate-50/50"></div>`);
        }

        // Loop and build out cells using clean decoupled template generator
        monthData.forEach(day => {
            const state = overrides[day.dateString] || 0;
            const hebrewDayNum = parseInt(new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' }).format(day.date));

            // Extract string determinations completely outside the HTML template
            let mainDateDisplay;
            let secondaryDateDisplay;

            if (calendarSystem === 'hebrew') {
                mainDateDisplay = formatGematria(hebrewDayNum, numberToHebrew(hebrewDayNum));
                secondaryDateDisplay = `${day.date.getDate()}.${day.date.getMonth() + 1}`;
            } else {
                mainDateDisplay = day.date.getDate();
                secondaryDateDisplay = formatGematria(hebrewDayNum, numberToHebrew(hebrewDayNum));
            }

            // Fire off template literal mapping call
            htmlBuffer.push(createDayHTML(day, state, mainDateDisplay, secondaryDateDisplay));
        });

        htmlBuffer.push(`</div></div>`);
        monthWrapper.innerHTML = htmlBuffer.join('');
        container.appendChild(monthWrapper);

        // Dispatches navigation click signals to be handled externally via custom config callbacks
        if (calendarViewMode === 'paginated') {
            const prevBtn = monthWrapper.querySelector('[data-nav="prev"]');
            const nextBtn = monthWrapper.querySelector('[data-nav="next"]');
            
            if (prevBtn && typeof config.onMonthChange === 'function') {
                prevBtn.addEventListener('click', () => {
                    if (validatedIndex > 0) config.onMonthChange(-1);
                });
            } else if (prevBtn) {
                // Self-contained fallback click handler if controller callback is omitted
                prevBtn.addEventListener('click', () => {
                    if (validatedIndex > 0) {
                        internalMonthIndex--;
                        renderFullCalendarLayout(container, studySchedule, config);
                    }
                });
            }

            if (nextBtn && typeof config.onMonthChange === 'function') {
                nextBtn.addEventListener('click', () => {
                    if (validatedIndex < monthKeys.length - 1) config.onMonthChange(1);
                });
            } else if (nextBtn) {
                // Self-contained fallback click handler if controller callback is omitted
                nextBtn.addEventListener('click', () => {
                    if (validatedIndex < monthKeys.length - 1) {
                        internalMonthIndex++;
                        renderFullCalendarLayout(container, studySchedule, config);
                    }
                });
            }
        }

        // 4. Restore scroll coordinates back onto newly generated nodes
        const scrollWrapper = monthWrapper.querySelector('.calendar-scroll-container');
        if (scrollWrapper && scrollSnapshots[key] !== undefined) {
            scrollWrapper.scrollLeft = scrollSnapshots[key];
        }
    });

    window.scrollTo(window.scrollX, savedGlobalY);
}

// Secondary Scroll Context Capture Utility
function captureScrollStates(container) {
    const snapshots = {};
    container.querySelectorAll('.calendar-month').forEach(monthEl => {
        const titleEl = monthEl.querySelector('.bg-slate-800 span') || monthEl.querySelector('.bg-slate-800');
        const scrollContainer = monthEl.querySelector('.calendar-scroll-container');
        if (titleEl && scrollContainer) {
            snapshots[titleEl.textContent.trim()] = scrollContainer.scrollLeft;
        }
    });
    return snapshots;
}

export function updateCalendarViewToggle(viewMode) {
    const iconEl = document.getElementById('toggleViewIcon');
    const textEl = document.getElementById('toggleViewText');
    if (!iconEl || !textEl) return;

    // Use the passed mode directly; if not provided, fall back to reading the stored preference
    const currentMode = viewMode || 'paginated';

    if (currentMode === 'continuous') {
        iconEl.textContent = '📅';
        textEl.textContent = 'הצג תצוגת חודשים נפרדים';
    } else {
        iconEl.textContent = '📄';
        textEl.textContent = 'הצג את כל החודשים ברצף';
    }
}