/**
 * ECC – Encontro de Casais com Cristo
 * Application Logic - Versão Completa
 */

'use strict';

/* ===================================================
   CONSTANTS
   =================================================== */

// Equipes de trabalho no retiro (used for service history, coordination, and interest)
const PASTAS = [
  'Coordenador Geral',
  'Sala',
  'Visitação',
  'Café e Mini Mercado',
  'Compras',
  'Cozinha',
  'Ordem e Limpeza',
  'Secretaria',
  'Liturgia e Vigília',
  'Círculos',
];

// Pastas da equipe dirigente (used only for "Pasta como Dirigente")
const PASTAS_DIRIGENTE = [
  'Pós Encontro',
  'Montagem',
  'Fichas',
  'Palestras',
  'Finanças',
];

const STORAGE_KEY  = 'ecc_casais';
const SENHA_KEY    = 'ecc_dir_senha';
const SENHA_PADRAO = 'ecc2024';

/* ===================================================
   STATE
   =================================================== */

let casais = [];
let filtroAtivo = null;

/* ===================================================
   STORAGE HELPERS
   =================================================== */

function salvar() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(casais));
  } catch (err) {
    console.error('Erro ao salvar no localStorage', err);
  }
}

function carregar() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    casais = raw ? JSON.parse(raw) : [];
  } catch (err) {
    casais = [];
  }
}

function getSenha() {
  return localStorage.getItem(SENHA_KEY) || SENHA_PADRAO;
}

function setSenha(nova) {
  localStorage.setItem(SENHA_KEY, nova);
}

/* ===================================================
   DOM HELPERS
   =================================================== */

const $ = (id) => document.getElementById(id);

/* ===================================================
   SESSION AUTH HELPERS
   =================================================== */

function isEccLogado() {
  return !!sessionStorage.getItem('ecc_casal_nome');
}

function isDirLogado() {
  return sessionStorage.getItem('ecc_dir_auth') === '1';
}

function setEccLogado(nome) {
  sessionStorage.setItem('ecc_casal_nome', nome);
}

function setDirLogado() {
  sessionStorage.setItem('ecc_dir_auth', '1');
}

function logoutDir() {
  sessionStorage.removeItem('ecc_dir_auth');
}

/* ===================================================
   ECC LOGIN  (index.html only)
   =================================================== */

const overlayEccLogin = $('overlay-ecc-login');
const formEccLogin    = $('form-ecc-login');
const eccLoginNome    = $('ecc-login-nome');
const eccWelcomeMsg   = $('ecc-welcome-msg');
const eccNomeLogado   = $('ecc-nome-logado');

function mostrarEccLogin() {
  if (overlayEccLogin) {
    overlayEccLogin.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function ocultarEccLogin() {
  if (overlayEccLogin) {
    overlayEccLogin.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }
}

if (formEccLogin) {
  formEccLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = eccLoginNome.value.trim();
    if (!nome) return;

    if (eccWelcomeMsg) {
      eccWelcomeMsg.textContent = `Bem-vindo(a), ${nome}! Que Deus abençoe o seu casal. ✝`;
      eccWelcomeMsg.removeAttribute('hidden');
    }
    formEccLogin.hidden = true;

    setEccLogado(nome);
    if (eccNomeLogado) eccNomeLogado.textContent = `Olá, ${nome}!`;

    setTimeout(() => {
      ocultarEccLogin();
      if (eccWelcomeMsg) eccWelcomeMsg.setAttribute('hidden', '');
      formEccLogin.hidden = false;
    }, 2200);
  });
}

/* ===================================================
   DIRIGENTE LOGIN  (admin.html only)
   =================================================== */

const overlayDirLogin = $('overlay-dir-login');
const formDirLogin    = $('form-dir-login');
const dirLoginSenha   = $('dir-login-senha');
const dirLoginErro    = $('dir-login-erro');
const btnVoltarEcc    = $('btn-voltar-ecc');
const btnLogoutDir    = $('btn-logout-dir');
const tabDirigente    = $('tab-dirigente');

function mostrarDirLogin() {
  if (overlayDirLogin) {
    overlayDirLogin.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    if (dirLoginErro) dirLoginErro.setAttribute('hidden', '');
    if (dirLoginSenha) { dirLoginSenha.value = ''; dirLoginSenha.focus(); }
  }
}

function ocultarDirLogin() {
  if (overlayDirLogin) {
    overlayDirLogin.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }
}

function mostrarPainelDirigente() {
  if (tabDirigente) {
    tabDirigente.removeAttribute('hidden');
  }
}

