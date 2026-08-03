/**
 * Liga Dynasty - bundle gerado automaticamente.
 * Cole este arquivo inteiro em Extensoes -> Apps Script -> Codigo.gs
 * Regenerar: python3 - <<'PY' ...
 */

// ========== Config.gs ==========

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


// ========== Lock.gs ==========

/**
 * Script lock helpers for critical writes.
 */

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  var acquired = lock.tryLock(30000);
  if (!acquired) {
    throw new Error('Sistema ocupado. Tente novamente em alguns segundos.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}


// ========== Auth.gs ==========

/**
 * Authentication — Google account + allowlist + session token bridge.
 *
 * Cross-origin frontend (GitHub Pages) cannot rely on Session cookies alone.
 * Login opens ?action=authBridge (HtmlService), which mints a CacheService token
 * and postMessages it to the opener. Subsequent API calls send { token }.
 */

var TOKEN_TTL_SECONDS = 21600; // 6 hours

function getActiveEmail_() {
  var email = '';
  try {
    email = Session.getActiveUser().getEmail() || '';
  } catch (e) {
    email = '';
  }
  if (!email) {
    try {
      email = Session.getEffectiveUser().getEmail() || '';
    } catch (e2) {
      email = '';
    }
  }
  return String(email).toLowerCase().trim();
}

function getAllowlistEmails_() {
  var emails = {};
  getAdminEmails_().forEach(function (e) {
    emails[e] = true;
  });
  sheetToObjects_(SHEET_NAMES.TIMES).forEach(function (t) {
    var e = String(t.Email || '')
      .toLowerCase()
      .trim();
    if (e) emails[e] = true;
  });
  return emails;
}

function findTeamByEmail_(email) {
  var e = (email || '').toLowerCase().trim();
  var teams = sheetToObjects_(SHEET_NAMES.TIMES);
  for (var i = 0; i < teams.length; i++) {
    if (
      String(teams[i].Email || '')
        .toLowerCase()
        .trim() === e
    ) {
      return teams[i];
    }
  }
  return null;
}

function mintSessionToken_(email) {
  var token =
    Utilities.getUuid() +
    '-' +
    Utilities.base64EncodeWebSafe(email).replace(/=+$/, '');
  CacheService.getScriptCache().put('sess:' + token, email, TOKEN_TTL_SECONDS);
  return token;
}

function emailFromToken_(token) {
  if (!token) return '';
  var email = CacheService.getScriptCache().get('sess:' + token);
  return email ? String(email).toLowerCase().trim() : '';
}

function resolveEmail_(params) {
  var fromSession = getActiveEmail_();
  if (fromSession) return fromSession;
  return emailFromToken_(params && params.token);
}

function buildUserFromEmail_(email) {
  if (!email) {
    throw new Error('Faça login com sua conta Google.');
  }
  var allow = getAllowlistEmails_();
  if (!allow[email]) {
    throw new Error('Acesso negado. Seu e-mail não está autorizado na liga.');
  }
  var team = findTeamByEmail_(email);
  var admins = getAdminEmails_();
  var isAdmin = admins.indexOf(email) !== -1;
  return {
    email: email,
    teamId: team ? String(team.ID) : null,
    teamName: team ? String(team.Nome_Time) : null,
    role: isAdmin ? 'admin' : 'member',
    isAdmin: isAdmin
  };
}

function requireAuth_(params) {
  var email = resolveEmail_(params || {});
  return buildUserFromEmail_(email);
}

function requireAdmin_(user) {
  if (!user || !user.isAdmin) {
    throw new Error('Ação restrita a administradores.');
  }
}

function actionMe_(user) {
  return {
    email: user.email,
    teamId: user.teamId,
    teamName: user.teamName,
    role: user.role,
    isAdmin: user.isAdmin,
    temporadaAtual: getTemporadaAtual_()
  };
}

/**
 * Called from auth bridge HTML after Google session is available.
 */
function bridgeCompleteLogin(bridgeId) {
  ensureSheets_();
  var email = getActiveEmail_();
  if (!email) {
    return { ok: false, error: 'Não foi possível obter seu e-mail Google. Confirme o login.' };
  }
  var allow = getAllowlistEmails_();
  // During first setup, empty allowlist + no teams emails: allow creating admin via setup
  var allowEmpty = Object.keys(allow).length === 0;
  if (!allow[email] && !allowEmpty) {
    return { ok: false, error: 'Acesso negado. Seu e-mail não está autorizado na liga.' };
  }
  if (allowEmpty) {
    setConfig_('admins', email);
  }
  var token = mintSessionToken_(email);
  var user = buildUserFromEmail_(email);
  var result = {
    ok: true,
    token: token,
    user: actionMe_(user)
  };
  if (bridgeId) {
    try {
      CacheService.getScriptCache().put('bridge:' + String(bridgeId), JSON.stringify(result), 300);
    } catch (e) {
      // ignore cache write failure
    }
  }
  return result;
}

function authBridgeHtml_(params) {
  var bridgeId = String((params && params.bridgeId) || '');
  var html = HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><base target="_top">' +
      '<meta charset="utf-8"><title>Login Liga Dynasty</title>' +
      '<style>body{font-family:system-ui,sans-serif;background:#0c1222;color:#e8eefc;display:flex;' +
      'align-items:center;justify-content:center;min-height:100vh;margin:0}' +
      '.box{text-align:center;padding:2rem}h1{font-size:1.25rem;font-weight:600}' +
      'p{opacity:.75}.err{color:#ff8a8a}</style></head><body><div class="box">' +
      '<h1>Liga Dynasty</h1><p id="msg">Autenticando…</p></div>' +
      '<script>' +
      'function done(result){' +
      '  var msg=document.getElementById("msg");' +
      '  if(!result||!result.ok){msg.className="err";msg.textContent=(result&&result.error)||"Falha no login";return;}' +
      '  msg.textContent="Login ok. Enviando resposta para a página principal...";' +
      '  try{' +
      '    if(window.opener){' +
      '      window.opener.postMessage({type:"dynasty-auth",payload:result},"*");' +
      '      msg.textContent="Login ok. Resposta enviada. Pode fechar esta janela.";' +
      '    } else {' +
      '      msg.textContent="Login ok, mas opener não está disponível. Não foi possível avisar a página principal.";' +
      '    }' +
      '  }catch(e){' +
      '    msg.textContent="Login ok, mas falha no postMessage: "+String(e&&e.message||e);' +
      '  }' +
      '  setTimeout(function(){window.close();},2000);' +
      '}' +
      'google.script.run.withSuccessHandler(done).withFailureHandler(function(e){' +
      '  done({ok:false,error:String(e&&e.message||e)});' +
      '}).bridgeCompleteLogin(' + JSON.stringify(bridgeId) + ');' +
      '</script></body></html>'
  );
  html.setTitle('Login — Liga Dynasty');
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

function actionBridgeCheck_(params) {
  var bridgeId = String((params && params.bridgeId) || '').trim();
  if (!bridgeId) {
    return { found: false };
  }
  var payload = CacheService.getScriptCache().get('bridge:' + bridgeId);
  if (!payload) {
    return { found: false };
  }
  try {
    var result = JSON.parse(payload);
    CacheService.getScriptCache().remove('bridge:' + bridgeId);
    return {
      found: true,
      token: result.token,
      user: result.user
    };
  } catch (e) {
    return { found: false };
  }
}


// ========== Players.gs ==========

/**
 * Players / roster helpers and read endpoints.
 */

function getAllPlayers_() {
  return sheetToObjects_(SHEET_NAMES.JOGADORES).map(normalizePlayer_);
}

function normalizePlayer_(p) {
  return {
    id: String(p.ID),
    jogador: String(p.Jogador),
    timeId: String(p.Time_ID),
    round: parseInt(p.Round, 10),
    anoDraft: parseInt(p.Ano_Draft, 10),
    limite: parseInt(p.Limite, 10),
    status: String(p.Status || 'ativo').toLowerCase(),
    _row: p._row
  };
}

function getActiveRoster_(timeId) {
  return getAllPlayers_().filter(function (p) {
    return p.timeId === timeId && p.status !== 'dispensado';
  });
}

function expiryLevel_(limite, temporada) {
  var years = yearsUntilExpiry_(limite, temporada);
  if (years <= 0) return 'red';
  if (years === 1) return 'yellow';
  return 'green';
}

function enrichPlayer_(p, temporada, teamsById) {
  var team = teamsById[p.timeId];
  return {
    id: p.id,
    jogador: p.jogador,
    timeId: p.timeId,
    timeNome: team ? team.Nome_Time : p.timeId,
    round: p.round,
    anoDraft: p.anoDraft,
    limite: p.limite,
    status: p.status,
    elegivel: isKeeperEligible_(p.limite, temporada),
    anosRestantes: yearsUntilExpiry_(p.limite, temporada),
    nivel: expiryLevel_(p.limite, temporada)
  };
}

function getTeamsMap_() {
  var map = {};
  sheetToObjects_(SHEET_NAMES.TIMES).forEach(function (t) {
    map[String(t.ID)] = t;
  });
  return map;
}

function actionGetDashboard_(user) {
  var temporada = getTemporadaAtual_();
  var teams = sheetToObjects_(SHEET_NAMES.TIMES);
  var players = getAllPlayers_();
  var picks = getAllPicks_();

  return {
    temporadaAtual: temporada,
    times: teams.map(function (t) {
      var tid = String(t.ID);
      var roster = players.filter(function (p) {
        return p.timeId === tid && p.status !== 'dispensado';
      });
      var futurePicks = picks.filter(function (pk) {
        return pk.timeDonoAtual === tid && pk.usado === 'nao' && pk.ano >= temporada;
      });
      var nearLimit = roster.filter(function (p) {
        return yearsUntilExpiry_(p.limite, temporada) <= 1;
      });
      return {
        id: tid,
        nome: String(t.Nome_Time),
        responsavel: String(t.Responsavel || ''),
        email: String(t.Email || ''),
        numJogadores: roster.length,
        numPicksFuturos: futurePicks.length,
        proximosDoLimite: nearLimit.length
      };
    })
  };
}

function actionGetTeam_(user, params) {
  var timeId = params.timeId || user.teamId;
  if (!timeId) {
    throw new Error('Informe timeId.');
  }
  var temporada = getTemporadaAtual_();
  var teamsById = getTeamsMap_();
  var team = teamsById[timeId];
  if (!team) {
    throw new Error('Time não encontrado: ' + timeId);
  }

  var roster = getActiveRoster_(timeId).map(function (p) {
    return enrichPlayer_(p, temporada, teamsById);
  });

  var picks = getAllPicks_()
    .filter(function (pk) {
      return pk.timeDonoAtual === timeId && pk.usado === 'nao';
    })
    .map(function (pk) {
      var original = teamsById[pk.timeOriginal];
      return {
        id: pk.id,
        rodada: pk.rodada,
        ano: pk.ano,
        timeOriginal: pk.timeOriginal,
        timeOriginalNome: original ? String(original.Nome_Time) : pk.timeOriginal,
        original: pk.timeOriginal === timeId,
        usado: pk.usado
      };
    })
    .sort(function (a, b) {
      if (a.ano !== b.ano) return a.ano - b.ano;
      return a.rodada - b.rodada;
    });

  return {
    temporadaAtual: temporada,
    time: {
      id: String(team.ID),
      nome: String(team.Nome_Time),
      responsavel: String(team.Responsavel || ''),
      email: String(team.Email || '')
    },
    jogadores: roster,
    picks: picks
  };
}

function actionGetManagementData_(user, params) {
  requireAdmin_(user);
  var teams = sheetToObjects_(SHEET_NAMES.TIMES).map(function (t) {
    return {
      id: String(t.ID),
      nome: String(t.Nome_Time),
      responsavel: String(t.Responsavel || ''),
      email: String(t.Email || '')
    };
  });
  var players = getAllPlayers_().map(function (p) {
    return {
      id: p.id,
      jogador: p.jogador,
      timeId: p.timeId,
      round: p.round,
      anoDraft: p.anoDraft,
      status: p.status
    };
  });
  return {
    times: teams,
    players: players,
    admins: getAdminEmails_()
  };
}

function actionUpsertTeam_(user, params) {
  requireAdmin_(user);
  return withLock_(function () {
    var id = String(params.id || '').trim();
    var nome = String(params.nome || '').trim();
    var responsavel = String(params.responsavel || '').trim();
    var email = String(params.email || '').trim();

    if (!nome) throw new Error('Informe o nome do time.');

    var sheet = getSheet_(SHEET_NAMES.TIMES);
    var rows = sheetToObjects_(SHEET_NAMES.TIMES);
    var existing = null;
    for (var i = 0; i < rows.length; i++) {
      if (id && String(rows[i].ID) === id) {
        existing = rows[i];
        break;
      }
      if (!id && String(rows[i].Nome_Time).toLowerCase() === nome.toLowerCase()) {
        existing = rows[i];
        break;
      }
    }

    if (!id) {
      id = nextId_('T', SHEET_NAMES.TIMES, 'ID');
    }

    if (existing) {
      sheet.getRange(existing._row, 2).setValue(nome);
      sheet.getRange(existing._row, 3).setValue(responsavel);
      sheet.getRange(existing._row, 4).setValue(email);
      return { team: { id: String(existing.ID || id), nome: nome, responsavel: responsavel, email: email } };
    }

    sheet.appendRow([id, nome, responsavel, email]);
    return { team: { id: id, nome: nome, responsavel: responsavel, email: email } };
  });
}

function actionUpsertPlayer_(user, params) {
  requireAdmin_(user);
  return withLock_(function () {
    var id = String(params.id || '').trim();
    var jogador = String(params.jogador || '').trim();
    var timeId = String(params.timeId || '').trim();
    var round = parseInt(params.round, 10) || 1;
    var anoDraft = parseInt(params.anoDraft, 10) || getTemporadaAtual_();
    var status = String(params.status || 'ativo').trim().toLowerCase();

    if (!jogador) throw new Error('Informe o nome do jogador.');
    if (!timeId) throw new Error('Selecione um time para o jogador.');

    var sheet = getSheet_(SHEET_NAMES.JOGADORES);
    var rows = sheetToObjects_(SHEET_NAMES.JOGADORES);
    var existing = null;
    for (var i = 0; i < rows.length; i++) {
      if (id && String(rows[i].ID) === id) {
        existing = rows[i];
        break;
      }
      if (!id && String(rows[i].Jogador).toLowerCase() === jogador.toLowerCase()) {
        existing = rows[i];
        break;
      }
    }

    var limite = calcularLimite_(round, anoDraft);

    if (!id) {
      id = nextId_('J', SHEET_NAMES.JOGADORES, 'ID');
    }

    if (existing) {
      sheet.getRange(existing._row, 2).setValue(jogador);
      sheet.getRange(existing._row, 3).setValue(timeId);
      sheet.getRange(existing._row, 4).setValue(round);
      sheet.getRange(existing._row, 5).setValue(anoDraft);
      sheet.getRange(existing._row, 6).setValue(limite);
      sheet.getRange(existing._row, 7).setValue(status);
      return { player: { id: String(existing.ID || id), jogador: jogador, timeId: timeId, round: round, anoDraft: anoDraft, limite: limite, status: status } };
    }

    sheet.appendRow([id, jogador, timeId, round, anoDraft, limite, status]);
    return { player: { id: id, jogador: jogador, timeId: timeId, round: round, anoDraft: anoDraft, limite: limite, status: status } };
  });
}

function actionGetExpiring_(user, params) {
  var temporada = getTemporadaAtual_();
  var anoFiltro = params.ano ? parseInt(params.ano, 10) : null;
  var teamsById = getTeamsMap_();

  var list = getAllPlayers_()
    .filter(function (p) {
      if (p.status === 'dispensado') return false;
      if (anoFiltro) return p.limite === anoFiltro;
      return p.limite === temporada || p.limite === temporada + 1;
    })
    .map(function (p) {
      return enrichPlayer_(p, temporada, teamsById);
    })
    .sort(function (a, b) {
      if (a.limite !== b.limite) return a.limite - b.limite;
      return a.jogador.localeCompare(b.jogador);
    });

  return {
    temporadaAtual: temporada,
    filtroAno: anoFiltro,
    jogadores: list
  };
}

function updatePlayerTeam_(playerId, newTimeId) {
  var sheet = getSheet_(SHEET_NAMES.JOGADORES);
  var rows = sheetToObjects_(SHEET_NAMES.JOGADORES);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].ID) === playerId) {
      sheet.getRange(rows[i]._row, 3).setValue(newTimeId);
      return rows[i];
    }
  }
  throw new Error('Jogador não encontrado: ' + playerId);
}

