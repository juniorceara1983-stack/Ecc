/**
 * ECC – Encontro de Casais com Cristo
 * Application Logic
 */

'use strict';

/* ===================================================
   CONSTANTS
   =================================================== */

const PASTAS = [
  'Liturgia',
  'Secretaria',
  'Cozinha',
  'Acolhida',
  'Animação',
  'Decoração',
  'Finanças',
  'Espaço Físico',
  'Comunicação',
  'Enfermagem',
  'Transporte',
  'Louvor',
  'Coordenação Geral',
];

const STORAGE_KEY     = 'ecc_casais';
const SENHA_KEY       = 'ecc_dir_senha';
const SENHA_PADRAO    = 'ecc2024';

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
  } catch {
    // Ignore storage errors gracefully
  }
}

function carregar() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    casais = raw ? JSON.parse(raw) : [];
  } catch {
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
   DOM REFERENCES
   =================================================== */

const $   = (id) => document.getElementById(id);
const $qs = (sel, root = document) => root.querySelector(sel);

// Login overlays
const overlayEccLogin  = $('overlay-ecc-login');
const formEccLogin     = $('form-ecc-login');
const eccLoginNome     = $('ecc-login-nome');
const eccWelcomeMsg    = $('ecc-welcome-msg');
const eccNomeLogado    = $('ecc-nome-logado');

const overlayDirLogin  = $('overlay-dir-login');
const formDirLogin     = $('form-dir-login');
const dirLoginSenha    = $('dir-login-senha');
const dirLoginErro     = $('dir-login-erro');
const btnVoltarEcc     = $('btn-voltar-ecc');

// Tabs
const tabBtns   = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

// ECC Panel
const tbodyEcc      = $('tbody-casais');
const msgVazioEcc   = $('msg-vazio');
const btnNovoCasal  = $('btn-novo-casal');
const btnOracoes    = $('btn-oracoes');

// Dirigente Panel
const tbodyDir         = $('tbody-dirigente');
const msgVazioDir      = $('msg-vazio-dir');
const btnAddCasalDir   = $('btn-add-casal-dir');
const buscarNomeInput  = $('busca-nome');
const buscarAnoInput   = $('busca-ano');
const btnBuscar        = $('btn-buscar');
const btnLimparBusca   = $('btn-limpar-busca');
const btnFiltrarPerfil = $('btn-filtrar-perfil');
const btnLimparPerfil  = $('btn-limpar-perfil');
const btnAplicarPastas = $('btn-aplicar-pastas');
const labelFiltroAtivo = $('label-filtro-ativo');
const btnLogoutDir     = $('btn-logout-dir');
const formMudarSenha   = $('form-mudar-senha');
const senhaAtualInput  = $('senha-atual');
const senhaNoveInput   = $('senha-nova');
const mudarSenhaMsg    = $('mudar-senha-msg');

// Modal cadastro
const modalCadastro  = $('modal-cadastro');
const btnFecharModal = $('btn-fechar-modal');
const btnCancelar    = $('btn-cancelar');
const btnSalvar      = $('btn-salvar');
const formCasal      = $('form-casal');

// Modal visualização
const modalVisualizar = $('modal-visualizar');
const btnFecharView   = $('btn-fechar-view');
const btnFecharView2  = $('btn-fechar-view2');
const viewBody        = $('view-body');

// Modal orações
const modalOracoes      = $('modal-oracoes');
const btnFecharOracoes  = $('btn-fechar-oracoes');
const btnFecharOracoes2 = $('btn-fechar-oracoes2');

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
   ECC LOGIN
   =================================================== */

function mostrarEccLogin() {
  overlayEccLogin.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
}

function ocultarEccLogin() {
  overlayEccLogin.setAttribute('hidden', '');
  document.body.style.overflow = '';
}

formEccLogin.addEventListener('submit', (e) => {
  e.preventDefault();
  const nome = eccLoginNome.value.trim();
  if (!nome) return;

  // Show welcome message briefly then hide overlay
  eccWelcomeMsg.textContent = `Bem-vindo(a), ${nome}! Que Deus abençoe o seu casal. ✝`;
  eccWelcomeMsg.removeAttribute('hidden');
  formEccLogin.hidden = true;

  setEccLogado(nome);
  eccNomeLogado.textContent = `Olá, ${nome}!`;

  setTimeout(() => {
    ocultarEccLogin();
    eccWelcomeMsg.setAttribute('hidden', '');
    formEccLogin.hidden = false;
  }, 2200);
});

/* ===================================================
   DIRIGENTE LOGIN
   =================================================== */

function mostrarDirLogin() {
  overlayDirLogin.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  dirLoginErro.setAttribute('hidden', '');
  dirLoginSenha.value = '';
  dirLoginSenha.focus();
}

function ocultarDirLogin() {
  overlayDirLogin.setAttribute('hidden', '');
  document.body.style.overflow = '';
}

formDirLogin.addEventListener('submit', (e) => {
  e.preventDefault();
  const senha = dirLoginSenha.value;
  if (senha === getSenha()) {
    setDirLogado();
    ocultarDirLogin();
    ativarTab('dirigente');
  } else {
    dirLoginErro.removeAttribute('hidden');
    dirLoginSenha.value = '';
    dirLoginSenha.focus();
  }
});

btnVoltarEcc.addEventListener('click', () => {
  ocultarDirLogin();
  ativarTab('ecc');
});

btnLogoutDir.addEventListener('click', () => {
  logoutDir();
  ativarTab('ecc');
});

/* ===================================================
   MUDAR SENHA
   =================================================== */

formMudarSenha.addEventListener('submit', (e) => {
  e.preventDefault();
  const atual = senhaAtualInput.value;
  const nova  = senhaNoveInput.value.trim();

  mudarSenhaMsg.className = 'mudar-senha-msg';
  mudarSenhaMsg.removeAttribute('hidden');

  if (atual !== getSenha()) {
    mudarSenhaMsg.textContent = 'Senha atual incorreta.';
    mudarSenhaMsg.classList.add('msg-erro');
    return;
  }
  if (!nova || nova.length < 8) {
    mudarSenhaMsg.textContent = 'A nova senha deve ter pelo menos 8 caracteres.';
    mudarSenhaMsg.classList.add('msg-erro');
    return;
  }

  setSenha(nova);
  mudarSenhaMsg.textContent = 'Senha alterada com sucesso!';
  mudarSenhaMsg.classList.add('msg-ok');
  senhaAtualInput.value = '';
  senhaNoveInput.value  = '';

  setTimeout(() => {
    mudarSenhaMsg.setAttribute('hidden', '');
  }, 3000);
});

/* ===================================================
   TABS
   =================================================== */

function ativarTab(tabId) {
  tabBtns.forEach((b) => b.classList.remove('active'));
  tabPanels.forEach((p) => p.classList.remove('active'));
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');
  const panel = $(`tab-${tabId}`);
  if (panel) panel.classList.add('active');
}

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab === 'dirigente' && !isDirLogado()) {
      mostrarDirLogin();
      return;
    }
    ativarTab(tab);
  });
});

