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
      { timeId: '', jogadores: new Map(), picks: new Map() }
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

  function getReceiverOptions(sideIndex) {
    return teams
      .filter((t) => !state.sides.some((s, idx) => idx === sideIndex && s.timeId === t.id))
      .map(
        (t) =>
          `<option value="${UI.escapeHtml(t.id)}">${UI.escapeHtml(t.nome)}</option>`
      )
      .join('');
  }

  function teamOptions(selected) {
    const used = new Set(state.sides.map((s) => s.timeId).filter(Boolean));
    return `
      <option value="">Selecione um time...</option>
      ${teams
        .filter((t) => !used.has(t.id))
        .map(
          (t) =>
            `<option value="${UI.escapeHtml(t.id)}" ${t.id === selected ? 'selected' : ''}>${UI.escapeHtml(t.nome)}</option>`
        )
        .join('')}
    `;
  }

  async function renderSides() {
    sidesEl.innerHTML = '';
    const isMultiTeam = state.sides.length > 2;
    
    for (let i = 0; i < state.sides.length; i++) {
      const side = state.sides[i];
      const assets = await loadTeamAssets(side.timeId);
      const panel = document.createElement('div');
      panel.className = 'side-panel';
      
      const receiverOptions = isMultiTeam ? getReceiverOptions(i) : '';
      
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
                    (p) => {
                      const receiver = side.jogadores.get(p.id) || '';
                      return `<label>
                        <input type="checkbox" value="${UI.escapeHtml(p.id)}" ${
                          side.jogadores.has(p.id) ? 'checked' : ''
                        }/>
                        <span class="player-info">${UI.escapeHtml(p.jogador)} <span class="muted">(${p.round}ª/${p.anoDraft})</span></span>
                        ${isMultiTeam ? `<select data-item="${p.id}" class="receiver-select">${receiverOptions.replace(`value="${receiver}"`, `value="${receiver}" selected`).replace('value=""', `value="${receiver}" selected`)}</select>` : ''}
                      </label>`;
                    }
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
                    (pk) => {
                      const receiver = side.picks.get(pk.id) || '';
                      return `<label>
                        <input type="checkbox" value="${UI.escapeHtml(pk.id)}" ${
                          side.picks.has(pk.id) ? 'checked' : ''
                        }/>
                        <span class="player-info">${pk.rodada}ª ${pk.ano} ${
                          pk.original ? '' : '<span class="pill traded">recebido</span>'
                        } <span class="muted">(orig: ${UI.escapeHtml(pk.timeOriginalNome || pk.timeOriginal)})</span></span>
                        ${isMultiTeam ? `<select data-item="${pk.id}" class="receiver-select">${receiverOptions.replace(`value="${receiver}"`, `value="${receiver}" selected`).replace('value=""', `value="${receiver}" selected`)}</select>` : ''}
                      </label>`;
                    }
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
        state.sides[i].jogadores = new Map();
        state.sides[i].picks = new Map();
        await renderSides();
      });
    });
    sidesEl.querySelectorAll('.check-list').forEach((list) => {
      list.addEventListener('change', (e) => {
        if (e.target.tagName !== 'INPUT') return;
        const i = parseInt(list.dataset.side, 10);
        const kind = list.dataset.kind;
        const itemId = e.target.value;
        
        if (e.target.checked) {
          state.sides[i][kind].set(itemId, '');
        } else {
          state.sides[i][kind].delete(itemId);
        }
        updatePreview();
      });
    });
    sidesEl.querySelectorAll('.receiver-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const sideIndex = parseInt(e.target.closest('.check-list').dataset.side, 10);
        const kind = e.target.closest('.check-list').dataset.kind;
        const itemId = e.target.dataset.item;
        const receiver = e.target.value;
        
        if (state.sides[sideIndex][kind].has(itemId)) {
          state.sides[sideIndex][kind].set(itemId, receiver);
        }
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
      
      const j = [...side.jogadores.entries()].map(([id, receiver]) => {
        const list = (state.cache[side.timeId] && state.cache[side.timeId].jogadores) || [];
        const p = list.find((x) => x.id === id);
        const playerName = p ? p.jogador : id;
        if (receiver) {
          const receiverTeam = teams.find((t) => t.id === receiver);
          return `${playerName} → ${receiverTeam ? receiverTeam.nome : receiver}`;
        }
        return playerName;
      });
      
      const p = [...side.picks.entries()].map(([id, receiver]) => {
        const list = (state.cache[side.timeId] && state.cache[side.timeId].picks) || [];
        const pk = list.find((x) => x.id === id);
        const pickDesc = pk ? `${pk.rodada}ª ${pk.ano} (orig: ${pk.timeOriginalNome || pk.timeOriginal})` : id;
        if (receiver) {
          const receiverTeam = teams.find((t) => t.id === receiver);
          return `${pickDesc} → ${receiverTeam ? receiverTeam.nome : receiver}`;
        }
        return pickDesc;
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
      jogadores: new Map(),
      picks: new Map()
    });
    await renderSides();
  });

  view.querySelector('#confirm-trade').addEventListener('click', async () => {
    const msg = view.querySelector('#trade-msg');
    msg.innerHTML = '';
    
    const isMultiTeam = state.sides.length > 2;
    const lados = state.sides.map((s) => {
      const envia = {
        jogadores: [...s.jogadores.entries()].map(([id, receiver]) => ({
          id,
          receiver: receiver || null
        })),
        picks: [...s.picks.entries()].map(([id, receiver]) => ({
          id,
          receiver: receiver || null
        }))
      };
      return { timeId: s.timeId, envia };
    });
    const ids = lados.map((l) => l.timeId);
    if (new Set(ids).size !== ids.length) {
      msg.innerHTML = UI.error('Cada lado precisa ser um time diferente.');
      return;
    }
    if (isMultiTeam) {
      const missingReceivers = lados.some((l) => 
        l.envia.jogadores.some((j) => !j.receiver) || l.envia.picks.some((p) => !p.receiver)
      );
      if (missingReceivers) {
        msg.innerHTML = UI.error('Em trocas de 3+ times, selecione para quem cada item vai.');
        return;
      }
      
      const receivers = new Set();
      lados.forEach((l) => {
        l.envia.jogadores.forEach((j) => { if (j.receiver) receivers.add(j.receiver); });
        l.envia.picks.forEach((p) => { if (p.receiver) receivers.add(p.receiver); });
      });
      
      const senderIds = new Set(lados.map((l) => l.timeId));
      const invalidReceivers = [...receivers].filter((r) => senderIds.has(r));
      if (invalidReceivers.length > 0) {
        msg.innerHTML = UI.error('Um time não pode enviar itens para si mesmo.');
        return;
      }
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
        s.jogadores = new Map();
        s.picks = new Map();
      });
      await renderSides();
    } catch (e) {
      msg.innerHTML = UI.error(e.message || String(e));
    }
  });

  await renderSides();
};