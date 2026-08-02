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