/* ===================================================
   POPULATE CHECKBOX GROUPS
   =================================================== */

function buildCheckboxGroup(containerId, pastas, prefix, singleSelect = false) {
  const el = $(containerId);
  el.innerHTML = '';
  pastas.forEach((pasta) => {
    const id = `${prefix}-${pasta.replace(/\s+/g, '-').toLowerCase()}`;
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

// Build static groups
buildCheckboxGroup('filtro-pastas', PASTAS, 'fpasta');

/* ===================================================
   MODAL HELPERS
   =================================================== */

function abrirModal(modal) {
  modal.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
}

function fecharModal(modal) {
  modal.setAttribute('hidden', '');
  document.body.style.overflow = '';
}

[modalCadastro, modalVisualizar, modalOracoes].forEach((m) => {
  m.addEventListener('click', (e) => {
    if (e.target === m) fecharModal(m);
  });
});

btnFecharModal.addEventListener('click', () => fecharModal(modalCadastro));
btnCancelar.addEventListener('click', () => fecharModal(modalCadastro));
btnFecharView.addEventListener('click', () => fecharModal(modalVisualizar));
btnFecharView2.addEventListener('click', () => fecharModal(modalVisualizar));
btnFecharOracoes.addEventListener('click', () => fecharModal(modalOracoes));
btnFecharOracoes2.addEventListener('click', () => fecharModal(modalOracoes));
btnOracoes.addEventListener('click', () => abrirModal(modalOracoes));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!modalCadastro.hidden)   fecharModal(modalCadastro);
    if (!modalVisualizar.hidden) fecharModal(modalVisualizar);
    if (!modalOracoes.hidden)    fecharModal(modalOracoes);
  }
});

/* ===================================================
   PHOTO HELPERS
   =================================================== */

