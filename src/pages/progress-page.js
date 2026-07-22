/**
 * Progress Page — Eifo Ata Ochez (book progress marking).
 * Per-book amud grid with amud and daf views for marking progress.
 * 
 * Three material states:
 *   0 = unlearned (will be learned chronologically)
 *   1 = learned
 *   2 = complete later (excluded from active cycle, sent to async bank in future)
 */

import { getTotalAmudim, indexToDaf } from '../utils/talmud.js';
import { numberToHebrew } from '../utils/gematria.js';
import { showDialog } from '../ui/components/dialog.js';

// Renders the interactive Amud Grid for progress marking — one button per amud (or per daf in daf mode),
// colored by learned/skipped/unlearned state. Used by the progress page (Eifo Ata Ochez).
function renderAmudGrid(containerId, amudStates, isDaf = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const htmlBuffer = [];

    amudStates.forEach((state, i) => {
        // Daf mode: one button per daf — only render even indices (amud א), skip amud ב
        if (isDaf && i % 2 !== 0) return;

        const dafNum = Math.floor(i / 2) + 2;
        const dafGematria = numberToHebrew(dafNum);

        let label, colorClass;

        if (isDaf) {
            // In daf mode, combine state of both amudim: learned if both are 1, skipped if both are 2, else unlearned
            const stateB = amudStates[i + 1]; // may be undefined on last daf
            const combinedLearned = state === 1 && (stateB === 1 || stateB === undefined);
            const combinedSkipped = state === 2 && (stateB === 2 || stateB === undefined);
            label = dafGematria;
            colorClass = combinedLearned
                ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                : combinedSkipped
                    ? "bg-orange-400 text-white border-orange-600 shadow-sm"
                    : "bg-slate-100 text-slate-400 border-slate-200";
        } else {
            // Uses your native engine formatting
            label = indexToDaf(i); 
            colorClass = state === 1
                ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                : state === 2
                    ? "bg-orange-400 text-white border-orange-600 shadow-sm"
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

function getProgressPageHtml(activeTrack, bookSequence) {
    // Calculate stats from amudStates directly
    let totalAmudim = 0;
    let totalLearned = 0;
    let totalCompleteLater = 0;
    bookSequence.forEach((book) => {
        const bookName = typeof book === 'string' ? book : book.name;
        const total = getTotalAmudim(bookName);
        const states = (typeof book === 'object' && book.amudStates) ? book.amudStates : [];
        totalAmudim += total;
        totalLearned += states.filter(s => s === 1).length;
        totalCompleteLater += states.filter(s => s === 2).length;
    });
    const activeAmudim = totalAmudim - totalCompleteLater;
    const completionRate = activeAmudim > 0 ? Math.round((totalLearned / activeAmudim) * 100) : 0;

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
                    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col items-center text-center justify-center">
                        <div class="flex items-center justify-center mb-3">
                            <span class="text-2xl">📚</span>
                        </div>
                        <p class="text-3xl font-black text-slate-800">${bookSequence.length}</p>
                        <p class="text-sm text-slate-500 font-medium mt-1">ספרים במסלול</p>
                    </div>
                    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col items-center text-center justify-center">
                        <div class="flex items-center justify-center mb-3">
                            <span class="text-2xl">📖</span>
                        </div>
                        <p class="text-3xl font-black text-slate-800">${totalLearned}/${activeAmudim}</p>
                        <p class="text-sm text-slate-500 font-medium mt-1">עמודים נלמדו${totalCompleteLater > 0 ? ` (${totalCompleteLater} השלמות)` : ''}</p>
                    </div>
                    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col items-center text-center justify-center">
                        <div class="flex items-center justify-center mb-3">
                            <span class="text-2xl">✅</span>
                        </div>
                        <p class="text-3xl font-black text-emerald-600">${completionRate}%</p>
                        <p id="statsCompleteLaterCount" class="text-sm text-slate-500 font-medium mt-1">${totalCompleteLater > 0 ? `${totalCompleteLater} השלמות` : ''}</p>
                    </div>
                </div>

                <!-- Overall Progress Bar -->
                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="font-bold text-slate-800">התקדמות כללית</h3>
                        <span class="text-sm font-bold text-slate-500">${totalLearned}/${activeAmudim} עמודים</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                        <div id="overallProgressBar" class="bg-gradient-to-l from-blue-800 to-blue-600 h-full rounded-full transition-all duration-500 ease-out" 
                             style="width: ${completionRate}%"></div>
                    </div>
                    <div class="flex justify-between mt-2 text-xs text-slate-400">
                        <span id="completeLaterCountLabel">${totalCompleteLater > 0 ? `השלמות: ${totalCompleteLater}` : ''}</span>
                        <span>${completionRate}% נלמד</span>
                    </div>
                </div>

                <!-- Catch-Up Status & Actions -->
                <div class="mb-6 space-y-3">
                    <div id="catchUpSection" class="hidden"></div>
                </div>

                <!-- Calendar (adjusted schedule) -->
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
                            <p class="text-slate-500 font-bold">אין ספרים במסלול זה</p>
                            <p class="text-slate-400 text-sm mt-1">הוסף ספרים בדף עריכת המסלול</p>
                        </div>
                    ` : bookSequence.map((book, idx) => {
                        const bookName = typeof book === 'string' ? book : book.name;
                        const totalAmudim = getTotalAmudim(bookName);
                        const amudStates = (typeof book === 'object' && book.amudStates) ? [...book.amudStates] : new Array(totalAmudim).fill(0);
                        const learned = amudStates.filter(s => s === 1).length;
                        const completeLater = amudStates.filter(s => s === 2).length;
                        const activeAmudim = totalAmudim - completeLater;
                        const pct = activeAmudim > 0 ? Math.round((learned / activeAmudim) * 100) : 0;
                        
                        return `
                            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" data-book-idx="${idx}">
                                <div class="p-4 border-b border-slate-100">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <span class="text-lg">📖</span>
                                            <h3 class="font-bold text-slate-800">מסכת ${bookName}</h3>
                                            <span id="bookProgressLabel_${idx}" class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">${learned}/${activeAmudim} עמודים${completeLater > 0 ? ` (+${completeLater} השלמות)` : ''}</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span id="bookPctLabel_${idx}" class="text-xs font-bold text-slate-400">${pct}%</span>
                                            <div class="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                                                <div id="bookProgressBar_${idx}" class="bg-emerald-500 h-full rounded-full transition-all duration-300" style="width: ${pct}%"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- View toggle buttons (amud/daf only) -->
                                    <div class="flex bg-slate-100 p-0.5 rounded-lg self-start w-fit mt-2">
                                        <button data-book-idx="${idx}" data-view="amud" class="view-toggle-btn px-2.5 py-1 rounded-md text-[10px] font-bold bg-white shadow-sm">עמודים</button>
                                        <button data-book-idx="${idx}" data-view="daf" class="view-toggle-btn px-2.5 py-1 rounded-md text-[10px] font-bold text-slate-500 hover:text-slate-700">דפים</button>
                                    </div>
                                </div>
                                <div class="p-4">
                                    <div class="flex flex-wrap gap-1 mb-3">
                                        <span class="text-[10px] font-bold text-slate-400 flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block"></span> טרם</span>
                                        <span class="text-[10px] font-bold text-slate-400 flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> נלמד</span>
                                        <span class="text-[10px] font-bold text-slate-400 flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block"></span> השלמות</span>
                                    </div>
                                    <div id="amudGrid_${idx}" class="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5"></div>
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

    // Track view modes per book (amud or daf)
    const viewModes = {};

    // Render the calendar with adjusted schedule
    app.handleScheduleGeneration();

    // Render amud grids and wire up clicks for each book
    bookSequence.forEach((book, idx) => {
        const bookName = typeof book === 'string' ? book : book.name;
        const totalAmudim = getTotalAmudim(bookName);
        const amudStates = (typeof book === 'object' && book.amudStates) ? [...book.amudStates] : new Array(totalAmudim).fill(0);
        const gridContainer = document.getElementById(`amudGrid_${idx}`);
        
        // Default to amud view (no more daily view)
        viewModes[idx] = 'amud';
        
        // Initial render of the grid
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
                const completeLater = entry.amudStates.filter(s => s === 2).length;
                const activeAmudim = totalAmudim - completeLater;
                const pct = activeAmudim > 0 ? Math.round((learned / activeAmudim) * 100) : 0;
                const labelEl = document.getElementById(`bookProgressLabel_${idx}`);
                const pctEl = document.getElementById(`bookPctLabel_${idx}`);
                const barEl = document.getElementById(`bookProgressBar_${idx}`);
                if (labelEl) labelEl.textContent = `${learned}/${activeAmudim} עמודים${completeLater > 0 ? ` (+${completeLater} השלמות)` : ''}`;
                if (pctEl) pctEl.textContent = `${pct}%`;
                if (barEl) barEl.style.width = `${pct}%`;
                
                // Update overall stats
                updateOverallStats(activeTrack.bookSequence);
                
                // Save and regenerate the adjusted schedule
                app.handleSaveBookConfig({ index: idx });
                app.handleScheduleGeneration();
                
                // Update catchup plan disclaimer UI
                renderCatchUpSection();
            };
            
            gridContainer.addEventListener('click', gridContainer[handlerKey]);
        }
    });

    // Wire up view toggle buttons (amud/daf only)
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
            viewModes[bookIdx] = view;
            
            // Update button styles
            const siblings = btn.closest('.flex.bg-slate-100')?.querySelectorAll('.view-toggle-btn');
            siblings?.forEach(s => {
                s.classList.remove('bg-white', 'shadow-sm');
                s.classList.add('text-slate-500');
            });
            btn.classList.add('bg-white', 'shadow-sm');
            btn.classList.remove('text-slate-500');
            
            const isDaf = view === 'daf';
            renderAmudGrid(`amudGrid_${bookIdx}`, amudStates, isDaf);
        });
    });

    // Wire up sync-to-today button
    const syncBtn = container.querySelector('#syncToTodayBtn');
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            const track = app.getActiveTrack();
            const hasActivePlan = track?.catchUpPlan?.isActive;

            if (hasActivePlan) {
                const confirmed = await showDialog({
                    title: 'סנכרן עד היום',
                    message: 'האם אתה בטוח שברצונך לסנכרן? פעולה זו תבטל את תכנית הצמצום פערים הפעילה.',
                    icon: '🔄',
                    showCancel: true,
                    confirmText: 'כן, סנכרן ובטל תכנית',
                    cancelText: 'ביטול'
                });
                if (!confirmed) return;

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
                const completeLater = states.filter(s => s === 2).length;
                const activeAmudim = total - completeLater;
                const pct = activeAmudim > 0 ? Math.round((learned / activeAmudim) * 100) : 0;
                const labelEl = document.getElementById(`bookProgressLabel_${idx}`);
                const pctEl = document.getElementById(`bookPctLabel_${idx}`);
                const barEl = document.getElementById(`bookProgressBar_${idx}`);
                if (labelEl) labelEl.textContent = `${learned}/${activeAmudim} עמודים${completeLater > 0 ? ` (+${completeLater} השלמות)` : ''}`;
                if (pctEl) pctEl.textContent = `${pct}%`;
                if (barEl) barEl.style.width = `${pct}%`;
            });
            
            // Regenerate the calendar and catch-up section after sync
            await app.handleScheduleGeneration();
            renderCatchUpSection();
        });
    }

    // Helper to update overall stats
    function updateOverallStats(seq) {
        let tAmudim = 0;
        let tLearned = 0;
        let tCompleteLater = 0;
        seq.forEach((b) => {
            const bName = typeof b === 'string' ? b : b.name;
            const total = getTotalAmudim(bName);
            const states = (typeof b === 'object' && b.amudStates) ? b.amudStates : [];
            tAmudim += total;
            tLearned += states.filter(s => s === 1).length;
            tCompleteLater += states.filter(s => s === 2).length;
        });
        const activeAmudim = tAmudim - tCompleteLater;
        const rate = activeAmudim > 0 ? Math.round((tLearned / activeAmudim) * 100) : 0;
        
        const overallBar = document.getElementById('overallProgressBar');
        if (overallBar) overallBar.style.width = `${rate}%`;
        
        // Update stat cards
        const statCards = container.querySelectorAll('.grid.grid-cols-1.sm\\:grid-cols-3 .text-3xl');
        if (statCards.length >= 3) {
            statCards[1].textContent = `${tLearned}/${activeAmudim}`;
            statCards[2].textContent = `${rate}%`;
        }
        
        // Update complete-later count in stats card
        const statsCompleteLaterEl = document.getElementById('statsCompleteLaterCount');
        if (statsCompleteLaterEl) {
            statsCompleteLaterEl.textContent = tCompleteLater > 0 ? `${tCompleteLater} השלמות` : '';
        }
        
        // Update complete-later count in progress bar section
        const completeLaterLabel = document.getElementById('completeLaterCountLabel');
        if (completeLaterLabel) {
            completeLaterLabel.textContent = tCompleteLater > 0 ? `השלמות: ${tCompleteLater}` : '';
        }
    }

    /* ================================================================
     * CATCH-UP PLAN
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
    
        // Only show if there's a plan OR if there's a deficit
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
                desc = `ספרינט: השלמת פער של ${bp.deficitAmount / 2} דפים לאורך ${bp.sprintDays} ימי לימוד`;
            } else if (bp.strategy === 'increase-pace') {
                // Convert amudim value back to dafs for the display string (2 amudim = 1 daf)
                const addedDaf = (bp.addAmudimValue || 0) / 2;
                desc = `הגדלת קצב: הוספת ${addedDaf} דף/דפים ליום לקצב היומי המקורי`;
            }
            return `<div class="flex items-center justify-between py-1">
                <span class="text-sm font-medium text-slate-700">מסכת ${bookName}</span>
                <span class="text-sm text-emerald-600 font-bold">${desc}</span>
            </div>`;
        }).join('');
    
        section.innerHTML = `
            <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div class="flex items-center gap-2">
                        <span class="text-xl">✅</span>
                        <h3 class="font-bold text-slate-800">תכנית צמצום פעילה</h3>
                        <span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">מהיום</span>
                    </div>
                    <button id="cancelCatchUpBtn" class="w-full sm:w-auto text-sm text-red-500 hover:text-red-700 font-bold px-4 py-2 rounded-lg border border-red-200 hover:bg-red-50 transition-all">
                        בטל תכנית
                    </button>
                </div>
                <div class="divide-y divide-emerald-100">${detailsHtml}</div>
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
                // Show deficit in Dafs (pages) instead of raw amudim
                const deficitDafs = d.deficit / 2;
                return `<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-slate-700">מסכת ${d.bookName}</span>
                        <span class="text-sm text-red-500 font-bold">${deficitDafs} דפים מאחור</span>
                    </div>
                    ${note ? `<span class="text-[14px] text-slate-500">${note}</span>` : ''}
                </div>`;
            }).join('');
    
        const hasPastTarget = Object.entries(deficit.books).some(([, d]) => d.isBehind && d.calcMethod === 'targetDate' && d.targetDatePassed);
    
        section.innerHTML = `
            <div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div class="flex items-center gap-2">
                        <span class="text-xl">⚠️</span>
                        <h3 class="font-bold text-slate-800">פער בלימוד</h3>
                        <span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">${deficit.totalDeficit / 2} דפים</span>
                    </div>
                    ${hasPastTarget ? `
                        <button id="createCatchUpBtn" class="w-full sm:w-auto bg-orange-400 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-sm flex items-center justify-center gap-1.5">
                            <span>📅</span>
                            <span>קבע תאריך יעד חדש</span>
                        </button>
                    ` : `
                        <button id="createCatchUpBtn" class="w-full sm:w-auto bg-orange-400 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-sm flex items-center justify-center gap-1.5">
                            <span>📈</span>
                            <span>צור תכנית צמצום פערים</span>
                        </button>
                    `}
                </div>
                <div class="divide-y divide-amber-100">${deficitHtml}</div>
                <p class="text-xs text-slate-500 mt-3">ללא תכנית צמצום פערים, ההתאמה נעשית אוטומטית: חומר שנותר יחולק מחדש מהיום ועד הסוף.</p>
            </div>
        `;
    
        document.getElementById('createCatchUpBtn')?.addEventListener('click', async () => {
            await showCatchUpDialog(app, deficit, renderCatchUpSection);
        });
    }
    
    async function showCatchUpDialog(app, deficit, onComplete) {
        // 1. Grab the active track from the app instance so it is in scope
        const activeTrack = app.getActiveTrack(); 
        if (!activeTrack) return;
    
        const behindBooks = Object.entries(deficit.books).filter(([, d]) => d.isBehind);
        if (behindBooks.length === 0) return;
    
        const inputs = [];
    
        behindBooks.forEach(([bookIdx, bookData]) => {
            const isTarget = bookData.calcMethod === 'targetDate';
            const bookLabel = `מסכת ${bookData.bookName} (${bookData.deficit / 2} דפים מאחור)`;
            const strategyFieldName = `strategy_${bookIdx}`;
    
            if (isTarget) {
                const targetPassed = bookData.targetDatePassed;
                const options = targetPassed
                    ? [
                        { value: 'move-target', text: '📅 קבע תאריך יעד חדש (חובה — תאריך היעד המקורי כבר עבר)' }
                      ]
                    : [
                        { value: 'move-target', text: '📅 קבע תאריך יעד חדש' },
                        { value: 'squeeze', text: '↔️ דחוס: חלק את כל החומר שנותר על הימים הנותרים כדי לסיים בזמן המקורי' },
                        { value: 'sprint', text: '⚡ ספרינט: חלק את הפער שנוצר באופן שווה על פני מספר ימי ספרינט' }
                      ];
    
                inputs.push({
                    type: 'select',
                    name: strategyFieldName,
                    label: `${bookLabel} — אסטרטגיה:`,
                    options: options
                });
                let maxDate = '';
                const nextBookIdx = parseInt(bookIdx) + 1;
                
                // This now works perfectly because activeTrack is defined!
                if (nextBookIdx < activeTrack.bookSequence.length) {
                    const nextBook = activeTrack.bookSequence[nextBookIdx];
                    const nextBookName = typeof nextBook === 'string' ? nextBook : nextBook.name;
                    const nextBookDays = activeTrack.studySchedule.filter(d => d.book === nextBookName && !d.isEmpty);
                    if (nextBookDays.length > 0) {
                        const nextBookStart = new Date(nextBookDays[0].date);
                        nextBookStart.setDate(nextBookStart.getDate() - 1);
                        maxDate = nextBookStart.toISOString().split('T')[0];
                    }
                }
                const todayStr = new Date().toISOString().split('T')[0];
    
                inputs.push({
                    type: 'date',
                    name: `newTargetDate_${bookIdx}`,
                    label: 'תאריך יעד חדש:',
                    value: bookData.targetDate || '',
                    min: todayStr,
                    max: maxDate || undefined,
                    dependsOn: { field: strategyFieldName, value: 'move-target' }
                });
                inputs.push({
                    type: 'number',
                    name: `sprintDays_${bookIdx}`,
                    label: 'תוך כמה ימי לימוד תרצה להשלים את הפער?',
                    value: Math.max(1, Math.ceil(bookData.deficit / 2)),
                    min: 1,
                    max: 90,
                    step: 1,
                    dependsOn: { field: strategyFieldName, value: 'sprint' }
                });
            } else {
                inputs.push({
                    type: 'select',
                    name: strategyFieldName,
                    label: `${bookLabel} — אסטרטגיה:`,
                    options: [
                        { value: 'sprint', text: '⚡ ספרינט: חלק את הפער שנוצר באופן שווה על פני מספר ימי ספרינט' },
                        { value: 'increase-pace', text: '🚀 הגדל קצב: הוסף מספר קבוע של דפים ליום לקצב הקיים' }
                    ]
                });
                inputs.push({
                    type: 'number',
                    name: `sprintDays_${bookIdx}`,
                    label: 'תוך כמה ימי לימוד תרצה להשלים את הפער? (הקצב הנוסף מחושב אוטומטית)',
                    value: Math.max(1, Math.ceil(bookData.deficit / 2)),
                    min: 1,
                    max: 90,
                    step: 1,
                    dependsOn: { field: strategyFieldName, value: 'sprint' }
                });
                inputs.push({
                    type: 'number',
                    name: `addDafs_${bookIdx}`,
                    label: 'כמה דפים תרצה להוסיף לקצב היומי המקורי שלך? (לדוגמה: 0.5 = עמוד אחד נוסף, 1 = דף נוסף, 2 = שני דפים נוספים)',
                    value: 0.5,
                    min: 0.5,
                    max: 10,
                    step: 0.5,
                    dependsOn: { field: strategyFieldName, value: 'increase-pace' }
                });
            }
        });
    
        const result = await showDialog({
            title: 'צור תכנית צמצום פערים',
            message: `אתה ${deficit.totalDeficit / 2} דפים מאחור. בחר אסטרטגיית צמצום פערים לכל ספר:`,
            icon: '📈',
            showCancel: true,
            confirmText: 'צור תכנית',
            cancelText: 'ביטול',
            inputs
        });
    
        if (!result) return;

        const planConfig = { books: {} };

        behindBooks.forEach(([bookIdx, bookData]) => {
            // 1. Force identify exactly what strategy was chosen
            const strategy = result[`strategy_${bookIdx}`];
            const isTarget = bookData.calcMethod === 'targetDate';

            if (isTarget) {
                if (strategy === 'move-target') {
                    const newTargetDate = result[`newTargetDate_${bookIdx}`];
                    planConfig.books[bookIdx] = {
                        strategy: 'move-target',
                        newTargetDate: newTargetDate || null
                    };
                } else if (strategy === 'sprint') {
                    // Read from result object, fallback directly to DOM if dialog stripped hidden/altered fields
                    let rawDays = result[`sprintDays_${bookIdx}`];
                    if (rawDays === undefined || rawDays === "") {
                        const el = document.querySelector(`[name="sprintDays_${bookIdx}"]`);
                        rawDays = el ? el.value : 7;
                    }
                    
                    planConfig.books[bookIdx] = {
                        strategy: 'sprint',
                        sprintDays: Math.max(1, parseInt(rawDays, 10) || 7),
                        deficitAmount: bookData.deficit
                    };
                } else {
                    planConfig.books[bookIdx] = {
                        strategy: 'squeeze'
                    };
                }
            } else {
                // PACE TRACKS
                if (strategy === 'increase-pace') {
                    let rawDafs = result[`addDafs_${bookIdx}`];
                    if (rawDafs === undefined || rawDafs === "") {
                        const el = document.querySelector(`[name="addDafs_${bookIdx}"]`);
                        rawDafs = el ? el.value : 0.5;
                    }

                    const parsedDafs = parseFloat(rawDafs) || 0.5;
                    planConfig.books[bookIdx] = {
                        strategy: 'increase-pace',
                        addAmudimValue: parsedDafs * 2, // Force float calculation immediately
                        deficitAmount: bookData.deficit
                    };
                } else {
                    // Must be sprint
                    let rawDays = result[`sprintDays_${bookIdx}`];
                    if (rawDays === undefined || rawDays === "") {
                        const el = document.querySelector(`[name="sprintDays_${bookIdx}"]`);
                        rawDays = el ? el.value : 7;
                    }

                    planConfig.books[bookIdx] = {
                        strategy: 'sprint',
                        sprintDays: Math.max(1, parseInt(rawDays, 10) || 7),
                        deficitAmount: bookData.deficit
                    };
                }
            }
        });

        await app.handleCreateCatchUpPlan(planConfig);
        await app.handleScheduleGeneration();
        onComplete();
    }

    renderCatchUpSection();

    return () => {
        // Clean-up if necessary
    }
}

/* ================================================================
 * DEPRECATED — Daily Study Requirement View
 * ================================================================
 * Previously lived in ui/components/book-config-modal.js where it did
 * not belong. It renders one button per scheduled day for a book,
 * colored by progress and with badges for today and completion status.
 * Kept here (commented out) for reference / future re-integration into
 * the progress page if the daily view is revived.
 * ================================================================ */
