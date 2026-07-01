/**
 * Navigation bar component for the Itim SPA.
 * Provides persistent top navigation between pages.
 */

/**
 * Render the navigation bar into a container element.
 * @param {HTMLElement} container - The nav container element
 * @param {object} app - App state reference
 * @param {function} navigateTo - Router navigate function
 */
export function renderNavBar(container, app, navigateTo) {
    container.innerHTML = `
        <nav id="main-nav" class="bg-white border-b border-slate-200 shadow-sm no-print select-none" dir="rtl">
            <div class="max-w-5xl mx-auto px-4 md:px-8">
                <div class="flex items-center justify-between h-14">
                    <!-- Logo / Brand -->
                    <div class="flex items-center gap-2">
                        <img src="icons/itim-icon-192.png" alt="עיתים" class="h-8 w-8 object-contain">
                        <span class="text-lg font-black text-slate-800 tracking-tight">עיתים</span>
                    </div>

                    <!-- Nav Links -->
                    <div class="flex items-center gap-1">
                        <button data-page="dashboard" 
                            class="nav-link px-3 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-95">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span>לוח בקרה</span>
                        </button>
                        <button data-page="planner" 
                            class="nav-link px-3 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-95">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            </svg>
                            <span>עריכת מסלול</span>
                        </button>
                        <button data-page="progress" 
                            class="nav-link px-3 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-95">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span>התקדמות</span>
                        </button>
                    </div>

                    <!-- Settings + Cloud buttons (moved from header) -->
                    <div class="flex items-center gap-2">
                        <button id="openCloudAuthBtn" class="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95">
                            <span id="globalCloudAuthBtnText">👤</span>
                        </button>
                        <button id="toggleSettingsPanelBtn" class="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95 group">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-400 group-hover:rotate-45 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>הגדרות</span>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    `;

    // Wire up nav link clicks
    container.querySelectorAll('.nav-link').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            if (page) {
                navigateTo(page, app);
            }
        });
    });
}

/**
 * Update the active nav link highlight.
 * @param {string} activePage - The currently active page name
 */
export function updateActiveNavLink(activePage) {
    document.querySelectorAll('.nav-link').forEach(link => {
        const isActive = link.dataset.page === activePage;
        link.classList.toggle('text-slate-800', isActive);
        link.classList.toggle('bg-slate-100', isActive);
        link.classList.toggle('text-slate-500', !isActive);
    });
}