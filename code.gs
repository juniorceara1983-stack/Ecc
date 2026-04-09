/**
 * ECC – Encontro de Casais com Cristo
 * Google Apps Script – Integração com Google Sheets
 *
 * Como usar:
 *  1. Acesse https://script.google.com e crie um novo projeto.
 *  2. Cole este código no editor e salve.
 *  3. Vá em "Implantar > Nova implantação", escolha "App da Web".
 *     - Execute como: "Eu"
 *     - Quem pode acessar: "Qualquer pessoa" (ou restrinja conforme necessário)
 *  4. Copie a URL gerada e cole em SCRIPT_URL dentro do arquivo js/app.js
 *     (ou no campo de configuração da integração no painel do dirigente).
 *  5. Na planilha vinculada (Sheet ID abaixo), serão criadas as abas
 *     automaticamente na primeira execução.
 */

'use strict';

// ── Configuração ──────────────────────────────────────────────────────────────
// Substitua pelo ID da sua planilha Google Sheets.
// O ID está na URL: https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit
var SHEET_ID = 'SEU_SHEET_ID_AQUI';

// Nomes das abas
var ABA_CASAIS    = 'Casais';
var ABA_SUGESTOES = 'Sugestões Retiro';

// Cabeçalho da aba principal
var CABECALHO_CASAIS = [
  'ID', 'Esposo', 'Esposa', 'Tel. Esposo', 'Tel. Esposa',
  'Endereço', 'Ano Retiro', 'Já Serviu',
  'Equipes de Trabalho', 'Coordenador', 'Equipes Coordenadas',
  'Dirigente', 'Ano Dirigente', 'Pasta Dirigente',
  'Pastoral', 'Gostaria de Servir em',
  'Última Atualização',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function getOrCreateSheet(ss, nome, cabecalho) {
  var sheet = ss.getSheetByName(nome);
  if (!sheet) {
    sheet = ss.insertSheet(nome);
    sheet.appendRow(cabecalho);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, cabecalho.length)
         .setFontWeight('bold')
         .setBackground('#1a5276')
         .setFontColor('#ffffff');
  }
  return sheet;
}

function casalParaLinha(c) {
  return [
    c.id            || '',
    c.nomeEsposo    || '',
    c.nomeEsposa    || '',
    c.telEsposo     || '',
    c.telEsposa     || '',
    c.endereco      || '',
    c.anoRetiro     || '',
    c.jaServiu      ? 'Sim' : 'Não',
    (c.pastasServidas      || []).join('; '),
    c.jaFoiCoordenador     ? 'Sim' : 'Não',
    (c.pastasCoordenadasDe || []).join('; '),
    c.jaFoiDirigente       ? 'Sim' : 'Não',
    c.anoDirigente  || '',
    c.pastaDirigente || '',
    c.participaPastoral || '',
    (c.gostariaDeServir || []).join('; '),
    new Date().toLocaleString('pt-BR'),
  ];
}

// ── doPost – recebe dados do app ──────────────────────────────────────────────

