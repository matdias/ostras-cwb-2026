const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxJM8DG_61faOXCk4X2ATNMmuax5AKz85tRUO0VYuHqGNCKV8T0YyaDTTkhEgo5tF2m/exec';

const INITIAL_DATA = {
    pricePerDozen: 30,
    cevicheTotalCost: 0,
    orders: [],
    bottles: []
};

const STORAGE_KEY = 'ostras_ceviche_cerveja_v4';
const SCRIPT_URL_STORAGE_KEY = 'ostras_ceviche_sheets_url_v2';
const PIN_STORAGE_KEY = 'ostras_ceviche_event_pin_v2';
const ROLE_STORAGE_KEY = 'ostras_ceviche_event_role_v1';

let appState = JSON.parse(JSON.stringify(INITIAL_DATA));
let currentPin = '';
let currentRole = 'view'; // 'view' ou 'edit'
let currentFilter = 'all';
let confirmCallback = null;
let syncDebounceTimer = null;
let isSyncing = false;

function canEdit() {
    return currentRole === 'edit';
}

function getActiveScriptUrl() {
    const customUrl = (localStorage.getItem(SCRIPT_URL_STORAGE_KEY) || '').trim();
    return customUrl || DEFAULT_SCRIPT_URL;
}

function setSyncIndicator(status, label) {
    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');
    const refreshBtn = document.getElementById('sync-refresh-btn');
    const configBadge = document.getElementById('config-sync-badge');
    const hasUrl = Boolean(getActiveScriptUrl());

    if (!dot || !text) return;
    refreshBtn.classList.toggle('hidden', !hasUrl);

    dot.className = 'w-2.5 h-2.5 rounded-full inline-block';
    if (status === 'synced') {
        dot.classList.add('bg-emerald-500');
        if (configBadge) {
            configBadge.textContent = 'Conectado';
            configBadge.className = 'text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
        }
    } else if (status === 'saving' || status === 'loading') {
        dot.classList.add('bg-amber-400', 'animate-pulse');
    } else if (status === 'error') {
        dot.classList.add('bg-red-400');
        if (configBadge) {
            configBadge.textContent = 'Erro na URL';
            configBadge.className = 'text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-800';
        }
    } else {
        dot.classList.add('bg-slate-400');
    }
    text.textContent = label;
}

function applyPermissionsUI() {
    const isEditor = canEdit();

    document.querySelectorAll('.edit-only').forEach(el => {
        el.classList.toggle('hidden', !isEditor);
    });
    document.querySelectorAll('.view-only').forEach(el => {
        el.classList.toggle('hidden', isEditor);
    });

    const searchWrapper = document.getElementById('search-filter-wrapper');
    if (searchWrapper) {
        searchWrapper.classList.toggle('border-t', isEditor);
        searchWrapper.classList.toggle('pt-2', isEditor);
    }

    const roleText = document.getElementById('role-status-text');
    const upgradeBtn = document.getElementById('upgrade-edit-btn');
    if (roleText && upgradeBtn) {
        if (isEditor) {
            roleText.textContent = '✏️ Modo Edição';
            roleText.className = 'text-[11px] font-extrabold text-emerald-700';
            upgradeBtn.classList.add('hidden');
        } else {
            roleText.textContent = '👁️ Visualização';
            roleText.className = 'text-[11px] font-extrabold text-cobalt';
            upgradeBtn.classList.remove('hidden');
        }
    }
}

// =========================================================
// AUTENTICAÇÃO VIA PIN (VISUALIZAÇÃO OU EDIÇÃO)
// =========================================================
function showAuthScreen(errorMsg = '') {
    document.getElementById('main-app-container').classList.add('hidden');
    const authScreen = document.getElementById('auth-screen');
    authScreen.classList.remove('hidden');

    const errEl = document.getElementById('pin-error-msg');
    if (errorMsg) {
        errEl.textContent = errorMsg;
        errEl.classList.remove('hidden');
    } else {
        errEl.classList.add('hidden');
    }
}

function unlockMainScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app-container').classList.remove('hidden');

    loadLocalCache();
    const urlInput = document.getElementById('sheets-url-input');
    if (urlInput) urlInput.value = getActiveScriptUrl();
    document.getElementById('input-preco-duzia').value = appState.pricePerDozen;
    document.getElementById('input-gasto-ceviche').value = appState.cevicheTotalCost;
    applyPermissionsUI();
    renderAll();
}

