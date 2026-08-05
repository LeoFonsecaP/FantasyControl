window.Pages = window.Pages || {};

window.Pages.keeps = async function () {
  const view = document.getElementById('view');
  const teamsData = await DynastyAPI.api('listTeams');
  const teams = teamsData.times;
  const defaultTeam = (App.user && App.user.teamId) || (teams[0] && teams[0].id) || '';

  view.innerHTML = `
    <h1 class="page-title">Keeps</h1>
    <p class="page-sub">Marque mantido ou dispensado para a temporada atual.</p>
    <div class="toolbar">
      <label class="field">Time
        <select id="keep-team">
          ${teams
            .map(
              (t) =>
                `<option value="${UI.escapeHtml(t.id)}" ${t.id === defaultTeam ? 'selected' : ''}>${UI.escapeHtml(t.nome)}</option>`
            )
            .join('')}
        </select>
      </label>
    </div>
    <div id="keep-msg"></div>
    <div id="keep-list"></div>
    <div class="toolbar" style="margin-top:1.5rem">
      <button class="btn" type="button" id="save-keeps" style="width:100%">Salvar decisões</button>
    </div>
  `;

  const decisions = {};

  async function load() {
    const timeId = view.querySelector('#keep-team').value;
    const list = view.querySelector('#keep-list');
    list.innerHTML = UI.loading();
    Object.keys(decisions).forEach((k) => delete decisions[k]);
    try {
      const data = await DynastyAPI.api('getKeepCandidates', { timeId });
      if (!data.jogadores.length) {
        list.innerHTML = UI.empty('Nenhum jogador no elenco.');
        return;
      }
      list.innerHTML = data.jogadores
        .map((p) => {
          const current = p.status === 'mantido' || p.status === 'dispensado' ? p.status : 'ativo';
          decisions[p.id] = current;
          const disabledKeep = !p.elegivel;
          return `
            <div class="keep-row">
              <div>
                <strong>${UI.escapeHtml(p.jogador)}</strong>
                <div class="muted" style="font-size:0.85rem">
                  ${p.round}ª · draft ${p.anoDraft} · limite ${p.limite} · ${UI.badge(p.nivel)}
                  ${disabledKeep ? ' · não elegível a keep' : ''}
                </div>
              </div>
              <div class="segmented" data-id="${UI.escapeHtml(p.id)}">
                <button type="button" data-status="mantido" ${disabledKeep ? 'disabled' : ''} class="${current === 'mantido' ? 'active' : ''}">Mantido</button>
                <button type="button" data-status="ativo" class="${current === 'ativo' ? 'active' : ''}">Ativo</button>
                <button type="button" data-status="dispensado" class="${current === 'dispensado' ? 'active' : ''}">Dispensado</button>
              </div>
            </div>`;
        })
        .join('');

      list.querySelectorAll('.segmented').forEach((seg) => {
        seg.addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-status]');
          if (!btn || btn.disabled) return;
          const id = seg.dataset.id;
          decisions[id] = btn.dataset.status;
          seg.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    } catch (e) {
      list.innerHTML = UI.error(e.message || String(e));
    }
  }

  view.querySelector('#keep-team').addEventListener('change', load);
  view.querySelector('#save-keeps').addEventListener('click', async () => {
    const msg = view.querySelector('#keep-msg');
    msg.innerHTML = '';
    const timeId = view.querySelector('#keep-team').value;
    const decisoes = Object.keys(decisions).map((id) => ({
      playerId: id,
      status: decisions[id]
    }));
    try {
      await DynastyAPI.api('setKeeps', { timeId, decisoes });
      msg.innerHTML = UI.success('Keeps salvos.');
      await load();
    } catch (e) {
      msg.innerHTML = UI.error(e.message || String(e));
    }
  });

  await load();
};