function doPost(e) {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    var payload = JSON.parse(e.postData.contents);
    var acao    = payload.acao; // 'sincronizar' | 'excluir'
    var casais  = payload.casais || [];

    var ss       = getSpreadsheet();
    var sheetCas = getOrCreateSheet(ss, ABA_CASAIS, CABECALHO_CASAIS);

    if (acao === 'sincronizar') {
      sincronizarCasais(sheetCas, casais);
    } else if (acao === 'excluir' && payload.id) {
      excluirCasal(sheetCas, payload.id);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, erro: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── doGet – exporta dados ou relatório de sugestões ───────────────────────────

function doGet(e) {
  var params = e.parameter || {};
  var acao   = params.acao || 'exportar';

  try {
    var ss       = getSpreadsheet();
    var sheetCas = getOrCreateSheet(ss, ABA_CASAIS, CABECALHO_CASAIS);

    if (acao === 'exportar') {
      var dados = exportarCasais(sheetCas);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, casais: dados }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (acao === 'sugestoes') {
      var pasta = params.pasta || '';
      var sugest = gerarSugestoes(sheetCas, pasta);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, sugestoes: sugest }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, erro: 'Ação desconhecida.' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, erro: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Lógica de sincronização ───────────────────────────────────────────────────

function sincronizarCasais(sheet, casais) {
  // Cria mapa ID → número da linha para atualização rápida
  var dados     = sheet.getDataRange().getValues();
  var mapaLinhas = {};
  for (var i = 1; i < dados.length; i++) {
    var id = dados[i][0];
    if (id) mapaLinhas[id] = i + 1; // linha 1-indexed
  }

  casais.forEach(function(c) {
    var linha = casalParaLinha(c);
    if (mapaLinhas[c.id]) {
      sheet.getRange(mapaLinhas[c.id], 1, 1, linha.length).setValues([linha]);
    } else {
      sheet.appendRow(linha);
    }
  });
}

function excluirCasal(sheet, id) {
  var dados = sheet.getDataRange().getValues();
  for (var i = dados.length - 1; i >= 1; i--) {
    if (dados[i][0] === id) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function exportarCasais(sheet) {
  var dados = sheet.getDataRange().getValues();
  if (dados.length <= 1) return [];
  var cabecalho = dados[0];
  return dados.slice(1).map(function(linha) {
    var obj = {};
    cabecalho.forEach(function(col, idx) {
      obj[col] = linha[idx];
    });
    return obj;
  });
}

function gerarSugestoes(sheet, pasta) {
  var dados = sheet.getDataRange().getValues();
  if (dados.length <= 1) return [];
  var idxEquipes = 8; // coluna "Equipes de Trabalho" (0-indexed)
  return dados.slice(1)
    .filter(function(linha) {
      if (!pasta) return linha[7] !== 'Sim'; // nunca serviram
      var equipes = String(linha[idxEquipes] || '').split(';').map(function(s){ return s.trim(); });
      return !equipes.includes(pasta);
    })
    .map(function(linha) {
      return {
        esposo:    linha[1],
        esposa:    linha[2],
        telEsposo: linha[3],
        telEsposa: linha[4],
        anoRetiro: linha[6],
      };
    });
}

// ── Planilha de sugestões (aba separada) ─────────────────────────────────────

function gerarAbaSugestoes() {
  var ss         = getSpreadsheet();
  var sheetCas   = getOrCreateSheet(ss, ABA_CASAIS, CABECALHO_CASAIS);
  var sheetSug   = ss.getSheetByName(ABA_SUGESTOES);
  if (sheetSug) ss.deleteSheet(sheetSug);
  sheetSug = ss.insertSheet(ABA_SUGESTOES);

  var equipesDeTrabalho = [
    'Coordenador Geral', 'Sala', 'Visitação', 'Café e Mini Mercado',
    'Compras', 'Cozinha', 'Ordem e Limpeza', 'Secretaria',
    'Liturgia e Vigília', 'Círculos',
  ];

  var cabSug = ['Equipe', 'Esposo', 'Esposa', 'Tel. Esposo', 'Tel. Esposa', 'Ano Retiro'];
  sheetSug.appendRow(cabSug);
  sheetSug.setFrozenRows(1);
  sheetSug.getRange(1, 1, 1, cabSug.length)
          .setFontWeight('bold')
          .setBackground('#1a5276')
          .setFontColor('#ffffff');

  var dados = sheetCas.getDataRange().getValues();
  equipesDeTrabalho.forEach(function(equipe) {
    var sugest = gerarSugestoes(sheetCas, equipe);
    sugest.forEach(function(c) {
      sheetSug.appendRow([equipe, c.esposo, c.esposa, c.telEsposo, c.telEsposa, c.anoRetiro]);
    });
  });

  SpreadsheetApp.flush();
  return 'Aba "' + ABA_SUGESTOES + '" gerada com sucesso!';
}

// ── Trigger / Menu ────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ECC')
    .addItem('Gerar Sugestões de Retiro', 'gerarAbaSugestoes')
    .addToUi();
}