async function handlePinSubmit(e) {
    e.preventDefault();
    const pinInput = document.getElementById('pin-input');
    const submitBtn = document.getElementById('pin-submit-btn');
    const errEl = document.getElementById('pin-error-msg');

    const typedPin = pinInput.value.trim();
    if (!typedPin) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verificando senha...';
    errEl.classList.add('hidden');

    currentPin = typedPin;
    const ok = await syncFromSheets(false);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Entrar no Evento';

    if (ok) {
        localStorage.setItem(PIN_STORAGE_KEY, typedPin);
        localStorage.setItem(ROLE_STORAGE_KEY, currentRole);
        pinInput.value = '';
        unlockMainScreen();
        renderAll();
        showToast(
            currentRole === 'edit' ? 'Acesso completo de edição liberado!' : 'Entrou em modo visualização!',
            currentRole === 'edit' ? '✏️' : '👁️'
        );
    } else {
        currentPin = '';
        currentRole = 'view';
        localStorage.removeItem(PIN_STORAGE_KEY);
        localStorage.removeItem(ROLE_STORAGE_KEY);
        errEl.textContent = 'Senha incorreta ou falha ao conectar. Tente novamente.';
        errEl.classList.remove('hidden');
    }
}

function openUpgradeEditModal() {
    document.getElementById('upgrade-pin-input').value = '';
    document.getElementById('upgrade-pin-error').classList.add('hidden');
    const modal = document.getElementById('upgrade-edit-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => document.getElementById('upgrade-pin-input').focus(), 50);
}

function closeUpgradeEditModal() {
    const modal = document.getElementById('upgrade-edit-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function handleUpgradeEditSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('upgrade-pin-input');
    const btn = document.getElementById('upgrade-submit-btn');
    const errEl = document.getElementById('upgrade-pin-error');
    const newPin = input.value.trim();
    if (!newPin) return;

    const previousPin = currentPin;
    const previousRole = currentRole;

    btn.disabled = true;
    btn.textContent = 'Verificando...';
    errEl.classList.add('hidden');

    currentPin = newPin;
    const ok = await syncFromSheets(false);

    btn.disabled = false;
    btn.textContent = 'Desbloquear';

    if (ok && currentRole === 'edit') {
        localStorage.setItem(PIN_STORAGE_KEY, newPin);
        localStorage.setItem(ROLE_STORAGE_KEY, 'edit');
        closeUpgradeEditModal();
        applyPermissionsUI();
        renderAll();
        showToast('Modo edição desbloqueado!', '🔓');
    } else {
        currentPin = previousPin;
        currentRole = previousRole;
        errEl.textContent = 'Senha de edição inválida.';
        errEl.classList.remove('hidden');
    }
}

function logoutPin() {
    currentPin = '';
    currentRole = 'view';
    localStorage.removeItem(PIN_STORAGE_KEY);
    localStorage.removeItem(ROLE_STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    appState = JSON.parse(JSON.stringify(INITIAL_DATA));
    showAuthScreen();
    showToast('Sessão bloqueada.', '🔒');
}

// =========================================================
// SINCRONIZAÇÃO COM GOOGLE SHEETS
// =========================================================
function loadLocalCache() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && Array.isArray(parsed.orders)) {
                appState = {
                    pricePerDozen: Number(parsed.pricePerDozen) >= 0 ? Number(parsed.pricePerDozen) : 30,
                    cevicheTotalCost: Number(parsed.cevicheTotalCost) >= 0 ? Number(parsed.cevicheTotalCost) : 0,
                    orders: parsed.orders.map(o => ({
                        ...o,
                        ceviche: Boolean(o.ceviche)
                    })),
                    bottles: Array.isArray(parsed.bottles) ? parsed.bottles.map(b => ({
                        ...b,
                        country: String(b.country || ''),
                        photoSent: Boolean(b.photoSent)
                    })) : []
                };
                return;
            }
        }
    } catch (e) {
        console.error('Erro ao ler cache local:', e);
    }
    appState = JSON.parse(JSON.stringify(INITIAL_DATA));
}

