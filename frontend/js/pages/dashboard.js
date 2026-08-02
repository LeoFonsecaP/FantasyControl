window.Pages = window.Pages || {};

window.Pages.dashboard = async function () {
  const view = document.getElementById('view');
  const data = await DynastyAPI.api('getDashboard');
  const tiles = data.times
    .map(
      (t, i) => `
      <a class="team-tile" href="#/team?id=${encodeURIComponent(t.id)}" style="animation-delay:${i * 0.04}s">
        <h3>${UI.escapeHtml(t.nome)}</h3>
        <div class="meta">${UI.escapeHtml(t.responsavel || '—')}</div>
        <div class="stat-row">
          <span class="stat"><b>${t.numJogadores}</b> jogadores</span>
          <span class="stat"><b>${t.numPicksFuturos}</b> picks</span>
          <span class="stat warn"><b>${t.proximosDoLimite}</b> no limite</span>
        </div>
      </a>`
    )
    .join('');

  view.innerHTML = `
    <h1 class="page-title">Dashboard</h1>
    <p class="page-sub">Temporada ${data.temporadaAtual} · ${data.times.length} times</p>
    <div class="team-grid">${tiles || UI.empty('Nenhum time cadastrado. Rode o seed no Apps Script.')}</div>
  `;
};
