/**
 * Planner Page — three-step wizard layout:
 *   1. 📚 מה לומדים? (book selection & sequence)
 *   2. ⚙️ מתי לומדים? (schedule settings with live summary)
 *   3. 🚀 צור לוח לימוד (generate + progress)
 * Plus a calendar preview area below.
 */

export function renderPlannerPage(container, app) {
    const activeTrack = app.getActiveTrack();
    const trackName = activeTrack?.name || 'מסלול לא ידוע';
    const sequenceCount = activeTrack?.bookSequence?.length || 0;
    const schedule = activeTrack?.studySchedule || [];
    const hasSchedule = schedule.length > 0;

    container.innerHTML = `
        <div class="max-w-4xl mx-auto p-4 md:p-6">
            <div class="bg-white rounded-2xl shadow-xl no-print border border-slate-200 overflow-hidden">
                <div class="h-2 bg-gradient-to-r from-blue-900 via-blue-700 to-blue-900"></div>

                <div class="p-5 md:p-7 space-y-6">

                    <!-- Track header (compact) -->
                    <div class="flex items-center gap-3 pb-3 border-b border-slate-100">
                        <span class="text-xl">📐</span>
                        <div>
                            <h2 class="text-base font-bold text-slate-800">עריכת מסלול: ${trackName}</h2>
                            <p class="text-[11px] text-slate-400">שלושה צעדים פשוטים ללוח לימוד מותאם</p>
                        </div>
                    </div>

                    <!-- ==================== STEP 1: מה לומדים? ==================== -->
                    <div class="step-card step-1" data-step="1">
                        <div class="flex items-center gap-3 mb-4">
                            <span class="step-number">1</span>
                            <div class="flex-1">
                                <h3 class="text-md font-bold text-slate-800">מה לומדים?</h3>
                                <p class="text-xs text-slate-400">בחר ספרים וסדר לימוד</p>
                            </div>
                            <span id="bookCountBadge" class="count-badge ${sequenceCount > 0 ? 'count-badge-active' : ''}">${sequenceCount} ספרים</span>
                        </div>

                        <div class="pr-8 space-y-4">
                            <!-- Add book row -->
                            <div class="flex gap-2 items-center">
                                <div class="flex-1 relative">
                                    <select id="bookSelect" class="w-full border border-slate-300 rounded-xl p-3 bg-white shadow-sm font-medium text-sm appearance-none cursor-pointer">
                                        <option value="" disabled selected>בחר ספר...</option>
                                    </select>
                                    <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                                <button id="addToSequenceBtn" class="bg-blue-800 text-white px-5 py-3 rounded-xl font-bold hover:bg-blue-900 transition-all shadow-md active:scale-95 flex items-center gap-1.5 text-sm shrink-0">
                                    <span>הוסף</span>
                                    <span class="text-lg leading-none">+</span>
                                </button>
                            </div>

                            <!-- Book sequence list -->
                            <div>
                                <div class="flex justify-between items-center mb-2">
                                    <label class="text-xs font-bold text-slate-500">רשימת הספרים</label>
                                    <button id="clearSequenceBtn" class="text-[11px] text-red-400 hover:text-red-600 font-semibold transition-colors flex items-center gap-1 ${sequenceCount === 0 ? 'hidden' : ''}">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 3h7" />
                                        </svg>
                                        <span>איפוס רשימה</span>
                                    </button>
                                </div>
                                <ul id="bookSequenceList" class="space-y-1.5 max-h-64 overflow-y-auto bg-white p-3 rounded-xl border-2 border-dashed border-slate-200 min-h-[80px]">
                                </ul>
                            </div>
                        </div>
                    </div>

                    <!-- ==================== STEP 2: מתי לומדים? ==================== -->
                    <div class="step-card step-2 ${sequenceCount === 0 ? 'step-disabled' : ''}" data-step="2">
                        <div class="flex items-center gap-3 mb-4">
                            <span class="step-number ${sequenceCount === 0 ? 'step-number-muted' : ''}">2</span>
                            <div class="flex-1">
                                <h3 class="text-md font-bold text-slate-800">מתי לומדים?</h3>
                                <p class="text-xs text-slate-400">הגדר ימים, מועדים וקצב הלימוד</p>
                            </div>
                            <!-- Settings gear with reset dropdown -->
                            <div class="relative" id="settingsGearContainer">
                                <button id="settingsGearBtn" class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all text-sm ${sequenceCount === 0 ? 'opacity-30 pointer-events-none' : ''}">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </button>
                                <div id="settingsResetDropdown" class="hidden absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1.5 min-w-[200px]">
                                    <button id="resetSettingsBtn" class="w-full text-right px-4 py-2 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-50 font-semibold transition-colors flex items-center gap-2">
                                        <span>⚙️</span>
                                        <span>איפוס הגדרות מסלול לברירת מחדל</span>
                                    </button>
                                    <button id="resetStudyStatusOverridesBtn" class="w-full text-right px-4 py-2 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 font-semibold transition-colors flex items-center gap-2">
                                        <span>🔄</span>
                                        <span>איפוס שינויים ידניים לסטטוס למידה</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="pr-8 space-y-4">
                            <!-- Start date row -->
                            <div class="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
                                <div class="flex-1">
                                    <label class="block text-xs font-bold text-slate-500 mb-1 mr-1" for="startDateInput">תאריך התחלה</label>
                                    <div class="flex items-center gap-2">
                                        <input type="date" id="startDateInput" class="flex-1 border border-slate-300 rounded-xl p-2.5 bg-white min-w-[140px] text-sm">
                                        <button id="syncToTodayBtn" class="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-semibold px-3 py-2.5 rounded-xl border border-slate-200 transition-colors whitespace-nowrap" title="סנכרן להיום">
                                            <span class="hidden sm:inline">📅 סנכרן להיום</span>
                                            <span class="sm:hidden">📅</span>
                                        </button>
                                    </div>
                                    <span id="startDateHebrewLabel" class="text-xs sm:text-sm text-slate-500 mr-1 font-medium block leading-tight mt-1"></span>
                                </div>
                            </div>

                            <!-- Study days — compact pills -->
                            <div>
                                <label class="block text-xs font-bold text-slate-500 mb-2 mr-1">ימי לימוד בשבוע</label>
                                <div class="flex gap-1.5 select-none" dir="rtl">
                                    <label class="day-pill group">
                                        <input type="checkbox" name="studyDays" value="0" class="peer hidden" checked>
                                        <div class="day-pill-inner">א</div>
                                    </label>
                                    <label class="day-pill group">
                                        <input type="checkbox" name="studyDays" value="1" class="peer hidden" checked>
                                        <div class="day-pill-inner">ב</div>
                                    </label>
                                    <label class="day-pill group">
                                        <input type="checkbox" name="studyDays" value="2" class="peer hidden" checked>
                                        <div class="day-pill-inner">ג</div>
                                    </label>
                                    <label class="day-pill group">
                                        <input type="checkbox" name="studyDays" value="3" class="peer hidden" checked>
                                        <div class="day-pill-inner">ד</div>
                                    </label>
                                    <label class="day-pill group">
                                        <input type="checkbox" name="studyDays" value="4" class="peer hidden" checked>
                                        <div class="day-pill-inner">ה</div>
                                    </label>
                                    <label class="day-pill group">
                                        <input type="checkbox" name="studyDays" value="5" class="peer hidden" checked>
                                        <div class="day-pill-inner">ו</div>
                                    </label>
                                    <label class="day-pill group">
                                        <input type="checkbox" name="studyDays" value="6" class="peer hidden">
                                        <div class="day-pill-inner">ש</div>
                                    </label>
                                </div>
                            </div>

                            <!-- Toggles row (holidays + bein hazmanim) side by side -->
                            <div class="flex flex-wrap gap-3" dir="rtl">
                                <label class="flex items-center gap-2.5 cursor-pointer group select-none bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-xl transition-all">
                                    <div class="relative flex items-center justify-center w-5 h-5">
                                        <input type="checkbox" id="includeHolidaysInput" class="peer hidden">
                                        <div class="absolute inset-0 border-2 border-slate-300 rounded-md group-hover:border-slate-400 peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all duration-200"></div>
                                        <svg class="relative z-10 w-3.5 h-3.5 text-white hidden peer-checked:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                                        </svg>
                                    </div>
                                    <span class="text-xs font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">ללמוד בחגים ומועדים</span>
                                </label>

                                <label class="flex items-center gap-2.5 cursor-pointer group select-none bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-xl transition-all">
                                    <div class="relative flex items-center justify-center w-5 h-5">
                                        <input type="checkbox" id="includeBeinHazmanimInput" class="peer hidden">
                                        <div class="absolute inset-0 border-2 border-slate-300 rounded-md group-hover:border-slate-400 peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all duration-200"></div>
                                        <svg class="relative z-10 w-3.5 h-3.5 text-white hidden peer-checked:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                                        </svg>
                                    </div>
                                    <span class="text-xs font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">ללמוד בבין הזמנים</span>
                                </label>

                                <div class="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-xl transition-all">
                                    <label class="text-xs font-bold text-slate-500" for="calendarSystem">סוג תאריך</label>
                                    <select id="calendarSystem" class="border-none bg-transparent p-0 text-xs font-bold text-slate-700 cursor-pointer focus:ring-0">
                                        <option value="hebrew">עברי</option>
                                        <option value="gregorian">לועזי</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Live summary bar -->
                            <div id="scheduleSummaryBar" class="bg-blue-50 border border-blue-100 rounded-xl p-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs ${hasSchedule ? '' : 'hidden'}">
                                <div class="flex items-center gap-1.5 text-blue-800">
                                    <span>📅</span>
                                    <span class="font-bold">מסתיים:</span>
                                    <span id="summaryEndDate" class="font-semibold">—</span>
                                </div>
                                <div class="flex items-center gap-1.5 text-blue-800">
                                    <span>📄</span>
                                    <span class="font-bold">ממוצע:</span>
                                    <span id="summaryAvgPages" class="font-semibold">—</span>
                                </div>
                                <div class="flex items-center gap-1.5 text-blue-800">
                                    <span>📆</span>
                                    <span class="font-bold">ימי לימוד:</span>
                                    <span id="summaryTotalDays" class="font-semibold">—</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ==================== STEP 3: צור לוח ==================== -->
                    <div class="step-card step-3 ${sequenceCount === 0 ? 'step-disabled' : ''}" data-step="3">
                        <div class="flex items-center gap-3 mb-0">
                            <span class="step-number ${sequenceCount === 0 ? 'step-number-muted' : ''}">3</span>
                            <div class="flex-1">
                                <h3 class="text-md font-bold text-slate-800">צור לוח לימוד</h3>
                                <p class="text-xs text-slate-400">צור לוח מותאם אישית עם כל ההגדרות</p>
                            </div>
                        </div>

                        <div class="pr-8 mt-4">
                            <button id="generateBtn"
                                class="generate-btn w-full bg-blue-800 text-white py-4 rounded-2xl font-black text-lg hover:bg-black transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-3 select-none ${sequenceCount === 0 ? 'opacity-40 cursor-not-allowed' : ''}"
                                ${sequenceCount === 0 ? 'disabled' : ''}>
                                <svg id="generateIcon" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span id="generateBtnText">צור לוח לימוד מותאם אישית</span>
                            </button>

                            <!-- Generation progress bar (hidden by default) -->
                            <div id="generationProgress" class="hidden mt-3">
                                <div class="flex justify-between text-xs text-slate-400 mb-1">
                                    <span>מייצר לוח...</span>
                                    <span id="generationProgressText">0%</span>
                                </div>
                                <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                    <div id="generationProgressBar" class="bg-blue-800 h-full rounded-full transition-all duration-500 ease-out" style="width: 0%"></div>
                                </div>
                            </div>

                            <!-- Last generated hint -->
                            <div id="lastGeneratedHint" class="text-center mt-2 ${hasSchedule ? 'text-[11px] text-slate-400' : 'hidden'}">
                                <span>נוצר לאחרונה: </span>
                                <span id="lastGeneratedTime">—</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- ==================== CALENDAR PREVIEW ==================== -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl shadow-xl border border-slate-200 mt-6 mb-6 select-none no-print" dir="rtl">
                <div class="flex items-center gap-2">
                    <span class="text-xl">📅</span>
                    <h3 class="text-md font-bold text-slate-800">תצוגה מקדימה</h3>
                </div>
                <button id="toggleCalendarViewModeBtn" 
                    class="w-full sm:w-auto bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 text-sm">
                    <span id="toggleViewIcon">📄</span>
                    <span id="toggleViewText">הצג את כל החודשים ברצף</span>
                </button>
            </div>

            <div id="calendarContainer" class="space-y-12 mb-24"></div>

            <!-- Action dock -->
            <div id="action-dock" class="fixed bottom-0 left-0 w-full bg-white/60 backdrop-blur-md border-t border-slate-200 flex gap-3 md:gap-4 justify-center py-4 hidden select-none no-print z-50 shadow-lg">
                <button id="printBtn"
                    class="bg-white text-slate-800 px-6 md:px-8 py-3 md:py-2.5 rounded-xl shadow-sm border border-slate-200 text-xs md:text-sm font-bold hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 group active:scale-98">
                    <span class="text-lg group-hover:rotate-12 group-hover:scale-110 transition-transform">🖨️</span>
                    <span>הדפסת הלוח</span>
                </button>
                <button id="exportToExcelBtn"
                    class="bg-emerald-600 text-white px-6 md:px-8 py-3 md:py-2.5 rounded-xl shadow-sm shadow-emerald-600/10 text-xs md:text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 group active:scale-98">
                    <span class="text-lg group-hover:rotate-12 group-hover:scale-110 transition-transform">📊</span>
                    <span>ייצוא לאקסל</span>
                </button>
                <button id="exportToICalBtn"
                    class="bg-blue-600 text-white px-6 md:px-8 py-3 md:py-2.5 rounded-xl shadow-sm shadow-blue-600/10 text-xs md:text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 group active:scale-98">
                    <span class="text-lg group-hover:rotate-12 group-hover:scale-110 transition-transform">📅</span>
                    <span>ייצוא ל-iCal</span>
                </button>
            </div>
        </div>
    `;

    // Return cleanup function
    return () => {
        // Any planner-specific cleanup if needed
    };
}