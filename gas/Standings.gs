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