if (formDirLogin) {
  formDirLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    const senha = dirLoginSenha ? dirLoginSenha.value : '';
    if (senha === getSenha()) {
      setDirLogado();
      ocultarDirLogin();
      mostrarPainelDirigente();
    } else {
      if (dirLoginErro) dirLoginErro.removeAttribute('hidden');
      if (dirLoginSenha) { dirLoginSenha.value = ''; dirLoginSenha.focus(); }
    }
  });
}

if (btnLogoutDir) {
  btnLogoutDir.addEventListener('click', () => {
    logoutDir();
    window.location.href = 'index.html';
  });
}

/* ===================================================
   MUDAR SENHA  (admin.html only)
   =================================================== */

const formMudarSenha  = $('form-mudar-senha');
const senhaAtualInput = $('senha-atual');
const senhaNoveInput  = $('senha-nova');
const mudarSenhaMsg   = $('mudar-senha-msg');

if (formMudarSenha) {
  formMudarSenha.addEventListener('submit', (e) => {
    e.preventDefault();
    const atual = senhaAtualInput ? senhaAtualInput.value : '';
    const nova  = senhaNoveInput  ? senhaNoveInput.value.trim() : '';

    if (mudarSenhaMsg) {
      mudarSenhaMsg.className = 'mudar-senha-msg';
      mudarSenhaMsg.removeAttribute('hidden');
    }

    if (atual !== getSenha()) {
      if (mudarSenhaMsg) { mudarSenhaMsg.textContent = 'Senha atual incorreta.'; mudarSenhaMsg.classList.add('msg-erro'); }
      return;
    }
    if (!nova || nova.length < 8) {
      if (mudarSenhaMsg) { mudarSenhaMsg.textContent = 'A nova senha deve ter pelo menos 8 caracteres.'; mudarSenhaMsg.classList.add('msg-erro'); }
      return;
    }

    setSenha(nova);
    if (mudarSenhaMsg) { mudarSenhaMsg.textContent = 'Senha alterada com sucesso!'; mudarSenhaMsg.classList.add('msg-ok'); }
    if (senhaAtualInput) senhaAtualInput.value = '';
    if (senhaNoveInput)  senhaNoveInput.value  = '';

    setTimeout(() => {
      if (mudarSenhaMsg) mudarSenhaMsg.setAttribute('hidden', '');
    }, 3000);
  });
}

/* ===================================================
   POPULATE CHECKBOX GROUPS
   =================================================== */

function buildCheckboxGroup(containerId, pastas, prefix, singleSelect = false) {
  const el = $(containerId);
  if (!el) return;
  el.innerHTML = '';
  pastas.forEach((pasta) => {
    const id    = `${prefix}-${pasta.replace(/\s+/g, '-').toLowerCase()}`;
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type  = singleSelect ? 'radio' : 'checkbox';
    if (singleSelect) input.name = prefix;
    input.value = pasta;
    input.id    = id;
    label.htmlFor = id;
    label.appendChild(input);
    label.appendChild(document.createTextNode(' ' + pasta));
    el.appendChild(label);
  });
}

function syncCheckboxGridClasses(containerId) {
  const el = $(containerId);
  if (!el) return;
  el.querySelectorAll('input').forEach((input) => {
    const label = input.closest('label');
    if (label) label.classList.toggle('is-checked', input.checked);
  });
}

// Build pasta filter checkboxes (admin.html)
buildCheckboxGroup('filtro-pastas', PASTAS, 'fpasta');

// Populate sugestao-pasta select (admin.html)
const sugestaoPastaSelect = $('sugestao-pasta');
if (sugestaoPastaSelect) {
  PASTAS.forEach((pasta) => {
    const opt = document.createElement('option');
    opt.value = pasta;
    opt.textContent = pasta;
    sugestaoPastaSelect.appendChild(opt);
  });
}

/* ===================================================
   MODAL HELPERS
   =================================================== */

function abrirModal(modal) {
  if (!modal) return;
  modal.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
}

function fecharModal(modal) {
  if (!modal) return;
  modal.setAttribute('hidden', '');
  document.body.style.overflow = '';
}

const modalCadastro  = $('modal-cadastro');
const modalVisualizar = $('modal-visualizar');
const modalOracoes   = $('modal-oracoes');

[modalCadastro, modalVisualizar, modalOracoes].forEach((m) => {
  if (m) {
    m.addEventListener('click', (e) => {
      if (e.target === m) fecharModal(m);
    });
  }
});

