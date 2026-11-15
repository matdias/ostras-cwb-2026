function updatePricePerDozen(val) {
    if (!canEdit()) return;
    const num = parseFloat(val);
    appState.pricePerDozen = isNaN(num) || num < 0 ? 0 : num;
    saveState(true);
}

function updateCevicheTotalCost(val) {
    if (!canEdit()) return;
    const num = parseFloat(val);
    appState.cevicheTotalCost = isNaN(num) || num < 0 ? 0 : num;
    saveState(true);
}

function renderFinanceSummary() {
    const list = document.getElementById('finance-summary-list');
    const metrics = getFinancialMetrics();
    const isEditor = canEdit();

    document.getElementById('info-preco-dz').textContent = formatCurrency(metrics.priceDz);
    document.getElementById('info-ceviche-eaters').textContent = metrics.cevicheEatersCount;
    document.getElementById('info-ceviche-per-person').textContent = formatCurrency(metrics.cevichePerPerson);
    document.getElementById('info-ceviche-cota').textContent = formatCurrency(metrics.cevichePerPerson);

    const participantsWithConsumption = appState.orders
        .map(p => ({ person: p, costs: getPersonTotalCost(p, metrics) }))
        .filter(item => (Number(item.person.dozens) || 0) > 0 || Boolean(item.person.ceviche))
        .sort((a, b) => b.costs.totalCost - a.costs.totalCost);

    const totalValue = participantsWithConsumption.reduce((sum, item) => sum + item.costs.totalCost, 0);
    const paidValue = participantsWithConsumption.filter(item => item.person.paid).reduce((sum, item) => sum + item.costs.totalCost, 0);

    document.getElementById('info-arrecadado').textContent = `${formatCurrency(paidValue)} / ${formatCurrency(totalValue)}`;
    const pct = totalValue > 0 ? Math.min(100, Math.round((paidValue / totalValue) * 100)) : 0;
    document.getElementById('payment-progress-bar').style.width = `${pct}%`;

    if (participantsWithConsumption.length === 0) {
        list.innerHTML = `<p class="py-4 text-center text-xs text-cobalt/70">Nenhum participante com consumo ainda.</p>`;
        return;
    }

    list.innerHTML = participantsWithConsumption.map(({ person, costs }) => {
        const dz = Number(person.dozens) || 0;
        const breakdownParts = [];
        if (dz > 0) breakdownParts.push(`🦪 ${formatDozensBadge(dz)} (${formatCurrency(costs.oystersCost)})`);
        if (person.ceviche) breakdownParts.push(`🐟 Ceviche (${formatCurrency(costs.cevicheCost)})`);

        return `
            <div class="py-2.5 flex items-center justify-between gap-2">
                <div class="min-w-0">
                    <p class="font-bold text-sm text-cobalt truncate">${escapeHtml(person.name)}</p>
                    <p class="text-[11px] text-cobalt/75">
                        ${breakdownParts.join(' + ')} = <strong class="text-cobalt text-xs">${formatCurrency(costs.totalCost)}</strong>
                    </p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    ${isEditor ? `
                    <button onclick="togglePaid('${person.id}')"
                        class="text-[11px] font-extrabold px-2.5 py-1 rounded-full cursor-pointer transition ${person.paid ? 'bg-emerald-600/90 text-white' : 'bg-mustardLight text-cobalt border border-cobalt/35'}">
                        ${person.paid ? '✅ Pago' : '⏳ Pendente'}
                    </button>
                    <button onclick="copyIndividualCharge('${person.id}')"
                        class="text-xs font-bold bg-paperDark hover:bg-mustardLight text-cobalt px-2.5 py-1.5 rounded-lg border border-cobalt/30 cursor-pointer" title="Copiar mensagem de cobrança">
                        📋 Cobrar
                    </button>
                    ` : `
                    <span class="text-[11px] font-extrabold px-2.5 py-1 rounded-full ${person.paid ? 'bg-emerald-600/90 text-white' : 'bg-mustardLight text-cobalt border border-cobalt/35'}">
                        ${person.paid ? '✅ Pago' : '⏳ Pendente'}
                    </span>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

function copyIndividualCharge(id) {
    const p = appState.orders.find(item => item.id === id);
    if (!p) return;
    const metrics = getFinancialMetrics();
    const costs = getPersonTotalCost(p, metrics);
    const firstName = p.name.split(' ')[0];

    const itemsDesc = [];
    if (Number(p.dozens) > 0) {
        itemsDesc.push(`• Ostras (${formatDozensDetailed(p.dozens)}): *${formatCurrency(costs.oystersCost)}*`);
    }
    if (p.ceviche) {
        itemsDesc.push(`• Ceviche (rateio ${metrics.cevicheEatersCount} pessoas): *${formatCurrency(costs.cevicheCost)}*`);
    }

    const text = `Fala ${firstName}! Segue seu fechamento do evento *Ostras, Ceviche e Cerveja boa* (19/11):\n${itemsDesc.join('\n')}\n💰 *Total: ${formatCurrency(costs.totalCost)}*\nValeu! 🦪🐟🍻`;
    copyToClipboard(text, `Cobrança de ${firstName} copiada!`);
}

function copyEventInvite() {
    const text = `🦪🐟🍻 *OSTRAS, CEVICHE E CERVEJA BOA*\n🍾 *BOTTLE SHARE • 1500ML*\n\n📅 Data: 19/11 às 19h00\n📍 Local: R. Camões, 476 - Hugo Lange\n\nBora confirmar as ostras, o ceviche e a garrafa do bottle share!`;
    copyToClipboard(text, 'Convite copiado para o WhatsApp!');
}

function copyWhatsAppSummary() {
    const metrics = getFinancialMetrics();

    const activeParticipants = appState.orders
        .map(p => ({ person: p, costs: getPersonTotalCost(p, metrics) }))
        .filter(item => Number(item.person.dozens) > 0 || item.person.ceviche)
        .sort((a, b) => a.person.name.localeCompare(b.person.name, 'pt-BR', { sensitivity: 'base' }));

    let lines = [
        `🦪🐟 *OSTRAS, CEVICHE E CERVEJA BOA - 19/11* 🍻`,
        `📍 R. Camões, 476 - Hugo Lange (19h00)`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `🦪 *Ostras:* ${formatDozensBadge(metrics.totalDozens)} (${metrics.totalUnits} un) • ${formatCurrency(metrics.priceDz)}/dz`,
        `🐟 *Ceviche:* ${metrics.cevicheEatersCount} pessoas (${formatCurrency(metrics.cevichePerPerson)}/pessoa)`,
        `💰 *Total Geral:* ${formatCurrency(metrics.grandTotalCost)}`,
        ``
    ];

    activeParticipants.forEach(({ person, costs }) => {
        const statusIcon = person.paid ? '✅' : '⏳';
        const parts = [];
        if (Number(person.dozens) > 0) parts.push(`${formatDozensBadge(person.dozens)} ostras`);
        if (person.ceviche) parts.push(`ceviche`);
        lines.push(`${statusIcon} *${person.name}*: ${parts.join(' + ')} = *${formatCurrency(costs.totalCost)}*`);
    });

    if (appState.bottles.length > 0) {
        lines.push(``, `🍾 *BOTTLE SHARE:*`);
        appState.bottles.forEach(b => {
            const breweryPart = b.brewery ? ` (${b.brewery})` : '';
            const photoIcon = b.photoSent ? '📸' : '⏳';
            lines.push(`${photoIcon} ${b.volume} - *${b.beer}*${breweryPart} — ${b.owner}`);
        });
    }

    copyToClipboard(lines.join('\n'), 'Resumo WhatsApp copiado!');
}