function updatePlayerStatus_(playerId, status) {
  var sheet = getSheet_(SHEET_NAMES.JOGADORES);
  var rows = sheetToObjects_(SHEET_NAMES.JOGADORES);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].ID) === playerId) {
      sheet.getRange(rows[i]._row, 7).setValue(status);
      return;
    }
  }
  throw new Error('Jogador não encontrado: ' + playerId);
}


// ========== Picks.gs ==========

/**
 * Draft picks helpers.
 */

function getAllPicks_() {
  return sheetToObjects_(SHEET_NAMES.PICKS).map(normalizePick_);
}

function normalizePick_(p) {
  return {
    id: String(p.ID),
    timeDonoAtual: String(p.Time_Dono_Atual),
    timeOriginal: String(p.Time_Original),
    rodada: parseInt(p.Rodada, 10),
    ano: parseInt(p.Ano, 10),
    usado: String(p.Usado || 'nao')
      .toLowerCase()
      .replace('não', 'nao')
      .replace('sim', 'sim'),
    _row: p._row
  };
}

function updatePickOwner_(pickId, newTimeId) {
  var sheet = getSheet_(SHEET_NAMES.PICKS);
  var rows = sheetToObjects_(SHEET_NAMES.PICKS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].ID) === pickId) {
      sheet.getRange(rows[i]._row, 2).setValue(newTimeId);
      return rows[i];
    }
  }
  throw new Error('Pick não encontrado: ' + pickId);
}


