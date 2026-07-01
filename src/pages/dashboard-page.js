/**
 * Dashboard Page — shows all tracks and provides access to editing and progress marking.
 */

export function renderDashboardPage(container, app, navigateTo) {
    const tracks = app.getTracksRef().slice();
    const state = app.getStateRef();
    const activeTrackId = state.activeTrackId;

    container.innerHTML = `
        <div class="max-w-5xl mx-auto p-4 md:p-8">
            <!-- Page Header -->
            <div class="mb-8">
                <div class="flex items-center gap-3 mb-2">
                    <span class="text-3xl">🏠</span>
                    <h1 class="text-3xl font-black text-slate-800">לוח הבקרה</h1>
                </div>
                <p class="text-slate-500 font-medium mr-12">ניהול מסלולי הלימוד שלך</p>
            </div>

            <!-- Create New Track Section -->
            <div class="bg-white rounded-2xl shadow-xl mb-8 border border-slate-200 overflow-hidden">
                <div class="h-2 bg-gradient-to-r from-blue-900 via-blue-700 to-blue-900"></div>
                <div class="p-6 md:p-8">
                    <div class="flex items-center gap-3 mb-5">
                        <span class="text-2xl">➕</span>
                        <h2 class="text-xl font-bold text-slate-800">יצירת מסלול לימוד חדש</h2>
                    </div>
                    <div class="flex gap-2 select-none">
                        <input type="text" id="dashboardNewTrackNameInput" placeholder='שם המסלול (למשל: דף יומי, רמב"ם...)' 
                            class="flex-1 border border-slate-300 rounded-lg p-3 bg-white shadow-sm font-medium focus:outline-none focus:border-blue-500 text-sm min-w-0">
                        <button id="dashboardAddNewTrackBtn" 
                            class="bg-blue-800 text-white px-5 sm:px-6 rounded-lg font-bold hover:bg-blue-900 transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 text-sm shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                            צור מסלול
                        </button>
                    </div>
                </div>
            </div>

            <!-- Tracks List -->
            <div id="dashboardTracksList" class="space-y-4">
                <div class="flex items-center gap-2 mb-4">
                    <span class="text-2xl">📋</span>
                    <h2 class="text-xl font-bold text-slate-800">המסלולים שלך</h2>
                </div>

                ${tracks.length === 0 ? `
                    <div class="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-10 text-center">
                        <span class="text-5xl block mb-4">📭</span>
                        <p class="text-slate-500 font-bold text-lg">אין מסלולי לימוד</p>
                        <p class="text-slate-400 text-sm mt-1">צור מסלול חדש כדי להתחיל</p>
                    </div>
                ` : tracks.map((track) => {
                    const isActive = track.id === activeTrackId;
                    const schedule = track.studySchedule || [];
                    const overrides = track.studyStatusOverrides || {};
                    const bookSequence = track.bookSequence || [];
                    const totalStudyDays = schedule.filter(d => d.type === 'study' || d.type === 'review').length;
                    const completedDays = Object.keys(overrides).filter(k => overrides[k] === 1).length;
                    const completionRate = totalStudyDays > 0 ? Math.round((completedDays / totalStudyDays) * 100) : 0;
                    
                    return `
                        <div class="bg-white rounded-2xl border ${isActive ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'} shadow-sm hover:shadow-md transition-all overflow-hidden" data-track-id="${track.id}">
                            <div class="p-5 md:p-6">
                                <div class="flex items-start justify-between gap-4">
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2 mb-1">
                                            <h3 class="text-lg font-bold text-slate-800 truncate">${track.name || 'מסלול ללא שם'}</h3>
                                            ${isActive ? '<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold shrink-0">פעיל</span>' : ''}
                                        </div>
                                        <div class="flex flex-wrap gap-3 mt-2 text-sm text-slate-500">
                                            <span>📚 ${bookSequence.length} מסכות</span>
                                            <span>📅 ${totalStudyDays} ימי לימוד</span>
                                            ${completedDays > 0 ? `<span>✅ ${completedDays} נלמדו</span>` : ''}
                                        </div>
                                        
                                        ${totalStudyDays > 0 ? `
                                            <div class="mt-3">
                                                <div class="flex justify-between text-xs text-slate-400 mb-1">
                                                    <span>התקדמות</span>
                                                    <span>${completionRate}%</span>
                                                </div>
                                                <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                    <div class="bg-gradient-to-l from-blue-800 to-blue-600 h-full rounded-full transition-all duration-700" 
                                                         style="width: ${completionRate}%"></div>
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>

                                    <div class="flex flex-col gap-2 shrink-0">
                                        <button data-track-id="${track.id}" data-action="edit-track" 
                                            class="bg-blue-800 hover:bg-blue-900 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-sm flex items-center gap-1.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            </svg>
                                            <span>ערוך מסלול</span>
                                        </button>
                                        <button data-track-id="${track.id}" data-action="view-progress" 
                                            class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-sm flex items-center gap-1.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            <span>התקדמות</span>
                                        </button>
                                        <button data-track-id="${track.id}" data-action="delete-track" 
                                            class="bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1 ${tracks.length <= 1 ? 'opacity-40 cursor-not-allowed' : ''}">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 3h7" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                
                                ${bookSequence.length > 0 ? `
                                    <div class="mt-4 pt-4 border-t border-slate-100">
                                        <div class="text-xs text-slate-400 font-semibold mb-2">מסכות במסלול:</div>
                                        <div class="flex flex-wrap gap-1.5">
                                            ${bookSequence.slice(0, 8).map((book) => {
                                                const bookName = typeof book === 'string' ? book : book.name;
                                                return `<span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-xs font-medium">${bookName}</span>`;
                                            }).join('')}
                                            ${bookSequence.length > 8 ? `<span class="text-xs text-slate-400 italic">ועוד ${bookSequence.length - 8}...</span>` : ''}
                                        </div>
                                    </div>
                                ` : `
                                    <div class="mt-4 pt-4 border-t border-slate-100 text-center">
                                        <p class="text-xs text-slate-400">אין מסכות במסלול זה. לחץ על "ערוך מסלול" כדי להתחיל.</p>
                                    </div>
                                `}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    // Wire up create new track
    const addBtn = container.querySelector('#dashboardAddNewTrackBtn');
    const nameInput = container.querySelector('#dashboardNewTrackNameInput');
    const addTrackClick = async () => {
        const name = nameInput?.value;
        if (!name || !name.trim()) return;
        await app.handleAddNewTrack(name.trim());
        if (nameInput) nameInput.value = '';
        renderDashboardPage(container, app, navigateTo);
    };
    addBtn?.addEventListener('click', addTrackClick);
    nameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addBtn?.click();
        }
    });

    // Wire up track action buttons
    container.querySelectorAll('[data-action="edit-track"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const trackId = btn.dataset.trackId;
            await app.handleSwitchTrack(trackId);
            if (typeof navigateTo === 'function') {
                navigateTo('planner');
            }
        });
    });

    container.querySelectorAll('[data-action="view-progress"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const trackId = btn.dataset.trackId;
            await app.handleSwitchTrack(trackId);
            if (typeof navigateTo === 'function') {
                navigateTo('progress');
            }
        });
    });

    container.querySelectorAll('[data-action="delete-track"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const trackId = btn.dataset.trackId;
            if (trackId) {
                await app.handleDeleteTrack(trackId);
                renderDashboardPage(container, app, navigateTo);
            }
        });
    });

    return () => {
        // Cleanup if needed
    };
}