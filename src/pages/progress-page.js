/**
 * Progress Page — Eifo Ata Ochez (book progress marking).
 * Per-book amud grid with individual, bunched, and daily views for marking progress.
 */

import { renderAmudGrid, renderDailyView } from '../ui/components/book-config-modal.js';
import { getTotalAmudim } from '../utils/talmud.js';
import { computeDaySlots } from '../core/scheduler.js';

function getProgressPageHtml(activeTrack, bookSequence) {
    // Calculate stats from amudStates directly
    let totalAmudim = 0;
    let totalLearned = 0;
    let totalSkipped = 0;
    bookSequence.forEach((book) => {
        const bookName = typeof book === 'string' ? book : book.name;
        const total = getTotalAmudim(bookName);
        const states = (typeof book === 'object' && book.amudStates) ? book.amudStates : [];
        totalAmudim += total;
        totalLearned += states.filter(s => s === 1).length;
        totalSkipped += states.filter(s => s === 2).length;
    });
    const completionRate = totalAmudim > 0 ? Math.round((totalLearned / totalAmudim) * 100) : 0;

    return `
        <div class="max-w-5xl mx-auto p-4 md:p-8">
            <!-- Page Header -->
            <div class="mb-8">
                <div class="flex items-center gap-3 mb-2">
                    <span class="text-3xl">📊</span>
                    <h1 class="text-3xl font-black text-slate-800">התקדמות הלימוד</h1>
                </div>
                <p class="text-slate-500 font-medium mr-12">איפה אתה אוחז? סמן את ההתקדמות שלך</p>
            </div>

            ${!activeTrack ? `
                <div class="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
                    <span class="text-4xl block mb-3">📭</span>
                    <p class="text-amber-800 font-bold text-lg">אין מסלול לימוד פעיל</p>
                    <p class="text-amber-600 text-sm mt-1">צור מסלול לימוד כדי להתחיל</p>
                </div>
            ` : `
                <!-- Stats Cards -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-2xl">📚</span>
                            <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">מסלול</span>
                        </div>
                        <p class="text-3xl font-black text-slate-800">${bookSequence.length}</p>
                        <p class="text-sm text-slate-500 font-medium mt-1">מסכות במסלול</p>
                    </div>
                    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-2xl">📖</span>
                            <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">עמודים</span>
                        </div>
                        <p class="text-3xl font-black text-slate-800">${totalLearned}/${totalAmudim}</p>
                        <p class="text-sm text-slate-500 font-medium mt-1">עמודים נלמדו</p>
                    </div>
                    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-2xl">✅</span>
                            <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">התקדמות</span>
                        </div>
                        <p class="text-3xl font-black text-emerald-600">${completionRate}%</p>
                        <p class="text-sm text-slate-500 font-medium mt-1">${totalSkipped > 0 ? `${totalSkipped} דילוגים` : ''}</p>
                    </div>
                </div>

                <!-- Overall Progress Bar -->
                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="font-bold text-slate-800">התקדמות כללית</h3>
                        <span class="text-sm font-bold text-slate-500">${totalLearned}/${totalAmudim} עמודים</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                        <div id="overallProgressBar" class="bg-gradient-to-l from-blue-800 to-blue-600 h-full rounded-full transition-all duration-500 ease-out" 
                             style="width: ${completionRate}%"></div>
                    </div>
                    <div class="flex justify-between mt-2 text-xs text-slate-400">
                        <span id="skippedCountLabel">${totalSkipped > 0 ? `דילוגים: ${totalSkipped}` : ''}</span>
                        <span>${completionRate}% הושלם</span>
                    </div>
                </div>

                <!-- Sync to Today Button -->
                <div class="mb-6">
                    <button id="syncToTodayBtn" 
                        class="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 text-sm">
                        <span>🔄</span>
                        <span>סנכרן כל הימים שעברו כנלמדו</span>
                    </button>
                </div>

                <!-- Per-Book Progress Marking (Eifo Ata Ochez) -->
                <div id="progressBooksContainer" class="space-y-6">
                    ${bookSequence.length === 0 ? `
                        <div class="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center">
                            <span class="text-4xl block mb-2">📭</span>
                            <p class="text-slate-500 font-bold">אין מסכות במסלול זה</p>
                            <p class="text-slate-400 text-sm mt-1">הוסף מסכות בדף עריכת המסלול</p>
                        </div>
                    ` : bookSequence.map((book, idx) => {
                        const bookName = typeof book === 'string' ? book : book.name;
                        const totalAmudim = getTotalAmudim(bookName);
                        const amudStates = (typeof book === 'object' && book.amudStates) ? [...book.amudStates] : new Array(totalAmudim).fill(0);
                        const learned = amudStates.filter(s => s === 1).length;
                        const pct = totalAmudim > 0 ? Math.round((learned / totalAmudim) * 100) : 0;
                        
                        return `
                            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" data-book-idx="${idx}">
                                <div class="p-4 border-b border-slate-100">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="flex items-center gap-2">
                                            <span class="text-lg">📖</span>
                                            <h3 class="font-bold text-slate-800">מסכת ${bookName}</h3>
                                            <span id="bookProgressLabel_${idx}" class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">${learned}/${totalAmudim} עמודים</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span id="bookPctLabel_${idx}" class="text-xs font-bold text-slate-400">${pct}%</span>
                                            <div class="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                                                <div id="bookProgressBar_${idx}" class="bg-emerald-500 h-full rounded-full transition-all duration-300" style="width: ${pct}%"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- View toggle buttons -->
                                    <div class="flex bg-slate-100 p-0.5 rounded-lg self-start w-fit">
                                        <button data-book-idx="${idx}" data-view="individual" class="view-toggle-btn px-2.5 py-1 rounded-md text-[10px] font-bold bg-white shadow-sm">עמודים</button>
                                        <button data-book-idx="${idx}" data-view="bunched" class="view-toggle-btn px-2.5 py-1 rounded-md text-[10px] font-bold text-slate-500 hover:text-slate-700">דפים</button>
                                        <button data-book-idx="${idx}" data-view="daily" class="view-toggle-btn px-2.5 py-1 rounded-md text-[10px] font-bold text-slate-500 hover:text-slate-700">לפי תאריך</button>
                                    </div>
                                </div>
                                <div class="p-4">
                                    <div class="flex flex-wrap gap-1 mb-3">
                                        <span class="text-[10px] font-bold text-slate-400 flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block"></span> טרם</span>
                                        <span class="text-[10px] font-bold text-slate-400 flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> נלמד</span>
                                        <span class="text-[10px] font-bold text-slate-400 flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> דלג</span>
                                    </div>
                                    <div id="amudGrid_${idx}" class="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5"></div>
                                    <div id="dailyView_${idx}" class="hidden"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;
}

export function renderProgressPage(container, app) {
    const activeTrack = app.getActiveTrack();
    const bookSequence = activeTrack?.bookSequence || [];
    
    container.innerHTML = getProgressPageHtml(activeTrack, bookSequence);

    // Track view modes per book
    const viewModes = {};

    // Render amud grids and wire up clicks for each book
    bookSequence.forEach((book, idx) => {
        const bookName = typeof book === 'string' ? book : book.name;
        const totalAmudim = getTotalAmudim(bookName);
        const amudStates = (typeof book === 'object' && book.amudStates) ? [...book.amudStates] : new Array(totalAmudim).fill(0);
        const gridContainer = document.getElementById(`amudGrid_${idx}`);
        const dailyContainer = document.getElementById(`dailyView_${idx}`);
        
        viewModes[idx] = 'individual';
        
        if (gridContainer) {
            renderAmudGrid(`amudGrid_${idx}`, amudStates, false);
        }

        // Amud grid click handler
        if (gridContainer) {
            const handlerKey = `_progressAmudClick_${idx}`;
            if (gridContainer[handlerKey]) {
                gridContainer.removeEventListener('click', gridContainer[handlerKey]);
            }
            
            gridContainer[handlerKey] = (e) => {
                const btn = e.target.closest('.amud-btn');
                if (!btn) return;
                const amudIdx = parseInt(btn.dataset.amudIdx, 10);
                if (isNaN(amudIdx)) return;
                
                const bookEntry = activeTrack.bookSequence[idx];
                if (!bookEntry) return;
                
                if (typeof bookEntry === 'string') {
                    activeTrack.bookSequence[idx] = { name: bookEntry, amudStates: new Array(totalAmudim).fill(0) };
                }
                const entry = activeTrack.bookSequence[idx];
                if (!entry.amudStates) {
                    entry.amudStates = new Array(totalAmudim).fill(0);
                }
                
                // In bunched mode, update both amudim of the daf together
                const isBunched = viewModes[idx] === 'bunched';
                if (isBunched) {
                    const dafStartIdx = Math.floor(amudIdx / 2) * 2;
                    const currentState = entry.amudStates[dafStartIdx] || 0;
                    const newState = (currentState + 1) % 3;
                    entry.amudStates[dafStartIdx] = newState;
                    if (dafStartIdx + 1 < entry.amudStates.length) {
                        entry.amudStates[dafStartIdx + 1] = newState;
                    }
                } else {
                    const currentState = entry.amudStates[amudIdx];
                    entry.amudStates[amudIdx] = (currentState + 1) % 3;
                }
                
                // Re-render the grid
                renderAmudGrid(`amudGrid_${idx}`, entry.amudStates, isBunched);
                
                // Update per-book progress indicators
                const learned = entry.amudStates.filter(s => s === 1).length;
                const pct = totalAmudim > 0 ? Math.round((learned / totalAmudim) * 100) : 0;
                const labelEl = document.getElementById(`bookProgressLabel_${idx}`);
                const pctEl = document.getElementById(`bookPctLabel_${idx}`);
                const barEl = document.getElementById(`bookProgressBar_${idx}`);
                if (labelEl) labelEl.textContent = `${learned}/${totalAmudim} עמודים`;
                if (pctEl) pctEl.textContent = `${pct}%`;
                if (barEl) barEl.style.width = `${pct}%`;
                
                // Update overall stats
                updateOverallStats(activeTrack.bookSequence);
                
                // Save
                app.handleSaveBookConfig({ index: idx });
            };
            
            gridContainer.addEventListener('click', gridContainer[handlerKey]);
        }

        // Daily view click handler
        if (dailyContainer) {
            const dailyHandlerKey = `_progressDailyClick_${idx}`;
            if (dailyContainer[dailyHandlerKey]) {
                dailyContainer.removeEventListener('click', dailyContainer[dailyHandlerKey]);
            }
            dailyContainer[dailyHandlerKey] = (e) => {
                const btn = e.target.closest('.day-slot-btn');
                if (!btn) return;
                const slotIdx = parseInt(btn.dataset.slotIdx);
                if (isNaN(slotIdx)) return;
                
                const bookEntry = activeTrack.bookSequence[idx];
                if (!bookEntry) return;
                if (typeof bookEntry === 'string') {
                    activeTrack.bookSequence[idx] = { name: bookEntry, amudStates: new Array(totalAmudim).fill(0) };
                }
                const entry = activeTrack.bookSequence[idx];
                if (!entry.amudStates) {
                    entry.amudStates = new Array(totalAmudim).fill(0);
                }
                
                // Toggle all amudim in this day slot
                const schedule = activeTrack.studySchedule || [];
                const slots = computeDaySlots(schedule, bookName, idx, activeTrack.bookSequence);
                const slot = slots[slotIdx];
                if (!slot) return;
                
                // Cycle through states: 0 (unlearned) -> 1 (learned) -> 2 (skipped) -> 0
                const firstAmudIdx = slot.amudStart;
                const currentState = firstAmudIdx < entry.amudStates.length ? entry.amudStates[firstAmudIdx] : 0;
                const newState = (currentState + 1) % 3;
                for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount && i < entry.amudStates.length; i++) {
                    entry.amudStates[i] = newState;
                }
                
                renderDailyView(`dailyView_${idx}`, slots, entry.amudStates);
                
                const learned = entry.amudStates.filter(s => s === 1).length;
                const pct = totalAmudim > 0 ? Math.round((learned / totalAmudim) * 100) : 0;
                const labelEl = document.getElementById(`bookProgressLabel_${idx}`);
                const pctEl = document.getElementById(`bookPctLabel_${idx}`);
                const barEl = document.getElementById(`bookProgressBar_${idx}`);
                if (labelEl) labelEl.textContent = `${learned}/${totalAmudim} עמודים`;
                if (pctEl) pctEl.textContent = `${pct}%`;
                if (barEl) barEl.style.width = `${pct}%`;
                
                updateOverallStats(activeTrack.bookSequence);
                app.handleSaveBookConfig({ index: idx });
            };
            dailyContainer.addEventListener('click', dailyContainer[dailyHandlerKey]);
        }
    });

    // Wire up view toggle buttons
    container.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const bookIdx = parseInt(btn.dataset.bookIdx, 10);
            const view = btn.dataset.view;
            const book = activeTrack.bookSequence[bookIdx];
            if (!book) return;
            
            const bookName = typeof book === 'string' ? book : book.name;
            const totalAmudim = getTotalAmudim(bookName);
            const amudStates = (typeof book === 'object' && book.amudStates) ? [...book.amudStates] : new Array(totalAmudim).fill(0);
            const gridContainer = document.getElementById(`amudGrid_${bookIdx}`);
            const dailyContainer = document.getElementById(`dailyView_${bookIdx}`);
            viewModes[bookIdx] = view;
            
            // Update button styles
            const siblings = btn.closest('.flex.bg-slate-100')?.querySelectorAll('.view-toggle-btn');
            siblings?.forEach(s => {
                s.classList.remove('bg-white', 'shadow-sm');
                s.classList.add('text-slate-500');
            });
            btn.classList.add('bg-white', 'shadow-sm');
            btn.classList.remove('text-slate-500');
            
            viewModes[bookIdx] = view;
            
            if (view === 'daily') {
                gridContainer?.classList.add('hidden');
                dailyContainer?.classList.remove('hidden');
                const schedule = activeTrack.studySchedule || [];
                const slots = computeDaySlots(schedule, bookName, bookIdx, activeTrack.bookSequence);
                renderDailyView(`dailyView_${bookIdx}`, slots, amudStates);
            } else {
                gridContainer?.classList.remove('hidden');
                dailyContainer?.classList.add('hidden');
                const isBunched = view === 'bunched';
                renderAmudGrid(`amudGrid_${bookIdx}`, amudStates, isBunched);
            }
        });
    });

    // Helper to update overall stats
    function updateOverallStats(seq) {
        let tAmudim = 0;
        let tLearned = 0;
        let tSkipped = 0;
        seq.forEach((b) => {
            const bName = typeof b === 'string' ? b : b.name;
            const total = getTotalAmudim(bName);
            const states = (typeof b === 'object' && b.amudStates) ? b.amudStates : [];
            tAmudim += total;
            tLearned += states.filter(s => s === 1).length;
            tSkipped += states.filter(s => s === 2).length;
        });
        const rate = tAmudim > 0 ? Math.round((tLearned / tAmudim) * 100) : 0;
        
        const overallBar = document.getElementById('overallProgressBar');
        if (overallBar) overallBar.style.width = `${rate}%`;
        
        // Update stat cards
        const statCards = container.querySelectorAll('.grid.grid-cols-1.sm\\:grid-cols-3 .text-3xl');
        if (statCards.length >= 3) {
            statCards[1].textContent = `${tLearned}/${tAmudim}`;
            statCards[2].textContent = `${rate}%`;
        }
        
        // Update skipped count in progress bar section
        const skippedLabel = document.getElementById('skippedCountLabel');
        if (skippedLabel) {
            skippedLabel.textContent = tSkipped > 0 ? `דילוגים: ${tSkipped}` : '';
        }
    }

    // Wire up sync-to-today button
    const syncBtn = container.querySelector('#syncToTodayBtn');
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            await app.handleSyncToToday();
            // Update UI directly without re-rendering
            const updatedTrack = app.getActiveTrack();
            const updatedSeq = updatedTrack?.bookSequence || [];
            
            // Recalculate and update overall stats
            updateOverallStats(updatedSeq);
            
            // Re-render all grids with updated states
            updatedSeq.forEach((book, idx) => {
                const bookName = typeof book === 'string' ? book : book.name;
                const total = getTotalAmudim(bookName);
                const states = (typeof book === 'object' && book.amudStates) ? [...book.amudStates] : new Array(total).fill(0);
                const isBunched = viewModes[idx] === 'bunched';
                renderAmudGrid(`amudGrid_${idx}`, states, isBunched);
                
                // Update per-book labels
                const learned = states.filter(s => s === 1).length;
                const pct = total > 0 ? Math.round((learned / total) * 100) : 0;
                const labelEl = document.getElementById(`bookProgressLabel_${idx}`);
                const pctEl = document.getElementById(`bookPctLabel_${idx}`);
                const barEl = document.getElementById(`bookProgressBar_${idx}`);
                if (labelEl) labelEl.textContent = `${learned}/${total} עמודים`;
                if (pctEl) pctEl.textContent = `${pct}%`;
                if (barEl) barEl.style.width = `${pct}%`;
            });
        });
    }

    return () => {
        // Cleanup if needed
    };
}
