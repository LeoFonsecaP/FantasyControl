window.Pages = window.Pages || {};

window.Pages.history = async function (route) {
  const view = document.getElementById('view');
  const teamsData = await DynastyAPI.api('listTeams');
  const filter = route.params.timeId || '';
  const data = await DynastyAPI.api('getTrades', filter ? { timeId: filter } : {});

  const items = data.trades
    .map(
      (t) => `
      <div class="hof-item" style="flex-direction:column;align-items:stretch;gap:0.35rem">
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap">
          <strong>${UI.escapeHtml(t.id)}</strong>
          <span class="muted">${UI.escapeHtml(String(t.data).slice(0, 19).replace('T', ' '))}</span>
        </div>
        <div>${UI.escapeHtml(t.descricao)}</div>
        <div class="muted" style="font-size:0.85rem">${UI.escapeHtml((t.timesNomes || []).join(' · '))}</div>
      </div>`
    )
    .join('');

  view.innerHTML = `
    <h1 class="page-title">Histórico de trocas</h1>
    <p class="page-sub">Registro cronológico das movimentações</p>
    <div class="toolbar">
      <label class="field">Filtrar por time
        <select id="hist-team">
          <option value="">Todos</option>
          ${teamsData.times
            .map(
              (t) =>
                `<option value="${UI.escapeHtml(t.id)}" ${t.id === filter ? 'selected' : ''}>${UI.escapeHtml(t.nome)}</option>`
            )
            .join('')}
        </select>
      </label>
    </div>
    <div class="hof-list">
      ${items || UI.empty('Nenhuma troca registrada ainda.')}
    </div>
  `;

  view.querySelector('#hist-team').addEventListener('change', (e) => {
    const v = e.target.value;
    location.hash = v ? `#/history?timeId=${encodeURIComponent(v)}` : '#/history';
  });
};
