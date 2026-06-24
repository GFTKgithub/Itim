// Create and render a custom context menu overlay
export function showContextMenu(event, items = []) {
    // Prevent default system behavior if it's a right-click
    event.preventDefault();

    // 1. Clean up any existing instances of the context menu safely
    removeExistingContextMenu();

    if (!items || items.length === 0) return;

    // 2. Build the context menu container element
    const menu = document.createElement('div');
    menu.id = 'app-custom-context-menu';
    // Style with modern Tailwind attributes mirroring your application aesthetics
    menu.className = `
        fixed z-[200] min-w-[160px] bg-white rounded-xl border border-slate-200/80 
        shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-1.5 font-sans text-right select-none 
        animate-in fade-in zoom-in-95 duration-100
    `;
    menu.setAttribute('dir', 'rtl');

    // 3. Inject individual actionable options
    items.forEach(item => {
        if (item.divider) {
            const divider = document.createElement('div');
            divider.className = 'my-1 border-t border-slate-100';
            menu.appendChild(divider);
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        
        // Dynamic conditional coloring based on action danger context (e.g. Delete)
        const baseColorClass = item.danger 
            ? 'text-rose-600 hover:bg-rose-50' 
            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900';

        button.className = `
            w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg
            transition-colors duration-150 text-right ${baseColorClass}
        `;

        // Process icons gracefully if supplied
        const iconHtml = item.icon ? `<span class="text-sm leading-none">${item.icon}</span>` : '';
        button.innerHTML = `${iconHtml}<span class="flex-1">${item.label}</span>`;

        // Execution engine bind
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            removeExistingContextMenu();
            if (typeof item.action === 'function') {
                item.action();
            }
        });

        menu.appendChild(button);
    });

    // 4. Attach temporary instances to body to query absolute dimensions
    document.body.appendChild(menu);

    // 5. Calculate perfect placement using boundary constraints
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    
    let posX = event.clientX;
    let posY = event.clientY;

    // Check right-edge collision for RTL reading comfort
    if (posX - menuWidth < 0) {
        posX = menuWidth; // Keep pinned safely within viewport view boundaries
    }
    // Check bottom viewport collision bounds
    if (posY + menuHeight > window.innerHeight) {
        posY = window.innerHeight - menuHeight - 10;
    }

    // Since our layout is RTL (`dir="rtl"`), position uses `left` anchor relative to coordinates
    menu.style.left = `${posX - menuWidth}px`;
    menu.style.top = `${posY}px`;

    // 6. Global event bindings to close safely when clicking away or hitting Escape
    setTimeout(() => {
        document.addEventListener('click', globalCloseHandler);
        document.addEventListener('contextmenu', globalCloseHandler);
        document.addEventListener('keydown', escapeCloseHandler);
    }, 10);
}

// Tears down the active context menu instance cleanly
export function removeExistingContextMenu() {
    const activeMenu = document.getElementById('app-custom-context-menu');
    if (activeMenu) {
        activeMenu.remove();
    }
    document.removeEventListener('click', globalCloseHandler);
    document.removeEventListener('contextmenu', globalCloseHandler);
    document.removeEventListener('keydown', escapeCloseHandler);
}

function globalCloseHandler(e) {
    const menu = document.getElementById('app-custom-context-menu');
    if (menu && !menu.contains(e.target)) {
        removeExistingContextMenu();
    }
}

function escapeCloseHandler(e) {
    if (e.key === 'Escape') {
        removeExistingContextMenu();
    }
}