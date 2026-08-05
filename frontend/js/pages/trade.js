window.Pages = window.Pages || {};

window.Pages.trade = async function () {
  const view = document.getElementById('view');
  const teamsData = await DynastyAPI.api('listTeams');
  const teams = teamsData.times;

  view.innerHTML = `
    <h1 class="page-title">Nova troca</h1>
    <p class="page-sub">Selecione os times e o que cada um envia.</p>
    <div id="trade-msg"></div>
    <div class="toolbar">
      <button class="btn btn-ghost" type="button" id="add-side">+ Time</button>
      <button class="btn" type="button" id="confirm-trade">Confirmar troca</button>
    </div>
    <div class="trade-sides" id="sides"></div>
    <h2>Preview</h2>
    <div class="preview-box" id="preview">Selecione itens para ver o resumo.</div>
  `;

  const sidesEl = view.querySelector('#sides');
  const state = {
    sides: [
      { timeId: '', jogadores: new Set(), picks: new Set() }
    ],
    cache: {}
  };

  async function loadTeamAssets(timeId) {
    if (!timeId) return { jogadores: [], picks: [] };
    if (state.cache[timeId]) return state.cache[timeId];
    const data = await DynastyAPI.api('getTeam', { timeId });
    state.cache[timeId] = { jogadores: data.jogadores, picks: data.picks, nome: data.time.nome };
    return state.cache[timeId];
  }

  function teamOptions(selected) {
    return teams
      .map(
        (t) =>
          `<option value="${UI.escapeHtml(t.id)}" ${t.id === selected ? 'selected' : ''}>${UI.escapeHtml(t.nome)}</option>`
      )
      .join('');
  }

  async function renderSides() {
    sidesEl.innerHTML = '';
    for (let i = 0; i < state.sides.length; i++) {
      const side = state.sides[i];
      const assets = await loadTeamAssets(side.timeId);
      const panel = document.createElement('div');
      panel.className = 'side-panel';
      panel.innerHTML = `
        <h3>Lado ${i + 1}</h3>
        <label class="field">Time
          <select data-side="${i}" class="side-team">${teamOptions(side.timeId)}</select>
        </label>
        <p class="muted" style="margin:0.75rem 0 0.25rem;font-size:0.8rem">Jogadores</p>
        <div class="check-list" data-kind="jogadores" data-side="${i}">
          ${
            assets.jogadores.length
              ? assets.jogadores
                  .map(
                    (p) => `<label><input type="checkbox" value="${UI.escapeHtml(p.id)}" ${
                      side.jogadores.has(p.id) ? 'checked' : ''
                    }/> ${UI.escapeHtml(p.jogador)} <span class="muted">(${p.round}ª/${p.anoDraft})</span></label>`
                  )
                  .join('')
              : '<span class="muted">Sem jogadores</span>'
          }
        </div>
        <p class="muted" style="margin:0.25rem 0;font-size:0.8rem">Picks</p>
        <div class="check-list" data-kind="picks" data-side="${i}">
          ${
            assets.picks.length
              ? assets.picks
                  .map(
                    (pk) => `<label><input type="checkbox" value="${UI.escapeHtml(pk.id)}" ${
                      side.picks.has(pk.id) ? 'checked' : ''
                    }/> ${pk.rodada}ª ${pk.ano} ${
                      pk.original ? '' : '<span class="pill traded">recebido</span>'
                    } <span class="muted">(${UI.escapeHtml(pk.timeDonoAtualNome || pk.timeDonoAtual)})</span></label>`
                  )
                  .join('')
              : '<span class="muted">Sem picks</span>'
          }
        </div>
        ${
          state.sides.length > 2
            ? `<button class="btn btn-ghost" type="button" data-remove="${i}" style="margin-top:0.5rem">Remover lado</button>`
            : ''
        }
      `;
      sidesEl.appendChild(panel);
    }
    bindSideEvents();
    updatePreview();
  }

  function bindSideEvents() {
    sidesEl.querySelectorAll('.side-team').forEach((sel) => {
      sel.addEventListener('change', async (e) => {
        const i = parseInt(e.target.dataset.side, 10);
        state.sides[i].timeId = e.target.value;
        state.sides[i].jogadores = new Set();
        state.sides[i].picks = new Set();
        await renderSides();
      });
    });
    sidesEl.querySelectorAll('.check-list').forEach((list) => {
      list.addEventListener('change', (e) => {
        if (e.target.tagName !== 'INPUT') return;
        const i = parseInt(list.dataset.side, 10);
        const kind = list.dataset.kind;
        if (e.target.checked) state.sides[i][kind].add(e.target.value);
        else state.sides[i][kind].delete(e.target.value);
        updatePreview();
      });
    });
    sidesEl.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const i = parseInt(btn.dataset.remove, 10);
        if (state.sides.length <= 2) return;
        state.sides.splice(i, 1);
        await renderSides();
      });
    });
  }

  function updatePreview() {
    const lines = state.sides.map((side, i) => {
      const nome = (state.cache[side.timeId] && state.cache[side.timeId].nome) || side.timeId || `Lado ${i + 1}`;
      const j = [...side.jogadores].map((id) => {
        const list = (state.cache[side.timeId] && state.cache[side.timeId].jogadores) || [];
        const p = list.find((x) => x.id === id);
        return p ? p.jogador : id;
      });
      const p = [...side.picks].map((id) => {
        const list = (state.cache[side.timeId] && state.cache[side.timeId].picks) || [];
        const pk = list.find((x) => x.id === id);
        return pk ? `${pk.rodada}ª ${pk.ano}` : id;
      });
      const items = [...j, ...p];
      return `${nome} envia: ${items.length ? items.join(', ') : '(nada)'}`;
    });
    view.querySelector('#preview').textContent = lines.join('\n');
  }

  view.querySelector('#add-side').addEventListener('click', async () => {
    const used = new Set(state.sides.map((s) => s.timeId));
    const next = teams.find((t) => !used.has(t.id));
    state.sides.push({
      timeId: next ? next.id : '',
      jogadores: new Set(),
      picks: new Set()
    });
    await renderSides();
  });

  view.querySelector('#confirm-trade').addEventListener('click', async () => {
    const msg = view.querySelector('#trade-msg');
    msg.innerHTML = '';
    const lados = state.sides.map((s) => ({
      timeId: s.timeId,
      envia: {
        jogadores: [...s.jogadores],
        picks: [...s.picks]
      }
    }));
    const ids = lados.map((l) => l.timeId);
    if (new Set(ids).size !== ids.length) {
      msg.innerHTML = UI.error('Cada lado precisa ser um time diferente.');
      return;
    }
    const hasItems = lados.some(
      (l) => l.envia.jogadores.length + l.envia.picks.length > 0
    );
    if (!hasItems) {
      msg.innerHTML = UI.error('Selecione ao menos um jogador ou pick.');
      return;
    }
    if (!confirm('Confirmar esta troca? Ela será aplicada na planilha.')) return;
    try {
      const result = await DynastyAPI.api('createTrade', { lados });
      msg.innerHTML = UI.success('Troca registrada: ' + result.trade.descricao);
      state.cache = {};
      state.sides.forEach((s) => {
        s.jogadores = new Set();
        s.picks = new Set();
      });
      await renderSides();
    } catch (e) {
      msg.innerHTML = UI.error(e.message || String(e));
    }
  });

  await renderSides();
};
