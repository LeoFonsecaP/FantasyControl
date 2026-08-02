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