function lerFoto(inputEl, previewEl) {
  return new Promise((resolve) => {
    const file = inputEl.files && inputEl.files[0];
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
  previewEl.innerHTML = '';
  if (!dataUrl) return;
  const img = document.createElement('img');
  img.className = 'foto-avatar';
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
      $('secao-ja-serviu').hidden   = !jaServiu;
      $('secao-nunca-serviu').hidden = jaServiu;
      if (!jaServiu) {
        document.querySelectorAll('input[name="foi-coord"]').forEach((r) => r.checked = false);
        document.querySelectorAll('input[name="foi-dirigente"]').forEach((r) => r.checked = false);
        $('secao-coord').hidden     = true;
        $('secao-dirigente').hidden = true;
      }
    });
  });

  document.querySelectorAll('input[name="foi-coord"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      $('secao-coord').hidden = radio.value !== 'sim';
    });
  });

  document.querySelectorAll('input[name="foi-dirigente"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      $('secao-dirigente').hidden = radio.value !== 'sim';
    });
  });
}

/* ===================================================
   FORM RESET & POPULATE
   =================================================== */

function resetForm() {
  formCasal.reset();
  $('casal-id').value = '';
  $('secao-ja-serviu').hidden    = true;
  $('secao-nunca-serviu').hidden = true;
  $('secao-coord').hidden        = true;
  $('secao-dirigente').hidden    = true;

  $('preview-esposo').innerHTML = '';
  $('preview-esposa').innerHTML = '';

  buildCheckboxGroup('pastas-servidas',    PASTAS, 'pserv');
  buildCheckboxGroup('pastas-coordenadas', PASTAS, 'pcoord');
  buildCheckboxGroup('pasta-dirigente',    PASTAS, 'pdir', true);
  buildCheckboxGroup('pastas-gostaria',    PASTAS, 'pgost');

  configurarSecoesCond();
  $('modal-titulo').textContent = 'Cadastro de Casal';
}

function popularForm(casal) {
  $('modal-titulo').textContent = 'Editar Casal';
  $('casal-id').value = casal.id;

  // Names (new fields, with backward-compat fallback)
  $('campo-nome-esposo').value = casal.nomeEsposo || '';
  $('campo-nome-esposa').value = casal.nomeEsposa || '';

  // Phones
  $('campo-tel-esposo').value = casal.telEsposo || '';
  $('campo-tel-esposa').value = casal.telEsposa || '';

  $('campo-endereco').value   = casal.endereco  || '';
  $('campo-ano-retiro').value = casal.anoRetiro || '';

  // Restore photos
  if (casal.fotoEsposo) mostrarPreview($('preview-esposo'), casal.fotoEsposo);
  if (casal.fotoEsposa) mostrarPreview($('preview-esposa'), casal.fotoEsposa);

  // Serviu radio
  if (casal.jaServiu !== null && casal.jaServiu !== undefined) {
    const val = casal.jaServiu ? 'sim' : 'nao';
    const radio = document.querySelector(`input[name="serviu"][value="${val}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    }
  }

  if (casal.jaServiu) {
    (casal.pastasServidas || []).forEach((pasta) => {
      const cb = document.querySelector(`#pastas-servidas input[value="${pasta}"]`);
      if (cb) cb.checked = true;
    });

    if (casal.jaFoiCoordenador !== null && casal.jaFoiCoordenador !== undefined) {
      const val = casal.jaFoiCoordenador ? 'sim' : 'nao';
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
      const val = casal.jaFoiDirigente ? 'sim' : 'nao';
      const radio = document.querySelector(`input[name="foi-dirigente"][value="${val}"]`);
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
    }
    if (casal.jaFoiDirigente) {
      $('campo-ano-dirigente').value = casal.anoDirigente || '';
      const rb = document.querySelector(`#pasta-dirigente input[value="${casal.pastaDirigente}"]`);
      if (rb) rb.checked = true;
    }

    $('campo-pastoral').value = casal.participaPastoral || '';
  } else if (casal.jaServiu === false) {
    (casal.gostariaDeServir || []).forEach((pasta) => {
      const cb = document.querySelector(`#pastas-gostaria input[value="${pasta}"]`);
      if (cb) cb.checked = true;
    });
  }
}

/* ===================================================
   COLLECT FORM DATA
   =================================================== */

