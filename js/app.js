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

// Frases inspiradoras exibidas no login (santos e bíblicas)
const FRASES_INSPIRADORAS = [
  '"Tudo posso naquele que me fortalece." — Fil 4,13',
  '"Deus é amor, e quem permanece no amor permanece em Deus." — 1 Jo 4,16',
  '"O Senhor é meu pastor e nada me faltará." — Sl 23,1',
  '"Amai-vos uns aos outros como Eu vos amei." — Jo 15,12',
  '"Que a paz de Cristo reine em vossos corações." — Cl 3,15',
  '"São José, guardião da Sagrada Família, rogai por nós."',
  '"A família que ora unida permanece unida." — Beato Pe. Patrick Peyton',
  '"O amor é paciente, o amor é bondoso." — 1 Cor 13,4',
  '"Onde há caridade e amor, aí está Deus." — Antífona Litúrgica',
  '"Feliz o povo que tem o Senhor como seu Deus." — Sl 33,12',
  '"Buscai primeiro o Reino de Deus e a sua justiça." — Mt 6,33',
  '"Com Deus tudo, sem Deus nada." — Santo Agostinho',
  '"Amar é querer o bem do outro." — Santo Tomás de Aquino',
  '"A oração é a respiração da alma." — São João Vianney',
  '"Não temas, pois Eu estou contigo." — Is 41,10',
  '"Sede a luz do mundo, a cidade posta no monte." — Mt 5,14',
  '"Nossa Senhora do Perpétuo Socorro, rogai por nós."',
  '"São Francisco de Sales, patrono dos casais, rogai por nós."',
  '"O amor conjugal é imagem do amor de Deus pela humanidade." — Familiaris Consortio',
  '"Quanto fizestes a um destes meus pequeninos irmãos, a Mim o fizestes." — Mt 25,40',
];

// URL do Google Apps Script implantado
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzYIU9U7PUjAHpxxWeEla8-vrK_pP2iTZg41858yw_2SE8usnUqtk8l6KRwbxX8P71mrw/exec';

// Chaves de proteção de dispositivo
const ECC_CASAL_REGISTRADO_KEY = 'ecc_casal_registrado';
const ECC_INSCRICAO_KEY        = 'ecc_inscricao_bloqueada';
const ECC_CASAL_ID_KEY         = 'ecc_casal_id';

// URL do robô Flask rodando na VPS (substitua pelo IP real da sua máquina)
// Exemplo: 'http://123.45.67.89:5000'
const BOT_URL = 'http://SEU_IP:5000';  // <-- ALTERE AQUI

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

/* ── Device registration helpers ── */

function getCasalRegistrado() {
  return localStorage.getItem(ECC_CASAL_REGISTRADO_KEY) || null;
}

function setCasalRegistrado(nome) {
  localStorage.setItem(ECC_CASAL_REGISTRADO_KEY, nome);
}

function isInscricaoBloqueada() {
  return localStorage.getItem(ECC_INSCRICAO_KEY) === 'true';
}

function bloquearInscricao() {
  localStorage.setItem(ECC_INSCRICAO_KEY, 'true');
}

function liberarInscricao() {
  localStorage.removeItem(ECC_INSCRICAO_KEY);
}

function getCasalId() {
  return localStorage.getItem(ECC_CASAL_ID_KEY) || null;
}

function setCasalId(id) {
  localStorage.setItem(ECC_CASAL_ID_KEY, id);
}

function redefinirDispositivo() {
  localStorage.removeItem(ECC_CASAL_REGISTRADO_KEY);
  localStorage.removeItem(ECC_INSCRICAO_KEY);
  localStorage.removeItem(ECC_CASAL_ID_KEY);
}

/* ===================================================
   GOOGLE SHEETS INTEGRATION
   =================================================== */

async function _postParaSheets(payload) {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    return await res.json();
  } catch (err) {
    console.warn('Erro ao comunicar com Google Sheets:', err);
    return { ok: false, erro: String(err.message || err) };
  }
}

async function sincronizarComSheets(lista) {
  return _postParaSheets({ acao: 'sincronizar', casais: lista });
}

async function excluirDoSheets(id) {
  return _postParaSheets({ acao: 'excluir', id });
}

async function importarDoSheets() {
  try {
    const res = await fetch(`${SCRIPT_URL}?acao=exportar`, { redirect: 'follow' });
    const data = await res.json();
    if (data.ok && Array.isArray(data.casais)) return data.casais;
    console.warn('Resposta inesperada da planilha:', data);
    return null;
  } catch (err) {
    console.warn('Erro ao importar do Google Sheets:', err);
    return null;
  }
}

async function verificarBloqueioNoSheets(login) {
  try {
    const res = await fetch(`${SCRIPT_URL}?acao=verificarBloqueio&login=${encodeURIComponent(login)}`, { redirect: 'follow' });
    const data = await res.json();
    return data.ok ? !!data.bloqueado : false;
  } catch (err) {
    console.warn('Erro ao verificar bloqueio:', err);
    return false;
  }
}

async function bloquearLoginNoSheets(login) {
  return _postParaSheets({ acao: 'bloquearLogin', login });
}

async function desbloquearLoginNoSheets(login) {
  return _postParaSheets({ acao: 'desbloquearLogin', login });
}

async function listarBloqueiosDoSheets() {
  try {
    const res = await fetch(`${SCRIPT_URL}?acao=listarBloqueios`, { redirect: 'follow' });
    const data = await res.json();
    return data.ok && Array.isArray(data.bloqueios) ? data.bloqueios : [];
  } catch (err) {
    console.warn('Erro ao listar bloqueios:', err);
    return [];
  }
}

async function salvarSenhaNoSheets(senha) {
  return _postParaSheets({ acao: 'salvarConfig', chave: 'senha_admin', valor: senha });
}

async function carregarSenhaDoSheets() {
  try {
    const res = await fetch(`${SCRIPT_URL}?acao=getConfig&chave=senha_admin`, { redirect: 'follow' });
    const data = await res.json();
    return data.ok && data.valor ? data.valor : null;
  } catch (err) {
    console.warn('Erro ao carregar senha do Sheets:', err);
    return null;
  }
}

// Mapeia uma linha exportada da planilha para o formato local
function casalDaPlanilha(row) {
  const jaServiu = row['Já Serviu'] === 'Sim';
  const pastasServidas = row['Equipes de Trabalho']
    ? String(row['Equipes de Trabalho']).split(';').map((s) => s.trim()).filter(Boolean)
    : [];
  const jaFoiCoordenador = row['Coordenador'] === 'Sim';
  const pastasCoordenadasDe = row['Equipes Coordenadas']
    ? String(row['Equipes Coordenadas']).split(';').map((s) => s.trim()).filter(Boolean)
    : [];
  const jaFoiDirigente = row['Dirigente'] === 'Sim';
  const gostariaDeServir = row['Gostaria de Servir em']
    ? String(row['Gostaria de Servir em']).split(';').map((s) => s.trim()).filter(Boolean)
    : [];
  const esposo = String(row['Esposo'] || '');
  const esposa = String(row['Esposa'] || '');
  const telEsposo = String(row['Tel. Esposo'] || '');
  const telEsposa = String(row['Tel. Esposa'] || '');
  return {
    id: String(row['ID'] || gerarId()),
    nomeEsposo: esposo,
    nomeEsposa: esposa,
    nomes: [esposo, esposa].filter(Boolean).join(' & '),
    telEsposo,
    telEsposa,
    contato: [telEsposo, telEsposa].filter(Boolean).join(' / '),
    endereco: String(row['Endereço'] || ''),
    anoRetiro: parseInt(row['Ano Retiro'], 10) || 0,
    jaServiu,
    pastasServidas,
    jaFoiCoordenador,
    pastasCoordenadasDe,
    jaFoiDirigente,
    anoDirigente: jaFoiDirigente ? (parseInt(row['Ano Dirigente'], 10) || null) : null,
    pastaDirigente: jaFoiDirigente ? String(row['Pasta Dirigente'] || '') : '',
    participaPastoral: jaServiu ? String(row['Pastoral'] || '') : '',
    gostariaDeServir,
  };
}

/* ===================================================
   DOM HELPERS
   =================================================== */

const $ = (id) => document.getElementById(id);

/* ===================================================
   INSPIRATIONAL PHRASES
   =================================================== */

function getFraseAleatoria() {
  return FRASES_INSPIRADORAS[Math.floor(Math.random() * FRASES_INSPIRADORAS.length)];
}

function mostrarFraseNoLogin(idElemento) {
  const el = $(idElemento);
  if (el) el.textContent = getFraseAleatoria();
}

/* ===================================================
   LOADING SCREEN
   =================================================== */

function mostrarLoadingScreen(duracao, callback) {
  const el = $('loading-screen');
  if (!el) { if (callback) callback(); return; }
  const fraseEl = $('loading-frase');
  if (fraseEl) fraseEl.textContent = getFraseAleatoria();
  // Ensure visible (it may already be visible on page load)
  el.removeAttribute('hidden');
  el.classList.remove('loading-fade-out');
  document.body.style.overflow = 'hidden';

  // Animate progress bar
  const barEl = $('loading-bar');
  if (barEl) {
    barEl.style.width = '0%';
    let prog = 0;
    const steps = Math.max(1, Math.floor((duracao - 800) / 30));
    const barTimer = setInterval(() => {
      prog = Math.min(100, prog + (100 / steps));
      barEl.style.width = prog + '%';
      if (prog >= 100) clearInterval(barTimer);
    }, 30);
  }

  // Trigger cross traverse animation near the end, then fade out
  setTimeout(() => {
    const cruzEl = $('loading-cruz-elem');
    if (cruzEl) cruzEl.classList.add('loading-cruz-atravessar');
    setTimeout(() => {
      el.classList.add('loading-fade-out');
      setTimeout(() => {
        el.setAttribute('hidden', '');
        document.body.style.overflow = '';
        const cruzElCleanup = $('loading-cruz-elem');
        if (cruzElCleanup) cruzElCleanup.classList.remove('loading-cruz-atravessar');
        if (callback) callback();
      }, 500);
    }, 700);
  }, Math.max(0, duracao - 700));
}

function mostrarLoadingENavegar(url, duracao) {
  duracao = duracao || 1500;
  const el = $('loading-screen');
  if (!el) { window.location.href = url; return; }
  const fraseEl = $('loading-frase');
  if (fraseEl) fraseEl.textContent = getFraseAleatoria();
  el.removeAttribute('hidden');
  el.classList.remove('loading-fade-out');
  document.body.style.overflow = 'hidden';

  // Animate progress bar during navigation transition
  const barEl = $('loading-bar');
  if (barEl) {
    barEl.style.width = '0%';
    let prog = 0;
    const steps = Math.max(1, Math.floor(duracao / 30));
    const barTimer = setInterval(() => {
      prog = Math.min(100, prog + (100 / steps));
      barEl.style.width = prog + '%';
      if (prog >= 100) clearInterval(barTimer);
    }, 30);
  }

  setTimeout(() => { window.location.href = url; }, duracao);
}

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
const eccLoginErro    = $('ecc-login-erro');
const eccNomeLogado   = $('ecc-nome-logado');

function mostrarEccLogin() {
  if (overlayEccLogin) {
    overlayEccLogin.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    mostrarFraseNoLogin('frase-inspiradora');

    // Pre-fill name if device already has a registered couple
    const nomeCadastrado = getCasalRegistrado();
    if (nomeCadastrado && eccLoginNome) {
      eccLoginNome.value = nomeCadastrado;
      const subtitleEl = overlayEccLogin.querySelector('.login-subtitle');
      if (subtitleEl) {
        subtitleEl.textContent = `Dispositivo registrado para: ${nomeCadastrado}`;
      }
    }
  }
}

function ocultarEccLogin() {
  if (overlayEccLogin) {
    overlayEccLogin.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }
}

function atualizarNomeLogado(nome) {
  if (!eccNomeLogado || !nome) return;
  const lockIcon = isInscricaoBloqueada() ? ' 🔒' : '';
  eccNomeLogado.textContent = `Olá, ${nome}!${lockIcon}`;
}

if (formEccLogin) {
  formEccLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = eccLoginNome ? eccLoginNome.value.trim() : '';
    if (!nome) return;

    const nomeCadastrado = getCasalRegistrado();

    // If a couple is already registered on this device, enforce name match
    if (nomeCadastrado) {
      if (nome.toLowerCase() !== nomeCadastrado.toLowerCase()) {
        if (eccLoginErro) {
          eccLoginErro.textContent = 'Este dispositivo já está registrado para outro casal. Informe o nome correto ou contate o Dirigente.';
          eccLoginErro.removeAttribute('hidden');
        }
        if (eccLoginNome) eccLoginNome.value = '';
        return;
      }
      if (eccLoginErro) eccLoginErro.setAttribute('hidden', '');
    } else {
      // First login on this device – persist the couple name
      setCasalRegistrado(nome);
    }

    if (eccWelcomeMsg) {
      eccWelcomeMsg.textContent = `Bem-vindo(a), ${nome}! Que Deus abençoe o seu casal. ✝`;
      eccWelcomeMsg.removeAttribute('hidden');
    }
    formEccLogin.hidden = true;

    setEccLogado(nome);
    atualizarNomeLogado(nome);

    // Sync block status from Google Sheets (source of truth)
    // This ensures the block persists even after cache clear / app reinstall
    verificarBloqueioNoSheets(nome).then((bloqueadoSheets) => {
      if (bloqueadoSheets) {
        bloquearInscricao();
      } else {
        liberarInscricao();
      }
      atualizarEstadoBotaoCadastro();
      atualizarNomeLogado(nome);
    }).catch((err) => {
      console.warn('Não foi possível sincronizar status de bloqueio:', err);
    });

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
    mostrarFraseNoLogin('frase-admin');
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
      renderListaBloqueios();
      if (casais.length === 0) {
        _autoImportarDoSheets();
      }
    } else {
      if (dirLoginErro) dirLoginErro.removeAttribute('hidden');
      if (dirLoginSenha) { dirLoginSenha.value = ''; dirLoginSenha.focus(); }
    }
  });
}

if (btnLogoutDir) {
  btnLogoutDir.addEventListener('click', () => {
    logoutDir();
    mostrarLoadingENavegar('index.html');
  });
}