// ========== Trades.gs ==========

/**
 * Trades — validation, apply under lock, history.
 */

function actionGetTrades_(user, params) {
  var timeId = params.timeId || null;
  var teamsById = getTeamsMap_();
  var trades = sheetToObjects_(SHEET_NAMES.TROCAS)
    .map(function (t) {
      var payload = {};
      try {
        payload = JSON.parse(String(t.Payload_JSON || '{}'));
      } catch (e) {
        payload = {};
      }
      var involved = String(t.Times_Envolvidos || '')
        .split(',')
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
      return {
        id: String(t.ID),
        data: String(t.Data),
        descricao: String(t.Descricao || ''),
        timesEnvolvidos: involved,
        timesNomes: involved.map(function (id) {
          return teamsById[id] ? String(teamsById[id].Nome_Time) : id;
        }),
        payload: payload
      };
    })
    .sort(function (a, b) {
      return String(b.data).localeCompare(String(a.data));
    });

  if (timeId) {
    trades = trades.filter(function (t) {
      return t.timesEnvolvidos.indexOf(timeId) !== -1;
    });
  }

  return { trades: trades };
}

function actionCreateTrade_(user, params) {
  return withLock_(function () {
    var lados = params.lados;
    if (!lados || !Array.isArray(lados) || lados.length < 2) {
      throw new Error('Uma troca precisa de pelo menos 2 times.');
    }

    var teamsById = getTeamsMap_();
    var playersById = {};
    getAllPlayers_().forEach(function (p) {
      playersById[p.id] = p;
    });
    var picksById = {};
    getAllPicks_().forEach(function (p) {
      picksById[p.id] = p;
    });

    var timeIds = [];
    var seenPlayers = {};
    var seenPicks = {};

    lados.forEach(function (lado) {
      var tid = String(lado.timeId || '');
      if (!teamsById[tid]) {
        throw new Error('Time inválido: ' + tid);
      }
      if (timeIds.indexOf(tid) !== -1) {
        throw new Error('Time duplicado na troca: ' + tid);
      }
      timeIds.push(tid);

      var envia = lado.envia || {};
      var jogs = envia.jogadores || [];
      var pks = envia.picks || [];

      jogs.forEach(function (jid) {
        jid = String(jid);
        if (seenPlayers[jid]) {
          throw new Error('Jogador repetido na troca: ' + jid);
        }
        seenPlayers[jid] = true;
        var pl = playersById[jid];
        if (!pl) throw new Error('Jogador não encontrado: ' + jid);
        if (pl.status === 'dispensado') {
          throw new Error('Jogador dispensado não pode ser trocado: ' + pl.jogador);
        }
        if (pl.timeId !== tid) {
          throw new Error(pl.jogador + ' não pertence ao time ' + tid);
        }
      });

      pks.forEach(function (pid) {
        pid = String(pid);
        if (seenPicks[pid]) {
          throw new Error('Pick repetido na troca: ' + pid);
        }
        seenPicks[pid] = true;
        var pk = picksById[pid];
        if (!pk) throw new Error('Pick não encontrado: ' + pid);
        if (pk.usado === 'sim') {
          throw new Error('Pick já usado: ' + pid);
        }
        if (pk.timeDonoAtual !== tid) {
          throw new Error('Pick ' + pid + ' não pertence ao time ' + tid);
        }
      });
    });

    // Snapshot for rollback
    var playerSnapshots = [];
    var pickSnapshots = [];
    Object.keys(seenPlayers).forEach(function (jid) {
      playerSnapshots.push({ id: jid, timeId: playersById[jid].timeId });
    });
    Object.keys(seenPicks).forEach(function (pid) {
      pickSnapshots.push({ id: pid, timeId: picksById[pid].timeDonoAtual });
    });

    // Multi-team: each item sent by A goes to the "next" counterparty pool.
    // Spec: items each side sends are received by the other side(s).
    // For 2 teams: A→B, B→A.
    // For 3+: each side's outgoing items are distributed to other sides in round-robin
    // of recipients — simpler model used here: for 2-party classic swap;
    // for N parties, each sender's items go to a single designated receiver
    // if `lado.recebeDe` is set; otherwise 2-team swap only if length===2.
    try {
      if (lados.length === 2) {
        applyTwoTeamTrade_(lados);
      } else {
        applyMultiTeamTrade_(lados);
      }
    } catch (err) {
      rollbackTrade_(playerSnapshots, pickSnapshots);
      throw err;
    }

    var descricao = buildTradeDescription_(lados, teamsById, playersById, picksById);
    var tradeId = nextId_('X', SHEET_NAMES.TROCAS, 'ID');
    var data = new Date().toISOString();
    var payload = { lados: lados };

    getSheet_(SHEET_NAMES.TROCAS).appendRow([
      tradeId,
      data,
      descricao,
      timeIds.join(','),
      JSON.stringify(payload)
    ]);

    return {
      trade: {
        id: tradeId,
        data: data,
        descricao: descricao,
        timesEnvolvidos: timeIds,
        payload: payload
      }
    };
  });
}

