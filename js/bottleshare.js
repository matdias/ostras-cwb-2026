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

function openAddBottleModal(preselectedOwner = '') {
    if (!canEdit()) return;
    document.getElementById('bottle-modal-title').textContent = 'Cadastrar Garrafa';
    document.getElementById('edit-bottle-id').value = '';
    document.getElementById('bottle-beer-input').value = '';
    document.getElementById('bottle-brewery-input').value = '';
    document.getElementById('bottle-country-select').value = '';
    document.getElementById('bottle-style-input').value = '';
    document.getElementById('bottle-volume-input').value = '750ml';
    document.getElementById('bottle-photo-input').checked = false;
    populateBottleOwnerSelect(preselectedOwner);

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
    document.getElementById('bottle-country-select').value = b.country || '';
    document.getElementById('bottle-style-input').value = b.style || '';
    document.getElementById('bottle-volume-input').value = b.volume || '750ml';
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
    const country = document.getElementById('bottle-country-select').value.trim();
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
            b.country = country;
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
            country,
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

function parseBottleVolumeMl(volumeStr) {
    const match = String(volumeStr || '').match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

function renderBottleCardHtml(b, isEditor) {
    const flagPart = b.country ? `<span class="text-base leading-none shrink-0">${escapeHtml(b.country)}</span>` : '';

    const photoBadgeHtml = b.photoSent
        ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
               <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
               <span>Foto enviada</span>
           </span>`
        : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
               <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
               <span>Foto pendente</span>
           </span>`;

    return `
        <div class="bg-white/95 p-3.5 hand-border-sm transition-all space-y-2">
            <!-- Linha Superior: Volume + Controles -->
            <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-black uppercase bg-mustard text-cobaltDark px-2.5 py-0.5 rounded-md shrink-0">
                    ${escapeHtml(b.volume)}
                </span>

                <div class="flex items-center gap-1.5 shrink-0">
                    ${isEditor ? `
                    <button type="button" onclick="toggleBottlePhoto('${b.id}')" title="Clique para alternar status da foto"
                        class="cursor-pointer transition hover:opacity-80 active:scale-[0.98]">
                        ${photoBadgeHtml}
                    </button>
                    <button onclick="openEditBottleModal('${b.id}')" title="Editar garrafa"
                        class="p-1.5 rounded-lg text-cobalt/70 hover:text-cobalt hover:bg-cobalt/10 transition cursor-pointer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                        </svg>
                    </button>
                    <button onclick="askDeleteBottle('${b.id}')" title="Excluir garrafa"
                        class="p-1.5 rounded-lg text-red-500/75 hover:text-red-700 hover:bg-red-50 transition cursor-pointer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                    ` : photoBadgeHtml}
                </div>
            </div>

            <!-- Corpo em Largura Total: Cerveja + Bandeira, Cervejaria e Estilo -->
            <div class="w-full space-y-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                    ${flagPart}
                    <h4 class="font-extrabold text-sm sm:text-base text-cobalt leading-snug">${escapeHtml(b.beer)}</h4>
                </div>

                ${b.brewery ? `
                <p class="text-xs text-cobalt/85 leading-relaxed">
                    Cervejaria: <strong>${escapeHtml(b.brewery)}</strong>
                </p>
                ` : ''}

                ${b.style ? `
                <p class="text-xs text-cobalt/75 leading-relaxed">
                    Estilo: <strong>${escapeHtml(b.style)}</strong>
                </p>
                ` : ''}
            </div>
        </div>
    `;
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

    const allOwnerNamesSet = new Set();
    appState.orders.forEach(p => {
        const cleanName = (p.name || '').trim();
        if (cleanName) allOwnerNamesSet.add(cleanName);
    });
    appState.bottles.forEach(b => {
        const cleanOwner = (b.owner || '').trim();
        if (cleanOwner) allOwnerNamesSet.add(cleanOwner);
    });

    const sortedOwners = [...allOwnerNamesSet].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
    );

    if (sortedOwners.length === 0) {
        container.innerHTML = `
            <div class="bg-white/95 p-6 hand-border-sm text-center text-cobalt/75">
                <p class="font-bold text-sm">Nenhum participante ou garrafa cadastrada ainda.</p>
                ${isEditor ? `<p class="text-xs mt-1">Cadastre os participantes na aba Ostras ou toque em "+ Cadastrar Garrafa".</p>` : ''}
            </div>
        `;
        return;
    }

    container.innerHTML = sortedOwners.map(ownerName => {
        const personBottles = appState.bottles.filter(
            b => (b.owner || '').trim().toLowerCase() === ownerName.toLowerCase()
        );
        const totalMl = personBottles.reduce((sum, b) => sum + parseBottleVolumeMl(b.volume), 0);
        const hasMinimumVolume = totalMl >= 1500;
        const safeOwnerAttr = escapeHtml(ownerName).replace(/'/g, "\\'");

        const volumeBadgeHtml = personBottles.length > 0
            ? `<span class="text-[11px] font-extrabold px-2 py-0.5 rounded-full ${hasMinimumVolume ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}">
                ${totalMl}ml / 1500ml ${hasMinimumVolume ? '✓' : ''}
               </span>`
            : `<span class="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-paperDark text-cobalt/65 border border-cobalt/20">
                0ml / 1500ml
               </span>`;

        return `
            <div class="bg-white/95 p-3.5 hand-border-sm space-y-2.5">
                <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-cobalt/15">
                    <div class="flex items-center gap-2 flex-wrap min-w-0">
                        <h3 class="font-extrabold text-sm sm:text-base text-cobalt truncate">
                            🙋 ${escapeHtml(ownerName)}
                        </h3>
                        ${volumeBadgeHtml}
                    </div>

                    ${isEditor ? `
                    <button onclick="openAddBottleModal('${safeOwnerAttr}')"
                        class="text-[11px] font-extrabold text-cobalt bg-mustardLight hover:bg-mustard px-2.5 py-1 rounded-lg border border-cobalt/30 transition cursor-pointer shrink-0">
                        + Garrafa
                    </button>
                    ` : ''}
                </div>

                ${personBottles.length > 0 ? `
                    <div class="space-y-2">
                        ${personBottles.map(b => renderBottleCardHtml(b, isEditor)).join('')}
                    </div>
                ` : `
                    <div class="bg-paper/90 border border-dashed border-cobalt/35 rounded-xl py-3 px-4 text-center">
                        <p class="text-xs sm:text-sm font-bold text-cobalt/70">
                            Nada por aqui ainda... estamos de olho 👀
                        </p>
                    </div>
                `}
            </div>
        `;
    }).join('');
}