const btnFecharModal  = $('btn-fechar-modal');
const btnCancelar     = $('btn-cancelar');
const btnFecharView   = $('btn-fechar-view');
const btnFecharView2  = $('btn-fechar-view2');
const btnFecharOracoes  = $('btn-fechar-oracoes');
const btnFecharOracoes2 = $('btn-fechar-oracoes2');
const btnOracoes      = $('btn-oracoes');

if (btnFecharModal)    btnFecharModal.addEventListener('click', () => fecharModal(modalCadastro));
if (btnCancelar)       btnCancelar.addEventListener('click',    () => fecharModal(modalCadastro));
if (btnFecharView)     btnFecharView.addEventListener('click',  () => fecharModal(modalVisualizar));
if (btnFecharView2)    btnFecharView2.addEventListener('click', () => fecharModal(modalVisualizar));
if (btnFecharOracoes)  btnFecharOracoes.addEventListener('click',  () => fecharModal(modalOracoes));
if (btnFecharOracoes2) btnFecharOracoes2.addEventListener('click', () => fecharModal(modalOracoes));
if (btnOracoes)        btnOracoes.addEventListener('click', () => abrirModal(modalOracoes));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (modalCadastro   && !modalCadastro.hidden)   fecharModal(modalCadastro);
    if (modalVisualizar && !modalVisualizar.hidden)  fecharModal(modalVisualizar);
    if (modalOracoes    && !modalOracoes.hidden)     fecharModal(modalOracoes);
  }
});

/* ===================================================
   PHOTO HELPERS
   =================================================== */

function lerFoto(inputEl, previewEl) {
  return new Promise((resolve) => {
    const file = inputEl && inputEl.files && inputEl.files[0];
    if (!file) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      mostrarPreview(previewEl, dataUrl);
      resolve(dataUrl);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function mostrarPreview(previewEl, dataUrl) {
  if (!previewEl) return;
  previewEl.innerHTML = '';
  if (!dataUrl) return;
  const img = document.createElement('img');
  img.className = 'foto-avatar foto-avatar-lg';
  img.alt = 'Foto';
  img.setAttribute('src', dataUrl);
  previewEl.appendChild(img);
}

/* ===================================================
   CONDITIONAL SECTIONS IN FORM
   =================================================== */

function configurarSecoesCond() {
  document.querySelectorAll('input[name="serviu"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const jaServiu = radio.value === 'sim';
      const secJaServiu    = $('secao-ja-serviu');
      const secNuncaServiu = $('secao-nunca-serviu');
      if (secJaServiu)    secJaServiu.hidden    = !jaServiu;
      if (secNuncaServiu) secNuncaServiu.hidden = jaServiu;
      if (!jaServiu) {
        document.querySelectorAll('input[name="foi-coord"]').forEach((r) => { r.checked = false; });
        document.querySelectorAll('input[name="foi-dirigente"]').forEach((r) => { r.checked = false; });
        const secCoord = $('secao-coord');
        const secDir   = $('secao-dirigente');
        if (secCoord) secCoord.hidden     = true;
        if (secDir)   secDir.hidden       = true;
      }
    });
  });

  document.querySelectorAll('input[name="foi-coord"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const secCoord = $('secao-coord');
      if (secCoord) secCoord.hidden = radio.value !== 'sim';
    });
  });

  document.querySelectorAll('input[name="foi-dirigente"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const secDir = $('secao-dirigente');
      if (secDir) secDir.hidden = radio.value !== 'sim';
    });
  });
}

/* ===================================================
   FORM RESET & POPULATE
   =================================================== */

function resetForm() {
  const formCasal = $('form-casal');
  if (formCasal) formCasal.reset();
  const casalId = $('casal-id');
  if (casalId) casalId.value = '';

  const secJaServiu    = $('secao-ja-serviu');
  const secNuncaServiu = $('secao-nunca-serviu');
  const secCoord       = $('secao-coord');
  const secDir         = $('secao-dirigente');
  if (secJaServiu)    secJaServiu.hidden    = true;
  if (secNuncaServiu) secNuncaServiu.hidden = true;
  if (secCoord)       secCoord.hidden       = true;
  if (secDir)         secDir.hidden         = true;

  const prevEsposo = $('preview-esposo');
  const prevEsposa = $('preview-esposa');
  if (prevEsposo) prevEsposo.innerHTML = '';
  if (prevEsposa) prevEsposa.innerHTML = '';

  buildCheckboxGroup('pastas-servidas',    PASTAS,           'pserv');
  buildCheckboxGroup('pastas-coordenadas', PASTAS,           'pcoord');
  buildCheckboxGroup('pasta-dirigente',    PASTAS_DIRIGENTE, 'pdir', true);
  buildCheckboxGroup('pastas-gostaria',    PASTAS,           'pgost');

  configurarSecoesCond();
  const tituloEl = $('modal-titulo');
  if (tituloEl) tituloEl.textContent = 'Cadastro de Casal';
}

