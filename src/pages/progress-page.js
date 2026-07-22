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
            <!-- ════════════════════════════════════════════════════════
                 Page Header
                 ════════════════════════════════════════════════════════ -->
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
                <!-- ════════════════════════════════════════════════════════
                     Section 1: סקירה כללית — Overview
                     ════════════════════════════════════════════════════════ -->
                <section class="mb-8">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="text-xl">📈</span>
                        <h2 class="text-xl font-bold text-slate-800">סקירה כללית</h2>
                        <span class="text-xs text-slate-400 font-medium mr-2">מבט על ההתקדמות שלך</span>
                    </div>

                    <!-- Stats Cards: books count + pages learned (no redundant % card) -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
                    </div>

                    <!-- Overall Progress Bar -->
                    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
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
                </section>

                <!-- Stylized Divider with Epic Curled Line Ends: Between Stats and Catchup Plan -->
                <div class="my-12 py-8 flex items-center justify-center">
                    <div class="w-full flex items-center justify-center gap-1">
                        <!-- Left Curled End Line -->
                        <svg class="grow h-4 text-slate-300" preserveAspectRatio="none" viewBox="0 0 400 16" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M 0 8 C 15 8, 20 2, 30 2 C 40 2, 35 14, 25 14 C 15 14, 20 8, 45 8 L 400 8" />
                        </svg>
                        
                        <!-- Center Original Rhombus/Diamond Accent -->
                        <div class="bg-slate-50 px-4 text-slate-300 text-xs tracking-widest shrink-0">❖ ❖ ❖</div>
                        
                        <!-- Right Curled End Line -->
                        <svg class="grow h-4 text-slate-300" preserveAspectRatio="none" viewBox="0 0 400 16" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M 0 8 L 355 8 C 380 8, 385 14, 375 14 C 365 14, 360 2, 370 2 C 380 2, 385 8, 400 8" />
                        </svg>
                    </div>
                </div>

                <!-- ════════════════════════════════════════════════════════
                     Section 2: מצב לימוד — Study Status (catch-up / deficit)
                     ════════════════════════════════════════════════════════ -->
                <section class="mb-8">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="text-xl">⚠️</span>
                        <h2 class="text-xl font-bold text-slate-800">מצב לימוד</h2>
                        <span class="text-xs text-slate-400 font-medium mr-2">פערים ותכניות צמצום</span>
                    </div>
                    <div id="catchUpSection" class="hidden"></div>
                    <div id="noCatchUpPlaceholder" class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-center">
                        <span class="text-slate-400 text-sm font-medium">הכל בסדר — אין פערים בלימוד</span>
                    </div>
                </section>

                <div class="h-10"></div>

                <!-- ════════════════════════════════════════════════════════
                     Section 3: לוח זמנים — Schedule Calendar
                     ════════════════════════════════════════════════════════ -->
                <section class="mb-8">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="text-xl">📅</span>
                        <h2 class="text-xl font-bold text-slate-800">לוח זמנים</h2>
                        <span class="text-xs text-slate-400 font-medium mr-2">הלוח המעודכן לפי ההתקדמות שלך</span>
                    </div>
                    <div id="progressCalendarContainer"></div>
                </section>

                <!-- Stylized Divider with Epic Curled Line Ends: Below Calendar -->
                <div class="my-12 py-8 flex items-center justify-center">
                    <div class="w-full flex items-center justify-center gap-1">
                        <!-- Left Curled End Line -->
                        <svg class="grow h-4 text-slate-300" preserveAspectRatio="none" viewBox="0 0 400 16" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M 0 8 C 15 8, 20 2, 30 2 C 40 2, 35 14, 25 14 C 15 14, 20 8, 45 8 L 400 8" />
                        </svg>
                        
                        <!-- Center Original Rhombus/Diamond Accent -->
                        <div class="bg-slate-50 px-4 text-slate-300 text-xs tracking-widest shrink-0">❖ ❖ ❖</div>
                        
                        <!-- Right Curled End Line -->
                        <svg class="grow h-4 text-slate-300" preserveAspectRatio="none" viewBox="0 0 400 16" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M 0 8 L 355 8 C 380 8, 385 14, 375 14 C 365 14, 360 2, 370 2 C 380 2, 385 8, 400 8" />
                        </svg>
                    </div>
                </div>

                <!-- ════════════════════════════════════════════════════════
                     Section 4: סנכרון — Sync Tools
                     ════════════════════════════════════════════════════════ -->
                <section class="mb-8">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="text-xl">🔄</span>
                        <h2 class="text-xl font-bold text-slate-800">סנכרון</h2>
                        <span class="text-xs text-slate-400 font-medium mr-2">עדכן את ההתקדמות בבת אחת</span>
                    </div>
                    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <p class="text-sm text-slate-500 mb-4">סמן את כל ימי הלימוד שעברו כנלמדו או כהשלמות. שימושי כשאתה מתחיל לעקוב אחרי ההתקדמות שלך.</p>
                        <button id="syncToTodayBtn" 
                            class="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold px-5 py-2.5 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 text-sm">
                            <span>🔄</span>
                            <span>סנכרן כל הימים שעברו</span>
                        </button>
                    </div>
                </section>

                <!-- ════════════════════════════════════════════════════════
                     Section 5: סימון התקדמות — Per-Book Progress Marking
                     ════════════════════════════════════════════════════════ -->
                <section class="mb-8">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="text-xl">✏️</span>
                        <h2 class="text-xl font-bold text-slate-800">סימון התקדמות</h2>
                        <span class="text-xs text-slate-400 font-medium mr-2">סמן עמודים שלמדת או דילגת עליהם</span>
                    </div>

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
                                        <!-- Header Section: Legend & Clear Button -->
                                        <div class="flex flex-wrap justify-between items-center gap-3 mb-4">
                                            
                                            <!-- Legend Items -->
                                            <div class="flex flex-wrap items-center gap-3">
                                                <span class="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                                                    <span class="w-2.5 h-2.5 rounded-full bg-slate-200 shrink-0"></span>
                                                    טרם
                                                </span>
                                                <span class="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                                                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                                                    נלמד
                                                </span>
                                                <span class="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                                                    <span class="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0"></span>
                                                    השלמות
                                                </span>
                                            </div>

                                            <!-- Action Button -->
                                            <div class="flex items-center">
                                                <button data-book-idx="${idx}" class="clear-book-btn flex items-center gap-1 text-xs text-red-400 hover:text-red-600 font-medium transition-all">
                                                    <span>🗑️</span>
                                                    <span>אפס התקדמות</span>
                                                </button>
                                            </div>

                                        </div>

                                        <!-- Grid Container -->
                                        <div id="amudGrid_${idx}" class="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </section>
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

    // Wire up "clear book" buttons
    container.querySelectorAll('.clear-book-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const bookIdx = parseInt(btn.dataset.bookIdx, 10);
            const book = activeTrack.bookSequence[bookIdx];
            if (!book) return;

            const bookName = typeof book === 'string' ? book : book.name;

            const confirmed = await showDialog({
                title: 'איפוס התקדמות',
                message: `האם אתה בטוח שברצונך לאפס את כל ההתקדמות במסכת ${bookName}?`,
                icon: '🗑️',
                showCancel: true,
                confirmText: 'כן, אפס הכל',
                cancelText: 'ביטול'
            });
            if (!confirmed) return;

            const totalAmudim = getTotalAmudim(bookName);
            const entry = activeTrack.bookSequence[bookIdx];
            if (typeof entry === 'string') {
                activeTrack.bookSequence[bookIdx] = { name: entry, amudStates: new Array(totalAmudim).fill(0) };
            } else {
                entry.amudStates = new Array(totalAmudim).fill(0);
            }

            // Re-render all UIs
            const viewMode = viewModes[bookIdx] || 'amud';
            const isDaf = viewMode === 'daf';
            renderAmudGrid(`amudGrid_${bookIdx}`, new Array(totalAmudim).fill(0), isDaf);

            // Update per-book indicators
            const labelEl = document.getElementById(`bookProgressLabel_${bookIdx}`);
            const pctEl = document.getElementById(`bookPctLabel_${bookIdx}`);
            const barEl = document.getElementById(`bookProgressBar_${bookIdx}`);
            if (labelEl) labelEl.textContent = `0/${totalAmudim} עמודים`;
            if (pctEl) pctEl.textContent = `0%`;
            if (barEl) barEl.style.width = `0%`;

            // Update overall stats
            updateOverallStats(activeTrack.bookSequence);

            // Save and regenerate
            app.handleSaveBookConfig({ index: bookIdx });
            app.handleScheduleGeneration();
            renderCatchUpSection();
        });
    });

    // Wire up sync-to-today button — now asks what state to mark (1 = learned, 2 = complete later)
    const syncBtn = container.querySelector('#syncToTodayBtn');
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            const track = app.getActiveTrack();
            const hasActivePlan = track?.catchUpPlan?.isActive;

            if (hasActivePlan) {
                const cancelConfirmed = await showDialog({
                    title: 'סנכרן עד היום',
                    message: 'האם אתה בטוח שברצונך לסנכרן? פעולה זו תבטל את תכנית הצמצום פערים הפעילה.',
                    icon: '🔄',
                    showCancel: true,
                    confirmText: 'כן, סנכרן ובטל תכנית',
                    cancelText: 'ביטול'
                });
                if (!cancelConfirmed) return;

                await app.handleCancelCatchUpPlan(true);
            }

            // Ask what state to mark all past days as
            const syncType = await showDialog({
                title: 'סנכרן עד היום',
                message: 'בחר מה לסמן בכל ימי הלימוד שעברו:',
                icon: '🔄',
                showCancel: true,
                confirmText: 'סנכרן',
                cancelText: 'ביטול',
                inputs: [
                    {
                        type: 'select',
                        name: 'syncState',
                        label: 'סמן ימים שעברו כ:',
                        options: [
                            { value: '1', text: '📖 נלמד — עמודים שלמדת' },
                            { value: '2', text: '⏭️ השלמות — עמודים שדילגת עליהם, יושלמו אחר כך' }
                        ]
                    }
                ]
            });

            if (!syncType) return;

            const stateToMark = parseInt(syncType.syncState, 10);
            await app.handleSyncToToday(stateToMark);

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
        
        // Update stat cards (now only 2 cards: books + pages)
        const statCards = container.querySelectorAll('.grid.grid-cols-1.sm\\:grid-cols-2 .text-3xl');
        if (statCards.length >= 2) {
            statCards[1].textContent = `${tLearned}/${activeAmudim}`;
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
        const placeholder = document.getElementById('noCatchUpPlaceholder');
        if (!catchUpSection) return;

        const deficit = app.getCatchUpDeficit();
        const track = app.getActiveTrack();
        const hasPlan = track?.catchUpPlan?.isActive;

        // Only show if there's a plan OR if there's a deficit
        if (!deficit.isAnyBehind && !hasPlan) {
            catchUpSection.classList.add('hidden');
            if (placeholder) placeholder.classList.remove('hidden');
            return;
        }

        catchUpSection.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');

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
                <span class="text-sm text-slate-600 font-bold">${desc}</span>
            </div>`;
        }).join('');

        section.innerHTML = `
            <div class="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div class="flex items-center gap-2">
                        <span class="text-xl">✅</span>
                        <h3 class="font-bold text-slate-800">תכנית צמצום פעילה</h3>
                        <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">מהיום</span>
                    </div>
                    <button id="cancelCatchUpBtn" class="w-full sm:w-auto text-sm text-red-500 hover:text-red-700 font-bold px-4 py-2 rounded-lg border border-red-200 hover:bg-red-50 transition-all">
                        בטל תכנית
                    </button>
                </div>
                <div class="divide-y divide-blue-100">${detailsHtml}</div>
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
                        <span class="text-sm font-medium text-slate-600">מסכת ${d.bookName}</span>
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