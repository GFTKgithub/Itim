// Updates UI of Book sequence (planner page only — no progress bars)
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