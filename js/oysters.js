function updateKPIs() {
    const metrics = getFinancialMetrics();
    const peopleWithOrder = appState.orders.filter(p => Number(p.dozens) > 0).length;

    document.getElementById('kpi-duzias').textContent = formatDozensBadge(metrics.totalDozens);
    document.getElementById('kpi-unidades-sub').textContent = `${metrics.totalUnits} unidades`;

    document.getElementById('kpi-ceviche-count').textContent = `${metrics.cevicheEatersCount} pessoas`;
    document.getElementById('kpi-ceviche-share').textContent = `${formatCurrency(metrics.cevichePerPerson)} / pessoa`;

    document.getElementById('kpi-custo-total').textContent = formatCurrency(metrics.grandTotalCost);
    document.getElementById('kpi-pediram').textContent = `${peopleWithOrder} de ${appState.orders.length} c/ ostras`;

    document.getElementById('readonly-preco-duzia').textContent = formatCurrency(metrics.priceDz);
    document.getElementById('readonly-gasto-ceviche').textContent = formatCurrency(metrics.cevicheTotal);

    const activeConsumers = appState.orders.filter(p => (Number(p.dozens) || 0) > 0 || Boolean(p.ceviche));
    const paidConsumersCount = activeConsumers.filter(p => Boolean(p.paid)).length;
    const totalConsumersCount = activeConsumers.length;

    document.getElementById('badge-ostras-tab').textContent = formatDozensBadge(metrics.totalDozens);
    document.getElementById('badge-bottles-tab').textContent = `${appState.bottles.length}`;
    document.getElementById('badge-rateio-tab').textContent = `${paidConsumersCount}/${totalConsumersCount}`;

    const cevicheCount = metrics.cevicheEatersCount;
    const paidCount = activeConsumers.filter(p => p.paid).length;
    const pendingCount = activeConsumers.filter(p => !p.paid).length;

    document.getElementById('count-all').textContent = appState.orders.length;
    document.getElementById('count-with_order').textContent = peopleWithOrder;
    document.getElementById('count-with_ceviche').textContent = cevicheCount;
    document.getElementById('count-pending_pay').textContent = pendingCount;
    document.getElementById('count-paid').textContent = paidCount;
}

function setFilter(filterKey) {
    currentFilter = filterKey;
    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.classList.remove('bg-cobalt', 'text-paper', 'border-cobalt');
        btn.classList.add('bg-white', 'text-cobalt', 'border-cobalt/35');
    });
    const activeBtn = document.getElementById(`filter-${filterKey}`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-white', 'text-cobalt', 'border-cobalt/35');
        activeBtn.classList.add('bg-cobalt', 'text-paper', 'border-cobalt');
    }
    renderOystersList();
}

function clearSearch() {
    document.getElementById('search-input').value = '';
    renderOystersList();
}

function quickAddPerson(e) {
    e.preventDefault();
    if (!canEdit()) return;
    const nameInput = document.getElementById('quick-name-input');
    const dozensSelect = document.getElementById('quick-dozens-select');
    const cevicheCheck = document.getElementById('quick-ceviche-check');

    const name = nameInput.value.trim();
    const dozens = Math.max(0, parseFloat(dozensSelect.value) || 0);
    const ceviche = Boolean(cevicheCheck.checked);

    if (!name) return;

    appState.orders.push({
        id: 'p_' + Date.now(),
        name,
        dozens,
        ceviche,
        paid: false,
        note: ''
    });

    nameInput.value = '';
    dozensSelect.value = '1';
    cevicheCheck.checked = false;
    saveState(true);
    showToast(`${name} adicionado(a)!`, '🦪');
}