async function coletarFormData() {
  const nomeEsposo = $('campo-nome-esposo').value.trim();
  const nomeEsposa = $('campo-nome-esposa').value.trim();
  if (!nomeEsposo && !nomeEsposa) {
    alert('Por favor, informe pelo menos o nome de um dos cônjuges.');
    return null;
  }

  const anoRetiro = parseInt($('campo-ano-retiro').value, 10);
  if (isNaN(anoRetiro) || anoRetiro <= 0) {
    alert('Por favor, informe o ano do retiro.');
    return null;
  }

  const serviuRadio = document.querySelector('input[name="serviu"]:checked');
  if (!serviuRadio) {
    alert('Por favor, indique se o casal já serviu no retiro.');
    return null;
  }

  const jaServiu = serviuRadio.value === 'sim';

  // Read photos (keep existing if file not changed)
  const existingId = $('casal-id').value;
  const existing   = existingId ? casais.find((c) => c.id === existingId) : null;

  const fotoEsposo = await lerFoto($('foto-esposo'), $('preview-esposo'))
    || (existing && existing.fotoEsposo ? existing.fotoEsposo : null);
  const fotoEsposa = await lerFoto($('foto-esposa'), $('preview-esposa'))
    || (existing && existing.fotoEsposa ? existing.fotoEsposa : null);

  const casal = {
    id:          existingId || gerarId(),
    nomeEsposo,
    nomeEsposa,
    // computed for backward compat display
    nomes:       [nomeEsposo, nomeEsposa].filter(Boolean).join(' & '),
    telEsposo:   $('campo-tel-esposo').value.trim(),
    telEsposa:   $('campo-tel-esposa').value.trim(),
    contato:     [$('campo-tel-esposo').value.trim(), $('campo-tel-esposa').value.trim()].filter(Boolean).join(' / '),
    endereco:    $('campo-endereco').value.trim(),
    anoRetiro,
    jaServiu,
    fotoEsposo,
    fotoEsposa,
  };

  if (jaServiu) {
    casal.pastasServidas = Array.from(
      document.querySelectorAll('#pastas-servidas input:checked')
    ).map((i) => i.value);

    const coordRadio = document.querySelector('input[name="foi-coord"]:checked');
    casal.jaFoiCoordenador = coordRadio ? coordRadio.value === 'sim' : false;

    casal.pastasCoordenadasDe = casal.jaFoiCoordenador
      ? Array.from(document.querySelectorAll('#pastas-coordenadas input:checked')).map((i) => i.value)
      : [];

    const dirig = document.querySelector('input[name="foi-dirigente"]:checked');
    casal.jaFoiDirigente = dirig ? dirig.value === 'sim' : false;

    if (casal.jaFoiDirigente) {
      casal.anoDirigente   = parseInt($('campo-ano-dirigente').value, 10) || null;
      const pdRadio = document.querySelector('#pasta-dirigente input:checked');
      casal.pastaDirigente = pdRadio ? pdRadio.value : '';
    } else {
      casal.anoDirigente   = null;
      casal.pastaDirigente = '';
    }

    casal.participaPastoral = $('campo-pastoral').value.trim();
    casal.gostariaDeServir  = [];
  } else {
    casal.pastasServidas      = [];
    casal.jaFoiCoordenador    = false;
    casal.pastasCoordenadasDe = [];
    casal.jaFoiDirigente      = false;
    casal.anoDirigente        = null;
    casal.pastaDirigente      = '';
    casal.participaPastoral   = '';
    casal.gostariaDeServir    = Array.from(
      document.querySelectorAll('#pastas-gostaria input:checked')
    ).map((i) => i.value);
  }

  return casal;
}

/* ===================================================
   SAVE COUPLE
   =================================================== */

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

/* ===================================================
   DISPLAY HELPERS
   =================================================== */

function getNomesCasal(c) {
  if (c.nomeEsposo || c.nomeEsposa) {
    return [c.nomeEsposo, c.nomeEsposa].filter(Boolean).join(' & ');
  }
  return c.nomes || '—';
}

function getEsposo(c) {
  return c.nomeEsposo || (c.nomes ? c.nomes.split(/\s*[&e]\s*/i)[0] : '') || '—';
}

function getEsposa(c) {
  if (c.nomeEsposa) return c.nomeEsposa;
  if (c.nomes) {
    const parts = c.nomes.split(/\s*[&e]\s*/i);
    return parts[1] ? parts[1].trim() : '—';
  }
  return '—';
}

