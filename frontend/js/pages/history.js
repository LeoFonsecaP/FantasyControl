window.Pages = window.Pages || {};

window.Pages.history = async function (route) {
  const view = document.getElementById('view');
  const teamsData = await DynastyAPI.api('listTeams');
  const filter = route.params.timeId || '';
  const data = await DynastyAPI.api('getTrades', filter ? { timeId: filter } : {});

  // Busca nomes de jogadores e times para enriquecer o payload
  const teamsMap = new Map(teamsData.times.map(t => [t.id, t.nome]));
  
  // Busca todos os jogadores e picks de todos os times para ter os nomes
  const allPlayers = new Map();
  const allPicks = new Map();
  for (const team of teamsData.times) {
    try {
      const teamData = await DynastyAPI.api('getTeam', { timeId: team.id });
      teamData.jogadores.forEach(j => allPlayers.set(j.id, j.jogador));
      teamData.picks.forEach(p => {
        allPicks.set(p.id, `${p.rodada}ª ${p.ano}`);
      });
    } catch (e) {
      console.warn(`Erro ao buscar dados do time ${team.id}:`, e.message);
    }
  }

  const items = data.trades
    .map(
      (t) => {
        const timesEnvolvidos = (t.timesNomes || []).join(' vs ');
        const payload = t.payload || {};
        const lados = payload.lados || [];
        
        // Constrói o conteúdo expandido
        let expandedContent = '';
        lados.forEach((lado, index) => {
          const timeNome = UI.escapeHtml(lado.timeNome || teamsMap.get(lado.timeId) || lado.timeId || 'Time');
          const envia = lado.envia || {};
          const jogadores = envia.jogadores || [];
          const picks = envia.picks || [];
          
          expandedContent += `<div style="margin-bottom: ${index < lados.length - 1 ? '1.25rem' : '0'};">`;
          expandedContent += `<strong style="font-size: 0.95rem;">${timeNome} envia:</strong>`;
          expandedContent += `<ul style="margin: 0.4rem 0 0 0; padding-left: 1.1rem; font-size: 0.9rem;">`;
          
          // Jogadores
          jogadores.forEach((j) => {
            const jNome = UI.escapeHtml(j.jogador || allPlayers.get(j.id) || j.id || 'Jogador');
            const receiverNome = UI.escapeHtml(teamsMap.get(j.receiver) || j.receiver || '?');
            expandedContent += `<li style="margin-bottom: 0.25rem;">${jNome} (${receiverNome})</li>`;
          });
          
          // Picks
          picks.forEach((p) => {
            const pickDesc = UI.escapeHtml(p.descricao || allPicks.get(p.id) || `${p.rodada || '?'}ª ${p.ano || '?'}`);
            const receiverNome = UI.escapeHtml(teamsMap.get(p.receiver) || p.receiver || '?');
            expandedContent += `<li style="margin-bottom: 0.25rem;">Pick ${pickDesc} (${receiverNome})</li>`;
          });
          
          if (jogadores.length === 0 && picks.length === 0) {
            expandedContent += `<li style="color: var(--muted); font-style: italic;">(nada)</li>`;
          }
          
          expandedContent += `</ul>`;
          expandedContent += `</div>`;
        });

        return `
        <div class="trade-item" data-trade-id="${UI.escapeHtml(t.id)}">
          <div class="trade-header" onclick="this.parentElement.classList.toggle('expanded')">
            <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center">
              <div>
                <strong>${UI.escapeHtml(t.id)}</strong>
                <span class="muted" style="margin-left: 0.75rem;font-size:0.85rem">${UI.escapeHtml(String(t.data).slice(0, 19).replace('T', ' '))}</span>
              </div>
              <span class="trade-toggle">▼</span>
            </div>
            <div class="muted" style="font-size:0.85rem;margin-top:0.35rem">${timesEnvolvidos}</div>
          </div>
          <div class="trade-details">
            ${expandedContent || '<div class="muted">Detalhes não disponíveis</div>'}
          </div>
        </div>`;
      }
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
    <div class="hof-list" id="trades-list">
      ${items || UI.empty('Nenhuma troca registrada ainda.')}
    </div>
  `;

  view.querySelector('#hist-team').addEventListener('change', (e) => {
    const v = e.target.value;
    location.hash = v ? `#/history?timeId=${encodeURIComponent(v)}` : '#/history';
  });
};