async function syncFromSheets(showFeedback = true) {
    const scriptUrl = getActiveScriptUrl();
    if (!scriptUrl || !currentPin) return false;
    if (isSyncing) return false;

    isSyncing = true;
    setSyncIndicator('loading', 'Atualizando...');

    try {
        const separator = scriptUrl.includes('?') ? '&' : '?';
        const requestUrl = `${scriptUrl}${separator}pin=${encodeURIComponent(currentPin)}`;

        const res = await fetch(requestUrl, {
            method: 'GET',
            redirect: 'follow',
            cache: 'no-store'
        });
        if (!res.ok) throw new Error('Falha HTTP ' + res.status);
        const data = await res.json();

        if (data && data.status === 'unauthorized') {
            isSyncing = false;
            return false;
        }

        if (data && data.status === 'ok') {
            currentRole = data.role === 'edit' ? 'edit' : 'view';
            localStorage.setItem(ROLE_STORAGE_KEY, currentRole);

            const remotePrice = Number(data.pricePerDozen);
            const remoteCevicheCost = Number(data.cevicheTotalCost);

            appState = {
                pricePerDozen: remotePrice > 0 ? remotePrice : (appState.pricePerDozen || 30),
                cevicheTotalCost: !isNaN(remoteCevicheCost) && remoteCevicheCost >= 0 ? remoteCevicheCost : (appState.cevicheTotalCost || 0),
                orders: Array.isArray(data.orders) ? data.orders.map(o => ({
                    id: String(o.id || ('p_' + Math.random())),
                    name: String(o.name || ''),
                    dozens: Number(o.dozens) || 0,
                    ceviche: Boolean(o.ceviche),
                    paid: Boolean(o.paid),
                    note: String(o.note || '')
                })) : [],
                bottles: Array.isArray(data.bottles) ? data.bottles.map(b => ({
                    id: String(b.id || ('b_' + Math.random())),
                    beer: String(b.beer || ''),
                    brewery: String(b.brewery || ''),
                    country: String(b.country || ''),
                    style: String(b.style || ''),
                    volume: String(b.volume || '750ml'),
                    owner: String(b.owner || ''),
                    photoSent: Boolean(b.photoSent)
                })) : []
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
            document.getElementById('input-preco-duzia').value = appState.pricePerDozen;
            document.getElementById('input-gasto-ceviche').value = appState.cevicheTotalCost;
            applyPermissionsUI();
            renderAll();
            setSyncIndicator('synced', 'Sincronizado com Sheets');

            if (showFeedback) showToast('Dados sincronizados da planilha!', '🔄');
            return true;
        } else {
            throw new Error('Resposta inesperada do Apps Script');
        }
    } catch (err) {
        console.error('Erro ao ler Google Sheets:', err);
        setSyncIndicator('error', 'Erro de rede');
        if (showFeedback) showToast('Erro ao ler planilha.', '⚠️');
        return false;
    } finally {
        isSyncing = false;
    }
}

function saveState(shouldRender = true, syncRemote = true) {
    if (!canEdit()) {
        showToast('Modo visualização: desbloqueie a edição para alterar.', '🔒');
        return;
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
        console.error('Erro ao salvar no localStorage:', e);
    }
    if (shouldRender) renderAll();
    if (syncRemote && getActiveScriptUrl() && currentPin) {
        setSyncIndicator('saving', 'Salvando...');
        clearTimeout(syncDebounceTimer);
        syncDebounceTimer = setTimeout(() => {
            pushToSheetsNow();
        }, 600);
    }
}

async function pushToSheetsNow() {
    const scriptUrl = getActiveScriptUrl();
    if (!scriptUrl || !currentPin || !canEdit()) return;

    setSyncIndicator('saving', 'Salvando...');
    try {
        const payloadWithPin = {
            ...appState,
            pin: currentPin
        };
        await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payloadWithPin)
        });
        setSyncIndicator('synced', 'Sincronizado com Sheets');
    } catch (err) {
        console.error('Erro ao gravar no Google Sheets:', err);
        setSyncIndicator('error', 'Erro ao salvar na planilha');
    }
}