function getTelefones(c) {
  const parts = [];
  if (c.telEsposo) parts.push(c.telEsposo);
  if (c.telEsposa) parts.push(c.telEsposa);
  if (parts.length) return parts.join(' / ');
  return c.contato || '—';
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
   RENDER ECC TABLE
   =================================================== */

function renderTabela() {
  tbodyEcc.innerHTML = '';
  if (casais.length === 0) {
    msgVazioEcc.classList.add('visivel');
    return;
  }
  msgVazioEcc.classList.remove('visivel');

  casais.forEach((c) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fotos-cell">
        ${avatarHtml(c.fotoEsposo, getEsposo(c))}
        ${avatarHtml(c.fotoEsposa, getEsposa(c))}
      </td>
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

tbodyEcc.addEventListener('click', handleRowAction);

/* ===================================================
   RENDER DIRIGENTE TABLE
   =================================================== */

function renderTabelaDirigente(lista) {
  tbodyDir.innerHTML = '';
  if (!lista || lista.length === 0) {
    msgVazioDir.classList.add('visivel');
    return;
  }
  msgVazioDir.classList.remove('visivel');

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

tbodyDir.addEventListener('click', handleRowAction);

/* ===================================================
   ROW ACTIONS (shared)
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

/* ===================================================
   OPEN NEW / EDIT
   =================================================== */

function abrirNovoCadastro() {
  resetForm();
  abrirModal(modalCadastro);
}

function abrirEdicao(casal) {
  resetForm();
  popularForm(casal);
  abrirModal(modalCadastro);
}

btnNovoCasal.addEventListener('click', abrirNovoCadastro);
btnAddCasalDir.addEventListener('click', abrirNovoCadastro);

/* ===================================================
   VISUALIZAÇÃO DETALHADA
   =================================================== */

function abrirVisualizacao(c) {
  const sim = (v) => v ? 'Sim' : 'Não';

  const fotosHtml = `
    <div class="view-fotos">
      <div class="view-foto-item">
        ${c.fotoEsposo ? `<img src="${c.fotoEsposo}" class="foto-avatar foto-avatar-lg" alt="Foto do Esposo" />` : '<span class="avatar-placeholder avatar-placeholder-lg">👤</span>'}
        <p class="view-foto-label">Esposo</p>
      </div>
      <div class="view-foto-item">
        ${c.fotoEsposa ? `<img src="${c.fotoEsposa}" class="foto-avatar foto-avatar-lg" alt="Foto da Esposa" />` : '<span class="avatar-placeholder avatar-placeholder-lg">👤</span>'}
        <p class="view-foto-label">Esposa</p>
      </div>
    </div>`;

  let html = `
    ${fotosHtml}
    <div class="view-section">
      <h4>Identificação</h4>
      <div class="view-row"><span class="view-label">Esposo:</span><span class="view-val">${esc(getEsposo(c))}</span></div>
      <div class="view-row"><span class="view-label">Esposa:</span><span class="view-val">${esc(getEsposa(c))}</span></div>
      <div class="view-row"><span class="view-label">Tel. Esposo:</span><span class="view-val">${esc(c.telEsposo || c.contato || '—')}</span></div>
      <div class="view-row"><span class="view-label">Tel. Esposa:</span><span class="view-val">${esc(c.telEsposa || '—')}</span></div>
      <div class="view-row"><span class="view-label">Endereço:</span><span class="view-val">${esc(c.endereco || '—')}</span></div>
      <div class="view-row"><span class="view-label">Ano do Retiro:</span><span class="view-val">${c.anoRetiro}</span></div>
    </div>`;

  if (c.jaServiu) {
    html += `
    <div class="view-section">
      <h4>Serviço no Retiro</h4>
      <div class="view-row"><span class="view-label">Já serviu:</span><span class="view-val">${sim(c.jaServiu)}</span></div>
      <div class="view-row"><span class="view-label">Pastas servidas:</span><span class="view-val">${esc((c.pastasServidas || []).join(', ') || '—')}</span></div>
      <div class="view-row"><span class="view-label">Já foi coordenador:</span><span class="view-val">${sim(c.jaFoiCoordenador)}</span></div>
      ${c.jaFoiCoordenador ? `<div class="view-row"><span class="view-label">Pastas coordenadas:</span><span class="view-val">${esc((c.pastasCoordenadasDe || []).join(', ') || '—')}</span></div>` : ''}
      <div class="view-row"><span class="view-label">Já foi dirigente:</span><span class="view-val">${sim(c.jaFoiDirigente)}</span></div>
      ${c.jaFoiDirigente ? `
        <div class="view-row"><span class="view-label">Ano como dirigente:</span><span class="view-val">${c.anoDirigente || '—'}</span></div>
        <div class="view-row"><span class="view-label">Pasta como dirigente:</span><span class="view-val">${esc(c.pastaDirigente || '—')}</span></div>` : ''}
      <div class="view-row"><span class="view-label">Pastoral / Serviço:</span><span class="view-val">${esc(c.participaPastoral || '—')}</span></div>
    </div>`;
  } else {
    html += `
    <div class="view-section">
      <h4>Serviço no Retiro</h4>
      <div class="view-row"><span class="view-label">Já serviu:</span><span class="view-val">Não</span></div>
      <div class="view-row"><span class="view-label">Gostaria de servir em:</span><span class="view-val">${esc((c.gostariaDeServir || []).join(', ') || '—')}</span></div>
    </div>`;
  }

  viewBody.innerHTML = html;
  abrirModal(modalVisualizar);
}

/* ===================================================
   FILTERS – DIRIGENTE PANEL
   =================================================== */

function aplicarFiltrosAtivos() {
  return filtroAtivo ? filtroAtivo(casais) : casais;
}

btnBuscar.addEventListener('click', () => {
  const nome = buscarNomeInput.value.trim().toLowerCase();
  const ano  = parseInt(buscarAnoInput.value, 10);

  filtroAtivo = (lista) => lista.filter((c) => {
    const nomes = getNomesCasal(c).toLowerCase();
    const matchNome = !nome || nomes.includes(nome);
    const matchAno  = !ano  || c.anoRetiro === ano;
    return matchNome && matchAno;
  });

  const desc = [];
  if (nome) desc.push(`nome: "${nome}"`);
  if (ano)  desc.push(`ano: ${ano}`);
  labelFiltroAtivo.textContent = desc.length ? `(filtro: ${desc.join(', ')})` : '';

  renderTabelaDirigente(aplicarFiltrosAtivos());
});

btnLimparBusca.addEventListener('click', () => {
  buscarNomeInput.value = '';
  buscarAnoInput.value  = '';
  filtroAtivo = null;
  labelFiltroAtivo.textContent = '';
  renderTabelaDirigente(casais);
});

btnFiltrarPerfil.addEventListener('click', () => {
  const selecionado = document.querySelector('input[name="filtro-perfil"]:checked');
  if (!selecionado) { alert('Selecione uma opção de perfil.'); return; }

  const perfilLabels = {
    'nunca-serviu':       'Nunca serviu',
    'nunca-coordenador':  'Nunca foi coordenador',
    'nunca-dirigente':    'Nunca foi dirigente',
  };

  const val = selecionado.value;
  filtroAtivo = (lista) => lista.filter((c) => {
    if (val === 'nunca-serviu')      return !c.jaServiu;
    if (val === 'nunca-coordenador') return !c.jaFoiCoordenador;
    if (val === 'nunca-dirigente')   return !c.jaFoiDirigente;
    return true;
  });

  labelFiltroAtivo.textContent = `(filtro: ${perfilLabels[val]})`;
  renderTabelaDirigente(aplicarFiltrosAtivos());
});

btnLimparPerfil.addEventListener('click', () => {
  document.querySelectorAll('input[name="filtro-perfil"]').forEach((r) => r.checked = false);
  filtroAtivo = null;
  labelFiltroAtivo.textContent = '';
  renderTabelaDirigente(casais);
});

btnAplicarPastas.addEventListener('click', () => {
  const selecionadas = Array.from(
    document.querySelectorAll('#filtro-pastas input:checked')
  ).map((i) => i.value);

  if (selecionadas.length === 0) {
    filtroAtivo = null;
    labelFiltroAtivo.textContent = '';
    renderTabelaDirigente(casais);
    return;
  }

  filtroAtivo = (lista) => lista.filter((c) =>
    selecionadas.some((p) => (c.pastasServidas || []).includes(p))
  );

  labelFiltroAtivo.textContent = `(pastas: ${selecionadas.join(', ')})`;
  renderTabelaDirigente(aplicarFiltrosAtivos());
});

/* ===================================================
   UTILITIES
   =================================================== */

function esc(str) {
  return String(str)
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
configurarSecoesCond();
renderTabela();
renderTabelaDirigente(casais);

// Restore ECC login state from session
if (isEccLogado()) {
  ocultarEccLogin();
  const nome = sessionStorage.getItem('ecc_casal_nome');
  if (nome) eccNomeLogado.textContent = `Olá, ${nome}!`;
} else {
  mostrarEccLogin();
}