if (btnVoltarEcc) {
  btnVoltarEcc.addEventListener('click', (e) => {
    e.preventDefault();
    mostrarLoadingENavegar('index.html');
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
    salvarSenhaNoSheets(nova).catch((err) => console.warn('Erro ao salvar senha no Sheets:', err));
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

function buildCheckboxGroup(containerId, pastas, prefix, singleSelect = false, accordion = false) {
  const el = $(containerId);
  if (!el) return;
  el.innerHTML = '';

  if (accordion) {
    const wrapper = document.createElement('div');
    wrapper.className = 'multiselect-wrapper';
    wrapper.dataset.prefix = prefix;

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'multiselect-toggle';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'multiselect-label';
    labelSpan.textContent = 'Nenhuma selecionada';

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'multiselect-arrow';
    arrowSpan.textContent = '▾';

    toggleBtn.appendChild(labelSpan);
    toggleBtn.appendChild(arrowSpan);

    const body = document.createElement('div');
    body.className = 'multiselect-body';
    body.hidden = true;

    const listEl = document.createElement('div');
    listEl.className = 'checkbox-list';
    listEl.id = containerId + '-list';

    pastas.forEach((pasta) => {
      const id = `${prefix}-${pasta.replace(/\s+/g, '-').toLowerCase()}`;
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = singleSelect ? 'radio' : 'checkbox';
      if (singleSelect) input.name = prefix;
      input.value = pasta;
      input.id = id;
      label.htmlFor = id;
      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + pasta));
      listEl.appendChild(label);
    });

    body.appendChild(listEl);
    wrapper.appendChild(toggleBtn);
    wrapper.appendChild(body);
    el.appendChild(wrapper);

    toggleBtn.addEventListener('click', () => {
      body.hidden = !body.hidden;
      wrapper.classList.toggle('open', !body.hidden);
    });

    listEl.addEventListener('change', () => {
      const checked = listEl.querySelectorAll('input:checked');
      labelSpan.textContent = checked.length === 0
        ? 'Nenhuma selecionada'
        : Array.from(checked).map((i) => i.value).join(', ');
      labelSpan.classList.toggle('has-selection', checked.length > 0);
    });

    return;
  }

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

function syncRadioGroupClasses() {
  document.querySelectorAll('.radio-group input[type="radio"]').forEach((input) => {
    const label = input.closest('label');
    if (label) label.classList.toggle('is-checked', input.checked);
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

function syncAndUpdateMultiselect(containerId) {
  const el = $(containerId);
  if (!el) return;
  el.querySelectorAll('input').forEach((input) => {
    const label = input.closest('label');
    if (label) label.classList.toggle('is-checked', input.checked);
  });
  const wrapper = el.querySelector('.multiselect-wrapper');
  if (!wrapper) return;
  const listEl = wrapper.querySelector('.checkbox-list');
  const labelEl = wrapper.querySelector('.multiselect-label');
  if (!listEl || !labelEl) return;
  const checked = listEl.querySelectorAll('input:checked');
  labelEl.textContent = checked.length === 0
    ? 'Nenhuma selecionada'
    : Array.from(checked).map((i) => i.value).join(', ');
  labelEl.classList.toggle('has-selection', checked.length > 0);
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

// Populate nunca-serviu pasta filter select (admin.html)
const nuncaServiuPastaSelect = $('nunca-serviu-pasta-select');
if (nuncaServiuPastaSelect) {
  PASTAS.forEach((pasta) => {
    const opt = document.createElement('option');
    opt.value = pasta;
    opt.textContent = pasta;
    nuncaServiuPastaSelect.appendChild(opt);
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

/**
 * Rebuilds the "pastas-coordenadas" multiselect to only include
 * the pastas currently checked in "pastas-servidas", since a couple
 * can only have coordinated a pasta they have already served in.
 * Any previously checked coordination pastas that are still valid
 * are preserved.
 */
function atualizarPastasCoordenadasDisponiveis() {
  const servidasListEl = document.querySelector('#pastas-servidas .checkbox-list');
  const selecionadas = servidasListEl
    ? Array.from(servidasListEl.querySelectorAll('input:checked')).map((i) => i.value)
    : [];

  // Remember current coordenadas selections before rebuilding
  const coordListEl = document.querySelector('#pastas-coordenadas .checkbox-list');
  const coordAntes  = coordListEl
    ? Array.from(coordListEl.querySelectorAll('input:checked')).map((i) => i.value)
    : [];

  // Rebuild with only the served pastas (or empty if none selected)
  buildCheckboxGroup('pastas-coordenadas', selecionadas, 'pcoord', false, true);

  // Restore valid previous selections
  coordAntes.forEach((pasta) => {
    const cb = document.querySelector(`#pastas-coordenadas input[value="${pasta}"]`);
    if (cb) cb.checked = true;
  });

  syncAndUpdateMultiselect('pastas-coordenadas');
}

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
      // Refresh available coordination pastas when section becomes visible
      if (radio.value === 'sim') atualizarPastasCoordenadasDisponiveis();
    });
  });

  document.querySelectorAll('input[name="foi-dirigente"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const secDir = $('secao-dirigente');
      if (secDir) secDir.hidden = radio.value !== 'sim';
    });
  });

  // Whenever pastas-servidas selections change, update pastas-coordenadas options
  const pastasServidasEl = $('pastas-servidas');
  if (pastasServidasEl) {
    pastasServidasEl.addEventListener('change', (e) => {
      if (e.target.matches('input[type="checkbox"]')) {
        atualizarPastasCoordenadasDisponiveis();
      }
    });
  }
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

  buildCheckboxGroup('pastas-servidas',    PASTAS,           'pserv',  false, true);
  buildCheckboxGroup('pastas-coordenadas', [],               'pcoord', false, true);
  buildCheckboxGroup('pasta-dirigente',    PASTAS_DIRIGENTE, 'pdir',   true,  true);
  buildCheckboxGroup('pastas-gostaria',    PASTAS,           'pgost',  false, true);

  configurarSecoesCond();
  syncRadioGroupClasses();
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

    // Update available coordination pastas to match what was served
    atualizarPastasCoordenadasDisponiveis();

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

  ['pastas-servidas', 'pastas-coordenadas', 'pasta-dirigente', 'pastas-gostaria'].forEach(syncAndUpdateMultiselect);
  syncRadioGroupClasses();
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
    const isNovo = idx < 0;
    if (idx >= 0) {
      casais[idx] = data;
    } else {
      casais.push(data);
    }

    salvar();
    fecharModal(modalCadastro);
    renderTabela();
    renderTabelaDirigente(aplicarFiltrosAtivos());
    sincronizarComSheets([data]).then((res) => {
      if (res && !res.ok) console.warn('Falha ao sincronizar casal com a planilha:', res.erro);
    });

    // Lock further registrations on this device after a new couple is saved
    // (only in the public view – admin panel is unrestricted)
    if (isNovo && $('tbody-casais') && !$('tbody-dirigente')) {
      bloquearInscricao();
      setCasalId(data.id);
      atualizarEstadoBotaoCadastro();
      // Persist block in Google Sheets so it survives cache clear / app reinstall
      const nomeRegistrado = getCasalRegistrado();
      if (nomeRegistrado) {
        bloquearLoginNoSheets(nomeRegistrado).catch((err) => console.warn('Erro ao bloquear login no Sheets:', err));
      }
      const nomeLogado = sessionStorage.getItem('ecc_casal_nome');
      if (nomeLogado) atualizarNomeLogado(nomeLogado);
    }
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

  // In the public panel, only the registered couple's own data is visible.
  // All other inscriptions are restricted to the admin panel.
  const casalIdRegistrado = getCasalId();
  const listaCasais = casalIdRegistrado
    ? casais.filter((c) => c.id === casalIdRegistrado)
    : [];

  tbodyEcc.innerHTML = '';
  if (listaCasais.length === 0) {
    if (msgVazioEcc) msgVazioEcc.classList.add('visivel');
    return;
  }
  if (msgVazioEcc) msgVazioEcc.classList.remove('visivel');

  listaCasais.forEach((c) => {
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
      excluirDoSheets(id).then((res) => {
        if (res && !res.ok) console.warn('Falha ao excluir casal da planilha:', res.erro);
      });
    }
  }
}

const tbodyEccEl = $('tbody-casais');
const tbodyDirEl = $('tbody-dirigente');
if (tbodyEccEl) tbodyEccEl.addEventListener('click', handleRowAction);
if (tbodyDirEl) tbodyDirEl.addEventListener('click', handleRowAction);

function abrirNovoCadastro() { resetForm(); abrirModal(modalCadastro); }

function atualizarEstadoBotaoCadastro() {
  if (!btnNovoCasal) return;
  if (isInscricaoBloqueada()) {
    btnNovoCasal.disabled = true;
    btnNovoCasal.textContent = '✅ Inscrição Realizada';
    btnNovoCasal.title = 'Inscrição já realizada. Para alterações, contate o Dirigente.';
  } else {
    btnNovoCasal.disabled = false;
    btnNovoCasal.textContent = '📝 Ficha de Cadastro';
    btnNovoCasal.title = '';
  }
}

const btnNovoCasal   = $('btn-novo-casal');
const btnAddCasalDir = $('btn-add-casal-dir');

if (btnNovoCasal) {
  btnNovoCasal.addEventListener('click', () => {
    if (isInscricaoBloqueada()) {
      alert('A inscrição deste dispositivo já foi realizada.\nPara alterações ou nova inscrição, contate o Dirigente.');
      return;
    }
    abrirNovoCadastro();
  });
}
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
  if (e.target.matches('.checkbox-list input')) {
    const label = e.target.closest('label');
    if (label) label.classList.toggle('is-checked', e.target.checked);
  }
  if (e.target.matches('.radio-group input[type="radio"]')) {
    const name = e.target.name;
    document.querySelectorAll(`input[name="${CSS.escape(name)}"]`).forEach((r) => {
      const label = r.closest('label');
      if (label) label.classList.toggle('is-checked', r.checked);
    });
  }
});

/* ===================================================
   PDF EXPORT  (admin.html)
   =================================================== */

function _gerarHtmlPDF(titulo, cabecalho, linhas) {
  const thCells = cabecalho.map((h) => `<th>${esc(h)}</th>`).join('');
  const trRows  = linhas.map((r) =>
    `<tr>${r.map((v) => `<td>${esc(String(v ?? ''))}</td>`).join('')}</tr>`
  ).join('');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>${esc(titulo)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 1cm; color: #222; }
  h1 { font-size: 15px; margin-bottom: 4px; color: #1a5276; }
  p.data { font-size: 10px; color: #555; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; }
  th { background: #1a5276; color: #fff; }
  tr:nth-child(even) { background: #f2f6fa; }
  @media print { @page { margin: 1cm; } button { display: none; } }
</style>
</head>
<body>
<h1>${esc(titulo)}</h1>
<p class="data">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
<table>
  <thead><tr>${thCells}</tr></thead>
  <tbody>${trRows}</tbody>
</table>
<br/>
<button onclick="window.print()" style="padding:6px 14px;cursor:pointer;">🖨️ Imprimir / Salvar PDF</button>
</body>
</html>`;
}

function baixarPDF(titulo, cabecalho, linhas) {
  const html = _gerarHtmlPDF(titulo, cabecalho, linhas);
  const win  = window.open('', '_blank');
  if (!win) {
    alert('Permita janelas pop-up para gerar o PDF.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  // Allow browser time to render content before triggering print dialog
  setTimeout(() => win.print(), 400);
}

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
const btnNuncaServiramFiltrar = $('btn-nunca-serviram-filtrar');
const btnBaixarNuncaServiram  = $('btn-baixar-nunca-serviram');

if (btnNuncaServiram) {
  btnNuncaServiram.addEventListener('click', () => {
    filtroAtivo = (lista) => lista.filter((c) => !c.jaServiu);
    if (labelFiltroAtivo) labelFiltroAtivo.textContent = '(Nunca Serviram)';
    renderTabelaDirigente(aplicarFiltrosAtivos());
  });
}

if (btnNuncaServiramFiltrar) {
  btnNuncaServiramFiltrar.addEventListener('click', () => {
    const pasta = nuncaServiuPastaSelect ? nuncaServiuPastaSelect.value : '';
    filtroAtivo = (lista) => {
      const nunca = lista.filter((c) => !c.jaServiu);
      return pasta ? nunca.filter((c) => (c.gostariaDeServir || []).includes(pasta)) : nunca;
    };
    if (labelFiltroAtivo) {
      labelFiltroAtivo.textContent = pasta
        ? `(Nunca Serviram – Interesse: ${pasta})`
        : '(Nunca Serviram)';
    }
    renderTabelaDirigente(aplicarFiltrosAtivos());
  });
}

if (btnBaixarNuncaServiram) {
  btnBaixarNuncaServiram.addEventListener('click', () => {
    const lista = aplicarFiltrosAtivos();
    if (!lista.length) {
      alert('Nenhum resultado disponível. Aplique um filtro primeiro.');
      return;
    }
    const pasta  = nuncaServiuPastaSelect ? nuncaServiuPastaSelect.value : '';
    const titulo = pasta
      ? `Casais que Nunca Serviram – Interesse: ${pasta}`
      : 'Casais que Nunca Serviram';
    const cabecalho = ['Esposo', 'Esposa', 'Tel. Esposo', 'Tel. Esposa', 'Ano Retiro', 'Gostaria de Servir em'];
    const linhas = lista.map((c) => [
      c.nomeEsposo || '',
      c.nomeEsposa || '',
      c.telEsposo  || '',
      c.telEsposa  || '',
      c.anoRetiro  || '',
      (c.gostariaDeServir || []).join('; '),
    ]);
    baixarPDF(titulo, cabecalho, linhas);
  });
}

if (btnBaixarSugestao) {
  btnBaixarSugestao.addEventListener('click', () => {
    const lista = aplicarFiltrosAtivos();
    if (!lista.length) {
      alert('Nenhum resultado disponível. Aplique um filtro primeiro.');
      return;
    }
    const pastaAtual = sugestaoPastaSelect ? sugestaoPastaSelect.value : '';
    const cabecalho  = ['Equipe', 'Esposo', 'Esposa', 'Tel. Esposo', 'Tel. Esposa', 'Ano Retiro'];
    const linhas     = lista.map((c) => [
      pastaAtual || '',
      c.nomeEsposo || '',
      c.nomeEsposa || '',
      c.telEsposo  || '',
      c.telEsposa  || '',
      c.anoRetiro  || '',
    ]);
    const titulo = pastaAtual ? `Sugestão de Retiro – ${pastaAtual}` : 'Sugestão de Retiro';
    baixarPDF(titulo, cabecalho, linhas);
  });
}

if (btnBaixarRelatorioPasta) {
  btnBaixarRelatorioPasta.addEventListener('click', () => {
    const lista = aplicarFiltrosAtivos();
    if (!lista.length) {
      alert('Nenhum resultado disponível. Aplique um filtro primeiro.');
      return;
    }
    const cabecalho = [
      'Esposo', 'Esposa', 'Tel. Esposo', 'Tel. Esposa',
      'Ano Retiro', 'Já Serviu', 'Pastas Servidas', 'Coordenador', 'Dirigente',
    ];
    const linhas = lista.map((c) => [
      c.nomeEsposo || '',
      c.nomeEsposa || '',
      c.telEsposo  || '',
      c.telEsposa  || '',
      c.anoRetiro  || '',
      c.jaServiu ? 'Sim' : 'Não',
      (c.pastasServidas || []).join('; '),
      c.jaFoiCoordenador ? 'Sim' : 'Não',
      c.jaFoiDirigente   ? 'Sim' : 'Não',
    ]);
    baixarPDF('Relatório por Pasta', cabecalho, linhas);
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
   SHEETS SYNC BUTTONS  (admin.html only)
   =================================================== */

function _setSheetsMsg(msg, tipo) {
  const el = $('sheets-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = `sheets-msg msg-${tipo || 'ok'}`;
  el.removeAttribute('hidden');
  if (tipo !== 'loading') {
    setTimeout(() => el.setAttribute('hidden', ''), 4000);
  }
}

const btnSincronizarTudo = $('btn-sincronizar-tudo');

if (btnSincronizarTudo) {
  btnSincronizarTudo.addEventListener('click', async () => {
    if (!casais.length) {
      _setSheetsMsg('Nenhum casal para sincronizar.', 'ok');
      return;
    }
    _setSheetsMsg('Sincronizando com a planilha…', 'loading');
    btnSincronizarTudo.disabled = true;
    const res = await sincronizarComSheets(casais);
    btnSincronizarTudo.disabled = false;
    if (res && res.ok) {
      _setSheetsMsg(`${casais.length} casal(is) sincronizado(s)!`, 'ok');
    } else {
      _setSheetsMsg('Erro ao sincronizar: ' + ((res && res.erro) || 'desconhecido'), 'erro');
    }
  });
}

/* ===================================================
   ADMIN – DEVICE MANAGEMENT  (admin.html only)
   =================================================== */

function atualizarInfoDispositivo() {
  const nomeEl   = $('nome-casal-registrado');
  const statusEl = $('status-inscricao');
  const nomeCadastrado = getCasalRegistrado();
  const bloqueado      = isInscricaoBloqueada();

  if (nomeEl) nomeEl.textContent = nomeCadastrado || 'Nenhum casal registrado';
  if (statusEl) {
    if (bloqueado) {
      statusEl.textContent = 'Status: Inscrição concluída 🔒';
      statusEl.className   = 'tool-desc dispositivo-bloqueado';
    } else {
      statusEl.textContent = 'Status: Livre para inscrição 🔓';
      statusEl.className   = 'tool-desc dispositivo-livre';
    }
  }
}

const btnLiberarInscricao    = $('btn-liberar-inscricao');
const btnRedefinirDispositivo = $('btn-redefinir-dispositivo');

if (btnLiberarInscricao) {
  btnLiberarInscricao.addEventListener('click', async () => {
    const nome = getCasalRegistrado();
    liberarInscricao();
    atualizarInfoDispositivo();
    if (nome) {
      btnLiberarInscricao.disabled = true;
      await desbloquearLoginNoSheets(nome).catch((err) => console.warn('Erro ao desbloquear no Sheets:', err));
      btnLiberarInscricao.disabled = false;
    }
    alert('Inscrição liberada! O casal poderá realizar uma nova inscrição.');
  });
}

if (btnRedefinirDispositivo) {
  btnRedefinirDispositivo.addEventListener('click', () => {
    if (confirm('Atenção: isso removerá o vínculo deste dispositivo com o casal registrado, permitindo que qualquer casal se registre novamente.\n\nConfirmar redefinição?')) {
      redefinirDispositivo();
      atualizarInfoDispositivo();
      alert('Dispositivo redefinido com sucesso. Um novo casal poderá se registrar.');
    }
  });
}

/* ===================================================
   ADMIN – BLOCK MANAGEMENT  (admin.html only)
   =================================================== */

async function renderListaBloqueios() {
  const listEl = $('lista-bloqueios');
  if (!listEl) return;
  listEl.innerHTML = '<p class="tool-desc">Carregando…</p>';
  const bloqueios = await listarBloqueiosDoSheets();
  if (!bloqueios.length) {
    listEl.innerHTML = '<p class="tool-desc">Nenhum login registrado na planilha.</p>';
    return;
  }
  listEl.innerHTML = '';
  bloqueios.forEach((b) => {
    const item = document.createElement('div');
    item.className = `bloqueio-item ${b.bloqueado ? 'bloqueio-bloqueado' : 'bloqueio-livre'}`;
    item.innerHTML = `
      <span class="bloqueio-nome">${esc(b.login)}</span>
      <span class="badge ${b.bloqueado ? 'badge-bloqueado' : 'badge-livre'}">${b.bloqueado ? '🔒 Bloqueado' : '🔓 Livre'}</span>
      <button class="btn btn-sm ${b.bloqueado ? 'btn-outline' : 'btn-danger'}"
              data-bloqueio-acao="${b.bloqueado ? 'desbloquear' : 'bloquear'}"
              data-bloqueio-login="${esc(b.login)}">
        ${b.bloqueado ? '🔓 Liberar' : '🔒 Bloquear'}
      </button>`;
    listEl.appendChild(item);
  });
}

const listaBloqueiosEl    = $('lista-bloqueios');
const btnCarregarBloqueios = $('btn-carregar-bloqueios');
const btnBloquearLogin    = $('btn-bloquear-login');
const bloquearLoginInput  = $('bloquear-login-input');

if (listaBloqueiosEl) {
  listaBloqueiosEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-bloqueio-acao]');
    if (!btn) return;
    const acao  = btn.dataset.bloqueioAcao;
    const login = btn.dataset.bloqueioLogin;
    btn.disabled = true;
    if (acao === 'desbloquear') {
      await desbloquearLoginNoSheets(login).catch(() => {});
    } else {
      await bloquearLoginNoSheets(login).catch(() => {});
    }
    await renderListaBloqueios();
  });
}

if (btnCarregarBloqueios) {
  btnCarregarBloqueios.addEventListener('click', () => renderListaBloqueios());
}

if (btnBloquearLogin && bloquearLoginInput) {
  btnBloquearLogin.addEventListener('click', async () => {
    const nome = bloquearLoginInput.value.trim();
    if (!nome) { alert('Informe o nome do casal.'); return; }
    btnBloquearLogin.disabled = true;
    await bloquearLoginNoSheets(nome).catch(() => {});
    bloquearLoginInput.value = '';
    btnBloquearLogin.disabled = false;
    await renderListaBloqueios();
    alert(`Login "${nome}" bloqueado com sucesso.`);
  });
}

/* ===================================================
   INIT
   =================================================== */

carregar();

// index.html init
if ($('tbody-casais')) {
  mostrarLoadingScreen(2200, () => {
    renderTabela();
    atualizarEstadoBotaoCadastro();

    if (isEccLogado()) {
      ocultarEccLogin();
      const nomeLogado = sessionStorage.getItem('ecc_casal_nome');
      atualizarNomeLogado(nomeLogado || '');
    } else {
      mostrarEccLogin();
    }
  });
}

// admin.html init
if ($('tbody-dirigente')) {
  renderTabelaDirigente(casais);

  mostrarLoadingScreen(2200, () => {
    // Load persisted admin password from Google Sheets (survives cache clear / reinstall)
    carregarSenhaDoSheets().then((senhaSalva) => {
      if (senhaSalva) setSenha(senhaSalva);

      if (isDirLogado()) {
        mostrarPainelDirigente();
        renderListaBloqueios();
        // Auto-fetch couples from Google Sheets if local cache is empty
        if (casais.length === 0) {
          _autoImportarDoSheets();
        }
      } else {
        mostrarDirLogin();
      }
    }).catch((err) => {
      console.warn('Erro ao carregar senha do Sheets:', err);
      if (isDirLogado()) {
        mostrarPainelDirigente();
        renderListaBloqueios();
        if (casais.length === 0) {
          _autoImportarDoSheets();
        }
      } else {
        mostrarDirLogin();
      }
    });
  });
}

async function _autoImportarDoSheets() {
  const linhas = await importarDoSheets();
  if (!linhas || linhas.length === 0) {
    if (!linhas) console.warn('Auto-importação: falha ao buscar dados da planilha.');
    return;
  }
  const mapaLocal = {};
  casais.forEach((c) => { mapaLocal[c.id] = c; });
  linhas.forEach((row) => {
    const c = casalDaPlanilha(row);
    if (mapaLocal[c.id]) {
      c.fotoEsposo = mapaLocal[c.id].fotoEsposo || null;
      c.fotoEsposa = mapaLocal[c.id].fotoEsposa || null;
    }
    mapaLocal[c.id] = c;
  });
  casais = Object.values(mapaLocal);
  salvar();
  renderTabelaDirigente(aplicarFiltrosAtivos());
}

/* ===================================================
   TAB SWITCHING
   =================================================== */

function initTabs(containerSelector) {
  const buttons = document.querySelectorAll(containerSelector + ' .tab-btn');
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === targetId);
      });
    });
  });
}

// Init tabs for both pages
initTabs('.app-header');

/* ===================================================
   COMUNICADOS — CONSTANTS & STORAGE
   =================================================== */

const STORAGE_KEY_COMUNICADOS = 'ecc_comunicados';

function getComunicados() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMUNICADOS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveComunicados(lista) {
  try {
    localStorage.setItem(STORAGE_KEY_COMUNICADOS, JSON.stringify(lista));
  } catch (e) { console.error('Erro ao salvar comunicados', e); }
}

/* ===================================================
   COMUNICADOS — SHEETS HELPERS
   =================================================== */

async function salvarComunicadoNoSheets(com) {
  return _postParaSheets({ acao: 'salvarComunicado', comunicado: {
    id: com.id, titulo: com.titulo, descricao: com.descricao,
    dataEvento: com.dataEvento, horaEvento: com.horaEvento,
    local: com.local, criadoEm: com.criadoEm,
  }});
}

async function excluirComunicadoNoSheets(id) {
  return _postParaSheets({ acao: 'excluirComunicado', id });
}

async function listarComunicadosDoSheets() {
  try {
    const res = await fetch(`${SCRIPT_URL}?acao=listarComunicados`, { redirect: 'follow' });
    const data = await res.json();
    return data.ok && Array.isArray(data.comunicados) ? data.comunicados : [];
  } catch (e) {
    console.warn('Erro ao listar comunicados:', e);
    return [];
  }
}

/* ===================================================
   COMUNICADOS — RENDER (Admin)
   =================================================== */

function renderComunicadosAdmin() {
  const container = $('lista-comunicados-admin');
  if (!container) return;
  const lista = getComunicados();
  if (!lista.length) {
    container.innerHTML = '<p class="msg-vazio visivel">Nenhum comunicado criado ainda.</p>';
    return;
  }
  container.innerHTML = lista.map((com) => {
    const thumb = com.imagem
      ? `<img src="${com.imagem}" class="comunicado-admin-thumb" alt="Flyer" />`
      : `<div class="comunicado-admin-thumb" style="background:var(--brand-light);display:flex;align-items:center;justify-content:center;font-size:1.8rem;border-radius:8px;">📢</div>`;
    const dataFmt = isValidDateStr(com.dataEvento)
      ? new Date(com.dataEvento + 'T12:00:00').toLocaleDateString('pt-BR') : '';
    const horaFmt = sanitizeTimeStr(com.horaEvento);
    return `
      <div class="comunicado-admin-item">
        ${thumb}
        <div class="comunicado-admin-info">
          <div class="comunicado-admin-title">${esc(com.titulo)}</div>
          <div class="comunicado-admin-meta">
            ${dataFmt ? '📅 ' + dataFmt : ''}
            ${horaFmt ? ' ⏰ ' + esc(horaFmt) : ''}
            ${com.local ? ' 📍 ' + esc(com.local) : ''}
          </div>
          <div class="comunicado-admin-desc">${esc(com.descricao)}</div>
        </div>
        <button class="btn btn-danger btn-sm" data-del-com="${esc(com.id)}">🗑</button>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-del-com]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este comunicado?')) return;
      const id = btn.dataset.delCom;
      let lista = getComunicados().filter((c) => c.id !== id);
      saveComunicados(lista);
      excluirComunicadoNoSheets(id).catch(() => {});
      renderComunicadosAdmin();
    });
  });
}