function popularForm(casal) {
  const tituloEl = $('modal-titulo');
  if (tituloEl) tituloEl.textContent = 'Editar Casal';
  const casalId = $('casal-id');
  if (casalId) casalId.value = casal.id;

  const setVal = (id, val) => { const el = $(id); if (el) el.value = val || ''; };
  setVal('campo-nome-esposo', casal.nomeEsposo);
  setVal('campo-nome-esposa', casal.nomeEsposa);
  setVal('campo-tel-esposo',  casal.telEsposo);
  setVal('campo-tel-esposa',  casal.telEsposa);
  setVal('campo-endereco',    casal.endereco);
  setVal('campo-ano-retiro',  casal.anoRetiro);

  if (casal.fotoEsposo) mostrarPreview($('preview-esposo'), casal.fotoEsposo);
  if (casal.fotoEsposa) mostrarPreview($('preview-esposa'), casal.fotoEsposa);

  if (casal.jaServiu !== null && casal.jaServiu !== undefined) {
    const val   = casal.jaServiu ? 'sim' : 'nao';
    const radio = document.querySelector(`input[name="serviu"][value="${val}"]`);
    if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
  }

  if (casal.jaServiu) {
    (casal.pastasServidas || []).forEach((pasta) => {
      const cb = document.querySelector(`#pastas-servidas input[value="${pasta}"]`);
      if (cb) cb.checked = true;
    });

    if (casal.jaFoiCoordenador !== null && casal.jaFoiCoordenador !== undefined) {
      const val   = casal.jaFoiCoordenador ? 'sim' : 'nao';
      const radio = document.querySelector(`input[name="foi-coord"][value="${val}"]`);
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
    }
    if (casal.jaFoiCoordenador) {
      (casal.pastasCoordenadasDe || []).forEach((pasta) => {
        const cb = document.querySelector(`#pastas-coordenadas input[value="${pasta}"]`);
        if (cb) cb.checked = true;
      });
    }

    if (casal.jaFoiDirigente !== null && casal.jaFoiDirigente !== undefined) {
      const val   = casal.jaFoiDirigente ? 'sim' : 'nao';
      const radio = document.querySelector(`input[name="foi-dirigente"][value="${val}"]`);
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
    }
    if (casal.jaFoiDirigente) {
      setVal('campo-ano-dirigente', casal.anoDirigente);
      const rb = document.querySelector(`#pasta-dirigente input[value="${casal.pastaDirigente}"]`);
      if (rb) rb.checked = true;
    }

    setVal('campo-pastoral', casal.participaPastoral);
  } else {
    (casal.gostariaDeServir || []).forEach((pasta) => {
      const cb = document.querySelector(`#pastas-gostaria input[value="${pasta}"]`);
      if (cb) cb.checked = true;
    });
  }

  ['pastas-servidas', 'pastas-coordenadas', 'pasta-dirigente', 'pastas-gostaria'].forEach(syncCheckboxGridClasses);
}

/* ===================================================
   COLLECT FORM DATA
   =================================================== */

