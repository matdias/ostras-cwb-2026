async function loadHtmlPartials() {
    const partials = [
        { id: 'panel-ostras', url: 'partials/tab-ostras.html' },
        { id: 'panel-bottleshare', url: 'partials/tab-bottleshare.html' },
        { id: 'panel-info', url: 'partials/tab-info.html' },
        { id: 'modals-container', url: 'partials/modals.html' }
    ];

    await Promise.all(partials.map(async ({ id, url }) => {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Erro ao carregar ${url}`);
        document.getElementById(id).innerHTML = await res.text();
    }));

    bindModalEvents();
}

function switchTab(tabName) {
    const tabs = ['ostras', 'bottleshare', 'info'];
    tabs.forEach(t => {
        const panel = document.getElementById(`panel-${t}`);
        const btn = document.getElementById(`tab-btn-${t}`);
        if (t === tabName) {
            panel.classList.remove('hidden');
            btn.classList.add('bg-cobalt', 'text-paper', 'shadow-2xs');
            btn.classList.remove('text-cobalt', 'hover:bg-cobalt/10');
            btn.setAttribute('aria-selected', 'true');
        } else {
            panel.classList.add('hidden');
            btn.classList.remove('bg-cobalt', 'text-paper', 'shadow-2xs');
            btn.classList.add('text-cobalt', 'hover:bg-cobalt/10');
            btn.setAttribute('aria-selected', 'false');
        }
    });

    if (tabName === 'info') renderFinanceSummary();
}

function renderAll() {
    updateKPIs();
    renderOystersList();
    renderBottlesList();
    renderFinanceSummary();
}

window.addEventListener('DOMContentLoaded', async () => {
    await loadHtmlPartials();

    const savedPin = (localStorage.getItem(PIN_STORAGE_KEY) || '').trim();
    const savedRole = localStorage.getItem(ROLE_STORAGE_KEY) || 'view';
    if (savedPin) {
        currentPin = savedPin;
        currentRole = savedRole === 'edit' ? 'edit' : 'view';
        unlockMainScreen();
        await syncFromSheets(false);
    } else {
        showAuthScreen();
    }
});
