window.Pages = window.Pages || {};

window.Pages.team = async function (route) {
  const view = document.getElementById('view');
  const timeId = route.params.id || (App.user && App.user.teamId);
  if (!timeId) {
    view.innerHTML = UI.error('Selecione um time no dashboard.');
    return;
  }
  
  const isEditMode = route.params.edit === '1';
  const isOwnTeam = App.user && App.user.teamId === timeId;
  
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
        <td>${UI.escapeHtml(pk.timeDonoAtualNome || pk.timeDonoAtual)}</td>
      </tr>`
    )
    .join('');

  // Se está em modo de edição e é o próprio time, mostra formulário de edição
  if (isEditMode && isOwnTeam) {
    view.innerHTML = `
      <h1 class="page-title">Editar ${UI.escapeHtml(t.nome)}</h1>
      <p class="page-sub">Atualize as informações do seu time</p>
      <div id="team-edit-msg"></div>
      
      <form id="team-edit-form" class="form-stack" style="max-width: 500px;">
        <label class="field">Nome do time<input type="text" id="edit-team-nome" value="${UI.escapeHtml(t.nome || '')}" required /></label>
        <label class="field">Responsável<input type="text" id="edit-team-responsavel" value="${UI.escapeHtml(t.responsavel || '')}" /></label>
        <label class="field">E-mail<input type="email" id="edit-team-email" value="${UI.escapeHtml(t.email || '')}" /></label>
        <div class="toolbar">
          <button class="btn" type="submit">Salvar alterações</button>
          <a href="#/team/${timeId}" class="btn btn-ghost">Cancelar</a>
        </div>
      </form>
    `;
    
    const form = view.querySelector('#team-edit-form');
    const msg = view.querySelector('#team-edit-msg');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.innerHTML = UI.loading('Salvando...');
      try {
        const result = await DynastyAPI.api('updateOwnTeam', {
          nome: view.querySelector('#edit-team-nome').value.trim(),
          responsavel: view.querySelector('#edit-team-responsavel').value.trim(),
          email: view.querySelector('#edit-team-email').value.trim()
        });
        msg.innerHTML = UI.success('Time atualizado com sucesso!');
        // Atualiza dados do usuário
        await App.refreshUser();
        // Redireciona para a página do time após 1 segundo
        setTimeout(() => {
          location.hash = '#/team/' + timeId;
        }, 1000);
      } catch (err) {
        msg.innerHTML = UI.error(err.message || String(err));
      }
    });
  } else {
    // Modo de visualização normal
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
            <thead><tr><th>Pick</th><th>Origem</th><th>Time original</th><th>Dono atual</th></tr></thead>
            <tbody>${picksRows}</tbody>
          </table></div>`
          : UI.empty('Nenhum pick futuro.')
      }
    `;
  }
};