async function coletarFormData() {
  const nomeEsposo = ($('campo-nome-esposo') || {}).value || '';
  const nomeEsposa = ($('campo-nome-esposa') || {}).value || '';
  if (!nomeEsposo.trim() && !nomeEsposa.trim()) {
    alert('Por favor, informe pelo menos o nome de um dos cônjuges.');
    return null;
  }

  const anoRetiroEl = $('campo-ano-retiro');
  const anoRetiro   = anoRetiroEl ? parseInt(anoRetiroEl.value, 10) : NaN;
  if (isNaN(anoRetiro) || anoRetiro <= 0) {
    alert('Por favor, informe o ano do retiro.');
    return null;
  }

  const serviuRadio = document.querySelector('input[name="serviu"]:checked');
  if (!serviuRadio) {
    alert('Por favor, indique se o casal já serviu no retiro.');
    return null;
  }

  const jaServiu   = serviuRadio.value === 'sim';
  const existingId = ($('casal-id') || {}).value || '';
  const existing   = existingId ? casais.find((c) => c.id === existingId) : null;

  const fotoEsposo = await lerFoto($('foto-esposo'), $('preview-esposo'))
    || (existing && existing.fotoEsposo ? existing.fotoEsposo : null);
  const fotoEsposa = await lerFoto($('foto-esposa'), $('preview-esposa'))
    || (existing && existing.fotoEsposa ? existing.fotoEsposa : null);

  const getVal = (id) => { const el = $(id); return el ? el.value.trim() : ''; };

  const casal = {
    id:        existingId || gerarId(),
    nomeEsposo: nomeEsposo.trim(),
    nomeEsposa: nomeEsposa.trim(),
    nomes:     [nomeEsposo.trim(), nomeEsposa.trim()].filter(Boolean).join(' & '),
    telEsposo: getVal('campo-tel-esposo'),
    telEsposa: getVal('campo-tel-esposa'),
    contato:   [getVal('campo-tel-esposo'), getVal('campo-tel-esposa')].filter(Boolean).join(' / '),
    endereco:  getVal('campo-endereco'),
    anoRetiro,
    jaServiu,
    fotoEsposo,
    fotoEsposa,
  };

  if (jaServiu) {
    casal.pastasServidas = Array.from(document.querySelectorAll('#pastas-servidas input:checked')).map((i) => i.value);
    const coordRadio = document.querySelector('input[name="foi-coord"]:checked');
    casal.jaFoiCoordenador = coordRadio ? coordRadio.value === 'sim' : false;
    casal.pastasCoordenadasDe = casal.jaFoiCoordenador
      ? Array.from(document.querySelectorAll('#pastas-coordenadas input:checked')).map((i) => i.value)
      : [];

    const dirigRadio = document.querySelector('input[name="foi-dirigente"]:checked');
    casal.jaFoiDirigente = dirigRadio ? dirigRadio.value === 'sim' : false;
    if (casal.jaFoiDirigente) {
      const anoDir = $('campo-ano-dirigente');
      casal.anoDirigente   = anoDir ? (parseInt(anoDir.value, 10) || null) : null;
      const pdRadio = document.querySelector('#pasta-dirigente input:checked');
      casal.pastaDirigente = pdRadio ? pdRadio.value : '';
    }
    casal.participaPastoral = getVal('campo-pastoral');
  } else {
    casal.gostariaDeServir = Array.from(document.querySelectorAll('#pastas-gostaria input:checked')).map((i) => i.value);
  }

  return casal;
}

/* ===================================================
   SAVE COUPLE
   =================================================== */

const btnSalvar = $('btn-salvar');

if (btnSalvar) {
  btnSalvar.addEventListener('click', async () => {
    const data = await coletarFormData();
    if (!data) return;

    const idx = casais.findIndex((c) => c.id === data.id);
    if (idx >= 0) {
      casais[idx] = data;
    } else {
      casais.push(data);
    }

    salvar();
    fecharModal(modalCadastro);
    renderTabela();
    renderTabelaDirigente(aplicarFiltrosAtivos());
  });
}

/* ===================================================
   DISPLAY HELPERS
   =================================================== */

function getNomesCasal(c) {
  return [c.nomeEsposo, c.nomeEsposa].filter(Boolean).join(' & ') || c.nomes || '—';
}

function getEsposo(c) { return c.nomeEsposo || '—'; }
function getEsposa(c) { return c.nomeEsposa || '—'; }

function getTelefones(c) {
  const parts = [c.telEsposo, c.telEsposa].filter(Boolean);
  return parts.length ? parts.join(' / ') : (c.contato || '—');
}

function avatarHtml(dataUrl, alt) {
  if (!dataUrl) return `<span class="avatar-placeholder" title="${esc(alt)}">👤</span>`;
  return `<img src="${dataUrl}" class="foto-avatar foto-avatar-sm" alt="${esc(alt)}" />`;
}

function badgeSim(val) {
  return val
    ? '<span class="badge badge-sim">Sim</span>'
    : '<span class="badge badge-nao">Não</span>';
}

/* ===================================================
   RENDER TABLES
   =================================================== */