function applyTwoTeamTrade_(lados) {
  var a = lados[0];
  var b = lados[1];
  var aId = String(a.timeId);
  var bId = String(b.timeId);
  var aEnv = a.envia || {};
  var bEnv = b.envia || {};

  (aEnv.jogadores || []).forEach(function (jid) {
    updatePlayerTeam_(String(jid), bId);
  });
  (aEnv.picks || []).forEach(function (pid) {
    updatePickOwner_(String(pid), bId);
  });
  (bEnv.jogadores || []).forEach(function (jid) {
    updatePlayerTeam_(String(jid), aId);
  });
  (bEnv.picks || []).forEach(function (pid) {
    updatePickOwner_(String(pid), aId);
  });
}

/**
 * Multi-team: each side may specify `recebeDe` timeId whose outgoing items
 * this side receives. If omitted, items from side i go to side (i+1) % n.
 */
function applyMultiTeamTrade_(lados) {
  var n = lados.length;
  for (var i = 0; i < n; i++) {
    var sender = lados[i];
    var receiverIdx = (i + 1) % n;
    if (sender.destinoTimeId) {
      for (var j = 0; j < n; j++) {
        if (String(lados[j].timeId) === String(sender.destinoTimeId)) {
          receiverIdx = j;
          break;
        }
      }
    }
    var receiverId = String(lados[receiverIdx].timeId);
    var env = sender.envia || {};
    (env.jogadores || []).forEach(function (jid) {
      updatePlayerTeam_(String(jid), receiverId);
    });
    (env.picks || []).forEach(function (pid) {
      updatePickOwner_(String(pid), receiverId);
    });
  }
}

