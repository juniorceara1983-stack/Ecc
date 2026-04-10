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
var SHEET_ID = '1o9h8x2mmifnHjJINmPL0Y5HgXsEDxRaP53sA_hBnfMY';

// Nomes das abas
var ABA_CASAIS       = 'Casais';
var ABA_SUGESTOES    = 'Sugestões Retiro';
var ABA_BLOQUEIOS    = 'Logins Bloqueados';
var ABA_CONFIG       = 'Configurações';
var ABA_COMUNICADOS  = 'Comunicados';
var ABA_QUIZ_RANKING = 'Quiz Ranking';

// Cabeçalho da aba principal
var CABECALHO_CASAIS = [
  'ID', 'Esposo', 'Esposa', 'Tel. Esposo', 'Tel. Esposa',
  'Endereço', 'Ano Retiro', 'Já Serviu',
  'Equipes de Trabalho', 'Coordenador', 'Equipes Coordenadas',
  'Dirigente', 'Ano Dirigente', 'Pasta Dirigente',
  'Pastoral', 'Gostaria de Servir em',
  'Última Atualização',
];

// Cabeçalho da aba de bloqueios
var CABECALHO_BLOQUEIOS = ['Login', 'Bloqueado', 'Data'];

// Índices das colunas (0-based), derivados do cabeçalho para evitar fragilidade
var COL_ID        = CABECALHO_CASAIS.indexOf('ID');
var COL_JA_SERVIU = CABECALHO_CASAIS.indexOf('Já Serviu');
var COL_EQUIPES   = CABECALHO_CASAIS.indexOf('Equipes de Trabalho');

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

// Cabeçalho da aba de configurações
var CABECALHO_CONFIG = ['Chave', 'Valor', 'Data'];

// Cabeçalho da aba de comunicados
var CABECALHO_COMUNICADOS = ['ID', 'Titulo', 'Descricao', 'DataEvento', 'HoraEvento', 'Local', 'Imagem', 'CriadoEm'];

// Cabeçalho do ranking de quiz
var CABECALHO_QUIZ_RANKING = ['Login', 'Pontuacao', 'TotalRespondidas', 'Mes', 'DataAtualizacao'];

// ── Helpers de configurações ─────────────────────────────────────────────────

function getConfigSheet(ss) {
  return getOrCreateSheet(ss, ABA_CONFIG, CABECALHO_CONFIG);
}

function salvarConfiguracao(sheet, chave, valor) {
  var dados = sheet.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim() === String(chave).trim()) {
      sheet.getRange(i + 1, 2).setValue(valor);
      sheet.getRange(i + 1, 3).setValue(new Date());
      return;
    }
  }
  sheet.appendRow([chave, valor, new Date()]);
}

function getConfiguracao(sheet, chave) {
  var dados = sheet.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim() === String(chave).trim()) {
      return String(dados[i][1] || '');
    }
  }
  return '';
}

// ── Helpers de bloqueios ──────────────────────────────────────────────────────

function getBloqueiosSheet(ss) {
  return getOrCreateSheet(ss, ABA_BLOQUEIOS, CABECALHO_BLOQUEIOS);
}

function verificarLoginBloqueado(sheet, login) {
  var dados = sheet.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim().toLowerCase() === String(login).trim().toLowerCase()) {
      return dados[i][1] === 'Sim';
    }
  }
  return false;
}

function bloquearLoginNaPlanilha(sheet, login) {
  var dados = sheet.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim().toLowerCase() === String(login).trim().toLowerCase()) {
      sheet.getRange(i + 1, 2).setValue('Sim');
      sheet.getRange(i + 1, 3).setValue(new Date().toLocaleString('pt-BR'));
      return;
    }
  }
  sheet.appendRow([login, 'Sim', new Date().toLocaleString('pt-BR')]);
}

function desbloquearLoginNaPlanilha(sheet, login) {
  var dados = sheet.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim().toLowerCase() === String(login).trim().toLowerCase()) {
      sheet.getRange(i + 1, 2).setValue('Não');
      sheet.getRange(i + 1, 3).setValue(new Date().toLocaleString('pt-BR'));
      return;
    }
  }
}

