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
