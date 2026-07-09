/**
 * Progress Page — Eifo Ata Ochez (book progress marking).
 * Per-book amud grid with amud, daf, and daily views for marking progress.
 * 
 * Catch-up plan feature: Completely rewritten from scratch.
 * - Target Date books: Move Target Date, Squeeze, Sprint
 * - Pace books: Sprint only
 * - Never modifies the baseline calendar
 */

import { renderAmudGrid, renderDailyView } from '../ui/components/book-config-modal.js';
import { getTotalAmudim } from '../utils/talmud.js';
import { computeDaySlots } from '../core/scheduler.js';
import { showDialog } from '../ui/components/dialog.js';

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
                        <p id="statsSkippedCount" class="text-sm text-slate-500 font-medium mt-1">${totalSkipped > 0 ? `${totalSkipped} דילוגים` : ''}</p>
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

                <!-- Catch-Up Status & Actions -->
                <div class="mb-6 space-y-3">

                    <!-- Catch-Up Section -->
                    <div id="catchUpSection" class="hidden"></div>
                </div>

                <!-- Calendar (baseline or catch-up overlay) -->
                <div id="progressCalendarContainer" class="mb-8"></div>

                <!-- Sync to Today Button -->
                <div class="flex justify-start mb-8">
                    <button id="syncToTodayBtn" 
                        class="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold px-5 py-2.5 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 text-sm">
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
                                        <button data-book-idx="${idx}" data-view="daily" class="view-toggle-btn px-2.5 py-1 rounded-md text-[10px] font-bold bg-white shadow-sm">לפי תאריך</button>
                                        <button data-book-idx="${idx}" data-view="amud" class="view-toggle-btn px-2.5 py-1 rounded-md text-[10px] font-bold text-slate-500 hover:text-slate-700">עמודים</button>
                                        <button data-book-idx="${idx}" data-view="daf" class="view-toggle-btn px-2.5 py-1 rounded-md text-[10px] font-bold text-slate-500 hover:text-slate-700">דפים</button>
                                    </div>
                                </div>
                                <div class="p-4">
                                    <div class="flex flex-wrap gap-1 mb-3">
                                        <span class="text-[10px] font-bold text-slate-400 flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block"></span> טרם</span>
                                        <span class="text-[10px] font-bold text-slate-400 flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> נלמד</span>
                                        <span class="text-[10px] font-bold text-slate-400 flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> דלג</span>
                                    </div>
                                    <div id="amudGrid_${idx}" class="hidden grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5"></div>
                                    <div id="dailyView_${idx}"></div>
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

    // Render the calendar with catch-up overlay if active
    app.handleScheduleGeneration();

    // Render amud grids and wire up clicks for each book
    bookSequence.forEach((book, idx) => {
        const bookName = typeof book === 'string' ? book : book.name;
        const totalAmudim = getTotalAmudim(bookName);
        const amudStates = (typeof book === 'object' && book.amudStates) ? [...book.amudStates] : new Array(totalAmudim).fill(0);
        const gridContainer = document.getElementById(`amudGrid_${idx}`);
        const dailyContainer = document.getElementById(`dailyView_${idx}`);
        
        viewModes[idx] = 'daily';
        
        if (dailyContainer) {
            const schedule = activeTrack.studySchedule || [];
            const slots = computeDaySlots(schedule, bookName, idx, activeTrack.bookSequence);
            renderDailyView(`dailyView_${idx}`, slots, amudStates);
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
                
                // In daf mode, update both amudim of the daf together
                const isDaf = viewModes[idx] === 'daf';
                if (isDaf) {
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
                renderAmudGrid(`amudGrid_${idx}`, entry.amudStates, isDaf);
                
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
                const isDaf = view === 'daf';
                renderAmudGrid(`amudGrid_${bookIdx}`, amudStates, isDaf);
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
        
        // Update skipped count in stats card
        const statsSkippedEl = document.getElementById('statsSkippedCount');
        if (statsSkippedEl) {
            statsSkippedEl.textContent = tSkipped > 0 ? `${tSkipped} דילוגים` : '';
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
            const track = app.getActiveTrack();
            const hasActivePlan = track?.catchUpPlan?.isActive;

            if (hasActivePlan) {
                const confirmed = await showDialog({
                    title: 'סנכרן עד היום',
                    message: 'האם אתה בטוח שברצונך לסנכרן? פעולה זו תבטל את תכנית ההשלמה הפעילה.',
                    icon: '🔄',
                    showCancel: true,
                    confirmText: 'כן, סנכרן ובטל תכנית',
                    cancelText: 'ביטול'
                });
                if (!confirmed) return;

                // Cancel plan without showing its own confirmation dialog
                await app.handleCancelCatchUpPlan(true);
            }

            await app.handleSyncToToday();
            const updatedTrack = app.getActiveTrack();
            const updatedSeq = updatedTrack?.bookSequence || [];
            
            updateOverallStats(updatedSeq);
            
            updatedSeq.forEach((book, idx) => {
                const bookName = typeof book === 'string' ? book : book.name;
                const total = getTotalAmudim(bookName);
                const states = (typeof book === 'object' && book.amudStates) ? [...book.amudStates] : new Array(total).fill(0);
                const isDaf = viewModes[idx] === 'daf';
                renderAmudGrid(`amudGrid_${idx}`, states, isDaf);
                
                const learned = states.filter(s => s === 1).length;
                const pct = total > 0 ? Math.round((learned / total) * 100) : 0;
                const labelEl = document.getElementById(`bookProgressLabel_${idx}`);
                const pctEl = document.getElementById(`bookPctLabel_${idx}`);
                const barEl = document.getElementById(`bookProgressBar_${idx}`);
                if (labelEl) labelEl.textContent = `${learned}/${total} עמודים`;
                if (pctEl) pctEl.textContent = `${pct}%`;
                if (barEl) barEl.style.width = `${pct}%`;
            });
            
            renderCatchUpSection();
        });
    }

    /* ================================================================
     * CATCH-UP PLAN — COMPLETE REWRITE
     * ================================================================
     *
     * Three strategies for Target Date books:
     *   1. Move Target Date — Let the user set a new target date
     *   2. Squeeze — Redistribute remaining material evenly over remaining days
     *   3. Sprint — Temporarily increase pace for N days, then resume normal pace
     *
     * One strategy for Pace books:
     *   1. Sprint — Temporarily increase pace for N days, then resume normal pace
     * ================================================================ */

    function renderCatchUpSection() {
        const catchUpSection = document.getElementById('catchUpSection');
        if (!catchUpSection) return;

        const deficit = app.getCatchUpDeficit();
        const track = app.getActiveTrack();
        const hasPlan = track?.catchUpPlan?.isActive;

        if (!deficit.isAnyBehind && !hasPlan) {
            catchUpSection.classList.add('hidden');
            return;
        }

        catchUpSection.classList.remove('hidden');

        if (hasPlan) {
            renderActivePlan(catchUpSection, deficit, track);
        } else {
            renderDeficitNotice(catchUpSection, deficit);
        }
    }

    function renderActivePlan(section, deficit, track) {
        const plan = track.catchUpPlan;
        const planEntries = Object.entries(plan.books || {});
        const detailsHtml = planEntries.map(([bookIdx, bp]) => {
            const book = track.bookSequence[parseInt(bookIdx)];
            const bookName = typeof book === 'string' ? book : (book?.name || 'לא ידוע');
            let desc = '';
            if (bp.strategy === 'move-target') {
                desc = `יעד חדש: ${bp.newTargetDate || 'ללא תאריך'}`;
            } else if (bp.strategy === 'squeeze') {
                desc = 'חלוקה מחדש של החומר הנותר על הימים הנותרים';
            } else if (bp.strategy === 'sprint') {
                desc = `ספרינט: ${bp.sprintDays} ימים קצב מוגבר`;
            } else if (bp.strategy === 'increase-pace') {
                desc = `קצב חדש: ${bp.newPaceValue} דפים ליום`;
            }
            return `<div class="flex items-center justify-between py-1">
                <span class="text-sm font-medium text-slate-700">מסכת ${bookName}</span>
                <span class="text-sm text-orange-600 font-bold">${desc}</span>
            </div>`;
        }).join('');

        section.innerHTML = `
            <div class="bg-orange-50 border border-orange-200 rounded-2xl p-5 shadow-sm">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div class="flex items-center gap-2">
                        <span class="text-xl">📈</span>
                        <h3 class="font-bold text-slate-800">תכנית השלמה פעילה</h3>
                        <span class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">מהיום</span>
                    </div>
                    <button id="cancelCatchUpBtn" class="w-full sm:w-auto text-sm text-red-500 hover:text-red-700 font-bold px-4 py-2 rounded-lg border border-red-200 hover:bg-red-50 transition-all">
                        בטל תכנית
                    </button>
                </div>
                <div class="divide-y divide-orange-100">${detailsHtml}</div>
            </div>
        `;

        document.getElementById('cancelCatchUpBtn')?.addEventListener('click', async () => {
            await app.handleCancelCatchUpPlan();
            await app.handleScheduleGeneration();
            renderCatchUpSection();
        });
    }

    function renderDeficitNotice(section, deficit) {
        const deficitHtml = Object.entries(deficit.books)
            .filter(([, d]) => d.isBehind)
            .map(([bookIdx, d]) => {
                let note = '';
                if (d.calcMethod === 'targetDate' && d.targetDate && !d.targetDatePassed) {
                    note = 'הלוח מחושב מחדש אוטומטית עד תאריך היעד';
                } else if (d.calcMethod === 'targetDate' && d.targetDatePassed) {
                    note = 'תאריך היעד עבר — יש לקבוע תאריך חדש';
                } else if (d.calcMethod !== 'targetDate') {
                    note = 'הלימוד ממשיך בקצב המקורי אוטומטית';
                }
                return `<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-slate-700">מסכת ${d.bookName}</span>
                        <span class="text-sm text-red-500 font-bold">${d.deficit} עמודים מאחור</span>
                    </div>
                    ${note ? `<span class="text-[10px] text-slate-500">${note}</span>` : ''}
                </div>`;
            }).join('');

        // Check if any target-date book has passed its target date - those NEED intervention
        const hasPastTarget = Object.entries(deficit.books).some(([, d]) => d.isBehind && d.calcMethod === 'targetDate' && d.targetDatePassed);

        section.innerHTML = `
            <div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div class="flex items-center gap-2">
                        <span class="text-xl">⚠️</span>
                        <h3 class="font-bold text-slate-800">פער בלימוד</h3>
                        <span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">${deficit.totalDeficit} עמודים</span>
                    </div>
                    ${hasPastTarget ? `
                        <button id="createCatchUpBtn" class="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-sm flex items-center justify-center gap-1.5">
                            <span>📅</span>
                            <span>קבע תאריך יעד חדש</span>
                        </button>
                    ` : `
                        <button id="createCatchUpBtn" class="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-sm flex items-center justify-center gap-1.5">
                            <span>📈</span>
                            <span>צור תכנית השלמה</span>
                        </button>
                    `}
                </div>
                <div class="divide-y divide-amber-100">${deficitHtml}</div>
                <p class="text-xs text-slate-500 mt-3">ללא תכנית השלמה, ההתאמה נעשית אוטומטית: חומר שפספסת יפוזר מחדש עד תאריך היעד, והספק קבוע יימשך אוטומטית.</p>
            </div>
        `;

        document.getElementById('createCatchUpBtn')?.addEventListener('click', async () => {
            await showCatchUpDialog(app, deficit, renderCatchUpSection);
        });
    }

    /**
     * Show dialog for creating a catch-up plan.
     * Uses dynamic field visibility (dependsOn) to show/hide inputs based on strategy selection.
     * For each behind book, presents strategies based on its calcMethod:
     *   - targetDate books: Move Target Date, Squeeze, Sprint
     *   - pace books: Sprint only
     */
    async function showCatchUpDialog(app, deficit, onComplete) {
        const behindBooks = Object.entries(deficit.books).filter(([, d]) => d.isBehind);
        if (behindBooks.length === 0) return;

        const inputs = [];

        behindBooks.forEach(([bookIdx, bookData]) => {
            const isTarget = bookData.calcMethod === 'targetDate';
            const bookLabel = `מסכת ${bookData.bookName} (${bookData.deficit} עמודים מאחור)`;
            const strategyFieldName = `strategy_${bookIdx}`;

            if (isTarget) {
                const targetPassed = bookData.targetDatePassed;
                // ── Target-Date book: 3 strategies ──────────────────
                // If target date has passed, only offer "Set new target date"
                const options = targetPassed
                    ? [
                        { value: 'move-target', text: '📅 קבע תאריך יעד חדש (חובה — תאריך היעד המקורי כבר עבר)' }
                      ]
                    : [
                        { value: 'move-target', text: '📅 קבע תאריך יעד חדש' },
                        { value: 'squeeze', text: '↔️ דחוס: חלק את כל החומר שפוספס על הימים הנותרים כדי לסיים בזמן המקורי' },
                        { value: 'sprint', text: '⚡ ספרינט: קצב מוגבר זמני למספר ימים' }
                      ];

                inputs.push({
                    type: 'select',
                    name: strategyFieldName,
                    label: `${bookLabel} — אסטרטגיה:`,
                    options: options
                });
                // Compute the max allowed date for the new target: the start date of the next book (if any)
                let maxDate = '';
                const nextBookIdx = parseInt(bookIdx) + 1;
                if (nextBookIdx < activeTrack.bookSequence.length) {
                    const nextBook = activeTrack.bookSequence[nextBookIdx];
                    const nextBookName = typeof nextBook === 'string' ? nextBook : nextBook.name;
                    const nextBookDays = activeTrack.studySchedule.filter(d => d.book === nextBookName && !d.isEmpty);
                    if (nextBookDays.length > 0) {
                        const nextBookStart = new Date(nextBookDays[0].date);
                        nextBookStart.setDate(nextBookStart.getDate() - 1); // day before next book starts
                        maxDate = nextBookStart.toISOString().split('T')[0];
                    }
                }
                const todayStr = new Date().toISOString().split('T')[0];

                // Move Target Date input — always visible for target-date books (shown by default if target passed)
                inputs.push({
                    type: 'date',
                    name: `newTargetDate_${bookIdx}`,
                    label: 'תאריך יעד חדש:',
                    value: bookData.targetDate || '',
                    min: todayStr,
                    max: maxDate || undefined,
                    dependsOn: { field: strategyFieldName, value: 'move-target' }
                });
                // Sprint days input — only visible when 'sprint' is selected
                inputs.push({
                    type: 'number',
                    name: `sprintDays_${bookIdx}`,
                    label: 'תוך כמה ימי לימוד תרצה להשלים?',
                    value: Math.max(1, Math.ceil(bookData.deficit / 2)),
                    min: 1,
                    max: 90,
                    step: 1,
                    dependsOn: { field: strategyFieldName, value: 'sprint' }
                });
            } else {
                // ── Pace book: Sprint or Increase Pace ───────────────
                inputs.push({
                    type: 'select',
                    name: strategyFieldName,
                    label: `${bookLabel} — אסטרטגיה:`,
                    options: [
                        { value: 'sprint', text: '⚡ ספרינט: קצב מוגבר זמני למספר ימים' },
                        { value: 'increase-pace', text: '🚀 הגדל קצב: קבע קצב חדש גבוה יותר קבוע' }
                    ]
                });
                inputs.push({
                    type: 'number',
                    name: `sprintDays_${bookIdx}`,
                    label: 'תוך כמה ימי לימוד תרצה להשלים? (הקצב מחושב אוטומטית)',
                    value: Math.max(1, Math.ceil(bookData.deficit / 2)),
                    min: 1,
                    max: 90,
                    step: 1,
                    dependsOn: { field: strategyFieldName, value: 'sprint' }
                });
                inputs.push({
                    type: 'number',
                    name: `newPace_${bookIdx}`,
                    label: 'כמה דפים ליום? (לדוגמה: 1 = דף אחד, 1.5 = דף וחצי)',
                    value: bookData.paceValue || 1,
                    min: 0.5,
                    max: 10,
                    step: 0.5,
                    dependsOn: { field: strategyFieldName, value: 'increase-pace' }
                });
            }
        });

        const result = await showDialog({
            title: 'צור תכנית השלמה',
            message: `אתה ${deficit.totalDeficit} עמודים מאחור. בחר אסטרטגיית השלמה לכל מסכת:`,
            icon: '📈',
            showCancel: true,
            confirmText: 'צור תכנית',
            cancelText: 'ביטול',
            inputs
        });

        if (!result) return;

        // Build plan config from dialog result
        const planConfig = { books: {} };

        behindBooks.forEach(([bookIdx, bookData]) => {
            const strategy = result[`strategy_${bookIdx}`] || 'squeeze';
            const isTarget = bookData.calcMethod === 'targetDate';

            if (isTarget) {
                if (strategy === 'move-target') {
                    const newTargetDate = result[`newTargetDate_${bookIdx}`];
                    planConfig.books[bookIdx] = {
                        strategy: 'move-target',
                        newTargetDate: newTargetDate || null
                    };
                } else if (strategy === 'sprint') {
                    const sprintDays = parseInt(result[`sprintDays_${bookIdx}`]) || 7;
                    // The daily pace is auto-calculated by the algorithm based on remaining material / sprintDays
                    planConfig.books[bookIdx] = {
                        strategy: 'sprint',
                        sprintDays: sprintDays
                    };
                } else {
                    // Squeeze (default for target): redistribute remaining material
                    planConfig.books[bookIdx] = {
                        strategy: 'squeeze'
                    };
                }
            } else {
                // Pace books: sprint or increase-pace
                if (strategy === 'increase-pace') {
                    const newPace = parseFloat(result[`newPace_${bookIdx}`]) || 1;
                    planConfig.books[bookIdx] = {
                        strategy: 'increase-pace',
                        newPaceValue: newPace
                    };
                } else {
                    const sprintDays = parseInt(result[`sprintDays_${bookIdx}`]) || 7;
                    planConfig.books[bookIdx] = {
                        strategy: 'sprint',
                        sprintDays: sprintDays
                    };
                }
            }
        });

        await app.handleCreateCatchUpPlan(planConfig);
        await app.handleScheduleGeneration();
        onComplete();
    }

    // Initial render of catch-up section
    renderCatchUpSection();

    return () => {
        // Cleanup if needed
    };
}