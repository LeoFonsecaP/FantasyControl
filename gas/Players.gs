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
