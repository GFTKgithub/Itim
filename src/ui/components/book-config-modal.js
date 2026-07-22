import { indexToDaf } from '../../utils/talmud.js';

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