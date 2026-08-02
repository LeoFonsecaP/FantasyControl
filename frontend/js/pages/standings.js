window.Pages = window.Pages || {};

window.Pages.standings = async function (route) {
  const view = document.getElementById('view');
  const anoParam = route.params.ano || '';
  const data = await DynastyAPI.api(
    'getStandings',
    anoParam ? { ano: parseInt(anoParam, 10) } : {}
  );
  const isAdmin = App.user && App.user.isAdmin;
  const teamsData = isAdmin ? await DynastyAPI.api('listTeams') : { times: [] };

  const yearOptions = (data.anos || [])
    .map((y) => `<option value="${y}" ${String(y) === String(anoParam) ? 'selected' : ''}>${y}</option>`)
    .join('');

  const rows = (anoParam ? data.standings : data.standings.filter((s) => !anoParam || s.ano === parseInt(anoParam, 10)))
    .map(
      (s) => `
      <tr>
        <td>${s.posicaoFinal || '—'}</td>
        <td>${UI.escapeHtml(s.timeNome)}</td>
        <td>${s.ano}</td>
        <td>${s.vitorias}</td>
        <td>${s.derrotas}</td>
        <td>${s.campeao ? '<span class="pill orig">Campeão</span>' : ''}</td>
      </tr>`
    )
    .join('');

  const hof = data.campeoes
    .map(
      (c) => `
      <div class="hof-item">
        <span class="year">${c.ano}</span>
        <strong>${UI.escapeHtml(c.timeNome)}</strong>
        <span class="muted">${c.vitorias}–${c.derrotas}</span>
      </div>`
    )
    .join('');

  view.innerHTML = `
    <h1 class="page-title">Standings</h1>
    <p class="page-sub">Classificação e hall of fame</p>
    <div class="toolbar">
      <label class="field">Temporada
        <select id="st-ano">
          <option value="">Todas</option>
          ${yearOptions}
        </select>
      </label>
    </div>
    <div id="st-msg"></div>
    <h2>Tabela</h2>
    ${
      rows
        ? `<div class="table-wrap"><table class="data">
            <thead><tr><th>#</th><th>Time</th><th>Ano</th><th>V</th><th>D</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>`
        : UI.empty('Sem standings cadastrados.')
    }
    <h2>Hall of Fame</h2>
    <div class="hof-list">${hof || UI.empty('Nenhum campeão registrado.')}</div>
    ${
      isAdmin
        ? `<h2>Registrar / atualizar (admin)</h2>
      <div class="toolbar" id="admin-st" style="align-items:flex-end">
        <label class="field">Ano<input type="number" id="up-ano" value="${new Date().getFullYear() - 1}" /></label>
        <label class="field">Time
          <select id="up-time">${teamsData.times.map((t) => `<option value="${UI.escapeHtml(t.id)}">${UI.escapeHtml(t.nome)}</option>`).join('')}</select>
        </label>
        <label class="field">Vitórias<input type="number" id="up-v" value="0" /></label>
        <label class="field">Derrotas<input type="number" id="up-d" value="0" /></label>
        <label class="field">Posição<input type="number" id="up-pos" value="1" /></label>
        <label class="field">Campeão
          <select id="up-champ"><option value="nao">Não</option><option value="sim">Sim</option></select>
        </label>
        <button class="btn" type="button" id="up-save">Salvar</button>
      </div>`
        : ''
    }
  `;

  view.querySelector('#st-ano').addEventListener('change', (e) => {
    const v = e.target.value;
    location.hash = v ? `#/standings?ano=${v}` : '#/standings';
  });

  if (isAdmin) {
    view.querySelector('#up-save').addEventListener('click', async () => {
      const msg = view.querySelector('#st-msg');
      msg.innerHTML = '';
      try {
        await DynastyAPI.api('upsertStanding', {
          ano: parseInt(view.querySelector('#up-ano').value, 10),
          timeId: view.querySelector('#up-time').value,
          vitorias: parseInt(view.querySelector('#up-v').value, 10),
          derrotas: parseInt(view.querySelector('#up-d').value, 10),
          posicaoFinal: parseInt(view.querySelector('#up-pos').value, 10),
          campeao: view.querySelector('#up-champ').value
        });
        msg.innerHTML = UI.success('Standing salvo.');
        location.hash = `#/standings?ano=${view.querySelector('#up-ano').value}`;
        // force reload if same hash
        App.navigate();
      } catch (e) {
        msg.innerHTML = UI.error(e.message || String(e));
      }
    });
  }
};
