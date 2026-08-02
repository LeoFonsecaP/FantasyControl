/**
 * Web App router — doGet / doPost
 *
 * Deploy as Web App: Execute as "Me", Access "Anyone".
 * Frontend calls with ?action=... (GET) or JSON body (POST).
 * Google identity is available when the user is signed into Google
 * and the request includes credentials / opens via redirect login.
 */

function doGet(e) {
  return handleRequest_(e, null);
}

function doPost(e) {
  var body = {};
  try {
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'JSON inválido.' });
  }
  return handleRequest_(e, body);
}

function handleRequest_(e, body) {
  try {
    ensureSheets_();
    var params = Object.assign({}, (e && e.parameter) || {}, body || {});
    var action = String(params.action || 'me');

    if (action === 'authBridge') {
      return authBridgeHtml_();
    }

    if (action === 'ping') {
      return jsonResponse_({ ok: true, data: { pong: true } });
    }

    var user = requireAuth_(params);
    var data;

    switch (action) {
      case 'me':
        data = actionMe_(user);
        break;
      case 'getDashboard':
        data = actionGetDashboard_(user);
        break;
      case 'getTeam':
        data = actionGetTeam_(user, params);
        break;
      case 'getExpiring':
        data = actionGetExpiring_(user, params);
        break;
      case 'getTrades':
        data = actionGetTrades_(user, params);
        break;
      case 'createTrade':
        data = actionCreateTrade_(user, params);
        break;
      case 'getKeepCandidates':
        data = actionGetKeepCandidates_(user, params);
        break;
      case 'setKeeps':
        data = actionSetKeeps_(user, params);
        break;
      case 'getStandings':
        data = actionGetStandings_(user, params);
        break;
      case 'upsertStanding':
        data = actionUpsertStanding_(user, params);
        break;
      case 'seed':
        data = actionSeed_(user, params);
        break;
      case 'listTeams':
        data = {
          times: sheetToObjects_(SHEET_NAMES.TIMES).map(function (t) {
            return {
              id: String(t.ID),
              nome: String(t.Nome_Time),
              responsavel: String(t.Responsavel || ''),
              email: String(t.Email || '')
            };
          })
        };
        break;
      default:
        throw new Error('Ação desconhecida: ' + action);
    }

    return jsonResponse_({ ok: true, data: data });
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * Seed demo data for 10 teams + sample players/picks.
 * Admin only. Pass { reset: true } to clear data sheets first (keeps Times if present).
 */
function actionSeed_(user, params) {
  requireAdmin_(user);
  return withLock_(function () {
    ensureSheets_();

    if (params.reset) {
      clearDataSheets_();
    }

    var existingTeams = sheetToObjects_(SHEET_NAMES.TIMES);
    if (existingTeams.length === 0) {
      seedTeams_();
    }

    if (sheetToObjects_(SHEET_NAMES.CONFIG).length === 0 || !getConfig_('temporada_atual')) {
      setConfig_('temporada_atual', '2026');
    }
    if (!getConfig_('admins') && user.email) {
      setConfig_('admins', user.email);
    }

    if (sheetToObjects_(SHEET_NAMES.JOGADORES).length === 0) {
      seedPlayersAndPicks_();
    }

    if (sheetToObjects_(SHEET_NAMES.STANDINGS).length === 0) {
      seedStandings_();
    }

    return {
      message: 'Seed concluído.',
      times: sheetToObjects_(SHEET_NAMES.TIMES).length,
      jogadores: sheetToObjects_(SHEET_NAMES.JOGADORES).length,
      picks: sheetToObjects_(SHEET_NAMES.PICKS).length,
      standings: sheetToObjects_(SHEET_NAMES.STANDINGS).length
    };
  });
}

function clearDataSheets_() {
  ['Jogadores', 'Picks', 'Trocas', 'Standings'].forEach(function (name) {
    var sheet = getSheet_(name);
    var last = sheet.getLastRow();
    if (last > 1) {
      sheet.getRange(2, 1, last, sheet.getLastColumn()).clearContent();
    }
  });
}

function seedTeams_() {
  var sheet = getSheet_(SHEET_NAMES.TIMES);
  var teams = [
    ['T001', 'Lakers Legacy', 'GM 1', ''],
    ['T002', 'Celtics Crown', 'GM 2', ''],
    ['T003', 'Heat Wave', 'GM 3', ''],
    ['T004', 'Nets Night', 'GM 4', ''],
    ['T005', 'Suns Empire', 'GM 5', ''],
    ['T006', 'Bucks Dynasty', 'GM 6', ''],
    ['T007', 'Warriors Gold', 'GM 7', ''],
    ['T008', 'Mavs Mavericks', 'GM 8', ''],
    ['T009', 'Nuggets Peak', 'GM 9', ''],
    ['T010', 'Thunder Storm', 'GM 10', '']
  ];
  sheet.getRange(2, 1, teams.length + 1, 4).setValues(teams);
}

function seedPlayersAndPicks_() {
  var playersSheet = getSheet_(SHEET_NAMES.JOGADORES);
  var picksSheet = getSheet_(SHEET_NAMES.PICKS);
  var sampleNames = [
    'Shai Gilgeous-Alexander',
    'Luka Doncic',
    'Jayson Tatum',
    'Nikola Jokic',
    'Giannis Antetokounmpo',
    'Anthony Edwards',
    'Victor Wembanyama',
    'Tyrese Haliburton',
    'Donovan Mitchell',
    'Devin Booker',
    'Jaylen Brown',
    'Paolo Banchero',
    'Cade Cunningham',
    'Franz Wagner',
    'Chet Holmgren',
    'LaMelo Ball',
    'Zion Williamson',
    'Ja Morant',
    'Bam Adebayo',
    'Domantas Sabonis'
  ];

  var playerRows = [];
  var pickRows = [];
  var pIdx = 1;
  var kIdx = 1;

  for (var t = 1; t <= 10; t++) {
    var tid = 'T' + String(t).padStart(3, '0');
    for (var slot = 0; slot < 2; slot++) {
      var name = sampleNames[(t - 1 + slot * 10) % sampleNames.length];
      var round = slot === 0 ? 1 : 2 + (t % 3);
      var ano = 2023 + ((t + slot) % 3);
      var limite = calcularLimite_(round, ano);
      var pid = 'J' + String(pIdx).padStart(3, '0');
      playerRows.push([pid, name, tid, round, ano, limite, 'ativo']);
      pIdx++;
    }
    for (var year = 2026; year <= 2028; year++) {
      for (var r = 1; r <= 7; r++) {
        var pickId = 'P' + String(kIdx).padStart(3, '0');
        pickRows.push([pickId, tid, tid, r, year, 'nao']);
        kIdx++;
      }
    }
  }

  if (playerRows.length) {
    playersSheet.getRange(2, 1, playerRows.length + 1, 7).setValues(playerRows);
  }
  if (pickRows.length) {
    picksSheet.getRange(2, 1, pickRows.length + 1, 6).setValues(pickRows);
  }
}

function seedStandings_() {
  var sheet = getSheet_(SHEET_NAMES.STANDINGS);
  var rows = [];
  for (var t = 1; t <= 10; t++) {
    var tid = 'T' + String(t).padStart(3, '0');
    var wins = 14 - t;
    var losses = t - 1;
    rows.push([
      'S' + String(t).padStart(3, '0'),
      2025,
      tid,
      wins,
      losses,
      t,
      t === 1 ? 'sim' : 'nao'
    ]);
  }
  sheet.getRange(2, 1, rows.length + 1, 7).setValues(rows);
}

/**
 * Manual setup from the Apps Script editor: run once after linking the sheet.
 */
function setupSpreadsheet() {
  ensureSheets_();
  if (!getConfig_('temporada_atual')) {
    setConfig_('temporada_atual', '2026');
  }
  var email = getActiveEmail_();
  if (email && !getConfig_('admins')) {
    setConfig_('admins', email);
  }
  Logger.log('Sheets prontas. Admins: ' + getConfig_('admins'));
  return {
    ok: true,
    admins: getConfig_('admins'),
    temporada: getConfig_('temporada_atual')
  };
}

/**
 * Menu na planilha — facilita o setup sem abrir o editor.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Liga Dynasty')
    .addItem('1. Criar abas (setup)', 'menuSetupSpreadsheet')
    .addItem('2. Popular dados demo', 'menuSeedData')
    .addSeparator()
    .addItem('Como publicar o Web App', 'menuShowDeployHelp')
    .addToUi();
}

function menuSetupSpreadsheet() {
  var ui = SpreadsheetApp.getUi();
  var result = setupSpreadsheet();
  ui.alert(
    'Setup concluído',
    'Abas criadas.\n\n' +
      'Admin: ' +
      (result.admins || '(preencha em Config → admins)') +
      '\nTemporada: ' +
      result.temporada +
      '\n\nPróximo: preencha a coluna Email na aba Times com o Gmail de cada GM.',
    ui.ButtonSet.OK
  );
}

function menuSeedData() {
  var ui = SpreadsheetApp.getUi();
  var email = getActiveEmail_();
  if (!email) {
    ui.alert('Não foi possível ler seu e-mail Google. Confira se você está logado.');
    return;
  }
  ensureSheets_();
  if (!getConfig_('admins')) {
    setConfig_('admins', email);
  }
  var user = buildUserFromEmail_(email);
  if (!user.isAdmin) {
    user.isAdmin = true;
  }
  try {
    var result = actionSeed_(user, { reset: false });
    ui.alert(
      'Dados demo criados',
      result.times +
        ' times\n' +
        result.jogadores +
        ' jogadores\n' +
        result.picks +
        ' picks\n' +
        result.standings +
        ' standings\n\nEdite os nomes dos times e e-mails na aba Times.',
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('Erro', err.message || String(err), ui.ButtonSet.OK);
  }
}

function menuShowDeployHelp() {
  var ui = SpreadsheetApp.getUi();
  ui.alert(
    'Publicar Web App',
    '1. Extensões → Apps Script\n' +
      '2. Implantar → Nova implantação → App da Web\n' +
      '3. Executar como: Usuário que acessa\n' +
      '4. Acesso: Qualquer pessoa\n' +
      '5. Copie a URL …/exec e cole no site\n\n' +
      'Detalhes: veja docs/SETUP-PASSO-1.md no repositório.',
    ui.ButtonSet.OK
  );
}
