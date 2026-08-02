window.Pages = window.Pages || {};

window.Pages.team = async function (route) {
  const view = document.getElementById('view');
  const timeId = route.params.id || (App.user && App.user.teamId);
  if (!timeId) {
    view.innerHTML = UI.error('Selecione um time no dashboard.');
    return;
  }
  const data = await DynastyAPI.api('getTeam', { timeId });
  const t = data.time;

  const playersRows = data.jogadores
    .map(
      (p) => `
      <tr>
        <td>${UI.escapeHtml(p.jogador)}</td>
        <td>${p.round}ª</td>
        <td>${p.anoDraft}</td>
        <td>${p.limite}</td>
        <td>${UI.badge(p.nivel)}</td>
        <td>${UI.escapeHtml(p.status)}</td>
      </tr>`
    )
    .join('');

  const picksRows = data.picks
    .map(
      (pk) => `
      <tr>
        <td>${pk.rodada}ª / ${pk.ano}</td>
        <td>
          <span class="pill ${pk.original ? 'orig' : 'traded'}">
            ${pk.original ? 'Original' : 'Recebido'}
          </span>
        </td>
        <td>${UI.escapeHtml(pk.timeOriginalNome)}</td>
      </tr>`
    )
    .join('');

  view.innerHTML = `
    <h1 class="page-title">${UI.escapeHtml(t.nome)}</h1>
    <p class="page-sub">${UI.escapeHtml(t.responsavel || '')} · Temporada ${data.temporadaAtual}</p>

    <h2>Elenco</h2>
    ${
      data.jogadores.length
        ? `<div class="table-wrap"><table class="data">
            <thead><tr><th>Jogador</th><th>Round</th><th>Draft</th><th>Limite</th><th>Status</th><th></th></tr></thead>
            <tbody>${playersRows}</tbody>
          </table></div>`
        : UI.empty('Nenhum jogador no elenco.')
    }

    <h2>Picks futuros</h2>
    ${
      data.picks.length
        ? `<div class="table-wrap"><table class="data">
            <thead><tr><th>Pick</th><th>Origem</th><th>Time original</th></tr></thead>
            <tbody>${picksRows}</tbody>
          </table></div>`
        : UI.empty('Nenhum pick futuro.')
    }
  `;
};