function renderTabela() {
  const tbodyEcc    = $('tbody-casais');
  const msgVazioEcc = $('msg-vazio');
  if (!tbodyEcc) return;

  tbodyEcc.innerHTML = '';
  if (casais.length === 0) {
    if (msgVazioEcc) msgVazioEcc.classList.add('visivel');
    return;
  }
  if (msgVazioEcc) msgVazioEcc.classList.remove('visivel');

  casais.forEach((c) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fotos-cell">${avatarHtml(c.fotoEsposo, getEsposo(c))} ${avatarHtml(c.fotoEsposa, getEsposa(c))}</td>
      <td>${esc(getEsposo(c))}</td>
      <td>${esc(getEsposa(c))}</td>
      <td>${esc(getTelefones(c))}</td>
      <td>${c.anoRetiro}</td>
      <td>${badgeSim(c.jaServiu)}</td>
      <td>${badgeSim(c.jaFoiDirigente)}</td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-outline" data-action="ver" data-id="${c.id}">Ver</button>
        <button class="btn btn-sm btn-secondary" data-action="editar" data-id="${c.id}">Editar</button>
        <button class="btn btn-sm btn-danger" data-action="excluir" data-id="${c.id}">Excluir</button>
      </td>`;
    tbodyEcc.appendChild(tr);
  });
}

function renderTabelaDirigente(lista) {
  const tbodyDir    = $('tbody-dirigente');
  const msgVazioDir = $('msg-vazio-dir');
  if (!tbodyDir) return;

  tbodyDir.innerHTML = '';
  if (!lista || lista.length === 0) {
    if (msgVazioDir) msgVazioDir.classList.add('visivel');
    return;
  }
  if (msgVazioDir) msgVazioDir.classList.remove('visivel');

  lista.forEach((c) => {
    const pastas = (c.pastasServidas || []).join(', ') || '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(getEsposo(c))}</td>
      <td>${esc(getEsposa(c))}</td>
      <td>${esc(getTelefones(c))}</td>
      <td>${c.anoRetiro}</td>
      <td>${esc(pastas)}</td>
      <td>${badgeSim(c.jaFoiCoordenador)}</td>
      <td>${badgeSim(c.jaFoiDirigente)}</td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-outline" data-action="ver" data-id="${c.id}">Ver</button>
        <button class="btn btn-sm btn-secondary" data-action="editar" data-id="${c.id}">Editar</button>
        <button class="btn btn-sm btn-danger" data-action="excluir" data-id="${c.id}">Excluir</button>
      </td>`;
    tbodyDir.appendChild(tr);
  });
}

/* ===================================================
   ACTIONS HANDLER
   =================================================== */

function handleRowAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  const casal = casais.find((c) => c.id === id);
  if (!casal) return;

  if (action === 'ver')    abrirVisualizacao(casal);
  if (action === 'editar') abrirEdicao(casal);
  if (action === 'excluir') {
    if (confirm(`Excluir o casal "${getNomesCasal(casal)}"?`)) {
      casais = casais.filter((c) => c.id !== id);
      salvar();
      renderTabela();
      renderTabelaDirigente(aplicarFiltrosAtivos());
    }
  }
}

const tbodyEccEl = $('tbody-casais');
const tbodyDirEl = $('tbody-dirigente');
if (tbodyEccEl) tbodyEccEl.addEventListener('click', handleRowAction);
if (tbodyDirEl) tbodyDirEl.addEventListener('click', handleRowAction);

function abrirNovoCadastro() { resetForm(); abrirModal(modalCadastro); }

const btnNovoCasal   = $('btn-novo-casal');
const btnAddCasalDir = $('btn-add-casal-dir');
if (btnNovoCasal)   btnNovoCasal.addEventListener('click', abrirNovoCadastro);
if (btnAddCasalDir) btnAddCasalDir.addEventListener('click', abrirNovoCadastro);

function abrirEdicao(casal) {
  resetForm();
  popularForm(casal);
  abrirModal(modalCadastro);
}

/* ===================================================
   VISUALIZAÇÃO DETALHADA
   =================================================== */

