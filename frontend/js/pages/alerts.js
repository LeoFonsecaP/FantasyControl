window.Pages = window.Pages || {};

window.Pages.alerts = async function (route) {
  const view = document.getElementById('view');
  const ano = route.params.ano || '';
  const payload = ano ? { ano: parseInt(ano, 10) } : {};
  const data = await DynastyAPI.api('getExpiring', payload);

  const years = [];
  for (let y = data.temporadaAtual; y <= data.temporadaAtual + 6; y++) years.push(y);

  const rows = data.jogadores
    .map(
      (p) => `
      <tr>
        <td>${UI.escapeHtml(p.jogador)}</td>
        <td><a href="#/team?id=${encodeURIComponent(p.timeId)}">${UI.escapeHtml(p.timeNome)}</a></td>
        <td>${p.round}ª / ${p.anoDraft}</td>
        <td>${p.limite}</td>
        <td>${UI.badge(p.nivel)}</td>
      </tr>`
    )
    .join('');

  view.innerHTML = `
    <h1 class="page-title">Alertas de keeper</h1>
    <p class="page-sub">Jogadores próximos do limite · temporada ${data.temporadaAtual}</p>
    <div class="toolbar">
      <label class="field">Filtrar por ano de expiração
        <select id="ano-filter">
          <option value="">Próxima temporada (padrão)</option>
          ${years.map((y) => `<option value="${y}" ${String(y) === String(ano) ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
      </label>
    </div>
    ${
      data.jogadores.length
        ? `<div class="table-wrap"><table class="data">
            <thead><tr><th>Jogador</th><th>Time</th><th>Draft</th><th>Limite</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>`
        : UI.empty('Nenhum jogador neste filtro.')
    }
  `;

  view.querySelector('#ano-filter').addEventListener('change', (e) => {
    const v = e.target.value;
    location.hash = v ? `#/alerts?ano=${v}` : '#/alerts';
  });
};
