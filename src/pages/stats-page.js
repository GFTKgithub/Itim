/**
 * Statistics Page — demo page showing study progress analytics.
 * This demonstrates how to add a new page to the Itim SPA.
 */

export function renderStatsPage(container, app) {
    const activeTrack = app.getActiveTrack();
    const schedule = activeTrack?.studySchedule || [];
    const bookSequence = activeTrack?.bookSequence || [];
    const overrides = activeTrack?.studyStatusOverrides || {};

    // Calculate some basic stats
    const totalStudyDays = schedule.filter(d => d.type === 'study' || d.type === 'review').length;
    const completedDays = Object.keys(overrides).filter(k => overrides[k] === 1).length;
    const skippedDays = Object.keys(overrides).filter(k => overrides[k] === 2).length;
    const completionRate = totalStudyDays > 0 ? Math.round((completedDays / totalStudyDays) * 100) : 0;
    const totalBooks = bookSequence.length;
    const siyumCount = schedule.filter(d => d.isSiyum).length;

    container.innerHTML = `
        <div class="max-w-5xl mx-auto p-4 md:p-8">
            <!-- Page Header -->
            <div class="mb-8">
                <div class="flex items-center gap-3 mb-2">
                    <span class="text-3xl">📊</span>
                    <h1 class="text-3xl font-black text-slate-800">סטטיסטיקות לימוד</h1>
                </div>
                <p class="text-slate-500 font-medium mr-12">סקירה כללית של התקדמות הלימוד שלך</p>
            </div>

            ${!activeTrack ? `
                <div class="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
                    <span class="text-4xl block mb-3">📭</span>
                    <p class="text-amber-800 font-bold text-lg">אין מסלול לימוד פעיל</p>
                    <p class="text-amber-600 text-sm mt-1">צור מסלול לימוד והפק לוח כדי לראות סטטיסטיקות</p>
                </div>
            ` : `
                <!-- Stats Cards Grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-2xl">📚</span>
                            <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">מסלול</span>
                        </div>
                        <p class="text-3xl font-black text-slate-800">${totalBooks}</p>
                        <p class="text-sm text-slate-500 font-medium mt-1">מסכות במסלול</p>
                    </div>

                    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-2xl">📅</span>
                            <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">ימים</span>
                        </div>
                        <p class="text-3xl font-black text-slate-800">${totalStudyDays}</p>
                        <p class="text-sm text-slate-500 font-medium mt-1">ימי לימוד מתוכננים</p>
                    </div>

                    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-2xl">✅</span>
                            <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">התקדמות</span>
                        </div>
                        <p class="text-3xl font-black text-emerald-600">${completionRate}%</p>
                        <p class="text-sm text-slate-500 font-medium mt-1">${completedDays} ימים נלמדו</p>
                    </div>

                    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-2xl">🎉</span>
                            <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">הישגים</span>
                        </div>
                        <p class="text-3xl font-black text-amber-600">${siyumCount}</p>
                        <p class="text-sm text-slate-500 font-medium mt-1">סיומי מסכת</p>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="font-bold text-slate-800">התקדמות כללית</h3>
                        <span class="text-sm font-bold text-slate-500">${completedDays}/${totalStudyDays} ימים</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                        <div class="bg-gradient-to-l from-blue-800 to-blue-600 h-full rounded-full transition-all duration-1000 ease-out" 
                             style="width: ${completionRate}%"></div>
                    </div>
                    <div class="flex justify-between mt-2 text-xs text-slate-400">
                        <span>${skippedDays > 0 ? `דילוגים: ${skippedDays}` : ''}</span>
                        <span>${completionRate}% הושלם</span>
                    </div>
                </div>

                <!-- Per-Book Breakdown -->
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div class="p-5 border-b border-slate-100">
                        <h3 class="font-bold text-slate-800 flex items-center gap-2">
                            <span>📖</span>
                            <span>פירוט לפי מסכת</span>
                        </h3>
                    </div>
                    <div class="divide-y divide-slate-100">
                        ${bookSequence.length === 0 ? `
                            <div class="p-8 text-center text-slate-400">
                                <p class="font-medium">אין מסכות במסלול הנוכחי</p>
                                <p class="text-sm mt-1">הוסף מסכות במתכנן הלימוד כדי לראות פירוט</p>
                            </div>
                        ` : bookSequence.map((book, idx) => {
                            const bookName = typeof book === 'string' ? book : book.name;
                            const bookDays = schedule.filter(d => d.book === bookName);
                            const bookStudyDays = bookDays.filter(d => d.type === 'study' || d.type === 'review').length;
                            const bookCompleted = bookDays.filter(d => overrides[d.dateString] === 1).length;
                            const bookRate = bookStudyDays > 0 ? Math.round((bookCompleted / bookStudyDays) * 100) : 0;
                            const hasSiyum = bookDays.some(d => d.isSiyum);
                            
                            return `
                                <div class="p-4 hover:bg-slate-50 transition-colors">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="flex items-center gap-2">
                                            <span class="text-sm font-bold text-slate-700">${bookName}</span>
                                            ${hasSiyum ? '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">🎉 סיום</span>' : ''}
                                        </div>
                                        <span class="text-xs font-bold text-slate-400">${bookCompleted}/${bookStudyDays} ימים</span>
                                    </div>
                                    <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div class="bg-gradient-to-l from-blue-700 to-blue-500 h-full rounded-full transition-all duration-700" 
                                             style="width: ${bookRate}%"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Empty state hint -->
                ${totalStudyDays === 0 ? `
                    <div class="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
                        <span class="text-3xl block mb-2">💡</span>
                        <p class="text-blue-800 font-bold">עדיין לא הופק לוח לימוד</p>
                        <p class="text-blue-600 text-sm mt-1">עבור למתכנן הלימוד, בחר מסכות ולחץ על "צור לוח לימוד מותאם אישית"</p>
                    </div>
                ` : ''}
            `}
        </div>
    `;

    // Return cleanup function
    return () => {
        // Cleanup stats page if needed
    };
}