// // Renders the daily study requirement view — one button per scheduled day for this Book, colored by progress and with badges for today and completion status
// export function renderDailyView(containerId, daySlots, amudStates) {
//     const container = document.getElementById(containerId);
//     if (!container) return;
//
//     if (!daySlots || daySlots.length === 0) {
//         container.innerHTML = `<div class="text-center text-slate-400 italic text-sm py-8">
//             אין ימי לימוד מתוכננים. יש ליצור לוח לימוד תחילה.
//         </div>`;
//         return;
//     }
//
//     const today = new Date().toISOString().split('T')[0];
//
//     const html = daySlots.map((slot, idx) => {
//         let learnedCount = 0, skippedCount = 0;
//         for (let i = slot.amudStart; i < slot.amudStart + slot.amudCount; i++) {
//             if (i < amudStates.length) {
//                 if (amudStates[i] === 1) learnedCount++;
//                 else if (amudStates[i] === 2) skippedCount++;
//             }
//         }
//         const isFullyLearned = learnedCount === slot.amudCount;
//         const isFullySkipped = skippedCount === slot.amudCount;
//         const isPartial = (learnedCount > 0 || skippedCount > 0) && !isFullyLearned && !isFullySkipped;
//         const isToday = slot.dateString === today;
//         const isPast = slot.dateString < today;
//
//         // Badge row is always rendered at fixed height to prevent layout shift
//         let badgeText, badgeColor;
//         if (isFullyLearned)      { badgeText = '✓';    badgeColor = 'text-emerald-500'; }
//         else if (isFullySkipped) { badgeText = 'דלג';  badgeColor = 'text-amber-500'; }
//         else if (isPartial)      { badgeText = `${learnedCount}/${slot.amudCount}`; badgeColor = 'text-blue-500'; }
//         else if (isToday)        { badgeText = 'היום'; badgeColor = 'text-blue-600'; }
//         else                     { badgeText = '\u00A0'; badgeColor = ''; } // non-breaking space holds the row height
//
//         let bg, border, textColor;
//         if (isFullyLearned)      { bg = 'bg-emerald-50'; border = 'border-emerald-300'; textColor = 'text-emerald-800'; }
//         else if (isFullySkipped) { bg = 'bg-amber-50';   border = 'border-amber-300';   textColor = 'text-amber-800'; }
//         else if (isPartial)      { bg = 'bg-blue-50';    border = 'border-blue-300';    textColor = 'text-blue-800'; }
//         else if (isToday)        { bg = 'bg-blue-50';    border = 'border-blue-400';    textColor = 'text-blue-800'; }
//         else if (isPast)         { bg = 'bg-slate-50';   border = 'border-slate-200';   textColor = 'text-slate-400'; }
//         else                     { bg = 'bg-white';      border = 'border-slate-200';   textColor = 'text-slate-600'; }
//
//         const [, m, d] = slot.dateString.split('-');
//         const dateLabel = `${d}/${m}`;
//
//         // Dynamically compute the local range content labels safely using your indexToDaf engine
//         let dafRange = '';
//         if (slot.amudCount > 0) {
//             const startLabel = indexToDaf(slot.amudStart);
//             const endLabel = indexToDaf(slot.amudStart + slot.amudCount - 1);
//             dafRange = (startLabel === endLabel) ? startLabel : `${startLabel} - ${endLabel}`;
//         }
//
//         return `<button data-slot-idx="${idx}"
//             class="day-slot-btn flex flex-col items-center justify-between p-2 rounded-xl border-2 ${bg} ${border} transition-all active:scale-95 hover:shadow-sm h-16 w-full">
//             <span class="text-[11px] font-bold ${textColor} leading-tight">${dateLabel}</span>
//             <span class="text-[9px] ${textColor} opacity-70 leading-tight text-center max-w-full truncate px-0.5">${dafRange}</span>
//             <span class="text-[10px] font-bold ${badgeColor} leading-tight">${badgeText}</span>
//         </button>`;
//     }).join('');
//
//     container.innerHTML = `<div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">${html}</div>`;
// }
