/**
 * Planner Page — pure baseline editing for the currently selected track.
 * No track selector UI, no progress marking (Eifo Ata Ochez).
 */

export function renderPlannerPage(container, app) {
    const activeTrack = app.getActiveTrack();
    const trackName = activeTrack?.name || 'מסלול לא ידוע';

    container.innerHTML = `
        <div class="max-w-5xl mx-auto p-4 md:p-8">
            <div class="bg-white rounded-2xl shadow-xl mb-8 no-print border border-slate-200 overflow-hidden">
                <div class="h-2 bg-gradient-to-r from-blue-900 via-blue-700 to-blue-900"></div>

                <div class="p-6 md:p-8 space-y-8">
                    
                    <!-- Track header -->
                    <div class="flex items-center gap-3 pb-4 border-b border-slate-100">
                        <span class="text-2xl">📐</span>
                        <div>
                            <h2 class="text-lg font-bold text-slate-800">עריכת מסלול: ${trackName}</h2>
                            <p class="text-xs text-slate-400">ערוך את תכולת הלימוד, ההגדרות והקצב של המסלול</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
                        
                        <div class="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-5">
                            <h3 class="text-md font-bold text-slate-800 border-b border-slate-200 pb-2">📚 ניהול תכולת וסדר הלימוד</h3>
                            
                            <div>
                                <label class="block font-bold mb-2 text-slate-700">הוספת מסכת למסלול</label>
                                <div class="flex gap-2 select-none">
                                    <select id="bookSelect" class="flex-1 border border-slate-300 rounded-lg p-3 bg-white shadow-sm font-medium text-sm"></select>
                                    <button id="addToSequenceBtn" class="bg-blue-800 text-white px-5 rounded-lg font-bold hover:bg-blue-900 transition-all shadow-md active:scale-95 flex items-center gap-1 text-sm">
                                        <span>הוסף</span>
                                        <span class="text-xl leading-none">+</span>
                                    </button>
                                </div>
                            </div>

                                <div class="pt-2">
                                    <div class="flex justify-between items-end mb-3">
                                        <label class="font-bold text-slate-700 flex items-center gap-2">
                                            סדר הלימוד המתוכנן
                                        </label>
                                        <div class="flex gap-3">
                                            <button id="clearSequenceBtn" class="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 3h7" />
                                            </svg>
                                            איפוס רשימה
                                        </button>
                                    </div>
                                </div>
                                <ul id="bookSequenceList" class="space-y-2 max-h-56 overflow-y-auto bg-white p-4 rounded-xl border-2 border-dashed border-slate-300 min-h-[80px]">
                                </ul>
                            </div>
                        </div>

                        <div class="space-y-5">
                            <div class="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                                <label class="block font-bold text-slate-800 border-b border-slate-200 pb-2 mb-2 text-md">
                                    ⚙️ הגדרות וקצב הלימוד
                                </label>

                                <div>
                                    <label class="block text-xs font-bold text-slate-500 mb-1 mr-1" for="startDateInput">תאריך התחלה</label>
                                    <div class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                                        <input type="date" id="startDateInput" class="w-full sm:w-auto flex-1 border border-slate-300 rounded-lg p-2 bg-white min-w-[130px] text-sm">
                                        <span id="startDateHebrewLabel" class="text-xs sm:text-sm text-slate-500 sm:mr-2 font-medium min-w-0 max-w-full block sm:inline leading-tight"></span>
                                    </div>
                                </div>

                                <div>
                                    <label class="block text-xs font-bold text-slate-500 mb-2 mr-1">ימי לימוד בשבוע</label>
                                    <div class="flex justify-between gap-1 select-none" dir="rtl">
                                        <label class="flex-1 text-center cursor-pointer group">
                                            <input type="checkbox" name="studyDays" value="0" class="peer hidden" checked>
                                            <div class="py-2 text-sm font-bold rounded-lg border-2 border-slate-200 text-slate-600 peer-checked:bg-blue-800 peer-checked:border-blue-800 peer-checked:text-white transition-all">א</div>
                                        </label>
                                        <label class="flex-1 text-center cursor-pointer group">
                                            <input type="checkbox" name="studyDays" value="1" class="peer hidden" checked>
                                            <div class="py-2 text-sm font-bold rounded-lg border-2 border-slate-200 text-slate-600 peer-checked:bg-blue-800 peer-checked:border-blue-800 peer-checked:text-white transition-all">ב</div>
                                        </label>
                                        <label class="flex-1 text-center cursor-pointer group">
                                            <input type="checkbox" name="studyDays" value="2" class="peer hidden" checked>
                                            <div class="py-2 text-sm font-bold rounded-lg border-2 border-slate-200 text-slate-600 peer-checked:bg-blue-800 peer-checked:border-blue-800 peer-checked:text-white transition-all">ג</div>
                                        </label>
                                        <label class="flex-1 text-center cursor-pointer group">
                                            <input type="checkbox" name="studyDays" value="3" class="peer hidden" checked>
                                            <div class="py-2 text-sm font-bold rounded-lg border-2 border-slate-200 text-slate-600 peer-checked:bg-blue-800 peer-checked:border-blue-800 peer-checked:text-white transition-all">ד</div>
                                        </label>
                                        <label class="flex-1 text-center cursor-pointer group">
                                            <input type="checkbox" name="studyDays" value="4" class="peer hidden" checked>
                                            <div class="py-2 text-sm font-bold rounded-lg border-2 border-slate-200 text-slate-600 peer-checked:bg-blue-800 peer-checked:border-blue-800 peer-checked:text-white transition-all">ה</div>
                                        </label>
                                        <label class="flex-1 text-center cursor-pointer group">
                                            <input type="checkbox" name="studyDays" value="5" class="peer hidden" checked>
                                            <div class="py-2 text-sm font-bold rounded-lg border-2 border-slate-200 text-slate-600 peer-checked:bg-blue-800 peer-checked:border-blue-800 peer-checked:text-white transition-all">ו</div>
                                        </label>
                                        <label class="flex-1 text-center cursor-pointer group">
                                            <input type="checkbox" name="studyDays" value="6" class="peer hidden">
                                            <div class="py-2 text-sm font-bold rounded-lg border-2 border-slate-200 text-slate-600 peer-checked:bg-blue-800 peer-checked:border-blue-800 peer-checked:text-white transition-all">ש</div>
                                        </label>
                                    </div>
                                </div>
                            
                                <div class="pt-4 mt-2 border-t border-slate-200 flex flex-col gap-3" dir="rtl">
                                    <label class="flex items-center gap-3 cursor-pointer group select-none">
                                        <div class="relative flex items-center justify-center w-5 h-5">
                                            <input type="checkbox" id="includeHolidaysInput" class="peer hidden">
                                            <div class="absolute inset-0 border-2 border-slate-300 rounded group-hover:border-slate-400 peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all duration-200"></div>
                                            <svg class="relative z-10 w-3 h-3 text-white hidden peer-checked:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <span class="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                                            ללמוד בחגים ומועדים
                                        </span>
                                    </label>
                                
                                    <label class="flex items-center gap-3 cursor-pointer group select-none">
                                        <div class="relative flex items-center justify-center w-5 h-5">
                                            <input type="checkbox" id="includeBeinHazmanimInput" class="peer hidden">
                                            <div class="absolute inset-0 border-2 border-slate-300 rounded group-hover:border-slate-400 peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all duration-200"></div>
                                            <svg class="relative z-10 w-3 h-3 text-white hidden peer-checked:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <span class="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                                            ללמוד בבין הזמנים
                                        </span>
                                    </label>
                                </div>

                                <div>
                                    <label class="block text-xs font-bold text-slate-500 mb-1 mr-1">סוג לוח תצוגה</label>
                                    <select id="calendarSystem" class="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-medium text-sm select-none">
                                        <option value="hebrew">עברי (ראשי)</option>
                                        <option value="gregorian">לועזי (ראשי)</option>
                                    </select>
                                </div>

                            </div>
                        </div>
                    </div>

                    <button id="generateBtn"
                        class="w-full mt-6 bg-blue-800 text-white py-5 rounded-2xl font-black text-xl hover:bg-black transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3 select-none">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        צור לוח לימוד מותאם אישית
                    </button>
                </div>
            </div>

            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 mb-6 select-none no-print" dir="rtl">
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