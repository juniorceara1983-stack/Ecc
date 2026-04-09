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

const STORAGE_KEY = 'ecc_casais';

/* ===================================================
   STATE
   =================================================== */

let casais = [];          // array of couple objects
let filtroAtivo = null;   // current filter descriptor (for dirigente panel)

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

/* ===================================================
   DOM REFERENCES
   =================================================== */

const $   = (id) => document.getElementById(id);
const $qs = (sel, root = document) => root.querySelector(sel);

// Tabs
const tabBtns   = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

// ECC Panel
const tbodyEcc      = $('tbody-casais');
const msgVazioEcc   = $('msg-vazio');
const btnNovoCasal  = $('btn-novo-casal');

// Dirigente Panel
const tbodyDir      = $('tbody-dirigente');
const msgVazioDir   = $('msg-vazio-dir');
const btnAddCasalDir = $('btn-add-casal-dir');
const buscarNomeInput = $('busca-nome');
const buscarAnoInput  = $('busca-ano');
const btnBuscar       = $('btn-buscar');
const btnLimparBusca  = $('btn-limpar-busca');
const btnFiltrarPerfil = $('btn-filtrar-perfil');
const btnLimparPerfil  = $('btn-limpar-perfil');
const btnAplicarPastas = $('btn-aplicar-pastas');
const labelFiltroAtivo = $('label-filtro-ativo');

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

/* ===================================================
   TABS
   =================================================== */

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.remove('active'));
    tabPanels.forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).classList.add('active');
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

// Close on overlay click
[modalCadastro, modalVisualizar].forEach((m) => {
  m.addEventListener('click', (e) => {
    if (e.target === m) fecharModal(m);
  });
});

btnFecharModal.addEventListener('click', () => fecharModal(modalCadastro));
btnCancelar.addEventListener('click', () => fecharModal(modalCadastro));
btnFecharView.addEventListener('click', () => fecharModal(modalVisualizar));
btnFecharView2.addEventListener('click', () => fecharModal(modalVisualizar));

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!modalCadastro.hidden)   fecharModal(modalCadastro);
    if (!modalVisualizar.hidden) fecharModal(modalVisualizar);
  }
});

/* ===================================================
   CONDITIONAL SECTIONS IN FORM
   =================================================== */

function configurarSecoesCond() {
  // Serviu / Nunca serviu
  document.querySelectorAll('input[name="serviu"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const jaServiu = radio.value === 'sim';
      $('secao-ja-serviu').hidden   = !jaServiu;
      $('secao-nunca-serviu').hidden = jaServiu;
      // reset inner radios when toggling
      if (!jaServiu) {
        document.querySelectorAll('input[name="foi-coord"]').forEach((r) => r.checked = false);
        document.querySelectorAll('input[name="foi-dirigente"]').forEach((r) => r.checked = false);
        $('secao-coord').hidden     = true;
        $('secao-dirigente').hidden = true;
      }
    });
  });

  // Foi coordenador
  document.querySelectorAll('input[name="foi-coord"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      $('secao-coord').hidden = radio.value !== 'sim';
    });
  });

  // Foi dirigente
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
  $('secao-ja-serviu').hidden   = true;
  $('secao-nunca-serviu').hidden = true;
  $('secao-coord').hidden        = true;
  $('secao-dirigente').hidden    = true;

  // Rebuild dynamic checkbox groups freshly
  buildCheckboxGroup('pastas-servidas',   PASTAS, 'pserv');
  buildCheckboxGroup('pastas-coordenadas', PASTAS, 'pcoord');
  buildCheckboxGroup('pasta-dirigente',   PASTAS, 'pdir', true); // single select
  buildCheckboxGroup('pastas-gostaria',   PASTAS, 'pgost');

  configurarSecoesCond();
  $('modal-titulo').textContent = 'Cadastro de Casal';
}

function popularForm(casal) {
  $('modal-titulo').textContent = 'Editar Casal';
  $('casal-id').value        = casal.id;
  $('campo-nomes').value     = casal.nomes     || '';
  $('campo-endereco').value  = casal.endereco  || '';
  $('campo-contato').value   = casal.contato   || '';
  $('campo-ano-retiro').value = casal.anoRetiro || '';

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
    // Pastas servidas
    (casal.pastasServidas || []).forEach((pasta) => {
      const cb = document.querySelector(`#pastas-servidas input[value="${pasta}"]`);
      if (cb) cb.checked = true;
    });

    // Coordenador
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

    // Dirigente
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
    // Nunca serviu – gostaria de servir
    (casal.gostariaDeServir || []).forEach((pasta) => {
      const cb = document.querySelector(`#pastas-gostaria input[value="${pasta}"]`);
      if (cb) cb.checked = true;
    });
  }
}

/* ===================================================
   COLLECT FORM DATA
   =================================================== */

function coletarFormData() {
  const nomes = $('campo-nomes').value.trim();
  if (!nomes) { alert('Por favor, informe os nomes do casal.'); return null; }
  const anoRetiro = parseInt($('campo-ano-retiro').value, 10);
  if (!anoRetiro) { alert('Por favor, informe o ano do retiro.'); return null; }

  const serviuRadio = document.querySelector('input[name="serviu"]:checked');
  if (!serviuRadio) { alert('Por favor, indique se o casal já serviu no retiro.'); return null; }

  const jaServiu = serviuRadio.value === 'sim';

  const casal = {
    id:           $('casal-id').value || gerarId(),
    nomes,
    endereco:     $('campo-endereco').value.trim(),
    contato:      $('campo-contato').value.trim(),
    anoRetiro,
    jaServiu,
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
      casal.anoDirigente  = parseInt($('campo-ano-dirigente').value, 10) || null;
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

btnSalvar.addEventListener('click', () => {
  const data = coletarFormData();
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
   RENDER ECC TABLE
   =================================================== */

function badgeSim(val) {
  return val
    ? '<span class="badge badge-sim">Sim</span>'
    : '<span class="badge badge-nao">Não</span>';
}

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
      <td>${esc(c.nomes)}</td>
      <td>${esc(c.contato || '—')}</td>
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
      <td>${esc(c.nomes)}</td>
      <td>${esc(c.contato || '—')}</td>
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
    if (confirm(`Excluir o casal "${casal.nomes}"?`)) {
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

  let html = `
    <div class="view-section">
      <h4>Identificação</h4>
      <div class="view-row"><span class="view-label">Nomes:</span><span class="view-val">${esc(c.nomes)}</span></div>
      <div class="view-row"><span class="view-label">Endereço:</span><span class="view-val">${esc(c.endereco || '—')}</span></div>
      <div class="view-row"><span class="view-label">Contato:</span><span class="view-val">${esc(c.contato || '—')}</span></div>
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

// Busca por nome / ano
btnBuscar.addEventListener('click', () => {
  const nome = buscarNomeInput.value.trim().toLowerCase();
  const ano  = parseInt(buscarAnoInput.value, 10);

  filtroAtivo = (lista) => lista.filter((c) => {
    const matchNome = !nome || c.nomes.toLowerCase().includes(nome);
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

// Filtro por perfil
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

// Filtro por pastas
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