function abrirVisualizacao(c) {
  const viewBody = $('view-body');
  if (!viewBody) return;

  const sim = (v) => (v ? 'Sim' : 'Não');
  const fotosHtml = `
    <div class="view-fotos">
      <div class="view-foto-item">
        ${c.fotoEsposo
          ? `<img src="${c.fotoEsposo}" class="foto-avatar foto-avatar-lg" alt="${esc(getEsposo(c))}" />`
          : '<span class="avatar-placeholder avatar-placeholder-lg">👤</span>'}
        <p class="view-foto-label">Esposo</p>
      </div>
      <div class="view-foto-item">
        ${c.fotoEsposa
          ? `<img src="${c.fotoEsposa}" class="foto-avatar foto-avatar-lg" alt="${esc(getEsposa(c))}" />`
          : '<span class="avatar-placeholder avatar-placeholder-lg">👤</span>'}
        <p class="view-foto-label">Esposa</p>
      </div>
    </div>`;

  let html = `${fotosHtml}
    <div class="view-section">
      <h4>Identificação</h4>
      <div class="view-row"><span class="view-label">Esposo:</span><span class="view-val">${esc(getEsposo(c))}</span></div>
      <div class="view-row"><span class="view-label">Esposa:</span><span class="view-val">${esc(getEsposa(c))}</span></div>
      <div class="view-row"><span class="view-label">Tel. Esposo:</span><span class="view-val">${esc(c.telEsposo || '—')}</span></div>
      <div class="view-row"><span class="view-label">Tel. Esposa:</span><span class="view-val">${esc(c.telEsposa || '—')}</span></div>
      <div class="view-row"><span class="view-label">Endereço:</span><span class="view-val">${esc(c.endereco || '—')}</span></div>
      <div class="view-row"><span class="view-label">Ano do Retiro:</span><span class="view-val">${c.anoRetiro}</span></div>
    </div>`;

  if (c.jaServiu) {
    html += `
    <div class="view-section">
      <h4>Serviço no Retiro</h4>
      <div class="view-row"><span class="view-label">Pastas:</span><span class="view-val">${esc((c.pastasServidas || []).join(', ') || '—')}</span></div>
      <div class="view-row"><span class="view-label">Coordenador:</span><span class="view-val">${sim(c.jaFoiCoordenador)}</span></div>
      ${c.jaFoiCoordenador
        ? `<div class="view-row"><span class="view-label">Pastas Coordenadas:</span><span class="view-val">${esc((c.pastasCoordenadasDe || []).join(', ') || '—')}</span></div>`
        : ''}
      <div class="view-row"><span class="view-label">Dirigente:</span><span class="view-val">${sim(c.jaFoiDirigente)}</span></div>
      ${c.jaFoiDirigente
        ? `<div class="view-row"><span class="view-label">Pasta Dirigente:</span><span class="view-val">${esc(c.pastaDirigente || '—')} (${c.anoDirigente || '—'})</span></div>`
        : ''}
      ${c.participaPastoral
        ? `<div class="view-row"><span class="view-label">Pastoral:</span><span class="view-val">${esc(c.participaPastoral)}</span></div>`
        : ''}
    </div>`;
  } else {
    html += `
    <div class="view-section">
      <h4>Interesse</h4>
      <div class="view-row"><span class="view-label">Gostaria de servir em:</span><span class="view-val">${esc((c.gostariaDeServir || []).join(', ') || '—')}</span></div>
    </div>`;
  }

  viewBody.innerHTML = html;
  abrirModal(modalVisualizar);
}

/* ===================================================
   CHECKBOX GRID – checked-state class fallback
   Toggles .is-checked on labels for browsers without :has() support
   =================================================== */

document.addEventListener('change', (e) => {
  if (e.target.matches('.checkbox-grid input')) {
    const label = e.target.closest('label');
    if (label) label.classList.toggle('is-checked', e.target.checked);
  }
});

/* ===================================================
   CSV EXPORT  (admin.html)
   =================================================== */