function rollbackTrade_(playerSnapshots, pickSnapshots) {
  playerSnapshots.forEach(function (s) {
    try {
      updatePlayerTeam_(s.id, s.timeId);
    } catch (e) {
      /* best effort */
    }
  });
  pickSnapshots.forEach(function (s) {
    try {
      updatePickOwner_(s.id, s.timeId);
    } catch (e) {
      /* best effort */
    }
  });
}

function buildTradeDescription_(lados, teamsById, playersById, picksById) {
  var parts = lados.map(function (lado) {
    var nome = teamsById[lado.timeId]
      ? String(teamsById[lado.timeId].Nome_Time)
      : lado.timeId;
    var env = lado.envia || {};
    var items = [];
    (env.jogadores || []).forEach(function (jid) {
      var p = playersById[String(jid)];
      items.push(p ? p.jogador : jid);
    });
    (env.picks || []).forEach(function (pid) {
      var pk = picksById[String(pid)];
      if (pk) {
        items.push(pk.rodada + 'ª ' + pk.ano);
      } else {
        items.push(pid);
      }
    });
    return nome + ' envia: ' + (items.length ? items.join(', ') : '(nada)');
  });
  return parts.join(' | ');
}


// ========== Keeps.gs ==========

/**
 * Keep / cut decisions per season.
 */

