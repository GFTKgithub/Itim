// Updates UI of Book sequence
export function updateBookSequenceUI(sequence) {
    const list = document.getElementById('bookSequenceList');
    const badge = document.getElementById('bookCountBadge');
    const clearBtn = document.getElementById('clearSequenceBtn');

    if (!list) return;

    const count = sequence ? sequence.length : 0;
    const hasBooks = count > 0;

    // --- 1. Update Step 2 & Step 3 Grayed-Out / Disabled States ---
    const step2Card = document.querySelector('.step-2');
    if (step2Card) {
        step2Card.classList.toggle('step-disabled', !hasBooks);
        const step2Number = step2Card.querySelector('.step-number');
        if (step2Number) step2Number.classList.toggle('step-number-muted', !hasBooks);

        const settingsGearBtn = document.getElementById('settingsGearBtn');
        if (settingsGearBtn) {
            settingsGearBtn.classList.toggle('opacity-30', !hasBooks);
            settingsGearBtn.classList.toggle('pointer-events-none', !hasBooks);
        }
    }

    const step3Card = document.querySelector('.step-3');
    if (step3Card) {
        step3Card.classList.toggle('step-disabled', !hasBooks);
        const step3Number = step3Card.querySelector('.step-number');
        if (step3Number) step3Number.classList.toggle('step-number-muted', !hasBooks);

        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.disabled = !hasBooks;
            generateBtn.classList.toggle('opacity-40', !hasBooks);
            generateBtn.classList.toggle('cursor-not-allowed', !hasBooks);
        }
    }

    // --- 2. Update Empty List State ---
    if (!hasBooks) {
        list.className = "max-h-64 overflow-y-auto bg-slate-50 p-4 rounded-xl border-2 border-dashed border-slate-200 min-h-[80px]";
        list.innerHTML = `
            <div class="text-center text-slate-400 text-sm italic pt-4">
                <div class="text-2xl mb-2">📚</div>
                <span>עדיין לא נבחרו ספרים. בחר ספר מהרשימה ולחץ "הוסף".</span>
            </div>`;
        if (badge) { badge.textContent = '0 ספרים'; badge.className = 'count-badge'; }
        if (clearBtn) clearBtn.classList.add('hidden');
        return;
    }

    // --- 3. Update Active List State ---
    list.className = "ordered-book-list space-y-1.5 max-h-64 overflow-y-auto bg-slate-50 py-3 px-2 rounded-xl border-2 border-dashed border-slate-200 min-h-[80px] touch-pan-y";
    
    if (badge) { badge.textContent = `${count} ספרים`; badge.className = 'count-badge count-badge-active'; }
    if (clearBtn) clearBtn.classList.remove('hidden');

    list.innerHTML = sequence.map((m, i) => {
        const bookName = typeof m === 'string' ? m : m.name;

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
                </div>
                
                <div class="flex items-center gap-1 shrink-0 mr-2">
                    <button data-index="${i}" class="configure-btn flex items-center gap-1.5 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-slate-200 hover:border-blue-200" title="הגדרת תאריכים וחזרות">
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