function listarTodosBloqueios(sheet) {
  var dados = sheet.getDataRange().getValues();
  if (dados.length <= 1) return [];
  return dados.slice(1).map(function(row) {
    return { login: String(row[0] || ''), bloqueado: row[1] === 'Sim', data: String(row[2] || '') };
  });
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
    } else if (acao === 'bloquearLogin' && payload.login) {
      var sheetBloq = getBloqueiosSheet(ss);
      bloquearLoginNaPlanilha(sheetBloq, payload.login);
    } else if (acao === 'desbloquearLogin' && payload.login) {
      var sheetBloqueios = getBloqueiosSheet(ss);
      desbloquearLoginNaPlanilha(sheetBloqueios, payload.login);
    } else if (acao === 'salvarConfig' && payload.chave) {
      var sheetConf = getConfigSheet(ss);
      salvarConfiguracao(sheetConf, payload.chave, payload.valor || '');
    } else if (acao === 'salvarComunicado' && payload.comunicado) {
      var sheetCom = getOrCreateSheet(ss, ABA_COMUNICADOS, CABECALHO_COMUNICADOS);
      salvarComunicado(sheetCom, payload.comunicado);
    } else if (acao === 'excluirComunicado' && payload.id) {
      var sheetComDel = getOrCreateSheet(ss, ABA_COMUNICADOS, CABECALHO_COMUNICADOS);
      excluirComunicado(sheetComDel, payload.id);
    } else if (acao === 'salvarQuizScore' && payload.score) {
      var sheetQuiz = getOrCreateSheet(ss, ABA_QUIZ_RANKING, CABECALHO_QUIZ_RANKING);
      salvarQuizScore(sheetQuiz, payload.score);
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

    if (acao === 'verificarBloqueio') {
      var login = params.login || '';
      var sheetBloq = getBloqueiosSheet(ss);
      var bloqueado = verificarLoginBloqueado(sheetBloq, login);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, bloqueado: bloqueado }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (acao === 'listarBloqueios') {
      var sheetBloqueios = getBloqueiosSheet(ss);
      var bloqueios = listarTodosBloqueios(sheetBloqueios);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, bloqueios: bloqueios }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (acao === 'getConfig') {
      var chave = params.chave || '';
      var sheetConf = getConfigSheet(ss);
      var valor = getConfiguracao(sheetConf, chave);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, valor: valor }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (acao === 'listarComunicados') {
      var sheetComList = getOrCreateSheet(ss, ABA_COMUNICADOS, CABECALHO_COMUNICADOS);
      var comunicados = listarComunicados(sheetComList);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, comunicados: comunicados }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (acao === 'listarQuizRanking') {
      var mes = params.mes || '';
      var sheetRank = getOrCreateSheet(ss, ABA_QUIZ_RANKING, CABECALHO_QUIZ_RANKING);
      var ranking = listarQuizRanking(sheetRank, mes);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, ranking: ranking }))
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
    var id = dados[i][COL_ID];
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
    if (dados[i][COL_ID] === id) {
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
  return dados.slice(1)
    .filter(function(linha) {
      if (!pasta) return linha[COL_JA_SERVIU] !== 'Sim';
      var equipes = String(linha[COL_EQUIPES] || '').split(';').map(function(s){ return s.trim(); });
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

// ── Comunicados ───────────────────────────────────────────────────────────────

function salvarComunicado(sheet, com) {
  var dados = sheet.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]) === String(com.id)) {
      sheet.getRange(i + 1, 1, 1, CABECALHO_COMUNICADOS.length).setValues([[
        com.id, com.titulo || '', com.descricao || '', com.dataEvento || '',
        com.horaEvento || '', com.local || '', '', com.criadoEm || '',
      ]]);
      return;
    }
  }
  sheet.appendRow([
    com.id, com.titulo || '', com.descricao || '', com.dataEvento || '',
    com.horaEvento || '', com.local || '', '', com.criadoEm || '',
  ]);
}

function excluirComunicado(sheet, id) {
  var dados = sheet.getDataRange().getValues();
  for (var i = dados.length - 1; i >= 1; i--) {
    if (String(dados[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function listarComunicados(sheet) {
  var dados = sheet.getDataRange().getValues();
  if (dados.length <= 1) return [];
  return dados.slice(1).map(function(row) {
    return {
      id: String(row[0] || ''),
      titulo: String(row[1] || ''),
      descricao: String(row[2] || ''),
      dataEvento: String(row[3] || ''),
      horaEvento: String(row[4] || ''),
      local: String(row[5] || ''),
      criadoEm: String(row[7] || ''),
    };
  });
}

// ── Quiz Ranking ──────────────────────────────────────────────────────────────

function salvarQuizScore(sheet, score) {
  var login = String(score.login || '');
  var mes   = String(score.mes   || '');
  var dados = sheet.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).toLowerCase() === login.toLowerCase() &&
        String(dados[i][3]) === mes) {
      sheet.getRange(i + 1, 2).setValue(Number(score.pontuacao)      || 0);
      sheet.getRange(i + 1, 3).setValue(Number(score.totalRespondidas) || 0);
      sheet.getRange(i + 1, 5).setValue(new Date().toLocaleString('pt-BR'));
      return;
    }
  }
  sheet.appendRow([
    login,
    Number(score.pontuacao)       || 0,
    Number(score.totalRespondidas) || 0,
    mes,
    new Date().toLocaleString('pt-BR'),
  ]);
}

function listarQuizRanking(sheet, mes) {
  var dados = sheet.getDataRange().getValues();
  if (dados.length <= 1) return [];
  var rows = dados.slice(1);
  if (mes) {
    rows = rows.filter(function(r){ return String(r[3]) === mes; });
  }
  rows.sort(function(a, b){ return Number(b[1]) - Number(a[1]); });
  return rows.slice(0, 10).map(function(row) {
    return {
      login: String(row[0] || ''),
      pontuacao: Number(row[1]) || 0,
      totalRespondidas: Number(row[2]) || 0,
      mes: String(row[3] || ''),
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