async function saveSheetsUrlFromInput() {
    const val = document.getElementById('sheets-url-input').value.trim();
    if (!val) {
        localStorage.removeItem(SCRIPT_URL_STORAGE_KEY);
        showToast('URL customizada removida.', 'ℹ️');
        return;
    }
    if (!val.startsWith('https://script.google.com/')) {
        showToast('A URL deve começar com https://script.google.com/...', '⚠️');
        return;
    }
    localStorage.setItem(SCRIPT_URL_STORAGE_KEY, val);
    showToast('Conectando à nova URL...', '⏳');
    await syncFromSheets(true);
}

async function resetCustomUrlToDefault() {
    localStorage.removeItem(SCRIPT_URL_STORAGE_KEY);
    document.getElementById('sheets-url-input').value = DEFAULT_SCRIPT_URL;
    showToast('URL padrão restaurada!', '🔄');
    await syncFromSheets(true);
}

// =========================================================
// FORMATAÇÃO & MÉTRICAS COMPARTILHADAS
// =========================================================
function formatCurrency(val) {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDozensNumber(dozens) {
    const num = Math.max(0, Number(dozens) || 0);
    const whole = Math.floor(num);
    const frac = Math.round((num - whole) * 100) / 100;

    if (frac === 0) return `${whole}`;
    if (Math.abs(frac - 0.5) < 0.01) return whole > 0 ? `${whole}½` : '½';
    if (Math.abs(frac - 0.25) < 0.01) return whole > 0 ? `${whole}¼` : '¼';
    if (Math.abs(frac - 0.75) < 0.01) return whole > 0 ? `${whole}¾` : '¾';
    return `${whole}½`;
}

function formatDozensBadge(dozens) {
    return `${formatDozensNumber(dozens)} dz`;
}

function formatDozensDetailed(dozens) {
    const num = Math.max(0, Number(dozens) || 0);
    if (num === 0) return 'Sem ostras';
    const units = Math.round(num * 12);
    const numStr = formatDozensNumber(num);
    const word = num > 1 && (num % 1 === 0) ? 'dúzias' : 'dúzia';
    return `${numStr} ${word} (${units} un)`;
}

function getFinancialMetrics() {
    const priceDz = Number(appState.pricePerDozen) || 0;
    const cevicheTotal = Number(appState.cevicheTotalCost) || 0;
    const totalDozens = appState.orders.reduce((acc, p) => acc + (Number(p.dozens) || 0), 0);
    const totalUnits = Math.round(totalDozens * 12);
    const oystersTotalCost = totalDozens * priceDz;

    const cevicheEatersCount = appState.orders.filter(p => Boolean(p.ceviche)).length;
    const cevichePerPerson = cevicheEatersCount > 0 ? (cevicheTotal / cevicheEatersCount) : 0;
    const grandTotalCost = oystersTotalCost + (cevicheEatersCount > 0 ? cevicheTotal : 0);

    return {
        priceDz,
        cevicheTotal,
        totalDozens,
        totalUnits,
        oystersTotalCost,
        cevicheEatersCount,
        cevichePerPerson,
        grandTotalCost
    };
}

function getPersonTotalCost(person, metrics) {
    const m = metrics || getFinancialMetrics();
    const oystersCost = (Number(person.dozens) || 0) * m.priceDz;
    const cevicheCost = person.ceviche ? m.cevichePerPerson : 0;
    return {
        oystersCost,
        cevicheCost,
        totalCost: oystersCost + cevicheCost
    };
}

// =========================================================
// UTILITÁRIOS DE UI (CLIPBOARD, MODAIS E TOAST)
// =========================================================
function copyToClipboard(text, successMsg) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast(successMsg, '✅');
    } catch (err) {
        showToast('Não foi possível copiar automaticamente.', '⚠️');
    }
    document.body.removeChild(textarea);
}

function openConfirmModal(title, msg, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = msg;
    confirmCallback = onConfirm;
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    confirmCallback = null;
}

function bindModalEvents() {
    const yesBtn = document.getElementById('confirm-yes-btn');
    if (yesBtn) {
        yesBtn.addEventListener('click', () => {
            if (typeof confirmCallback === 'function') confirmCallback();
            closeConfirmModal();
        });
    }
}

let toastTimer = null;
function showToast(message, icon = '✅') {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = message;
    document.getElementById('toast-icon').textContent = icon;
    toast.classList.remove('hidden');
    toast.classList.add('flex', 'toast-enter');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('flex', 'toast-enter');
    }, 3000);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
