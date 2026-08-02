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