/* ===================================================
   COMUNICADOS — RENDER (Public)
   =================================================== */

function addHourToTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  return String((h + 1) % 24).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function isValidDateStr(val) {
  return /^\d{4}-\d{2}-\d{2}$/.test(val || '');
}

function sanitizeTimeStr(val) {
  if (!val) return '';
  const s = String(val);
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  const m = s.match(/(\d{2}):(\d{2})/);
  return m ? m[1] + ':' + m[2] : '';
}

function formatGCalDate(dateStr, timeStr) {
  if (!isValidDateStr(dateStr)) return '';
  const d = dateStr.replace(/-/g, '');
  const cleanTime = sanitizeTimeStr(timeStr);
  const t = cleanTime ? cleanTime.replace(':', '') + '00' : '000000';
  return d + 'T' + t;
}

function renderComunicadosPub() {
  const container = $('lista-comunicados-pub');
  if (!container) return;
  const lista = getComunicados();
  if (!lista.length) {
    container.innerHTML = '<p class="msg-vazio visivel">Nenhum comunicado disponível no momento.</p>';
    return;
  }
  const sorted = [...lista].sort((a, b) => {
    if (!a.dataEvento) return 1;
    if (!b.dataEvento) return -1;
    return a.dataEvento.localeCompare(b.dataEvento);
  });
  container.innerHTML = sorted.map((com) => {
    const dataFmt = isValidDateStr(com.dataEvento)
      ? new Date(com.dataEvento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : '';
    const horaFmt = sanitizeTimeStr(com.horaEvento);
    const imgHtml = com.imagem
      ? `<img src="${com.imagem}" class="comunicado-card-img" alt="${esc(com.titulo)}" />`
      : `<div class="comunicado-card-img-placeholder">📢</div>`;
    const startDate = formatGCalDate(com.dataEvento, horaFmt);
    const endDate   = formatGCalDate(com.dataEvento, addHourToTime(horaFmt));
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(com.titulo)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(com.descricao)}&location=${encodeURIComponent(com.local || '')}`;
    return `
      <div class="comunicado-card">
        ${imgHtml}
        <div class="comunicado-card-body">
          ${dataFmt ? `<span class="comunicado-card-date">📅 ${dataFmt}${horaFmt ? ' · ' + esc(horaFmt) : ''}</span>` : ''}
          <div class="comunicado-card-title">${esc(com.titulo)}</div>
          ${com.local ? `<div class="comunicado-card-location">📍 ${esc(com.local)}</div>` : ''}
          <div class="comunicado-card-desc">${esc(com.descricao)}</div>
        </div>
        ${startDate ? `<div class="comunicado-card-footer">
          <a href="${esc(gcalUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-block" style="font-size:0.82rem;">📅 Salvar no Calendário</a>
        </div>` : ''}
      </div>`;
  }).join('');
}

/* ===================================================
   COMUNICADOS — ADMIN FORM
   =================================================== */

const formComunicado = $('form-comunicado');
const comImgInput    = $('com-imagem');
const comPreview     = $('com-preview');
const comMsg         = $('com-msg');

function _setComMsg(msg, tipo) {
  if (!comMsg) return;
  comMsg.textContent = msg;
  comMsg.className = 'sheets-msg msg-' + tipo;
  comMsg.removeAttribute('hidden');
  if (tipo !== 'loading') setTimeout(() => comMsg.setAttribute('hidden', ''), 4000);
}

if (comImgInput) {
  comImgInput.addEventListener('change', () => {
    const file = comImgInput.files[0];
    if (!file || !comPreview) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      comPreview.innerHTML = `<img src="${ev.target.result}" alt="Preview" />`;
    };
    reader.readAsDataURL(file);
  });
}

if (formComunicado) {
  formComunicado.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = ($('com-titulo') || {}).value?.trim() || '';
    if (!titulo) { alert('Informe o título do comunicado.'); return; }

    _setComMsg('Salvando...', 'loading');

    let imagem = null;
    if (comImgInput && comImgInput.files[0]) {
      imagem = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = (ev) => res(ev.target.result);
        reader.onerror = () => res(null);
        reader.readAsDataURL(comImgInput.files[0]);
      });
    }

    const com = {
      id: gerarId(),
      titulo,
      descricao: ($('com-descricao') || {}).value?.trim() || '',
      dataEvento: ($('com-data')    || {}).value || '',
      horaEvento: ($('com-hora')    || {}).value || '',
      local:      ($('com-local')   || {}).value?.trim() || '',
      imagem,
      criadoEm: new Date().toISOString(),
    };

    const lista = getComunicados();
    lista.unshift(com);
    saveComunicados(lista);
    renderComunicadosAdmin();

    salvarComunicadoNoSheets(com).catch(() => {});
    _setComMsg('Comunicado salvo com sucesso!', 'ok');
    formComunicado.reset();
    if (comPreview) comPreview.innerHTML = '';
  });
}

// Init admin comunicados
if ($('lista-comunicados-admin')) renderComunicadosAdmin();

// Init public comunicados
if ($('lista-comunicados-pub')) {
  listarComunicadosDoSheets().then((sheetsData) => {
    if (sheetsData.length > 0) {
      const local = getComunicados();
      const localIds = new Set(local.map((c) => c.id));
      sheetsData.forEach((sc) => {
        if (!localIds.has(sc.id)) local.push(sc);
      });
      saveComunicados(local);
    }
    renderComunicadosPub();
  }).catch(() => renderComunicadosPub());
}

/* ===================================================
   QUIZ — QUESTIONS (300 total, 60 per category)
   =================================================== */

const QUIZ_QUESTIONS = [
  // ── BÍBLIA (60 questions) ──
  { id: 'b01', categoria: 'Bíblia', pergunta: 'Quantos livros tem a Bíblia Católica?', opcoes: ['66','73','72','70'], correta: 1 },
  { id: 'b02', categoria: 'Bíblia', pergunta: 'Quem escreveu o Livro do Apocalipse?', opcoes: ['São Paulo','São Marcos','São João','São Lucas'], correta: 2 },
  { id: 'b03', categoria: 'Bíblia', pergunta: 'Qual foi o primeiro milagre de Jesus?', opcoes: ['Cura de um cego','Multiplicação dos pães','Ressurreição de Lázaro','Transformação da água em vinho'], correta: 3 },
  { id: 'b04', categoria: 'Bíblia', pergunta: 'Quem foi o pai da fé, chamado por Deus para deixar sua terra?', opcoes: ['Moisés','Isaac','Abraão','Jacó'], correta: 2 },
  { id: 'b05', categoria: 'Bíblia', pergunta: 'Qual livro bíblico narra a criação do mundo?', opcoes: ['Êxodo','Gênesis','Levítico','Números'], correta: 1 },
  { id: 'b06', categoria: 'Bíblia', pergunta: 'Quantos Evangelhos existem no Novo Testamento?', opcoes: ['3','5','4','6'], correta: 2 },
  { id: 'b07', categoria: 'Bíblia', pergunta: 'Em qual rio Jesus foi batizado?', opcoes: ['Rio Jordão','Rio Nilo','Rio Eufrates','Rio Tigre'], correta: 0 },
  { id: 'b08', categoria: 'Bíblia', pergunta: 'Quem traiu Jesus por 30 moedas de prata?', opcoes: ['Pedro','Tomé','Judas Iscariotes','João'], correta: 2 },
  { id: 'b09', categoria: 'Bíblia', pergunta: 'Qual é o livro mais longo da Bíblia?', opcoes: ['Isaías','Gênesis','Salmos','Jeremias'], correta: 2 },
  { id: 'b10', categoria: 'Bíblia', pergunta: 'Qual é o livro mais curto da Bíblia (em versículos)?', opcoes: ['Obadias','Filemon','2 João','3 João'], correta: 2 },
  { id: 'b11', categoria: 'Bíblia', pergunta: 'Quem foi o primeiro mártir cristão relatado nos Atos dos Apóstolos?', opcoes: ['Tiago','Barnabé','Estêvão','Filipe'], correta: 2 },
  { id: 'b12', categoria: 'Bíblia', pergunta: 'Qual profeta foi engolido por um grande peixe?', opcoes: ['Elias','Jonas','Amós','Miqueias'], correta: 1 },
  { id: 'b13', categoria: 'Bíblia', pergunta: 'Com quantos pães e peixes Jesus alimentou mais de cinco mil pessoas?', opcoes: ['7 pães e 3 peixes','5 pães e 2 peixes','10 pães e 5 peixes','3 pães e 1 peixe'], correta: 1 },
  { id: 'b14', categoria: 'Bíblia', pergunta: 'Qual apóstolo negou Jesus três vezes?', opcoes: ['João','Paulo','Tiago','Pedro'], correta: 3 },
  { id: 'b15', categoria: 'Bíblia', pergunta: 'Qual é o versículo mais curto da Bíblia?', opcoes: ['"Orai sem cessar."','"Jesus chorou."','"Deus é amor."','"Amém."'], correta: 1 },
  { id: 'b16', categoria: 'Bíblia', pergunta: 'Quem foi o rei de Israel famoso por sua sabedoria?', opcoes: ['Davi','Saúl','Salomão','Ezequias'], correta: 2 },
  { id: 'b17', categoria: 'Bíblia', pergunta: 'Em qual cidade Jesus nasceu?', opcoes: ['Nazaré','Jerusalém','Belém','Cafarnaum'], correta: 2 },
  { id: 'b18', categoria: 'Bíblia', pergunta: 'Qual é o nome da mãe de Jesus?', opcoes: ['Isabel','Ana','Maria','Marta'], correta: 2 },
  { id: 'b19', categoria: 'Bíblia', pergunta: 'Quantos mandamentos Deus entregou a Moisés no Monte Sinai?', opcoes: ['7','12','5','10'], correta: 3 },
  { id: 'b20', categoria: 'Bíblia', pergunta: 'Qual é o nome do jardim onde Adão e Eva viviam?', opcoes: ['Jardim de Getsêmani','Jardim do Éden','Jardim de Ofélia','Jardim das Oliveiras'], correta: 1 },
  { id: 'b21', categoria: 'Bíblia', pergunta: 'Quem construiu a arca durante o dilúvio?', opcoes: ['Abraão','Moisés','Noé','Elias'], correta: 2 },
  { id: 'b22', categoria: 'Bíblia', pergunta: 'Qual foi a última praga do Egito?', opcoes: ['Gafanhotos','Água em sangue','Morte dos primogênitos','Trevas'], correta: 2 },
  { id: 'b23', categoria: 'Bíblia', pergunta: 'Quem escreveu a maioria das cartas do Novo Testamento?', opcoes: ['Pedro','Paulo','João','Tiago'], correta: 1 },
  { id: 'b24', categoria: 'Bíblia', pergunta: 'Qual é o nome do discípulo que duvidou da ressurreição de Jesus?', opcoes: ['Bartolomeu','Filipe','Simão','Tomé'], correta: 3 },
  { id: 'b25', categoria: 'Bíblia', pergunta: 'Por quantos dias e noites Deus fez chover sobre a terra durante o dilúvio?', opcoes: ['40 dias e 40 noites','7 dias e 7 noites','20 dias e 20 noites','100 dias e 100 noites'], correta: 0 },
  { id: 'b26', categoria: 'Bíblia', pergunta: 'Qual profeta anunciou: "Eis que a virgem conceberá e dará à luz um filho"?', opcoes: ['Jeremias','Ezequiel','Isaías','Daniel'], correta: 2 },
  { id: 'b27', categoria: 'Bíblia', pergunta: 'Em qual monte Moisés recebeu os Dez Mandamentos?', opcoes: ['Monte Carmelo','Monte Sinai','Monte Tabor','Monte das Oliveiras'], correta: 1 },
  { id: 'b28', categoria: 'Bíblia', pergunta: 'Qual é o Salmo mais conhecido da Bíblia?', opcoes: ['Salmo 1','Salmo 100','Salmo 23','Salmo 119'], correta: 2 },
  { id: 'b29', categoria: 'Bíblia', pergunta: 'Quem foi o pai de João Batista?', opcoes: ['Simeão','Zacarias','José','Eli'], correta: 1 },
  { id: 'b30', categoria: 'Bíblia', pergunta: 'Em qual cidade Paulo foi convertido no caminho?', opcoes: ['Corinto','Éfeso','Damasco','Antioquia'], correta: 2 },
  { id: 'b31', categoria: 'Bíblia', pergunta: 'Qual livro do Antigo Testamento fala sobre a fidelidade de Rute?', opcoes: ['Ester','Juízes','Rute','Tobias'], correta: 2 },
  { id: 'b32', categoria: 'Bíblia', pergunta: 'Quantos dias Jesus ficou no deserto em jejum?', opcoes: ['20','30','40','50'], correta: 2 },
  { id: 'b33', categoria: 'Bíblia', pergunta: 'Qual é o nome da esposa de Abraão?', opcoes: ['Rute','Rebeca','Sara','Lia'], correta: 2 },
  { id: 'b34', categoria: 'Bíblia', pergunta: 'Qual é o livro do Novo Testamento que descreve o nascimento da Igreja?', opcoes: ['Romanos','Atos dos Apóstolos','Gálatas','Hebreus'], correta: 1 },
  { id: 'b35', categoria: 'Bíblia', pergunta: 'Quem foi o rei que mandou matar os meninos de Belém?', opcoes: ['Pôncio Pilatos','Herodes','Nero','Faraó'], correta: 1 },
  { id: 'b36', categoria: 'Bíblia', pergunta: 'Quantas tribos havia em Israel?', opcoes: ['10','12','14','7'], correta: 1 },
  { id: 'b37', categoria: 'Bíblia', pergunta: 'Qual profeta foi levado ao céu num carro de fogo?', opcoes: ['Eliseu','Isaías','Ezequiel','Elias'], correta: 3 },
  { id: 'b38', categoria: 'Bíblia', pergunta: 'Qual é o nome do livro que narra a história de Ester?', opcoes: ['Judite','Tobias','Ester','Rute'], correta: 2 },
  { id: 'b39', categoria: 'Bíblia', pergunta: 'Jesus ressuscitou Lázaro depois de quantos dias?', opcoes: ['1','2','4','3'], correta: 2 },
  { id: 'b40', categoria: 'Bíblia', pergunta: 'Qual é o nome do anjo que anunciou o nascimento de Jesus a Maria?', opcoes: ['Rafael','Miguel','Gabriel','Uriel'], correta: 2 },
  { id: 'b41', categoria: 'Bíblia', pergunta: 'Quantos apóstolos Jesus escolheu?', opcoes: ['7','10','12','14'], correta: 2 },
  { id: 'b42', categoria: 'Bíblia', pergunta: 'Qual é o primeiro livro do Novo Testamento?', opcoes: ['Marcos','João','Lucas','Mateus'], correta: 3 },
  { id: 'b43', categoria: 'Bíblia', pergunta: 'Onde Jesus foi crucificado?', opcoes: ['Monte Tabor','Monte das Oliveiras','Gólgota','Getsêmani'], correta: 2 },
  { id: 'b44', categoria: 'Bíblia', pergunta: 'Qual é o nome do filho que Abraão quase sacrificou?', opcoes: ['Jacó','Isaque','Ismael','Esaú'], correta: 1 },
  { id: 'b45', categoria: 'Bíblia', pergunta: 'Quem ungiu Davi como rei de Israel?', opcoes: ['Natã','Gade','Samuel','Elias'], correta: 2 },
  { id: 'b46', categoria: 'Bíblia', pergunta: 'Qual livro bíblico apresenta as Bem-aventuranças?', opcoes: ['Lucas','João','Mateus','Marcos'], correta: 2 },
  { id: 'b47', categoria: 'Bíblia', pergunta: 'Em qual cidade Jesus realizou a multiplicação dos pães?', opcoes: ['Caná','Betsaida','Cafarnaum','Jericó'], correta: 1 },
  { id: 'b48', categoria: 'Bíblia', pergunta: 'Qual é o nome da mãe de João Batista?', opcoes: ['Ana','Maria','Isabel','Marta'], correta: 2 },
  { id: 'b49', categoria: 'Bíblia', pergunta: 'Quem escreveu o Evangelho de Lucas?', opcoes: ['Um médico chamado Lucas','Um pescador chamado Lucas','Um fariseu chamado Lucas','Um levita chamado Lucas'], correta: 0 },
  { id: 'b50', categoria: 'Bíblia', pergunta: 'Qual é o nome do lago onde Jesus acalmou a tempestade?', opcoes: ['Mar Morto','Mar de Tiberíades','Mar Vermelho','Mar Mediterrâneo'], correta: 1 },
  { id: 'b51', categoria: 'Bíblia', pergunta: 'Quantos dias Jesus ficou ressuscitado antes de ascender ao céu?', opcoes: ['7','40','30','50'], correta: 1 },
  { id: 'b52', categoria: 'Bíblia', pergunta: 'Qual é o nome do apóstolo que foi substituído por Matias?', opcoes: ['Judas Iscariotes','Bartolomeu','Simão','Natanael'], correta: 0 },
  { id: 'b53', categoria: 'Bíblia', pergunta: 'Em qual idioma foi escrito o Novo Testamento originalmente?', opcoes: ['Latim','Aramaico','Hebraico','Grego'], correta: 3 },
  { id: 'b54', categoria: 'Bíblia', pergunta: 'Qual é a última palavra da Bíblia?', opcoes: ['Aleluia','Paz','Graça','Amém'], correta: 3 },
  { id: 'b55', categoria: 'Bíblia', pergunta: 'Quem foi o primeiro sumo sacerdote de Israel?', opcoes: ['Melquisedeque','Aaron','Sadoque','Eli'], correta: 1 },
  { id: 'b56', categoria: 'Bíblia', pergunta: 'Qual milagre Jesus realizou nas Bodas de Caná?', opcoes: ['Curou um paralítico','Ressuscitou um morto','Transformou água em vinho','Expulsou demônios'], correta: 2 },
  { id: 'b57', categoria: 'Bíblia', pergunta: 'Qual é o nome do irmão de Moisés que falava por ele?', opcoes: ['Calebe','Josué','Aaron','Nuno'], correta: 2 },
  { id: 'b58', categoria: 'Bíblia', pergunta: 'Quantas cartas Paulo escreveu à comunidade de Corinto?', opcoes: ['1','3','4','2'], correta: 3 },
  { id: 'b59', categoria: 'Bíblia', pergunta: 'Qual é o nome da prostituta de Jericó que ajudou os espias israelitas?', opcoes: ['Dalila','Raabe','Débora','Rute'], correta: 1 },
  { id: 'b60', categoria: 'Bíblia', pergunta: 'Qual é o livro da Bíblia que fala sobre a criação do universo em 7 dias?', opcoes: ['Levítico','Êxodo','Gênesis','Números'], correta: 2 },

  // ── SANTOS (60 questions) ──
  { id: 's01', categoria: 'Santos', pergunta: 'Qual é a padroeira do Brasil?', opcoes: ['Nossa Senhora de Fátima','Nossa Senhora Aparecida','Nossa Senhora do Carmo','Nossa Senhora das Graças'], correta: 1 },
  { id: 's02', categoria: 'Santos', pergunta: 'Quem foi o primeiro Papa da Igreja Católica?', opcoes: ['São Paulo','São Pedro','São João','São Tiago'], correta: 1 },
  { id: 's03', categoria: 'Santos', pergunta: 'São Francisco de Assis é patrono de quê?', opcoes: ['Dos médicos','Dos animais e meio ambiente','Dos pobres','Dos guerreiros'], correta: 1 },
  { id: 's04', categoria: 'Santos', pergunta: 'Em qual cidade Nossa Senhora Aparecida foi encontrada?', opcoes: ['Aparecida do Norte','Guaratinguetá','Lorena','Pindamonhangaba'], correta: 0 },
  { id: 's05', categoria: 'Santos', pergunta: 'Qual é o nome do santo padroeiro dos casais e da família?', opcoes: ['São Valentim','São Joaquim','São José','São Francisco de Sales'], correta: 2 },
  { id: 's06', categoria: 'Santos', pergunta: 'Santa Teresa de Ávila é doutora da Igreja conhecida por seus escritos sobre:', opcoes: ['A liturgia','A vida mística e oração','A teologia moral','A história da Igreja'], correta: 1 },
  { id: 's07', categoria: 'Santos', pergunta: 'Qual é a data da festa de Nossa Senhora Aparecida?', opcoes: ['15 de agosto','12 de outubro','8 de setembro','13 de maio'], correta: 1 },
  { id: 's08', categoria: 'Santos', pergunta: 'São Tomás de Aquino é conhecido como o "Doutor" de quê?', opcoes: ['Doutor Angélico','Doutor Iluminado','Doutor Seráfico','Doutor Universal'], correta: 0 },
  { id: 's09', categoria: 'Santos', pergunta: 'Qual santa fundou as Missionárias da Caridade?', opcoes: ['Santa Teresa de Lisieux','Santa Faustina','Santa Teresa de Calcutá','Santa Clara'], correta: 2 },
  { id: 's10', categoria: 'Santos', pergunta: 'São Pedro é simbolizado pela chave. O que ela representa?', opcoes: ['A abertura do coração','As chaves do Reino dos Céus','A abertura da Bíblia','O poder temporal'], correta: 1 },
  { id: 's11', categoria: 'Santos', pergunta: 'Qual santo foi o primeiro mártir cristão, apedrejado pelos perseguidores?', opcoes: ['São Tiago','São Estêvão','São João','São Paulo'], correta: 1 },
  { id: 's12', categoria: 'Santos', pergunta: 'Nossa Senhora de Fátima apareceu a três pastorzinhos. Qual era o nome deles?', opcoes: ['Francisco, Jacinta e Lúcia','Pedro, Paulo e Ana','João, Lucas e Maria','Tomé, Filipe e Isabel'], correta: 0 },
  { id: 's13', categoria: 'Santos', pergunta: 'São Benedito de Núrsia é o fundador de qual ordem religiosa?', opcoes: ['Franciscana','Dominicana','Jesuíta','Beneditina'], correta: 3 },
  { id: 's14', categoria: 'Santos', pergunta: 'Qual é o dia de Todos os Santos?', opcoes: ['1 de novembro','2 de novembro','31 de outubro','15 de agosto'], correta: 0 },
  { id: 's15', categoria: 'Santos', pergunta: 'São Domingos de Gusmão fundou qual ordem religiosa?', opcoes: ['Carmelitas','Dominicanos','Agostinianos','Franciscanos'], correta: 1 },
  { id: 's16', categoria: 'Santos', pergunta: 'Qual santa recebeu os estigmas, sendo uma das poucas mulheres a recebê-los?', opcoes: ['Santa Clara','Santa Teresa de Lisieux','Santa Catarina de Sena','Santa Gema Galgani'], correta: 2 },
  { id: 's17', categoria: 'Santos', pergunta: 'São Jorge é padroeiro de qual país?', opcoes: ['França','Portugal','Espanha','Inglaterra'], correta: 3 },
  { id: 's18', categoria: 'Santos', pergunta: 'Qual santo é chamado de "o Curé d\'Ars" e é patrono dos sacerdotes?', opcoes: ['São Pio de Pietrelcina','São João Vianney','São Filipe Néri','São João Bosco'], correta: 1 },
  { id: 's19', categoria: 'Santos', pergunta: 'Santa Faustina Kowalska é conhecida por divulgar a devoção à:', opcoes: ['Divina Misericórdia','Sagrada Família','Imaculada Conceição','Nossa Senhora do Rosário'], correta: 0 },
  { id: 's20', categoria: 'Santos', pergunta: 'São Lucas é patrono dos médicos, mas qual era sua profissão?', opcoes: ['Pescador','Médico','Publicano','Carpinteiro'], correta: 1 },
  { id: 's21', categoria: 'Santos', pergunta: 'Qual santa é conhecida como "a Doutorinha" ou "a pequena flor"?', opcoes: ['Santa Teresa de Ávila','Santa Rosa de Lima','Santa Teresa de Lisieux','Santa Clara'], correta: 2 },
  { id: 's22', categoria: 'Santos', pergunta: 'São Pio de Pietrelcina (Padre Pio) é patrono de quê?', opcoes: ['Dos estudantes','Dos doentes e voluntários','Dos sacerdotes','Dos pobres'], correta: 1 },
  { id: 's23', categoria: 'Santos', pergunta: 'Qual é a padroeira dos músicos?', opcoes: ['Santa Inês','Santa Cecília','Santa Luzia','Santa Ágata'], correta: 1 },
  { id: 's24', categoria: 'Santos', pergunta: 'São Cristóvão é patrono dos:', opcoes: ['Viajantes e motoristas','Doentes','Pescadores','Professores'], correta: 0 },
  { id: 's25', categoria: 'Santos', pergunta: 'Qual santo italiano ajudou a reconstruir a Igreja e fundou os Franciscanos?', opcoes: ['Santo Antônio','São Domingos','São Francisco de Assis','São Bento'], correta: 2 },
  { id: 's26', categoria: 'Santos', pergunta: 'Nossa Senhora de Guadalupe apareceu a quem?', opcoes: ['Santa Bernadete','Juan Diego','São Francisco','Lúcia de Fátima'], correta: 1 },
  { id: 's27', categoria: 'Santos', pergunta: 'São João Paulo II foi Papa por quantos anos aproximadamente?', opcoes: ['16','20','27','33'], correta: 2 },
  { id: 's28', categoria: 'Santos', pergunta: 'Qual santa foi queimada viva na fogueira por traição na França?', opcoes: ['Santa Inês','Santa Joana d\'Arc','Santa Genoveva','Santa Isabel'], correta: 1 },
  { id: 's29', categoria: 'Santos', pergunta: 'Santo Antônio de Pádua nasceu em qual país?', opcoes: ['Itália','Espanha','Portugal','Brasil'], correta: 2 },
  { id: 's30', categoria: 'Santos', pergunta: 'Qual é o nome da santa conhecida como "Rosa do Peru", primeira santa da América?', opcoes: ['Santa Ana','Santa Isabel','Santa Rosa de Lima','Santa Margarida'], correta: 2 },
  { id: 's31', categoria: 'Santos', pergunta: 'São Mateus era qual profissão antes de seguir Jesus?', opcoes: ['Pescador','Carpinteiro','Cobrador de impostos','Escriba'], correta: 2 },
  { id: 's32', categoria: 'Santos', pergunta: 'Qual santa é padroeira da França e foi canonizada juntamente com o fundador dos Jesuítas?', opcoes: ['Santa Joana d\'Arc','Santa Genoveva','Santa Teresinha','Santa Margarida'], correta: 0 },
  { id: 's33', categoria: 'Santos', pergunta: 'São Inácio de Loyola fundou qual ordem religiosa?', opcoes: ['Dominicanos','Franciscanos','Jesuítas','Salesianos'], correta: 2 },
  { id: 's34', categoria: 'Santos', pergunta: 'Qual é o nome da santa que viu Nossa Senhora na gruta de Massabielle?', opcoes: ['Lúcia de Fátima','Bernadete Soubirous','Teresa de Lisieux','Faustina'], correta: 1 },
  { id: 's35', categoria: 'Santos', pergunta: 'São Miguel é um dos três arcanjos citados na Bíblia. Qual é sua missão?', opcoes: ['Cura dos doentes','Mensageiro de Deus','Capitão do exército celestial','Guardião das almas'], correta: 2 },
  { id: 's36', categoria: 'Santos', pergunta: 'Qual santo é patrono dos pobres, doentes e da cidade do Rio de Janeiro?', opcoes: ['São Sebastião','São Francisco','Santo Antônio','São Benedito'], correta: 0 },
  { id: 's37', categoria: 'Santos', pergunta: 'Santa Clara de Assis fundou qual ordem feminina?', opcoes: ['Clarissas (Ordem das Pobres Damas)','Dominicanas','Carmelitas Descalças','Beneditinas'], correta: 0 },
  { id: 's38', categoria: 'Santos', pergunta: 'Qual santo é conhecido como "o último dos apóstolos" por ter escrito o Apocalipse?', opcoes: ['São Paulo','São Pedro','São João Evangelista','São Tiago'], correta: 2 },
  { id: 's39', categoria: 'Santos', pergunta: 'São José Benedito foi o primeiro santo negro do Brasil, canonizado em:', opcoes: ['1985','1989','2013','2021'], correta: 1 },
  { id: 's40', categoria: 'Santos', pergunta: 'Qual foi o primeiro Papa americano?', opcoes: ['Bento XVI','João Paulo I','Francisco','João XXIII'], correta: 2 },
  { id: 's41', categoria: 'Santos', pergunta: 'Nossa Senhora do Perpétuo Socorro é venerada principalmente em qual basílica em Roma?', opcoes: ['Santa Maria Maggiore','São Pedro','Sant\'Alfonso','São João de Latrão'], correta: 2 },
  { id: 's42', categoria: 'Santos', pergunta: 'São João Bosco é patrono dos jovens e fundador dos:', opcoes: ['Jesuítas','Salesianos','Dominicanos','Lazaristas'], correta: 1 },
  { id: 's43', categoria: 'Santos', pergunta: 'Qual santo é representado com um lobo ao seu lado?', opcoes: ['São Roque','São Francisco de Assis','São Cristóvão','São Huberto'], correta: 1 },
  { id: 's44', categoria: 'Santos', pergunta: 'Santa Mônica é patrona das mães porque orou por quanto tempo pela conversão de seu filho Agostinho?', opcoes: ['5 anos','17 anos','32 anos','40 anos'], correta: 2 },
  { id: 's45', categoria: 'Santos', pergunta: 'São Rafael Arcanjo é o patrono de quais profissionais?', opcoes: ['Militares','Médicos, farmacêuticos e viajantes','Professores','Pescadores'], correta: 1 },
  { id: 's46', categoria: 'Santos', pergunta: 'Qual santa polonesa fundou a Congregação das Irmãs da Família de Maria?', opcoes: ['Santa Faustina','Santa Edith Stein','Santa Úrsula Ledóchowska','Santa Benigna'], correta: 2 },
  { id: 's47', categoria: 'Santos', pergunta: 'São Franscisco Xavier foi missionário em qual continente?', opcoes: ['África','América','Ásia','Europa'], correta: 2 },
  { id: 's48', categoria: 'Santos', pergunta: 'Qual é o nome do pai e da mãe de Nossa Senhora Maria?', opcoes: ['Eli e Ana','Joaquim e Ana','Zacarias e Isabel','José e Salomé'], correta: 1 },
  { id: 's49', categoria: 'Santos', pergunta: 'São Nicolau de Mira é a origem histórica de qual personagem popular?', opcoes: ['Papai Noel','Os Reis Magos','O Anjo Bom','O Cordeiro de Deus'], correta: 0 },
  { id: 's50', categoria: 'Santos', pergunta: 'Qual santa polonesa viveu no século XX e é conhecida pela "Mensagem da Misericórdia"?', opcoes: ['Edith Stein','Ursula Ledóchowska','Faustina Kowalska','Maria de Nazaret'], correta: 2 },
  { id: 's51', categoria: 'Santos', pergunta: 'São Luís Maria Grignion de Montfort é famoso pela sua devoção a:', opcoes: ['Jesus Eucarístico','Nossa Senhora','A Sagrada Família','São José'], correta: 1 },
  { id: 's52', categoria: 'Santos', pergunta: 'Qual santo é padroeiro da Espanha?', opcoes: ['São Pedro','São Paulo','São Tiago','São João'], correta: 2 },
  { id: 's53', categoria: 'Santos', pergunta: 'Santa Zélia Martin e Louis Martin, pais de Santa Teresinha, foram beatificados em:', opcoes: ['2000','2008','2015','2018'], correta: 1 },
  { id: 's54', categoria: 'Santos', pergunta: 'Qual santo foi decapitado a mando do rei Herodes?', opcoes: ['São Paulo','São Tiago','João Batista','São André'], correta: 2 },
  { id: 's55', categoria: 'Santos', pergunta: 'São Valentim é patrono dos namorados. Quando é seu dia?', opcoes: ['12 de fevereiro','14 de fevereiro','7 de junho','14 de julho'], correta: 1 },
  { id: 's56', categoria: 'Santos', pergunta: 'Qual santa italiana fundou as Filhas de Nossa Senhora do Sagrado Coração?', opcoes: ['Santa Bakhita','Santa Francisca Cabrini','Santa Ángela Merici','Santa Agostina Pietrantoni'], correta: 1 },
  { id: 's57', categoria: 'Santos', pergunta: 'São André é irmão de qual apóstolo?', opcoes: ['João','Tiago','Pedro','Filipe'], correta: 2 },
  { id: 's58', categoria: 'Santos', pergunta: 'Qual santa mártir cristã foi jogada aos leões no Coliseu de Roma?', opcoes: ['Santa Cecília','Santa Inês','Santa Perpétua','Santa Blandina'], correta: 2 },
  { id: 's59', categoria: 'Santos', pergunta: 'Beato Carlos de Foucauld viveu como ermitão em qual deserto?', opcoes: ['Deserto do Saara','Deserto do Sahel','Deserto do Atacama','Deserto da Judéia'], correta: 0 },
  { id: 's60', categoria: 'Santos', pergunta: 'São Bento de Núrsia escreveu uma famosa obra chamada:', opcoes: ['Suma Teológica','Regra de São Bento','Exercícios Espirituais','A Imitação de Cristo'], correta: 1 },

  // ── ECC (60 questions) ──
  { id: 'e01', categoria: 'ECC', pergunta: 'O que significa a sigla ECC?', opcoes: ['Encontro de Cristãos Casados','Encontro de Casais com Cristo','Encontro Cristão de Casais','Encontro de Católicos Casados'], correta: 1 },
  { id: 'e02', categoria: 'ECC', pergunta: 'O ECC é um movimento voltado para:', opcoes: ['Jovens solteiros','Famílias com filhos','Casais cristãos','Sacerdotes'], correta: 2 },
  { id: 'e03', categoria: 'ECC', pergunta: 'O ECC nasceu em qual país?', opcoes: ['Brasil','Espanha','Estados Unidos','Argentina'], correta: 0 },
  { id: 'e04', categoria: 'ECC', pergunta: 'O principal objetivo do ECC é:', opcoes: ['Organizar eventos sociais','Fortalecer o casamento à luz da fé cristã','Preparar casais para o divórcio','Fazer turismo religioso'], correta: 1 },
  { id: 'e05', categoria: 'ECC', pergunta: 'Como se chama o fim de semana de experiência vivido pelos casais no ECC?', opcoes: ['Semana de retiro','Encontro de casais','Retiro de casais','Weekend'], correta: 2 },
  { id: 'e06', categoria: 'ECC', pergunta: 'Qual é o lema do ECC?', opcoes: ['"Fé, esperança e caridade"','Ama e faz o que queres"','"Casais para Cristo, Cristo para os casais"','A família que ora unida permanece unida'], correta: 2 },
  { id: 'e07', categoria: 'ECC', pergunta: 'Como chamamos o casal que lidera um grupo do ECC?', opcoes: ['Casal palestrante','Casal membro','Casal dirigente','Casal coordenador'], correta: 2 },
  { id: 'e08', categoria: 'ECC', pergunta: 'No retiro do ECC, os casais se organizam em grupos chamados:', opcoes: ['Turmas','Círculos','Equipes','Ligas'], correta: 1 },
  { id: 'e09', categoria: 'ECC', pergunta: 'Quantos dias dura normalmente um retiro do ECC?', opcoes: ['1 dia','3 dias','5 dias','7 dias'], correta: 1 },
  { id: 'e10', categoria: 'ECC', pergunta: 'O ECC no Brasil está vinculado a qual organização internacional?', opcoes: ['RENEW International','Worldwide Marriage Encounter','Teams of Our Lady','Chemin Neuf'], correta: 1 },
  { id: 'e11', categoria: 'ECC', pergunta: 'O retiro do ECC começa normalmente em qual dia da semana?', opcoes: ['Segunda-feira','Quarta-feira','Sexta-feira','Domingo'], correta: 2 },
  { id: 'e12', categoria: 'ECC', pergunta: 'Qual sacramento é central na espiritualidade do ECC?', opcoes: ['Batismo','Eucaristia','Sacramento do Matrimônio','Confirmação'], correta: 2 },
  { id: 'e13', categoria: 'ECC', pergunta: 'O ECC incentiva os casais a rezar juntos. Qual oração é especialmente incentivada?', opcoes: ['Terço','Liturgia das Horas','Via Sacra','Novena de Pentecostes'], correta: 0 },
  { id: 'e14', categoria: 'ECC', pergunta: 'No ECC, o "diálogo de casal" é uma prática que tem como objetivo:', opcoes: ['Resolver conflitos judicialmente','Aprofundar a comunicação e intimidade do casal','Discutir finanças do lar','Planejar a catequese dos filhos'], correta: 1 },
  { id: 'e15', categoria: 'ECC', pergunta: 'Como se chama o movimento que antecedeu historicamente o ECC no Brasil?', opcoes: ['Cursilho de Cristandade','Focolares','Renovação Carismática','Legio Mariae'], correta: 0 },
  { id: 'e16', categoria: 'ECC', pergunta: 'Qual é a flor símbolo do ECC em algumas regionais?', opcoes: ['Rosa','Margarida','Girassol','Lírio'], correta: 1 },
  { id: 'e17', categoria: 'ECC', pergunta: 'No ECC, a "convivência" pós-retiro tem como finalidade:', opcoes: ['Fazer festas entre amigos','Manter a vivência do retiro no cotidiano','Angariar fundos para a paróquia','Recrutar novos membros'], correta: 1 },
  { id: 'e18', categoria: 'ECC', pergunta: 'O casal que apresenta os temas no retiro ECC é chamado de:', opcoes: ['Casal Animador','Casal Palestrante','Casal de Palco','Casal Testemunho'], correta: 1 },
  { id: 'e19', categoria: 'ECC', pergunta: 'Qual é o documento eclesial que mais fundamenta a espiritualidade do ECC?', opcoes: ['Lumen Gentium','Familiaris Consortio','Gaudium et Spes','Deus Caritas Est'], correta: 1 },
  { id: 'e20', categoria: 'ECC', pergunta: 'O ECC oferece um retiro específico para quais casais em crise?', opcoes: ['Weekend Retrospect','Retiro de Cura','Semana de Rekindling','Retiro de Reconciliação'], correta: 0 },
  { id: 'e21', categoria: 'ECC', pergunta: 'Qual é o papel do sacerdote ou diácono no retiro ECC?', opcoes: ['Presidir todas as palestras','Coordenar os círculos','Celebrar a Eucaristia e estar à disposição para confissões','Gerir a logística do retiro'], correta: 2 },
  { id: 'e22', categoria: 'ECC', pergunta: 'O ECC considera o casamento como:', opcoes: ['Um contrato social','Um sacramento que reflete o amor de Deus','Uma tradição cultural','Um acordo financeiro entre famílias'], correta: 1 },
  { id: 'e23', categoria: 'ECC', pergunta: 'No retiro ECC, o momento de silêncio e reflexão individual é chamado de:', opcoes: ['Lectio Divina','Oração pessoal','Estudo bíblico','Adoração ao Santíssimo'], correta: 1 },
  { id: 'e24', categoria: 'ECC', pergunta: 'O ECC é vinculado a qual segmento eclesial?', opcoes: ['Movimentos leigos','Vida consagrada','Clero secular','Ordens religiosas'], correta: 0 },
  { id: 'e25', categoria: 'ECC', pergunta: 'Qual é o nome do encontro pós-retiro para ex-participantes?', opcoes: ['Ultreya','Ágape','Koinonia','Metánoia'], correta: 0 },
  { id: 'e26', categoria: 'ECC', pergunta: 'O ECC acredita que o casamento é caminho de santidade. Isso significa:', opcoes: ['Só santos podem ser casados','O casal se santifica na vivência diária do amor conjugal','Casados não precisam de sacramentos','Casamento é igual ao sacerdócio'], correta: 1 },
  { id: 'e27', categoria: 'ECC', pergunta: 'Como se chama a equipe responsável pela logística e organização de um retiro ECC?', opcoes: ['Equipe de Serviço','Equipe de Missão','Equipe de Suporte','Equipe Administrativa'], correta: 0 },
  { id: 'e28', categoria: 'ECC', pergunta: 'O ECC trabalha a dimensão da fé do casal em qual aspecto específico?', opcoes: ['Fé individualista','Fé compartilhada a dois como casal','Fé intelectual teológica','Fé popular e devocional'], correta: 1 },
  { id: 'e29', categoria: 'ECC', pergunta: 'Qual é a cor associada ao ECC em muitas regionais brasileiras?', opcoes: ['Azul e branco','Verde e amarelo','Roxo e dourado','Vermelho e branco'], correta: 0 },
  { id: 'e30', categoria: 'ECC', pergunta: 'O ECC encoraja os casais a se reconciliarem por meio de qual sacramento?', opcoes: ['Batismo','Eucaristia','Unção dos Enfermos','Confissão/Reconciliação'], correta: 3 },
  { id: 'e31', categoria: 'ECC', pergunta: 'Qual é a proposta do ECC para os casais após o retiro?', opcoes: ['Fazer novos retiros todo ano','Viver o carisma no dia a dia e convidar outros casais','Somente participar de missas','Dedicar-se à caridade em obras sociais'], correta: 1 },
  { id: 'e32', categoria: 'ECC', pergunta: 'No ECC, "diálogo" entre o casal é praticado com que frequência ideal?', opcoes: ['Semanalmente','Diariamente','Mensalmente','Anualmente'], correta: 1 },
  { id: 'e33', categoria: 'ECC', pergunta: 'O ECC é reconhecido pela Igreja Católica como:', opcoes: ['Congregação religiosa','Movimento leigo de espiritualidade conjugal','Congregação de direito pontifício','Associação civil sem fins lucrativos'], correta: 1 },
  { id: 'e34', categoria: 'ECC', pergunta: 'Qual é o papel dos casais testemunho nas palestras do retiro?', opcoes: ['Ensinar teologia','Partilhar a experiência vivida do casal','Conduzir orações longas','Explicar o Catecismo'], correta: 1 },
  { id: 'e35', categoria: 'ECC', pergunta: 'O retiro ECC é normalmente realizado em regime de:', opcoes: ['Day use','Internato (totalmente afastado)','Semi-internato','Módulos semanais'], correta: 1 },
  { id: 'e36', categoria: 'ECC', pergunta: 'O ECC tem como um dos pilares a dimensão da:', opcoes: ['Riqueza material','Serviço e missão na comunidade','Separação do mundo','Vida contemplativa'], correta: 1 },
  { id: 'e37', categoria: 'ECC', pergunta: 'Os casais que participaram do ECC são chamados de:', opcoes: ['Egressos ECC','Casais de Cristo','Ex-retirantes','Casais do Encontro'], correta: 3 },
  { id: 'e38', categoria: 'ECC', pergunta: 'Qual é a dimensão do casamento que o ECC mais aprofunda?', opcoes: ['Jurídica e legal','Sacramental e espiritual','Econômica e social','Psicológica e terapêutica'], correta: 1 },
  { id: 'e39', categoria: 'ECC', pergunta: 'O ECC é aberto para casais de qual religião?', opcoes: ['Somente católicos','Somente cristãos','Cristãos de todas as denominações','Qualquer religião'], correta: 2 },
  { id: 'e40', categoria: 'ECC', pergunta: 'Como o ECC incentiva os casais a resolverem os conflitos?', opcoes: ['Evitando conversas difíceis','Com diálogo, perdão e amor','Buscando separação amigável','Pedindo conselho apenas ao sacerdote'], correta: 1 },
  { id: 'e41', categoria: 'ECC', pergunta: 'O ECC usa como símbolo central:', opcoes: ['Uma pomba','Um coração com cruz','Uma família','Uma aliança'], correta: 1 },
  { id: 'e42', categoria: 'ECC', pergunta: 'O ECC foi fundado originalmente na década de:', opcoes: ['1940','1950','1960','1970'], correta: 1 },
  { id: 'e43', categoria: 'ECC', pergunta: 'No ECC, a "Ceia" durante o retiro representa:', opcoes: ['Apenas uma refeição juntos','A Santa Ceia, memória da Última Ceia de Jesus','Uma confraternização informal','O pagamento da dívida do casal'], correta: 1 },
  { id: 'e44', categoria: 'ECC', pergunta: 'Qual é o papel dos filhos na espiritualidade do ECC?', opcoes: ['São excluídos do movimento','São frutos e prolongamento do amor do casal','Participam das mesmas atividades dos adultos','São responsáveis pela organização dos retiros'], correta: 1 },
  { id: 'e45', categoria: 'ECC', pergunta: 'O ECC baseia seu método em qual tipo de espiritualidade?', opcoes: ['Beneditina','Inaciana','Conjugal e leiga','Franciscana'], correta: 2 },
  { id: 'e46', categoria: 'ECC', pergunta: 'Qual é a missão do casal dirigente no ECC?', opcoes: ['Ministrar sacramentos','Liderar e animar a comunidade de casais','Substituir o sacerdote nas celebrações','Realizar missões ad gentes'], correta: 1 },
  { id: 'e47', categoria: 'ECC', pergunta: 'O ECC promove a renovação das promessas matrimoniais. Isso ocorre geralmente:', opcoes: ['Toda quinta-feira','Nas convivências e encontros comunitários','Somente no aniversário de casamento','Nunca, pois vale somente a primeira promessa'], correta: 1 },
  { id: 'e48', categoria: 'ECC', pergunta: 'Como o ECC vê a Eucaristia no retiro?', opcoes: ['Como um costume opcional','Como o ápice e fonte da vida do casal','Como apenas um rito simbólico','Como uma obrigação para os católicos'], correta: 1 },
  { id: 'e49', categoria: 'ECC', pergunta: 'O ECC no Brasil nasceu em qual estado?', opcoes: ['São Paulo','Minas Gerais','Rio de Janeiro','Bahia'], correta: 0 },
  { id: 'e50', categoria: 'ECC', pergunta: 'Qual é a forma principal de evangelização do casal do ECC?', opcoes: ['Pregações públicas','Missões na TV','O testemunho de vida do casal','Distribuição de panfletos'], correta: 2 },
  { id: 'e51', categoria: 'ECC', pergunta: 'O ECC incentiva o casal a redigir um documento pessoal chamado:', opcoes: ['Carta ao cônjuge','Contrato de aliança','Testamento espiritual','Voto renovado'], correta: 0 },
  { id: 'e52', categoria: 'ECC', pergunta: 'A "equipe de visitação" do ECC tem qual função?', opcoes: ['Visitar os doentes da paróquia','Acompanhar casais em crise','Visitar outros movimentos eclesiais','Visitar missões no exterior'], correta: 1 },
  { id: 'e53', categoria: 'ECC', pergunta: 'No contexto do ECC, "conviver" significa:', opcoes: ['Morar juntos sem ser casado','Participar ativamente da comunidade ECC','Viajar juntos','Partilhar as finanças do casal'], correta: 1 },
  { id: 'e54', categoria: 'ECC', pergunta: 'O ECC é coordenado em cada diocese por:', opcoes: ['O bispo diocesano','Uma junta de padres','Um casal dirigente diocesano','Um conselho de leigos'], correta: 2 },
  { id: 'e55', categoria: 'ECC', pergunta: 'No retiro ECC, o momento de adoração eucarística serve para:', opcoes: ['Substituir a missa','Aprofundar a relação do casal com Jesus na Eucaristia','Treinar o ministério extraordinário','Estudar a Bíblia em grupo'], correta: 1 },
  { id: 'e56', categoria: 'ECC', pergunta: 'A oração do rosário no ECC é incentivada porque:', opcoes: ['É uma tradição cultural','Une o casal na contemplação dos mistérios de Cristo e Maria','É obrigatória para católicos','Substitui a leitura bíblica'], correta: 1 },
  { id: 'e57', categoria: 'ECC', pergunta: 'O ECC considera o lar do casal como:', opcoes: ['Um espaço privado sem dimensão eclesial','Igreja doméstica','Um lugar de passagem','Apenas um espaço social'], correta: 1 },
  { id: 'e58', categoria: 'ECC', pergunta: 'O retiro ECC termina normalmente em qual dia?', opcoes: ['Sábado à tarde','Domingo após o almoço','Domingo à noite','Segunda-feira cedo'], correta: 1 },
  { id: 'e59', categoria: 'ECC', pergunta: 'O ECC prepara casais para serem agentes de:', opcoes: ['Política paroquial','Evangelização e serviço à família','Formação para o sacerdócio','Vida monástica'], correta: 1 },
  { id: 'e60', categoria: 'ECC', pergunta: 'O ECC é fruto de qual espiritualidade que nasceu no século XX na Espanha?', opcoes: ['Espiritualidade dos Cursilhos de Cristandade','Espiritualidade Inaciana','Espiritualidade Beneditina','Espiritualidade Focolarina'], correta: 0 },

  // ── DOCUMENTOS (60 questions) ──
  { id: 'd01', categoria: 'Documentos', pergunta: 'Qual documento da Igreja trata sobre a família?', opcoes: ['Lumen Gentium','Familiaris Consortio','Gaudium et Spes','Dei Verbum'], correta: 1 },
  { id: 'd02', categoria: 'Documentos', pergunta: 'O Concílio Vaticano II aconteceu entre os anos:', opcoes: ['1950-1955','1962-1965','1958-1961','1965-1970'], correta: 1 },
  { id: 'd03', categoria: 'Documentos', pergunta: 'Qual encíclica de João Paulo II trata da dignidade e vocação da mulher?', opcoes: ['Mulieris Dignitatem','Veritatis Splendor','Evangelium Vitae','Redemptoris Mater'], correta: 0 },
  { id: 'd04', categoria: 'Documentos', pergunta: 'A Lumen Gentium é o documento do Vaticano II que trata sobre:', opcoes: ['A liturgia','A natureza da Igreja','O apostolado dos leigos','As missões'], correta: 1 },
  { id: 'd05', categoria: 'Documentos', pergunta: '"Gaudium et Spes" significa:', opcoes: ['"Alegria e Esperança"','\"Luz das Nações\"','\"A Palavra de Deus\"','\"Dos Bispos da Igreja\"'], correta: 0 },
  { id: 'd06', categoria: 'Documentos', pergunta: 'A Sacrosanctum Concilium trata sobre:', opcoes: ['A família cristã','A sagrada liturgia','O ecumenismo','As missões'], correta: 1 },
  { id: 'd07', categoria: 'Documentos', pergunta: 'O Catecismo da Igreja Católica foi publicado em qual ano?', opcoes: ['1985','1990','1992','2000'], correta: 2 },
  { id: 'd08', categoria: 'Documentos', pergunta: 'Qual Papa promulgou a "Familiaris Consortio" em 1981?', opcoes: ['Pio XII','João XXIII','Paulo VI','João Paulo II'], correta: 3 },
  { id: 'd09', categoria: 'Documentos', pergunta: 'O documento "Amoris Laetitia" (2016) trata sobre:', opcoes: ['A guerra e a paz','O amor na família','A liturgia renovada','A nova evangelização'], correta: 1 },
  { id: 'd10', categoria: 'Documentos', pergunta: 'Qual Papa assinou a "Amoris Laetitia"?', opcoes: ['Bento XVI','João Paulo II','Francisco','João Paulo I'], correta: 2 },
  { id: 'd11', categoria: 'Documentos', pergunta: 'A "Dei Verbum" do Vaticano II trata sobre:', opcoes: ['A palavra de Deus — Escritura e Tradição','A Igreja no mundo','O sacerdócio','Os leigos'], correta: 0 },
  { id: 'd12', categoria: 'Documentos', pergunta: 'A "Humanae Vitae" de Paulo VI (1968) aborda qual tema?', opcoes: ['A regulação da natalidade','A ecologia','A paz mundial','A missão ad gentes'], correta: 0 },
  { id: 'd13', categoria: 'Documentos', pergunta: 'O Sínodo sobre a Família de 2014-2015 produziu qual documento final?', opcoes: ['Laudato Si','Querida Amazônia','Amoris Laetitia','Evangelii Gaudium'], correta: 2 },
  { id: 'd14', categoria: 'Documentos', pergunta: 'A "Laudato Si" (2015) de Papa Francisco aborda qual tema?', opcoes: ['A família','O cuidado da casa comum — ecologia','A nova evangelização','A pobreza'], correta: 1 },
  { id: 'd15', categoria: 'Documentos', pergunta: 'O Apostolicam Actuositatem trata sobre:', opcoes: ['O apostolado dos leigos','A liturgia','A formação sacerdotal','O ecumenismo'], correta: 0 },
  { id: 'd16', categoria: 'Documentos', pergunta: 'Qual encíclica social de Leão XIII (1891) é considerada a "Carta Magna" da Doutrina Social da Igreja?', opcoes: ['Quadragesimo Anno','Rerum Novarum','Mater et Magistra','Laborem Exercens'], correta: 1 },
  { id: 'd17', categoria: 'Documentos', pergunta: 'A "Evangelii Gaudium" (2013) de Papa Francisco é uma exortação sobre:', opcoes: ['A alegria do evangelho e a nova evangelização','A família e o matrimônio','A ecologia integral','A misericórdia divina'], correta: 0 },
  { id: 'd18', categoria: 'Documentos', pergunta: '"Misericordiae Vultus" foi o documento de proclamação do:', opcoes: ['Ano da Fé','Jubileu da Misericórdia','Ano Mariano','Ano da Família'], correta: 1 },
  { id: 'd19', categoria: 'Documentos', pergunta: 'A Declaração Nostra Aetate trata sobre:', opcoes: ['A liturgia','As relações com as religiões não-cristãs','A Bíblia','As missões'], correta: 1 },
  { id: 'd20', categoria: 'Documentos', pergunta: 'O Decreto Ad Gentes trata sobre:', opcoes: ['Os leigos','A atividade missionária da Igreja','O sacerdócio','A liturgia'], correta: 1 },
  { id: 'd21', categoria: 'Documentos', pergunta: 'Quantos documentos foram produzidos no Concílio Vaticano II?', opcoes: ['8','12','16','20'], correta: 2 },
  { id: 'd22', categoria: 'Documentos', pergunta: 'Qual é o nome do código de leis da Igreja Católica?', opcoes: ['Direito Canônico','Catecismo da Igreja','Corpus Juris','Codex Iuris Canonici'], correta: 3 },
  { id: 'd23', categoria: 'Documentos', pergunta: 'A "Christifideles Laici" de João Paulo II trata sobre:', opcoes: ['Os bispos','A vocação e missão dos leigos','A vida consagrada','Os diáconos'], correta: 1 },
  { id: 'd24', categoria: 'Documentos', pergunta: 'A "Redemptor Hominis" foi a primeira encíclica de qual Papa?', opcoes: ['Paulo VI','João Paulo I','João Paulo II','Bento XVI'], correta: 2 },
  { id: 'd25', categoria: 'Documentos', pergunta: 'O documento "Deus Caritas Est" (2006) de Bento XVI trata sobre:', opcoes: ['A justiça social','O amor — Deus é amor','A criação','A salvação'], correta: 1 },
  { id: 'd26', categoria: 'Documentos', pergunta: '"Caritas in Veritate" (2009) de Bento XVI aborda:', opcoes: ['O amor e a verdade no desenvolvimento humano','A ecologia','A família','A morte e ressurreição'], correta: 0 },
  { id: 'd27', categoria: 'Documentos', pergunta: 'O "Diretório para o Ministério e Vida dos Diáconos Permanentes" foi emitido por qual congregação?', opcoes: ['Congregação para o Clero','Congregação para os Bispos','Congregação para a Doutrina da Fé','Secretaria de Estado'], correta: 0 },
  { id: 'd28', categoria: 'Documentos', pergunta: 'A Encíclica "Evangelium Vitae" (1995) trata sobre:', opcoes: ['A família','O valor e a inviolabilidade da vida humana','A paz mundial','O ecumenismo'], correta: 1 },
  { id: 'd29', categoria: 'Documentos', pergunta: 'O Decreto Unitatis Redintegratio trata sobre:', opcoes: ['As missões','O ecumenismo','Os leigos','A liturgia'], correta: 1 },
  { id: 'd30', categoria: 'Documentos', pergunta: 'Qual documento conciliar trata da formação dos sacerdotes?', opcoes: ['Presbyterorum Ordinis','Optatam Totius','Perfectae Caritatis','Gravissimum Educationis'], correta: 1 },
  { id: 'd31', categoria: 'Documentos', pergunta: 'A "Fides et Ratio" de João Paulo II trata sobre:', opcoes: ['A relação entre fé e razão','A moral sexual','A política','A liturgia'], correta: 0 },
  { id: 'd32', categoria: 'Documentos', pergunta: 'Qual documento tridentino unificou a missa em latim por séculos?', opcoes: ['Bula Unam Sanctam','Missale Romanum de Pio V','Bula Exsurge Domine','Constitutio de Liturgia'], correta: 1 },
  { id: 'd33', categoria: 'Documentos', pergunta: 'A "Querida Amazônia" (2020) de Papa Francisco é uma exortação sobre:', opcoes: ['A Amazônia e a Igreja na região','A ecologia global','As missões na Ásia','O diaconato feminino'], correta: 0 },
  { id: 'd34', categoria: 'Documentos', pergunta: 'A "Laudate Deum" (2023) é uma continuação de qual documento?', opcoes: ['Amoris Laetitia','Evangelii Gaudium','Laudato Si','Fratelli Tutti'], correta: 2 },
  { id: 'd35', categoria: 'Documentos', pergunta: '"Fratelli Tutti" (2020) de Papa Francisco aborda:', opcoes: ['A fraternidade universal e a amizade social','A família','A liturgia','A criação'], correta: 0 },
  { id: 'd36', categoria: 'Documentos', pergunta: 'O Código de Direito Canônico atual foi reformado em qual ano?', opcoes: ['1960','1971','1983','1992'], correta: 2 },
  { id: 'd37', categoria: 'Documentos', pergunta: 'A "Veritatis Splendor" de João Paulo II trata sobre:', opcoes: ['A verdade na moral cristã','A criação','A família','A liturgia'], correta: 0 },
  { id: 'd38', categoria: 'Documentos', pergunta: 'O Diretório Homilético (2014) é um documento sobre:', opcoes: ['A pregação e a homilia','Os sacramentos','A formação dos leigos','A oração litúrgica'], correta: 0 },
  { id: 'd39', categoria: 'Documentos', pergunta: 'Qual Sínodo dos Bispos gerou o documento "Palavra de Deus" (Verbum Domini, 2010)?', opcoes: ['Sínodo sobre os Leigos','Sínodo sobre a Família','Sínodo sobre a Palavra de Deus','Sínodo sobre a Eucaristia'], correta: 2 },
  { id: 'd40', categoria: 'Documentos', pergunta: '"Sacramentum Caritatis" de Bento XVI trata sobre qual sacramento?', opcoes: ['Batismo','Confirmação','Eucaristia','Matrimônio'], correta: 2 },
  { id: 'd41', categoria: 'Documentos', pergunta: 'A Bula "Misericordiae Vultus" foi proclamada para anunciar o:', opcoes: ['Ano do Jubileu Ordinário','Jubileu Extraordinário da Misericórdia 2015-2016','Ano Mariano','Ano da Fé'], correta: 1 },
  { id: 'd42', categoria: 'Documentos', pergunta: 'A "Populorum Progressio" de Paulo VI (1967) aborda:', opcoes: ['O desenvolvimento integral dos povos','A família','A liturgia','O sacerdócio'], correta: 0 },
  { id: 'd43', categoria: 'Documentos', pergunta: 'Qual Concílio definiu o cânon completo da Bíblia Católica?', opcoes: ['Concílio de Trento','Concílio de Nicéia','Vaticano I','Vaticano II'], correta: 0 },
  { id: 'd44', categoria: 'Documentos', pergunta: 'O "Diretório Geral para a Catequese" (1997) é um documento sobre:', opcoes: ['A missa','A transmissão da fé pela catequese','A liturgia dos sacramentos','A vida consagrada'], correta: 1 },
  { id: 'd45', categoria: 'Documentos', pergunta: '"Presbyterorum Ordinis" é um decreto do Vaticano II sobre:', opcoes: ['Os bispos','O ministério e vida dos sacerdotes','Os diáconos','Os leigos'], correta: 1 },
  { id: 'd46', categoria: 'Documentos', pergunta: 'A "Inter Mirifica" do Vaticano II trata sobre:', opcoes: ['Os meios de comunicação social','A liturgia','As missões','A escola católica'], correta: 0 },
  { id: 'd47', categoria: 'Documentos', pergunta: '"Lumen Fidei" (2013) foi assinada por qual Papa?', opcoes: ['Bento XVI','João Paulo II','Francisco','João XXIII'], correta: 2 },
  { id: 'd48', categoria: 'Documentos', pergunta: 'A "Christus Dominus" do Vaticano II trata sobre:', opcoes: ['O ofício pastoral dos bispos','O clero paroquial','Os leigos','Os seminários'], correta: 0 },
  { id: 'd49', categoria: 'Documentos', pergunta: 'O "Compêndio da Doutrina Social da Igreja" foi publicado em:', opcoes: ['1995','2000','2004','2010'], correta: 2 },
  { id: 'd50', categoria: 'Documentos', pergunta: 'Qual encíclica de João XXIII ficou conhecida como "Encíclica da Paz"?', opcoes: ['Mater et Magistra','Pacem in Terris','Gaudium et Spes','Populorum Progressio'], correta: 1 },
  { id: 'd51', categoria: 'Documentos', pergunta: 'A "Perfectae Caritatis" do Vaticano II trata sobre:', opcoes: ['A renovação da vida religiosa','Os leigos','A liturgia','Os sacerdotes'], correta: 0 },
  { id: 'd52', categoria: 'Documentos', pergunta: 'Qual é o documento da Igreja sobre a educação cristã dos jovens?', opcoes: ['Gravissimum Educationis','Christifideles Laici','Gaudium et Spes','Lumen Gentium'], correta: 0 },
  { id: 'd53', categoria: 'Documentos', pergunta: 'O "Exsultet" é um texto proclamado durante qual celebração litúrgica?', opcoes: ['Missa de Natal','Vigília Pascal','Corpus Christi','Pentecostes'], correta: 1 },
  { id: 'd54', categoria: 'Documentos', pergunta: 'Qual é o documento que define a "Teologia do Corpo" de João Paulo II?', opcoes: ['Uma série de catequeses (1979-1984)','Familiaris Consortio','Amor e Responsabilidade','Mulieris Dignitatem'], correta: 0 },
  { id: 'd55', categoria: 'Documentos', pergunta: '"Sacrosanctum Concilium" foi o primeiro documento aprovado no:', opcoes: ['Vaticano I','Concílio de Trento','Vaticano II','Concílio de Nicéia'], correta: 2 },
  { id: 'd56', categoria: 'Documentos', pergunta: 'A "Dignitatis Humanae" do Vaticano II trata sobre:', opcoes: ['A liberdade religiosa','A liturgia','O matrimônio','O sacerdócio'], correta: 0 },
  { id: 'd57', categoria: 'Documentos', pergunta: 'O documento "Ecclesia in America" (1999) de João Paulo II é sobre:', opcoes: ['A Igreja na América','A ecologia','A pobreza no terceiro mundo','A paz'], correta: 0 },
  { id: 'd58', categoria: 'Documentos', pergunta: 'O "Directoire de Pastorale Familiale" é utilizado para a pastoral de quê?', opcoes: ['Da liturgia','Da família','Dos jovens','Dos doentes'], correta: 1 },
  { id: 'd59', categoria: 'Documentos', pergunta: '"Redemptoris Missio" (1990) de João Paulo II trata sobre:', opcoes: ['A missão do Redentor','A vida contemplativa','A Eucaristia','Os pobres'], correta: 0 },
  { id: 'd60', categoria: 'Documentos', pergunta: 'Qual encíclica de Pio XI (1930) tratou sobre o matrimônio cristão antes da "Familiaris Consortio"?', opcoes: ['Rerum Novarum','Casti Connubii','Humane Vitae','Matrimonii Sacramentum'], correta: 1 },

  // ── CATECISMO (60 questions) ──
  { id: 'c01', categoria: 'Catecismo', pergunta: 'Quantos Sacramentos tem a Igreja Católica?', opcoes: ['5','6','7','8'], correta: 2 },
  { id: 'c02', categoria: 'Catecismo', pergunta: 'Qual é o primeiro Mandamento de Deus?', opcoes: ['Honra teu pai e tua mãe','Não matarás','Não terás outros deuses diante de Mim','Não darás falso testemunho'], correta: 2 },
  { id: 'c03', categoria: 'Catecismo', pergunta: 'Qual é o sacramento que nos incorpora à Igreja?', opcoes: ['Confirmação','Eucaristia','Batismo','Ordem'], correta: 2 },
  { id: 'c04', categoria: 'Catecismo', pergunta: 'Quais são os três sacramentos de iniciação cristã?', opcoes: ['Batismo, Eucaristia e Matrimônio','Batismo, Confirmação e Eucaristia','Confirmação, Penitência e Eucaristia','Batismo, Penitência e Ordem'], correta: 1 },
  { id: 'c05', categoria: 'Catecismo', pergunta: 'Qual é o nome da graça que nos é dada no Batismo para resistir ao pecado?', opcoes: ['Graça santificante','Graça sacramental','Graça atual','Graça grátis data'], correta: 0 },
  { id: 'c06', categoria: 'Catecismo', pergunta: 'O sacramento da Confirmação fortalece quais dons?', opcoes: ['Os dons dos frutos do Espírito','Os sete dons do Espírito Santo','As oito bem-aventuranças','Os mandamentos da Igreja'], correta: 1 },
  { id: 'c07', categoria: 'Catecismo', pergunta: 'Qual é o nome do pecado que separa completamente a alma de Deus?', opcoes: ['Pecado venial','Pecado capital','Pecado mortal','Pecado original'], correta: 2 },
  { id: 'c08', categoria: 'Catecismo', pergunta: 'Quais são os pecados capitais? Marque a lista correta:', opcoes: ['Soberba, avareza, inveja, ira, gula, preguiça, luxúria','Mentira, roubo, adultério, cobiça, ódio, inveja, orgulho','Blasfêmia, idolatria, soberba, ira, gula, preguiça, luxúria','Vaidade, orgulho, ira, luxúria, inveja, avareza, gula'], correta: 0 },
  { id: 'c09', categoria: 'Catecismo', pergunta: 'Qual é o nome do estado de purificação após a morte?', opcoes: ['Paraíso','Limbo','Purgatório','Inferno'], correta: 2 },
  { id: 'c10', categoria: 'Catecismo', pergunta: 'A Trindade Santa é composta por:', opcoes: ['Pai, Filho e Espírito Santo','Pai, Mãe e Filho','Jesus, Maria e José','Criador, Redentor e Santificador'], correta: 0 },
  { id: 'c11', categoria: 'Catecismo', pergunta: 'Qual é o nome do ato pelo qual Deus criou o mundo do nada?', opcoes: ['Criação ex natura','Criação ex nihilo','Criação ex Deo','Criação continua'], correta: 1 },
  { id: 'c12', categoria: 'Catecismo', pergunta: 'Qual é o nome da virtude que dispõe a crer em tudo que Deus revelou?', opcoes: ['Esperança','Caridade','Fé','Prudência'], correta: 2 },
  { id: 'c13', categoria: 'Catecismo', pergunta: 'Quantas virtudes teologais existem?', opcoes: ['2','3','4','7'], correta: 1 },
  { id: 'c14', categoria: 'Catecismo', pergunta: 'Quais são as quatro virtudes cardeais?', opcoes: ['Fé, Esperança, Caridade, Prudência','Prudência, Justiça, Fortaleza, Temperança','Humildade, Paciência, Caridade, Obediência','Fé, Humildade, Paciência, Fortaleza'], correta: 1 },
  { id: 'c15', categoria: 'Catecismo', pergunta: 'O pecado original é herdado de quem?', opcoes: ['Caim e Abel','Adão e Eva','Noé','Moisés'], correta: 1 },
  { id: 'c16', categoria: 'Catecismo', pergunta: 'Na Eucaristia, o pão e o vinho se tornam o corpo e sangue de Cristo. Como se chama essa transformação?', opcoes: ['Consubstanciação','Epifania','Transubstanciação','Transignificação'], correta: 2 },
  { id: 'c17', categoria: 'Catecismo', pergunta: 'Quantos Mandamentos da Igreja (preceitos) existem?', opcoes: ['3','5','7','10'], correta: 1 },
  { id: 'c18', categoria: 'Catecismo', pergunta: 'Qual é o sinal externo do sacramento do Batismo?', opcoes: ['A imposição das mãos','A imersão ou infusão de água','A unção com crisma','A entrega de uma vela'], correta: 1 },
  { id: 'c19', categoria: 'Catecismo', pergunta: 'Qual é o nome do ato de Deus pelo qual Ele cuida de todas as criaturas?', opcoes: ['Redenção','Santificação','Providência','Criação'], correta: 2 },
  { id: 'c20', categoria: 'Catecismo', pergunta: 'Qual é o nome da oração ensinada pelo próprio Jesus?', opcoes: ['Ave Maria','Salve Rainha','Pai Nosso','Glória'], correta: 2 },
  { id: 'c21', categoria: 'Catecismo', pergunta: 'O sacramento do Matrimônio é ministrado por quem?', opcoes: ['Pelo bispo','Pelo sacerdote','Pelos próprios cônjuges','Pelo diácono'], correta: 2 },
  { id: 'c22', categoria: 'Catecismo', pergunta: 'Qual é o nome da ressurreição final de todos os mortos?', opcoes: ['Parousia','Ressurreição dos corpos','Última Sentença','Juízo Final'], correta: 1 },
  { id: 'c23', categoria: 'Catecismo', pergunta: 'Qual é a diferença entre pecado mortal e venial?', opcoes: ['Não há diferença','O venial rompe completamente com Deus; o mortal é leve','O mortal rompe completamente com Deus; o venial enfraquece a relação','O venial não precisa de perdão'], correta: 2 },
  { id: 'c24', categoria: 'Catecismo', pergunta: 'Qual é o nome do dom que nos permite ver Deus face a face no céu?', opcoes: ['Graça santificante','Visão beatífica','Dom da sabedoria','Dom da profecia'], correta: 1 },
  { id: 'c25', categoria: 'Catecismo', pergunta: 'O Espírito Santo desce sobre os apóstolos em qual festa?', opcoes: ['Natal','Páscoa','Pentecostes','Ascensão'], correta: 2 },
  { id: 'c26', categoria: 'Catecismo', pergunta: 'Qual é o nome do sacramento que cura o pecado pós-batismal?', opcoes: ['Eucaristia','Unção dos Enfermos','Confissão/Penitência','Confirmação'], correta: 2 },
  { id: 'c27', categoria: 'Catecismo', pergunta: 'Quantos artigos tem o Credo Apostólico (Símbolo dos Apóstolos)?', opcoes: ['7','10','12','14'], correta: 2 },
  { id: 'c28', categoria: 'Catecismo', pergunta: 'Qual é o nome do pecado que consiste em adorar outros deuses ou ídolos?', opcoes: ['Blasfêmia','Idolatria','Heresia','Apostasia'], correta: 1 },
  { id: 'c29', categoria: 'Catecismo', pergunta: 'A ressurreição de Jesus ocorreu em qual dia?', opcoes: ['Sexta-feira','Sábado','Domingo','Segunda-feira'], correta: 2 },
  { id: 'c30', categoria: 'Catecismo', pergunta: 'Qual é o nome da profissão de fé recitada na missa?', opcoes: ['Confiteor','Credo','Kyrie','Gloria'], correta: 1 },
  { id: 'c31', categoria: 'Catecismo', pergunta: 'O sacramento da Unção dos Enfermos é destinado a:', opcoes: ['Somente aos que estão à morte','Doentes graves e idosos em situação de risco','Qualquer pecador','Somente sacerdotes doentes'], correta: 1 },
  { id: 'c32', categoria: 'Catecismo', pergunta: 'Qual é o nome do primeiro grau da Ordem Sagrada?', opcoes: ['Episcopado','Presbiterado','Diaconado','Subdiaconado'], correta: 2 },
  { id: 'c33', categoria: 'Catecismo', pergunta: 'Qual é o sinal externo do sacramento da Confirmação?', opcoes: ['Imersão em água','Imposição das mãos e unção com crisma','Entrega do pão bento','Leitura do Evangelho'], correta: 1 },
  { id: 'c34', categoria: 'Catecismo', pergunta: 'Qual é o nome do estado final onde a alma goza plenamente de Deus?', opcoes: ['Purgatório','Limbo','Paraíso/Céu','Juízo'], correta: 2 },
  { id: 'c35', categoria: 'Catecismo', pergunta: 'O que é a graça atual?', opcoes: ['A graça recebida no Batismo','Uma ajuda transitória de Deus para agir bem','A plenitude da graça no céu','O estado de graça permanente'], correta: 1 },
  { id: 'c36', categoria: 'Catecismo', pergunta: 'Qual é o nome da parte da missa em que são proclamadas as leituras bíblicas?', opcoes: ['Liturgia da Eucaristia','Liturgia da Palavra','Ritos Iniciais','Ritos de Comunhão'], correta: 1 },
  { id: 'c37', categoria: 'Catecismo', pergunta: 'Qual é o nome da oração que acompanha cada dezena do terço?', opcoes: ['Pai Nosso','Ave Maria','Glória','Fátima'], correta: 1 },
  { id: 'c38', categoria: 'Catecismo', pergunta: 'O que significa "Amen" em hebraico?', opcoes: ['"Louvado seja Deus"','"Assim seja" ou "É verdade"','"Santificado seja o teu nome"','"Venha o teu reino"'], correta: 1 },
  { id: 'c39', categoria: 'Catecismo', pergunta: 'Qual é o nome do pecado de usar o nome de Deus em vão ou de forma desrespeitosa?', opcoes: ['Apostasia','Heresia','Blasfêmia','Idolatria'], correta: 2 },
  { id: 'c40', categoria: 'Catecismo', pergunta: 'Qual é o nome do dom do Espírito Santo que nos torna "participantes da natureza divina"?', opcoes: ['Dom de conselho','Dom de sabedoria','Dom de ciência','Graça divinizante'], correta: 3 },
  { id: 'c41', categoria: 'Catecismo', pergunta: 'Qual é o Mandamento que nos obriga a guardar o domingo como dia do Senhor?', opcoes: ['1º Mandamento','3º Mandamento','4º Mandamento','5º Mandamento'], correta: 1 },
  { id: 'c42', categoria: 'Catecismo', pergunta: 'O que é o "Juízo Particular"?', opcoes: ['O julgamento de toda a humanidade no fim dos tempos','O julgamento de cada alma imediatamente após a morte','O tribunal da Inquisição','A avaliação dos papas'], correta: 1 },
  { id: 'c43', categoria: 'Catecismo', pergunta: 'Qual é o nome da doutrina que afirma que Maria não teve pecado original?', opcoes: ['Assunção de Maria','Imaculada Conceição','Virgindade de Maria','Maternidade Divina'], correta: 1 },
  { id: 'c44', categoria: 'Catecismo', pergunta: 'O dogma da Assunção de Maria foi proclamado em qual ano?', opcoes: ['1854','1870','1950','1965'], correta: 2 },
  { id: 'c45', categoria: 'Catecismo', pergunta: 'Qual é o nome do preceito dominical?', opcoes: ['Participar da Missa todos os dias','Participar da Missa nos domingos e festas de preceito','Rezar o rosário todo domingo','Fazer jejum todo domingo'], correta: 1 },
  { id: 'c46', categoria: 'Catecismo', pergunta: 'Qual é o nome da crença de que o Papa, quando ensina solenemente matéria de fé e costumes, é preservado do erro?', opcoes: ['Magistério ordinário','Infalibilidade papal','Autoridade papal','Infusão do Espírito Santo'], correta: 1 },
  { id: 'c47', categoria: 'Catecismo', pergunta: 'Quais são as três pessoas da Santíssima Trindade?', opcoes: ['Pai, Filho e Espírito Santo','Deus, Jesus e Maria','Criador, Redentor e Espírito','Pai, Verbo e Paracleto'], correta: 0 },
  { id: 'c48', categoria: 'Catecismo', pergunta: 'O que é a "contrição"?', opcoes: ['Uma oração antes da missa','O arrependimento sincero dos pecados cometidos','A absolvição sacramental','Uma penitência imposta pelo confessor'], correta: 1 },
  { id: 'c49', categoria: 'Catecismo', pergunta: 'Qual é o nome do rito pelo qual se removem o pecado original e se recebe a graça da filiação divina?', opcoes: ['Confirmação','Batismo','Eucaristia','Penitência'], correta: 1 },
  { id: 'c50', categoria: 'Catecismo', pergunta: 'Quantos dons do Espírito Santo existem?', opcoes: ['5','7','9','12'], correta: 1 },
  { id: 'c51', categoria: 'Catecismo', pergunta: 'O que é a "Parousia"?', opcoes: ['A segunda vinda de Cristo em glória','A primeira vinda de Cristo no Natal','O julgamento dos mortos','A ascensão de Jesus'], correta: 0 },
  { id: 'c52', categoria: 'Catecismo', pergunta: 'Qual é o nome do pecado que consiste em abandonar completamente a fé cristã?', opcoes: ['Heresia','Cisma','Apostasia','Blasfêmia'], correta: 2 },
  { id: 'c53', categoria: 'Catecismo', pergunta: 'O que é a "comunhão dos santos"?', opcoes: ['A missa solene de santos','A união entre os fiéis na terra, almas no purgatório e santos no céu','A festa de Todos os Santos','Os sacramentos dos santos'], correta: 1 },
  { id: 'c54', categoria: 'Catecismo', pergunta: 'Qual é o nome do sacramento que fortalece os fiéis com o dom do Espírito Santo?', opcoes: ['Batismo','Eucaristia','Confirmação','Ordem'], correta: 2 },
  { id: 'c55', categoria: 'Catecismo', pergunta: 'O que é o "kérygma"?', opcoes: ['Um rito batismal','O anúncio fundamental do Evangelho: Jesus morreu e ressuscitou','Um hino litúrgico','Uma forma de penitência'], correta: 1 },
  { id: 'c56', categoria: 'Catecismo', pergunta: 'Qual é o nome da heresia que nega a divindade de Jesus?', opcoes: ['Gnosticismo','Pelagianismo','Arianismo','Nestorianismo'], correta: 2 },
  { id: 'c57', categoria: 'Catecismo', pergunta: 'Quantos frutos do Espírito Santo o Catecismo enumera?', opcoes: ['7','9','12','14'], correta: 2 },
  { id: 'c58', categoria: 'Catecismo', pergunta: 'O que é a "indulgência"?', opcoes: ['O perdão dos pecados no sacramento da confissão','A remissão da pena temporal devida pelos pecados já perdoados','Uma licença para pecar','Um pagamento à Igreja'], correta: 1 },
  { id: 'c59', categoria: 'Catecismo', pergunta: 'Qual é o nome do ato de amor a Deus acima de tudo e ao próximo como a si mesmo?', opcoes: ['Fé','Esperança','Caridade','Prudência'], correta: 2 },
  { id: 'c60', categoria: 'Catecismo', pergunta: 'Qual é o nome do jejum eucarístico exigido antes de receber a comunhão?', opcoes: ['Jejum natural de 3 horas','Jejum de 1 hora antes da comunhão','Jejum do dia inteiro','Jejum de 30 minutos'], correta: 1 },
];

/* ===================================================
   QUIZ — STORAGE & STATE
   =================================================== */

const STORAGE_KEY_QUIZ = 'ecc_quiz_data';

function getQuizData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUIZ);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveQuizData(data) {
  try {
    localStorage.setItem(STORAGE_KEY_QUIZ, JSON.stringify(data));
  } catch (e) {}
}

function getMesAtual() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function getTodayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function initQuizData() {
  const today = getTodayStr();
  const mes   = getMesAtual();
  let data = getQuizData();
  if (!data) {
    data = { date: today, answered_today: 0, total_score: 0, total_answered: 0, history: [], mes };
  }
  // Reset daily counter if new day
  if (data.date !== today) {
    data.date = today;
    data.answered_today = 0;
  }
  // Reset monthly score if new month
  if (data.mes !== mes) {
    data.mes = mes;
    data.total_score = 0;
    data.total_answered = 0;
    data.history = [];
  }
  return data;
}

/* ===================================================
   QUIZ — QUESTION SELECTION
   =================================================== */

function selectDailyQuestions(data) {
  const allIds = QUIZ_QUESTIONS.map((q) => q.id);
  const available = allIds.filter((id) => !data.history.includes(id));
  // When pool exhausted, reset history so questions cycle again
  if (available.length < 10) {
    data.history = [];
    const shuffled = allIds.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 10).map((id) => QUIZ_QUESTIONS.find((q) => q.id === id));
  }
  const shuffled = available.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 10).map((id) => QUIZ_QUESTIONS.find((q) => q.id === id));
}

/* ===================================================
   QUIZ — SHEETS HELPERS
   =================================================== */

async function salvarQuizScoreNoSheets(scoreData) {
  return _postParaSheets({ acao: 'salvarQuizScore', score: scoreData });
}

async function listarQuizRankingDoSheets(mes) {
  try {
    const url = `${SCRIPT_URL}?acao=listarQuizRanking&mes=${encodeURIComponent(mes)}`;
    const res  = await fetch(url, { redirect: 'follow' });
    const data = await res.json();
    return data.ok && Array.isArray(data.ranking) ? data.ranking : [];
  } catch (e) {
    console.warn('Erro ao listar ranking quiz:', e);
    return [];
  }
}

/* ===================================================
   QUIZ — RENDER RANKING
   =================================================== */

async function renderQuizRanking() {
  const container = $('quiz-ranking-list');
  if (!container) return;
  container.innerHTML = '<p class="msg-vazio visivel">Carregando ranking...</p>';
  const ranking = await listarQuizRankingDoSheets(getMesAtual());
  if (!ranking.length) {
    container.innerHTML = '<p class="msg-vazio visivel">Nenhum dado de ranking disponível ainda.</p>';
    return;
  }
  const medals = ['🥇','🥈','🥉'];
  container.innerHTML = ranking.map((item, i) => {
    const pos = i < 3 ? `<span class="quiz-ranking-pos top${i+1}">${medals[i]}</span>` : `<span class="quiz-ranking-pos">${i+1}°</span>`;
    return `<div class="quiz-ranking-item">
      ${pos}
      <span class="quiz-ranking-nome">${esc(item.login)}</span>
      <span class="quiz-ranking-pts">${item.pontuacao} pts</span>
    </div>`;
  }).join('');
}

/* ===================================================
   QUIZ — MAIN LOGIC
   =================================================== */

let quizSession = null;

function initQuizUI() {
  const quizArea = $('quiz-area');
  if (!quizArea) return;

  updateQuizStatusInfo();
  renderQuizRanking();

  const btnIniciar = $('btn-iniciar-quiz');
  const btnProxima = $('btn-proxima');
  const btnVerRanking = $('btn-ver-ranking');
  const btnVoltar  = $('btn-quiz-voltar');

  if (btnIniciar) {
    btnIniciar.addEventListener('click', () => {
      const data = initQuizData();
      if (data.answered_today >= 10) {
        alert('Você já respondeu suas 10 perguntas de hoje! Volte amanhã.');
        return;
      }
      const questions = selectDailyQuestions(data);
      quizSession = { questions, current: 0, score: 0, data };
      showQuizIntro(false);
      showQuizQuestion();
    });
  }

  if (btnProxima) {
    btnProxima.addEventListener('click', () => {
      quizSession.current++;
      if (quizSession.current < quizSession.questions.length) {
        showQuizQuestion();
      } else {
        endQuizSession();
      }
    });
  }

  if (btnVerRanking) {
    btnVerRanking.addEventListener('click', () => {
      renderQuizRanking();
      const rankArea = $('quiz-ranking-area');
      if (rankArea) rankArea.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (btnVoltar) {
    btnVoltar.addEventListener('click', () => {
      showQuizIntro(true);
      updateQuizStatusInfo();
    });
  }
}

function showQuizIntro(show) {
  const intro    = $('quiz-intro');
  const qArea    = $('quiz-question-area');
  const rArea    = $('quiz-result-area');
  if (intro)  intro.hidden  = !show;
  if (qArea)  qArea.hidden  = show;
  if (rArea)  rArea.hidden  = true;
}

function showQuizQuestion() {
  const q      = quizSession.questions[quizSession.current];
  const total  = quizSession.questions.length;
  const current = quizSession.current + 1;

  const intro = $('quiz-intro');
  const qArea = $('quiz-question-area');
  const rArea = $('quiz-result-area');
  if (intro) intro.hidden = true;
  if (qArea) qArea.hidden = false;
  if (rArea) rArea.hidden = true;

  const progressBar = $('quiz-progress-bar');
  if (progressBar) progressBar.style.width = ((current - 1) / total * 100) + '%';

  const counter = $('quiz-counter');
  if (counter) counter.textContent = `Pergunta ${current} de ${total}`;

  const scoreLive = $('quiz-score-live');
  if (scoreLive) scoreLive.textContent = `Pontos: ${quizSession.score}`;

  const catBadge = $('quiz-category-badge');
  if (catBadge) catBadge.textContent = q.categoria;

  const pergunta = $('quiz-pergunta');
  if (pergunta) pergunta.textContent = q.pergunta;

  const opcoesEl = $('quiz-opcoes');
  if (opcoesEl) {
    opcoesEl.innerHTML = q.opcoes.map((op, i) => `
      <button class="quiz-opcao" data-idx="${i}">${esc(op)}</button>
    `).join('');
    opcoesEl.querySelectorAll('.quiz-opcao').forEach((btn) => {
      btn.addEventListener('click', () => handleAnswer(parseInt(btn.dataset.idx, 10)));
    });
  }

  const feedback = $('quiz-feedback');
  if (feedback) { feedback.hidden = true; feedback.className = 'quiz-feedback'; }

  const btnProxima = $('btn-proxima');
  if (btnProxima) btnProxima.hidden = true;
}

function handleAnswer(idx) {
  const q = quizSession.questions[quizSession.current];
  const opcoesEl = $('quiz-opcoes');
  const feedback  = $('quiz-feedback');
  const btnProxima = $('btn-proxima');
  const isCorreta = idx === q.correta;

  opcoesEl.querySelectorAll('.quiz-opcao').forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correta) btn.classList.add('correta');
    if (i === idx && !isCorreta) btn.classList.add('errada');
  });

  if (isCorreta) {
    quizSession.score += 10;
    if (feedback) {
      feedback.textContent = '✅ Correto! +10 pontos';
      feedback.className = 'quiz-feedback certo';
      feedback.hidden = false;
    }
  } else {
    if (feedback) {
      feedback.textContent = `❌ Errado! A resposta certa era: "${q.opcoes[q.correta]}"`;
      feedback.className = 'quiz-feedback errado';
      feedback.hidden = false;
    }
  }

  const scoreLive = $('quiz-score-live');
  if (scoreLive) scoreLive.textContent = `Pontos: ${quizSession.score}`;

  if (btnProxima) {
    const isLast = quizSession.current + 1 >= quizSession.questions.length;
    btnProxima.textContent = isLast ? 'Ver Resultado 🏁' : 'Próxima →';
    btnProxima.hidden = false;
  }
}

function endQuizSession() {
  const data = quizSession.data;
  data.answered_today = (data.answered_today || 0) + quizSession.questions.length;
  data.total_score    = (data.total_score || 0)    + quizSession.score;
  data.total_answered = (data.total_answered || 0) + quizSession.questions.length;
  data.history        = [...(data.history || []), ...quizSession.questions.map((q) => q.id)];
  saveQuizData(data);

  const qArea = $('quiz-question-area');
  const rArea = $('quiz-result-area');
  const intro = $('quiz-intro');
  if (qArea) qArea.hidden = true;
  if (intro) intro.hidden = true;
  if (rArea) rArea.hidden = false;

  const score = quizSession.score;
  const total = quizSession.questions.length;
  const pct   = score / (total * 10) * 100;
  const icon  = pct >= 80 ? '🏆' : pct >= 50 ? '🎯' : '📚';
  const title = pct >= 80 ? 'Excelente!' : pct >= 50 ? 'Bom trabalho!' : 'Continue estudando!';

  const resultIcon  = $('quiz-result-icon');
  const resultTitle = $('quiz-result-title');
  const resultText  = $('quiz-result-text');
  const resultPontos = $('quiz-result-pontos');

  if (resultIcon)  resultIcon.textContent  = icon;
  if (resultTitle) resultTitle.textContent = title;
  if (resultText)  resultText.textContent  = `Você acertou ${score / 10} de ${total} perguntas.`;
  if (resultPontos) resultPontos.textContent = `${score} pontos`;

  // Save score to Sheets
  const nomeLogado = sessionStorage.getItem('ecc_casal_nome') || 'Anônimo';
  salvarQuizScoreNoSheets({
    login: nomeLogado,
    pontuacao: data.total_score,
    totalRespondidas: data.total_answered,
    mes: getMesAtual(),
  }).catch(() => {});

  renderQuizRanking();
}

function updateQuizStatusInfo() {
  const el = $('quiz-status-info');
  if (!el) return;
  const data = initQuizData();
  const restantes = Math.max(0, 10 - (data.answered_today || 0));
  if (restantes === 0) {
    el.textContent = '✅ Você já completou as 10 perguntas de hoje! Volte amanhã.';
  } else {
    el.textContent = `📊 Score do mês: ${data.total_score || 0} pts | Restantes hoje: ${restantes}/10`;
  }
  const btnIniciar = $('btn-iniciar-quiz');
  if (btnIniciar) btnIniciar.disabled = restantes === 0;
}

// Init quiz if on index.html
if ($('tab-quiz')) initQuizUI();

/* ===================================================
   QUIZ RANKING DOWNLOAD (Admin — Tab 3)
   =================================================== */

const btnBaixarRankingQuiz = $('btn-baixar-ranking-quiz');
if (btnBaixarRankingQuiz) {
  btnBaixarRankingQuiz.addEventListener('click', async () => {
    btnBaixarRankingQuiz.disabled = true;
    btnBaixarRankingQuiz.textContent = '⏳ Carregando...';
    const mes = getMesAtual();
    const ranking = await listarQuizRankingDoSheets(mes).catch(() => []);
    btnBaixarRankingQuiz.disabled = false;
    btnBaixarRankingQuiz.textContent = '📄 Baixar Ranking PDF';

    const win = window.open('', '_blank');
    if (!win) { alert('Popup bloqueado. Libere popups para este site.'); return; }
    const medals = ['🥇','🥈','🥉'];
    const rows = ranking.map((item, i) => `
      <tr>
        <td style="text-align:center;font-size:1.2rem;">${i < 3 ? medals[i] : (i+1)+'°'}</td>
        <td>${esc(String(item.login || ''))}</td>
        <td style="text-align:center;font-weight:700;color:#7b2d8b;">${Number(item.pontuacao) || 0}</td>
        <td style="text-align:center;">${Number(item.totalRespondidas) || 0}</td>
      </tr>`).join('');
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>Ranking Quiz ECC — ${mes}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 2rem; max-width: 700px; margin: 0 auto; }
        h1 { color: #5a1f68; text-align: center; }
        p.sub { text-align: center; color: #666; margin-bottom: 1.5rem; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #5a1f68; color: #fff; padding: 0.75rem; text-align: left; }
        td { padding: 0.65rem 0.75rem; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) { background: #f9fafb; }
        tr:first-child td { background: #fff8ec; }
      </style>
    </head><body>
      <h1>🏆 Ranking do Quiz ECC</h1>
      <p class="sub">Mês: ${mes} | Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
      <table>
        <thead><tr><th>#</th><th>Casal</th><th>Pontuação</th><th>Respondidas</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" style="text-align:center">Nenhum dado</td></tr>'}</tbody>
      </table>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  });
}

/* ===================================================
   BOT / HOMILIAS — API HELPERS
   =================================================== */

async function listarVideosDoBot() {
  try {
    const res  = await fetch(`${BOT_URL}/listar-videos`);
    const data = await res.json();
    return data.ok && Array.isArray(data.videos) ? data.videos : [];
  } catch (e) {
    console.warn('Erro ao listar vídeos do bot:', e);
    return [];
  }
}

async function enviarHomiliaParaBot(titulo, texto, imagemBase64) {
  try {
    const res = await fetch(`${BOT_URL}/nova-homilia`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ titulo, texto, imagem: imagemBase64 || '' }),
    });
    return await res.json();
  } catch (e) {
    console.warn('Erro ao enviar homilia:', e);
    return { erro: String(e) };
  }
}

/* ===================================================
   HOMILIAS — RENDER (Public — index.html)
   =================================================== */

function renderVideoCard(v) {
  return `
    <div class="comunicado-card">
      <div class="comunicado-card-body">
        <span class="comunicado-card-date">📅 ${esc(v.data)}</span>
        <div class="comunicado-card-title">🎬 ${esc(v.titulo)}</div>
      </div>
      <div class="comunicado-card-footer">
        <video controls style="width:100%;border-radius:8px;max-height:220px;" preload="none">
          <source src="${esc(v.url)}" type="video/mp4" />
          Seu navegador não suporta vídeos HTML5.
        </video>
      </div>
    </div>`;
}

async function renderVideosPub() {
  const container = $('lista-videos-pub');
  if (!container) return;
  container.innerHTML = '<p class="msg-vazio visivel">Carregando vídeos...</p>';
  const videos = await listarVideosDoBot();
  if (!videos.length) {
    container.innerHTML = '<p class="msg-vazio visivel">Nenhum vídeo disponível no momento.</p>';
    return;
  }
  container.innerHTML = videos.map(renderVideoCard).join('');
}

if ($('lista-videos-pub')) renderVideosPub();

/* ===================================================
   HOMILIAS — RENDER (Admin — admin.html)
   =================================================== */

async function renderVideosAdmin() {
  const container = $('lista-videos-admin');
  if (!container) return;
  container.innerHTML = '<p class="msg-vazio visivel">Carregando...</p>';
  const videos = await listarVideosDoBot();
  if (!videos.length) {
    container.innerHTML = '<p class="msg-vazio visivel">Nenhum vídeo gerado ainda.</p>';
    return;
  }
  container.innerHTML = videos.map((v) => `
    <div class="comunicado-admin-item">
      <div class="comunicado-admin-thumb" style="background:var(--brand-light);display:flex;align-items:center;justify-content:center;font-size:1.8rem;border-radius:8px;">🎬</div>
      <div class="comunicado-admin-info">
        <div class="comunicado-admin-title">${esc(v.titulo)}</div>
        <div class="comunicado-admin-meta">📅 ${esc(v.data)}</div>
        <div class="comunicado-admin-desc">
          <a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">▶ Assistir</a>
        </div>
      </div>
    </div>`).join('');
}

const btnAtualizarVideos = $('btn-atualizar-videos');
if (btnAtualizarVideos) {
  btnAtualizarVideos.addEventListener('click', () => renderVideosAdmin());
}

if ($('lista-videos-admin')) renderVideosAdmin();

/* ===================================================
   HOMILIAS — ADMIN FORM (admin.html)
   =================================================== */

const formHomilia   = $('form-homilia');
const homImgInput   = $('hom-imagem');
const homPreview    = $('hom-preview');
const homMsg        = $('hom-msg');

function _setHomMsg(msg, tipo) {
  if (!homMsg) return;
  homMsg.textContent = msg;
  homMsg.className = 'sheets-msg msg-' + tipo;
  homMsg.removeAttribute('hidden');
  if (tipo !== 'loading') setTimeout(() => homMsg.setAttribute('hidden', ''), 5000);
}

if (homImgInput) {
  homImgInput.addEventListener('change', () => {
    const file = homImgInput.files[0];
    if (!file || !homPreview) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      homPreview.innerHTML = `<img src="${ev.target.result}" alt="Preview" />`;
    };
    reader.readAsDataURL(file);
  });
}

if (formHomilia) {
  formHomilia.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = ($('hom-titulo') || {}).value?.trim() || '';
    const texto  = ($('hom-texto')  || {}).value?.trim() || '';
    if (!titulo) { alert('Informe o título.'); return; }
    if (!texto)  { alert('Informe o texto.'); return; }

    _setHomMsg('Enviando para o robô...', 'loading');

    let imagemBase64 = '';
    if (homImgInput && homImgInput.files[0]) {
      imagemBase64 = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = (ev) => res(ev.target.result);
        reader.onerror = () => res('');
        reader.readAsDataURL(homImgInput.files[0]);
      });
    }

    const resp = await enviarHomiliaParaBot(titulo, texto, imagemBase64);
    if (resp && !resp.erro) {
      _setHomMsg('✅ Enviado! O robô irá gerar o vídeo em breve.', 'ok');
      formHomilia.reset();
      if (homPreview) homPreview.innerHTML = '';
      setTimeout(() => renderVideosAdmin(), 3000);
    } else {
      _setHomMsg('❌ Erro: ' + (resp.erro || 'Verifique se o robô está rodando na VPS.'), 'erro');
    }
  });
}
