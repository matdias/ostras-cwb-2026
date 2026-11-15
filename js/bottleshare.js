function populateBottleOwnerSelect(selectedOwner = '') {
    const select = document.getElementById('bottle-owner-select');
    const customWrapper = document.getElementById('bottle-custom-owner-wrapper');
    const customInput = document.getElementById('bottle-custom-owner-input');

    const sortedParticipants = [...appState.orders]
        .map(p => p.name.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

    const uniqueNames = [...new Set(sortedParticipants)];

    let optionsHtml = `<option value="">Selecione quem vai levar...</option>`;
    uniqueNames.forEach(name => {
        optionsHtml += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
    });
    optionsHtml += `<option value="__CUSTOM__">+ Outro responsável (digitar nome)</option>`;

    select.innerHTML = optionsHtml;

    if (selectedOwner) {
        if (uniqueNames.includes(selectedOwner)) {
            select.value = selectedOwner;
            customWrapper.classList.add('hidden');
            customInput.required = false;
            customInput.value = '';
        } else {
            select.value = '__CUSTOM__';
            customWrapper.classList.remove('hidden');
            customInput.required = true;
            customInput.value = selectedOwner;
        }
    } else {
        select.value = '';
        customWrapper.classList.add('hidden');
        customInput.required = false;
        customInput.value = '';
    }
}

function handleBottleOwnerSelectChange() {
    const select = document.getElementById('bottle-owner-select');
    const customWrapper = document.getElementById('bottle-custom-owner-wrapper');
    const customInput = document.getElementById('bottle-custom-owner-input');

    if (select.value === '__CUSTOM__') {
        customWrapper.classList.remove('hidden');
        customInput.required = true;
        setTimeout(() => customInput.focus(), 50);
    } else {
        customWrapper.classList.add('hidden');
        customInput.required = false;
        customInput.value = '';
    }
}

function openAddBottleModal() {
    if (!canEdit()) return;
    document.getElementById('bottle-modal-title').textContent = 'Cadastrar Garrafa';
    document.getElementById('edit-bottle-id').value = '';
    document.getElementById('bottle-beer-input').value = '';
    document.getElementById('bottle-brewery-input').value = '';
    document.getElementById('bottle-style-input').value = '';
    document.getElementById('bottle-volume-input').value = '1500ml';
    document.getElementById('bottle-photo-input').checked = false;
    populateBottleOwnerSelect('');

    const modal = document.getElementById('bottle-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => document.getElementById('bottle-beer-input').focus(), 50);
}

function openEditBottleModal(id) {
    if (!canEdit()) return;
    const b = appState.bottles.find(item => item.id === id);
    if (!b) return;

    document.getElementById('bottle-modal-title').textContent = 'Editar Garrafa';
    document.getElementById('edit-bottle-id').value = b.id;
    document.getElementById('bottle-beer-input').value = b.beer;
    document.getElementById('bottle-brewery-input').value = b.brewery || '';
    document.getElementById('bottle-style-input').value = b.style || '';
    document.getElementById('bottle-volume-input').value = b.volume || '1500ml';
    document.getElementById('bottle-photo-input').checked = Boolean(b.photoSent);
    populateBottleOwnerSelect(b.owner || '');

    const modal = document.getElementById('bottle-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeBottleModal() {
    const modal = document.getElementById('bottle-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function saveBottleFromModal(e) {
    e.preventDefault();
    if (!canEdit()) return;
    const id = document.getElementById('edit-bottle-id').value;
    const beer = document.getElementById('bottle-beer-input').value.trim();
    const brewery = document.getElementById('bottle-brewery-input').value.trim();
    const style = document.getElementById('bottle-style-input').value.trim();
    const volume = document.getElementById('bottle-volume-input').value;

    const ownerSelectVal = document.getElementById('bottle-owner-select').value;
    const owner = ownerSelectVal === '__CUSTOM__'
        ? document.getElementById('bottle-custom-owner-input').value.trim()
        : ownerSelectVal.trim();

    const photoSent = document.getElementById('bottle-photo-input').checked;

    if (!beer || !owner) return;

    if (id) {
        const b = appState.bottles.find(item => item.id === id);
        if (b) {
            b.beer = beer;
            b.brewery = brewery;
            b.style = style;
            b.volume = volume;
            b.owner = owner;
            b.photoSent = photoSent;
        }
        showToast('Garrafa atualizada!', '✏️');
    } else {
        appState.bottles.push({
            id: 'b_' + Date.now(),
            beer,
            brewery,
            style,
            volume,
            owner,
            photoSent
        });
        showToast('Garrafa adicionada ao Bottle Share!', '🍾');
    }

    closeBottleModal();
    saveState(true);
}

function toggleBottlePhoto(id) {
    if (!canEdit()) return;
    const b = appState.bottles.find(item => item.id === id);
    if (!b) return;
    b.photoSent = !b.photoSent;
    saveState(true);
    showToast(b.photoSent ? `Foto de "${b.beer}" marcada como enviada!` : `Foto marcada como pendente`, b.photoSent ? '📸' : '⏳');
}

function askDeleteBottle(id) {
    if (!canEdit()) return;
    const b = appState.bottles.find(item => item.id === id);
    if (!b) return;
    openConfirmModal(
        'Remover garrafa?',
        `Deseja remover "${b.beer}" do line-up?`,
        () => {
            appState.bottles = appState.bottles.filter(item => item.id !== id);
            saveState(true);
            showToast('Garrafa removida.', '🗑️');
        }
    );
}

function renderBottlesList() {
    const container = document.getElementById('bottles-list');
    const summaryBadge = document.getElementById('bottles-photos-summary');
    const totalBottles = appState.bottles.length;
    const photosSentCount = appState.bottles.filter(b => Boolean(b.photoSent)).length;
    const isEditor = canEdit();

    if (summaryBadge) {
        summaryBadge.textContent = `${photosSentCount}/${totalBottles} fotos enviadas`;
    }

    if (totalBottles === 0) {
        container.innerHTML = `
            <div class="bg-white/90 p-6 hand-border-sm text-center text-cobalt/75">
                <p class="font-bold text-sm">Nenhuma garrafa cadastrada ainda.</p>
                ${isEditor ? `<p class="text-xs mt-1">Toque em "+ Cadastrar Garrafa" para montar o line-up do Bottle Share!</p>` : ''}
            </div>
        `;
        return;
    }

    container.innerHTML = appState.bottles.map(b => `
        <div class="${b.photoSent ? 'bg-emerald-50/85' : 'bg-white/95'} p-3.5 hand-border-sm transition-all">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-[11px] font-black uppercase bg-mustard text-cobaltDark px-2 py-0.5 rounded-md">
                            ${escapeHtml(b.volume)}
                        </span>
                        <h4 class="font-extrabold text-sm sm:text-base text-cobalt truncate">${escapeHtml(b.beer)}</h4>
                    </div>
                    <p class="text-xs text-cobalt/80 mt-1">
                        ${b.brewery ? `Cervejaria: <strong>${escapeHtml(b.brewery)}</strong>${b.style ? ' &bull; ' : ''}` : ''}
                        ${b.style ? `Estilo: <strong>${escapeHtml(b.style)}</strong>` : ''}
                    </p>
                </div>

                ${isEditor ? `
                <div class="flex items-center gap-1 shrink-0">
                    <button onclick="openEditBottleModal('${b.id}')" title="Editar garrafa"
                        class="p-2 rounded-lg text-cobalt/70 hover:text-cobalt hover:bg-cobalt/10 transition cursor-pointer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                        </svg>
                    </button>
                    <button onclick="askDeleteBottle('${b.id}')" title="Excluir garrafa"
                        class="p-2 rounded-lg text-red-500/75 hover:text-red-700 hover:bg-red-50 transition cursor-pointer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
                ` : ''}
            </div>

            <div class="mt-2.5 pt-2 border-t border-cobalt/10 flex flex-wrap items-center justify-between gap-2">
                <span class="text-xs font-bold text-cobalt">
                    🙋 Responsável: <span class="bg-paperDark px-2 py-0.5 rounded-md">${escapeHtml(b.owner)}</span>
                </span>

                ${isEditor ? `
                <label class="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer select-none transition ${b.photoSent ? 'bg-emerald-600/90 text-white shadow-2xs' : 'bg-mustardLight/80 text-cobalt border border-cobalt/30 hover:bg-mustard'}">
                    <input type="checkbox" ${b.photoSent ? 'checked' : ''} onchange="toggleBottlePhoto('${b.id}')" class="w-4 h-4 accent-cobalt rounded cursor-pointer">
                    <span>${b.photoSent ? '📸 Foto enviada' : '📷 Foto pendente'}</span>
                </label>
                ` : `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold ${b.photoSent ? 'bg-emerald-600/90 text-white' : 'bg-mustardLight/80 text-cobalt border border-cobalt/30'}">
                    ${b.photoSent ? '📸 Foto enviada' : '📷 Foto pendente'}
                </span>
                `}
            </div>
        </div>
    `).join('');
}