function actionSetKeeps_(user, params) {
  return withLock_(function () {
    var timeId = params.timeId || user.teamId;
    if (!timeId) {
      throw new Error('Informe timeId.');
    }
    if (!user.isAdmin && user.teamId !== timeId) {
      throw new Error('Você só pode registrar keeps do seu time.');
    }

    var temporada = getTemporadaAtual_();
    var decisoes = params.decisoes || [];
    if (!Array.isArray(decisoes) || decisoes.length === 0) {
      throw new Error('Informe as decisões de keep.');
    }

    var roster = getActiveRoster_(timeId);
    var byId = {};
    roster.forEach(function (p) {
      byId[p.id] = p;
    });

    var updated = [];
    decisoes.forEach(function (d) {
      var pid = String(d.playerId || d.id);
      var status = String(d.status || '').toLowerCase();
      if (status !== 'mantido' && status !== 'dispensado' && status !== 'ativo') {
        throw new Error('Status inválido: ' + status);
      }
      var pl = byId[pid];
      if (!pl) {
        throw new Error('Jogador não está no elenco: ' + pid);
      }
      if (status === 'mantido' && !isKeeperEligible_(pl.limite, temporada)) {
        throw new Error(
          pl.jogador + ' não é elegível a keep (limite ' + pl.limite + ').'
        );
      }
      updatePlayerStatus_(pid, status);
      updated.push({ id: pid, status: status });
    });

    return {
      timeId: timeId,
      temporada: temporada,
      updated: updated
    };
  });
}