function gerarCSV(lista) {
  const header = [
    'Esposo', 'Esposa', 'Tel. Esposo', 'Tel. Esposa',
    'Endereço', 'Ano Retiro', 'Já Serviu', 'Pastas Servidas',
    'Coordenador', 'Pastas Coordenadas', 'Dirigente',
    'Ano Dirigente', 'Pasta Dirigente', 'Pastoral', 'Gostaria de Servir em',
  ];
  const rows = lista.map((c) => [
    c.nomeEsposo || '',
    c.nomeEsposa || '',
    c.telEsposo  || '',
    c.telEsposa  || '',
    c.endereco   || '',
    c.anoRetiro  || '',
    c.jaServiu ? 'Sim' : 'Não',
    (c.pastasServidas      || []).join('; '),
    c.jaFoiCoordenador ? 'Sim' : 'Não',
    (c.pastasCoordenadasDe || []).join('; '),
    c.jaFoiDirigente ? 'Sim' : 'Não',
    c.anoDirigente    || '',
    c.pastaDirigente  || '',
    c.participaPastoral || '',
    (c.gostariaDeServir || []).join('; '),
  ]);
  return [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}

function baixarCSV(nomeArquivo, conteudo) {
  const blob = new Blob(['\ufeff' + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ===================================================
   FILTERS  (admin.html)
   =================================================== */

function aplicarFiltrosAtivos() { return filtroAtivo ? filtroAtivo(casais) : casais; }

const buscarNomeInput   = $('busca-nome');
const buscarAnoInput    = $('busca-ano');
const btnBuscar         = $('btn-buscar');
const btnLimparBusca    = $('btn-limpar-busca');
const btnAplicarPastas  = $('btn-aplicar-pastas');
const labelFiltroAtivo  = $('label-filtro-ativo');
const btnAjudaRetiro    = $('btn-ajuda-retiro');

if (btnBuscar) {
  btnBuscar.addEventListener('click', () => {
    const nome = buscarNomeInput ? buscarNomeInput.value.trim().toLowerCase() : '';
    const ano  = buscarAnoInput  ? parseInt(buscarAnoInput.value, 10) : NaN;
    filtroAtivo = (lista) => lista.filter((c) => {
      const nomesMatch = getNomesCasal(c).toLowerCase().includes(nome);
      const anoMatch   = !ano || c.anoRetiro === ano;
      return nomesMatch && anoMatch;
    });
    if (labelFiltroAtivo) labelFiltroAtivo.textContent = '(Busca Ativa)';
    renderTabelaDirigente(aplicarFiltrosAtivos());
  });
}

if (btnLimparBusca) {
  btnLimparBusca.addEventListener('click', () => {
    if (buscarNomeInput) buscarNomeInput.value = '';
    if (buscarAnoInput)  buscarAnoInput.value  = '';
    filtroAtivo = null;
    if (labelFiltroAtivo) labelFiltroAtivo.textContent = '';
    renderTabelaDirigente(casais);
  });
}

if (btnAplicarPastas) {
  btnAplicarPastas.addEventListener('click', () => {
    const selecionadas = Array.from(document.querySelectorAll('#filtro-pastas input:checked')).map((i) => i.value);
    if (selecionadas.length === 0) {
      filtroAtivo = null;
      if (labelFiltroAtivo) labelFiltroAtivo.textContent = '';
    } else {
      filtroAtivo = (lista) => lista.filter((c) =>
        selecionadas.some((p) => (c.pastasServidas || []).includes(p))
      );
      if (labelFiltroAtivo) labelFiltroAtivo.textContent = `(Pastas: ${selecionadas.join(', ')})`;
    }
    renderTabelaDirigente(aplicarFiltrosAtivos());
  });
}

if (btnAjudaRetiro) {
  btnAjudaRetiro.addEventListener('click', () => {
    const pasta = sugestaoPastaSelect ? sugestaoPastaSelect.value : '';
    if (!pasta) {
      alert('Selecione uma pasta para obter sugestões.');
      return;
    }
    filtroAtivo = (lista) => lista.filter((c) =>
      !(c.pastasServidas || []).includes(pasta)
    );
    if (labelFiltroAtivo) labelFiltroAtivo.textContent = `(Sugestão para: ${pasta})`;
    renderTabelaDirigente(aplicarFiltrosAtivos());
  });
}

const btnNuncaServiram        = $('btn-nunca-serviram');
const btnBaixarSugestao       = $('btn-baixar-sugestao');
const btnBaixarRelatorioPasta = $('btn-baixar-relatorio-pasta');

if (btnNuncaServiram) {
  btnNuncaServiram.addEventListener('click', () => {
    filtroAtivo = (lista) => lista.filter((c) => !c.jaServiu);
    if (labelFiltroAtivo) labelFiltroAtivo.textContent = '(Nunca Serviram)';
    renderTabelaDirigente(aplicarFiltrosAtivos());
  });
}

if (btnBaixarSugestao) {
  btnBaixarSugestao.addEventListener('click', () => {
    const lista = aplicarFiltrosAtivos();
    if (!lista.length) {
      alert('Nenhum resultado disponível. Aplique um filtro primeiro.');
      return;
    }
    baixarCSV('sugestao-retiro.csv', gerarCSV(lista));
  });
}

if (btnBaixarRelatorioPasta) {
  btnBaixarRelatorioPasta.addEventListener('click', () => {
    const lista = aplicarFiltrosAtivos();
    if (!lista.length) {
      alert('Nenhum resultado disponível. Aplique um filtro primeiro.');
      return;
    }
    baixarCSV('relatorio-por-pasta.csv', gerarCSV(lista));
  });
}

/* ===================================================
   UTILITIES
   =================================================== */

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ===================================================
   INIT
   =================================================== */

carregar();

// index.html init
if ($('tbody-casais')) {
  renderTabela();

  if (isEccLogado()) {
    ocultarEccLogin();
    if (eccNomeLogado) eccNomeLogado.textContent = `Olá, ${sessionStorage.getItem('ecc_casal_nome')}!`;
  } else {
    mostrarEccLogin();
  }
}

// admin.html init
if ($('tbody-dirigente')) {
  renderTabelaDirigente(casais);

  if (isDirLogado()) {
    mostrarPainelDirigente();
  } else {
    mostrarDirLogin();
  }
}
