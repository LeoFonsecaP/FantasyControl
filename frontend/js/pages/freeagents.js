window.Pages = window.Pages || {};

window.Pages.freeagents = async function (route) {
  const view = document.getElementById('view');
  const ano = route.params.ano || '';
  const payload = ano ? { ano: parseInt(ano, 10) } : {};
  const data = await DynastyAPI.api('getFreeAgents', payload);

  const rows = data.jogadores
    .map(
      (p) => `
      <tr>
        <td>${UI.escapeHtml(p.jogador)}</td>
        <td><a href="#/team?id=${encodeURIComponent(p.timeId)}">${UI.escapeHtml(p.timeNome)}</a></td>
        <td>${p.round}ª / ${p.anoDraft}</td>
        <td>${p.limite}</td>
        <td>${p.anosRestantes >= 0 ? p.anosRestantes : 0}</td>
        <td>${UI.badge(p.nivel)}</td>
      </tr>`
    )
    .join('');

  // Resumo por ano de expiração (independente do filtro ativo)
  const resumo = data.resumo || [];
  const totalGeral = resumo.reduce((acc, r) => acc + (r.total || 0), 0);
  const summaryHtml = resumo
    .map(
      (r) => `
      <a class="year-chip ${String(r.ano) === String(ano) ? 'active' : ''}" href="#/freeagents?ano=${r.ano}">
        ${r.ano} <span class="count">${r.total}</span>
      </a>`
    )
    .join('');

  view.innerHTML = `
    <h1 class="page-title">Free Agent Tracker</h1>
    <p class="page-sub">Todos os jogadores por ano de expiração · temporada ${data.temporadaAtual}</p>

    <div class="toolbar">
      <label class="field">Filtrar por ano de expiração
        <select id="ano-filter">
          <option value="">Todos os anos</option>
          ${(data.anos || [])
            .map((y) => `<option value="${y}" ${String(y) === String(ano) ? 'selected' : ''}>${y}</option>`)
            .join('')}
        </select>
      </label>
    </div>

    <div class="year-summary">
      <a class="year-chip ${!ano ? 'active' : ''}" href="#/freeagents">Todos <span class="count">${totalGeral}</span></a>
      ${summaryHtml}
    </div>

    ${
      data.jogadores.length
        ? `<div class="table-wrap"><table class="data">
            <thead><tr><th>Jogador</th><th>Time</th><th>Draft</th><th>Expira</th><th>Anos rest.</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>`
        : UI.empty('Nenhum jogador neste filtro.')
    }
  `;

  view.querySelector('#ano-filter').addEventListener('change', (e) => {
    const v = e.target.value;
    location.hash = v ? `#/freeagents?ano=${v}` : '#/freeagents';
  });
};