function actionGetKeepCandidates_(user, params) {
  var timeId = params.timeId || user.teamId;
  if (!timeId) throw new Error('Informe timeId.');
  var temporada = getTemporadaAtual_();
  var teamsById = getTeamsMap_();
  var roster = getActiveRoster_(timeId).map(function (p) {
    return enrichPlayer_(p, temporada, teamsById);
  });
  return {
    temporadaAtual: temporada,
    timeId: timeId,
    jogadores: roster
  };
}


// ========== Standings.gs ==========

/**
 * Standings and hall of fame.
 */

function actionGetStandings_(user, params) {
  var ano = params.ano ? parseInt(params.ano, 10) : null;
  var teamsById = getTeamsMap_();
  var rows = sheetToObjects_(SHEET_NAMES.STANDINGS).map(function (s) {
    var tid = String(s.Time_ID);
    var team = teamsById[tid];
    return {
      id: String(s.ID),
      ano: parseInt(s.Ano, 10),
      timeId: tid,
      timeNome: team ? String(team.Nome_Time) : tid,
      vitorias: parseInt(s.Vitorias, 10) || 0,
      derrotas: parseInt(s.Derrotas, 10) || 0,
      posicaoFinal: parseInt(s.Posicao_Final, 10) || 0,
      campeao:
        String(s.Campeao || 'nao')
          .toLowerCase()
          .indexOf('sim') === 0
    };
  });

  var champions = rows
    .filter(function (r) {
      return r.campeao;
    })
    .sort(function (a, b) {
      return b.ano - a.ano;
    });

  var standings = rows;
  if (ano) {
    standings = rows
      .filter(function (r) {
        return r.ano === ano;
      })
      .sort(function (a, b) {
        return a.posicaoFinal - b.posicaoFinal;
      });
  } else {
    standings = rows.sort(function (a, b) {
      if (a.ano !== b.ano) return b.ano - a.ano;
      return a.posicaoFinal - b.posicaoFinal;
    });
  }

  var anos = [];
  rows.forEach(function (r) {
    if (anos.indexOf(r.ano) === -1) anos.push(r.ano);
  });
  anos.sort(function (a, b) {
    return b - a;
  });

  return {
    ano: ano,
    anos: anos,
    standings: standings,
    campeoes: champions
  };
}

