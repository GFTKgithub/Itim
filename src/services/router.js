/**
 * Lightweight page router for the Itim SPA.
 * Manages page registration, navigation, and animated transitions.
 */

const pages = new Map();
let currentPage = null;
let currentCleanup = null;
let containerId = 'page-container';

/**
 * Register a page with the router.
 * @param {string} name - Unique page identifier
 * @param {object} page - { render(container, app), destroy()? }
 */
export function registerPage(name, page) {
    pages.set(name, page);
}

/**
 * Set the container element ID where pages render.
 */
export function setContainerId(id) {
    containerId = id;
}

/**
 * Navigate to a registered page with a smooth transition.
 * @param {string} name - Page name to navigate to
 * @param {object} app - App state reference (passed to render)
 */
export async function navigateTo(name, app, force = false) {
    const page = pages.get(name);
    if (!page) {
        console.error(`Router: Page "${name}" not found.`);
        return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Router: Container #${containerId} not found.`);
        return;
    }

    // Don't re-navigate to the same page unless force flag is set
    if (currentPage === name && !force) return;

    // Run cleanup on current page
    if (currentCleanup && typeof currentCleanup === 'function') {
        currentCleanup();
    }
    if (currentPage) {
        const prevPage = pages.get(currentPage);
        if (prevPage && typeof prevPage.destroy === 'function') {
            prevPage.destroy();
        }
    }

    // Fade out
    container.style.opacity = '0';
    container.style.transform = 'translateY(8px)';
    container.style.transition = 'opacity 0.2s ease, transform 0.2s ease';

    // Wait for fade out
    await new Promise(resolve => setTimeout(resolve, 150));

    // Clear and render new page
    container.innerHTML = '';
    currentPage = name;

    const result = page.render(container, app);
    currentCleanup = result || null;

    // Force reflow then fade in
    container.offsetHeight;
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';
}

/**
 * Get the currently active page name.
 */
export function getCurrentPage() {
    return currentPage;
}