function renderOystersList() {
    const container = document.getElementById('oysters-list');
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    const clearBtn = document.getElementById('clear-search-btn');
    clearBtn.classList.toggle('hidden', query.length === 0);

    const metrics = getFinancialMetrics();
    const isEditor = canEdit();

    const filtered = appState.orders
        .filter(p => {
            const matchesQuery = p.name.toLowerCase().includes(query) || (p.note && p.note.toLowerCase().includes(query));
            if (!matchesQuery) return false;

            const dz = Number(p.dozens) || 0;
            const hasConsumption = dz > 0 || Boolean(p.ceviche);
            if (currentFilter === 'with_order') return dz > 0;
            if (currentFilter === 'with_ceviche') return Boolean(p.ceviche);
            if (currentFilter === 'paid') return hasConsumption && p.paid;
            if (currentFilter === 'pending_pay') return hasConsumption && !p.paid;
            return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="bg-white/90 p-6 hand-border-sm text-center text-cobalt/75">
                <p class="font-bold text-sm">Nenhum participante encontrado neste filtro.</p>
                <button onclick="setFilter('all'); clearSearch();" class="mt-2 text-xs font-extrabold underline text-cobalt cursor-pointer">Mostrar todos</button>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(person => {
        const dz = Number(person.dozens) || 0;
        const costs = getPersonTotalCost(person, metrics);
        const hasConsumption = dz > 0 || person.ceviche;
        const cardBg = !hasConsumption ? 'bg-white/75 opacity-85' : (person.paid ? 'bg-emerald-50/90' : 'bg-white/95');

        return `
        <div class="${cardBg} p-3.5 hand-border-sm transition-all shadow-2xs">
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <h3 class="font-extrabold text-sm sm:text-base text-cobalt truncate">${escapeHtml(person.name)}</h3>
                        ${person.note ? `<span class="text-[10px] font-bold bg-mustardLight text-cobalt px-2 py-0.5 rounded-full">${escapeHtml(person.note)}</span>` : ''}
                    </div>
                    <div class="flex items-center gap-1.5 flex-wrap mt-0.5 text-xs">
                        <span class="font-bold ${dz > 0 ? 'text-cobalt' : 'text-cobalt/55'}">
                            🦪 ${formatDozensDetailed(dz)}
                        </span>
                        <span class="text-cobalt/30">&bull;</span>
                        <span class="font-bold ${person.ceviche ? 'text-cobalt' : 'text-cobalt/45 line-through'}">
                            🐟 Ceviche
                        </span>
                        ${costs.totalCost > 0 ? `
                            <span class="text-cobalt/30">&bull;</span>
                            <span class="font-extrabold text-emerald-700">${formatCurrency(costs.totalCost)}</span>
                        ` : ''}
                    </div>
                </div>

                ${isEditor ? `
                <div class="flex items-center gap-1 shrink-0">
                    <button onclick="openEditPersonModal('${person.id}')" title="Editar participante"
                        class="p-2 rounded-lg text-cobalt/70 hover:text-cobalt hover:bg-cobalt/10 transition cursor-pointer" aria-label="Editar ${escapeHtml(person.name)}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                        </svg>
                    </button>
                    <button onclick="askDeletePerson('${person.id}')" title="Remover"
                        class="p-2 rounded-lg text-red-500/75 hover:text-red-700 hover:bg-red-50 transition cursor-pointer" aria-label="Remover ${escapeHtml(person.name)}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
                ` : (hasConsumption ? `
                <span class="shrink-0 text-[11px] font-extrabold px-2.5 py-1 rounded-full ${person.paid ? 'bg-emerald-600/90 text-white' : 'bg-mustardLight text-cobalt border border-cobalt/35'}">
                    ${person.paid ? '✅ Pago' : '⏳ Pendente'}
                </span>
                ` : '')}
            </div>

            ${isEditor ? `
            <div class="mt-3 pt-2.5 border-t border-cobalt/10 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-1 flex-wrap">
                    <button onclick="changePersonDozens('${person.id}', -0.5)"
                        class="px-2 h-7 rounded-lg bg-paperDark hover:bg-cobalt hover:text-paper font-black text-xs text-cobalt border border-cobalt/30 transition cursor-pointer" title="Menos ½ dúzia">-½ dz</button>
                    
                    <span class="min-w-[3.2rem] text-center font-black text-xs sm:text-sm text-cobalt">${formatDozensBadge(dz)}</span>
                    
                    <button onclick="changePersonDozens('${person.id}', 0.5)"
                        class="px-2 h-7 rounded-lg bg-paperDark hover:bg-cobalt hover:text-paper font-black text-xs text-cobalt border border-cobalt/30 transition cursor-pointer" title="Mais ½ dúzia">+½ dz</button>

                    <span class="mx-0.5 text-cobalt/20">|</span>

                    ${[0, 0.5, 1, 1.5, 2, 3].map(preset => {
                        const label = formatDozensBadge(preset);
                        const isSelected = Math.abs(dz - preset) < 0.01;
                        return `<button onclick="setPersonDozens('${person.id}', ${preset})"
                            class="px-2 py-1 rounded-md text-[11px] font-extrabold transition cursor-pointer ${isSelected ? 'bg-cobalt text-paper' : 'bg-paper hover:bg-mustardLight text-cobalt border border-cobalt/25'}">
                            ${label}
                        </button>`;
                    }).join('')}
                </div>

                <div class="flex items-center gap-1.5 ml-auto sm:ml-0">
                    <button onclick="toggleCeviche('${person.id}')"
                        class="px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 transition cursor-pointer ${person.ceviche ? 'bg-cobaltSoft text-cobalt border border-cobalt/40' : 'bg-paper text-cobalt/45 border border-cobalt/20 hover:text-cobalt'}"
                        title="Alternar participação no rateio do Ceviche">
                        <span>🐟 ${person.ceviche ? 'Ceviche ✓' : 'Sem Ceviche'}</span>
                    </button>

                    ${hasConsumption ? `
                    <button onclick="togglePaid('${person.id}')"
                        class="px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 transition cursor-pointer ${person.paid ? 'bg-emerald-600/90 text-white shadow-2xs' : 'bg-mustardLight text-cobalt border border-cobalt/35 hover:bg-mustard'}">
                        <span>${person.paid ? '✅ Pago' : '⏳ Pendente'}</span>
                    </button>
                    ` : ''}
                </div>
            </div>
            ` : ''}
        </div>
        `;
    }).join('');
}

function setPersonDozens(id, newDozens) {
    if (!canEdit()) return;
    const p = appState.orders.find(item => item.id === id);
    if (!p) return;
    p.dozens = Math.max(0, Math.round((Number(newDozens) || 0) * 2) / 2);
    if (p.dozens === 0 && !p.ceviche) p.paid = false;
    saveState(true);
}

function changePersonDozens(id, delta) {
    if (!canEdit()) return;
    const p = appState.orders.find(item => item.id === id);
    if (!p) return;
    const updated = Math.max(0, Math.round(((Number(p.dozens) || 0) + delta) * 2) / 2);
    p.dozens = updated;
    if (p.dozens === 0 && !p.ceviche) p.paid = false;
    saveState(true);
}

function toggleCeviche(id) {
    if (!canEdit()) return;
    const p = appState.orders.find(item => item.id === id);
    if (!p) return;
    p.ceviche = !p.ceviche;
    if (p.dozens === 0 && !p.ceviche) p.paid = false;
    saveState(true);
    showToast(p.ceviche ? `${p.name} incluído(a) no Ceviche!` : `${p.name} removido(a) do Ceviche`, '🐟');
}

function togglePaid(id) {
    if (!canEdit()) return;
    const p = appState.orders.find(item => item.id === id);
    if (!p) return;
    p.paid = !p.paid;
    saveState(true);
    showToast(p.paid ? `Pagamento de ${p.name} confirmado!` : `Marcado como pendente`, p.paid ? '✅' : '⏳');
}

function openEditPersonModal(id) {
    if (!canEdit()) return;
    const p = appState.orders.find(item => item.id === id);
    if (!p) return;

    document.getElementById('modal-title').textContent = 'Editar Participante';
    document.getElementById('edit-person-id').value = p.id;
    document.getElementById('person-name-input').value = p.name;
    document.getElementById('person-dozens-input').value = p.dozens;
    document.getElementById('person-note-input').value = p.note || '';
    document.getElementById('person-ceviche-input').checked = Boolean(p.ceviche);
    document.getElementById('person-paid-input').checked = Boolean(p.paid);
    updateModalUnitsPreview();

    const modal = document.getElementById('person-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closePersonModal() {
    const modal = document.getElementById('person-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function setModalDozens(dz) {
    document.getElementById('person-dozens-input').value = dz;
    updateModalUnitsPreview();
}

function updateModalUnitsPreview() {
    const dz = Math.max(0, parseFloat(document.getElementById('person-dozens-input').value) || 0);
    const units = Math.round(dz * 12);
    document.getElementById('modal-units-preview').textContent = `= ${formatDozensBadge(dz)} (${units} un)`;
}

function savePersonFromModal(e) {
    e.preventDefault();
    if (!canEdit()) return;
    const id = document.getElementById('edit-person-id').value;
    const name = document.getElementById('person-name-input').value.trim();
    const dozens = Math.max(0, Math.round((parseFloat(document.getElementById('person-dozens-input').value) || 0) * 2) / 2);
    const note = document.getElementById('person-note-input').value.trim();
    const ceviche = document.getElementById('person-ceviche-input').checked;
    const paid = (dozens > 0 || ceviche) ? document.getElementById('person-paid-input').checked : false;

    if (!name || !id) return;

    const p = appState.orders.find(item => item.id === id);
    if (p) {
        p.name = name;
        p.dozens = dozens;
        p.note = note;
        p.ceviche = ceviche;
        p.paid = paid;
        showToast('Dados atualizados!', '✏️');
    }

    closePersonModal();
    saveState(true);
}

function askDeletePerson(id) {
    if (!canEdit()) return;
    const p = appState.orders.find(item => item.id === id);
    if (!p) return;
    openConfirmModal(
        'Remover participante?',
        `Deseja remover "${p.name}" da lista do evento?`,
        () => {
            appState.orders = appState.orders.filter(item => item.id !== id);
            saveState(true);
            showToast('Participante removido.', '🗑️');
        }
    );
}