function actionUpsertStanding_(user, params) {
  requireAdmin_(user);
  return withLock_(function () {
    var ano = parseInt(params.ano, 10);
    var timeId = String(params.timeId);
    var teamsById = getTeamsMap_();
    if (!teamsById[timeId]) throw new Error('Time inválido.');
    if (!ano) throw new Error('Informe o ano.');

    var vitorias = parseInt(params.vitorias, 10) || 0;
    var derrotas = parseInt(params.derrotas, 10) || 0;
    var posicao = parseInt(params.posicaoFinal, 10) || 0;
    var campeao = params.campeao === true || params.campeao === 'sim' ? 'sim' : 'nao';

    var sheet = getSheet_(SHEET_NAMES.STANDINGS);
    var rows = sheetToObjects_(SHEET_NAMES.STANDINGS);
    var existing = null;
    for (var i = 0; i < rows.length; i++) {
      if (parseInt(rows[i].Ano, 10) === ano && String(rows[i].Time_ID) === timeId) {
        existing = rows[i];
        break;
      }
    }

    if (campeao === 'sim') {
      rows.forEach(function (r) {
        if (parseInt(r.Ano, 10) === ano && String(r.Campeao).toLowerCase().indexOf('sim') === 0) {
          sheet.getRange(r._row, 7).setValue('nao');
        }
      });
    }

    if (existing) {
      sheet.getRange(existing._row, 4, existing._row, 7).setValues([[vitorias, derrotas, posicao, campeao]]);
      return {
        standing: {
          id: String(existing.ID),
          ano: ano,
          timeId: timeId,
          vitorias: vitorias,
          derrotas: derrotas,
          posicaoFinal: posicao,
          campeao: campeao === 'sim'
        }
      };
    }

    var id = nextId_('S', SHEET_NAMES.STANDINGS, 'ID');
    sheet.appendRow([id, ano, timeId, vitorias, derrotas, posicao, campeao]);
    return {
      standing: {
        id: id,
        ano: ano,
        timeId: timeId,
        vitorias: vitorias,
        derrotas: derrotas,
        posicaoFinal: posicao,
        campeao: campeao === 'sim'
      }
    };
  });
}


// ========== Code.gs ==========

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
      return authBridgeHtml_(params);
    }

    if (action === 'bridgeCheck') {
      return jsonResponse_({ ok: true, data: actionBridgeCheck_(params) });
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
      case 'getManagementData':
        data = actionGetManagementData_(user, params);
        break;
      case 'upsertTeam':
        data = actionUpsertTeam_(user, params);
        break;
      case 'upsertPlayer':
        data = actionUpsertPlayer_(user, params);
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
