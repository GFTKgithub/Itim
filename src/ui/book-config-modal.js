import { numberToHebrew } from '../utils/gematria.js';
import { indexToDaf } from '../utils/talmud.js';

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
            // Uses your native engine formatting
            label = indexToDaf(i); 
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
        else if (isPartial)      { bg = 'bg-blue-50';    border = 'border-blue-300';    textColor = 'text-blue-800'; }
        else if (isToday)        { bg = 'bg-blue-50';    border = 'border-blue-400';    textColor = 'text-blue-800'; }
        else if (isPast)         { bg = 'bg-slate-50';   border = 'border-slate-200';   textColor = 'text-slate-400'; }
        else                     { bg = 'bg-white';      border = 'border-slate-200';   textColor = 'text-slate-600'; }

        const [, m, d] = slot.dateString.split('-');
        const dateLabel = `${d}/${m}`;
        
        // Dynamically compute the local range content labels safely using your indexToDaf engine
        let dafRange = '';
        if (slot.amudCount > 0) {
            const startLabel = indexToDaf(slot.amudStart);
            const endLabel = indexToDaf(slot.amudStart + slot.amudCount - 1);
            dafRange = (startLabel === endLabel) ? startLabel : `${startLabel} - ${endLabel}`;
        }

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

