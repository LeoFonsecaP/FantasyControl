/**
 * Config sheet helpers and sheet bootstrap.
 */

var SHEET_NAMES = {
  TIMES: 'Times',
  JOGADORES: 'Jogadores',
  PICKS: 'Picks',
  TROCAS: 'Trocas',
  STANDINGS: 'Standings',
  CONFIG: 'Config'
};

var HEADERS = {
  Times: ['ID', 'Nome_Time', 'Responsavel', 'Email'],
  Jogadores: ['ID', 'Jogador', 'Time_ID', 'Round', 'Ano_Draft', 'Limite', 'Status'],
  Picks: ['ID', 'Time_Dono_Atual', 'Time_Original', 'Rodada', 'Ano', 'Usado'],
  Trocas: ['ID', 'Data', 'Descricao', 'Times_Envolvidos', 'Payload_JSON'],
  Standings: ['ID', 'Ano', 'Time_ID', 'Vitorias', 'Derrotas', 'Posicao_Final', 'Campeao'],
  Config: ['Chave', 'Valor']
};

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(name) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('Aba não encontrada: ' + name);
  }
  return sheet;
}

function ensureSheets_() {
  var ss = getSpreadsheet_();
  Object.keys(HEADERS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
      sheet.setFrozenRows(1);
    } else if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
      sheet.setFrozenRows(1);
    }
  });
}

function getConfig_(key, defaultValue) {
  var sheet = getSheet_(SHEET_NAMES.CONFIG);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === key) {
      return String(data[i][1]);
    }
  }
  return defaultValue !== undefined ? defaultValue : null;
}

function setConfig_(key, value) {
  var sheet = getSheet_(SHEET_NAMES.CONFIG);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function getTemporadaAtual_() {
  var v = getConfig_('temporada_atual', String(new Date().getFullYear()));
  return parseInt(v, 10);
}

function getAdminEmails_() {
  var raw = getConfig_('admins', '') || '';
  return raw
    .split(',')
    .map(function (e) {
      return e.trim().toLowerCase();
    })
    .filter(Boolean);
}

function sheetToObjects_(sheetName) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) {
    return String(h);
  });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.every(function (c) {
      return c === '' || c === null;
    })) {
      continue;
    }
    var obj = { _row: i + 1 };
    headers.forEach(function (h, idx) {
      obj[h] = row[idx];
    });
    rows.push(obj);
  }
  return rows;
}

function nextId_(prefix, sheetName, idColumn) {
  var rows = sheetToObjects_(sheetName);
  var max = 0;
  rows.forEach(function (r) {
    var id = String(r[idColumn] || '');
    if (id.indexOf(prefix) === 0) {
      var n = parseInt(id.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  var next = max + 1;
  return prefix + String(next).padStart(3, '0');
}

function anosPermitidos_(round) {
  var r = parseInt(round, 10);
  if (r === 1) return 4;
  if (r === 2 || r === 3) return 3;
  return 2;
}

function calcularLimite_(round, anoDraft) {
  return parseInt(anoDraft, 10) + anosPermitidos_(round);
}

function isKeeperEligible_(limite, temporada) {
  return parseInt(temporada, 10) <= parseInt(limite, 10);
}

function yearsUntilExpiry_(limite, temporada) {
  return parseInt(limite, 10) - parseInt(temporada, 10);
}
