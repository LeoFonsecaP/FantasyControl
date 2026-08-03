(function () {
  window.Pages = window.Pages || {};

  window.Pages.management = async function () {
    const view = document.getElementById('view');
    if (!App || !App.user || !App.user.isAdmin) {
      view.innerHTML = UI.error('Acesso restrito a administradores.');
      return;
    }

    try {
      const data = await DynastyAPI.api('getManagementData');
      const teams = data.times || [];
      const players = data.players || [];

      const teamRows = teams.length
        ? teams
            .map(
              (team) => `
              <tr>
                <td>${UI.escapeHtml(team.id)}</td>
                <td>${UI.escapeHtml(team.nome)}</td>
                <td>${UI.escapeHtml(team.responsavel)}</td>
                <td>${UI.escapeHtml(team.email)}</td>
                <td><button class="btn btn-ghost" type="button" data-edit-team="${UI.escapeHtml(team.id)}">Editar</button></td>
              </tr>`
            )
            .join('')
        : `<tr><td colspan="5">${UI.empty('Nenhum time cadastrado.')}</td></tr>`;

      const playerRows = players.length
        ? players
            .map(
              (player) => `
              <tr>
                <td>${UI.escapeHtml(player.id)}</td>
                <td>${UI.escapeHtml(player.jogador)}</td>
                <td>${UI.escapeHtml(player.timeId)}</td>
                <td>${player.round}</td>
                <td>${player.anoDraft}</td>
                <td>${UI.escapeHtml(player.status)}</td>
                <td><button class="btn btn-ghost" type="button" data-edit-player="${UI.escapeHtml(player.id)}">Editar</button></td>
              </tr>`
            )
            .join('')
        : `<tr><td colspan="7">${UI.empty('Nenhum jogador cadastrado.')}</td></tr>`;

      const teamOptions = teams.length
        ? teams
            .map(
              (team) => `<option value="${UI.escapeHtml(team.id)}">${UI.escapeHtml(team.nome)}</option>`
            )
            .join('')
        : '<option value="">Cadastre um time primeiro</option>';

      view.innerHTML = `
        <h1 class="page-title">Gestão da liga</h1>
        <p class="page-sub">Cadastre times, associe e-mails de usuários e monte o elenco por time.</p>
        <div id="mgmt-msg"></div>

        <div class="management-grid">
          <section class="side-panel">
            <h2>Time</h2>
            <form id="team-form" class="form-stack">
              <input type="hidden" id="team-id" />
              <label class="field">Nome do time<input type="text" id="team-nome" required /></label>
              <label class="field">Responsável<input type="text" id="team-responsavel" /></label>
              <label class="field">E-mail do usuário<input type="text" id="team-email" placeholder="usuario@gmail.com" /></label>
              <div class="toolbar">
                <button class="btn" type="submit">Salvar time</button>
                <button class="btn btn-ghost" type="button" id="team-reset">Limpar</button>
              </div>
            </form>
          </section>

          <section class="side-panel">
            <h2>Jogador</h2>
            <form id="player-form" class="form-stack">
              <input type="hidden" id="player-id" />
              <label class="field">Nome do jogador<input type="text" id="player-nome" required /></label>
              <label class="field">Time<select id="player-team">${teamOptions}</select></label>
              <label class="field">Rodada<input type="number" id="player-round" min="1" value="1" /></label>
              <label class="field">Ano do draft<input type="number" id="player-ano" value="${new Date().getFullYear()}" /></label>
              <label class="field">Status<select id="player-status">
                <option value="ativo">Ativo</option>
                <option value="mantido">Mantido</option>
                <option value="dispensado">Dispensado</option>
              </select></label>
              <div class="toolbar">
                <button class="btn" type="submit">Salvar jogador</button>
                <button class="btn btn-ghost" type="button" id="player-reset">Limpar</button>
              </div>
            </form>
          </section>
        </div>

        <h2>Times cadastrados</h2>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>ID</th><th>Time</th><th>Responsável</th><th>E-mail</th><th></th></tr>
            </thead>
            <tbody>${teamRows}</tbody>
          </table>
        </div>

        <h2>Jogadores cadastrados</h2>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>ID</th><th>Jogador</th><th>Time</th><th>Rodada</th><th>Ano draft</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>${playerRows}</tbody>
          </table>
        </div>
      `;

      const msg = view.querySelector('#mgmt-msg');
      const teamForm = view.querySelector('#team-form');
      const playerForm = view.querySelector('#player-form');

      function showMessage(text, type) {
        msg.innerHTML = type === 'error' ? UI.error(text) : UI.success(text);
      }

      function resetTeamForm() {
        teamForm.reset();
        view.querySelector('#team-id').value = '';
      }

      function resetPlayerForm() {
        playerForm.reset();
        view.querySelector('#player-id').value = '';
        view.querySelector('#player-round').value = '1';
        view.querySelector('#player-ano').value = String(new Date().getFullYear());
        view.querySelector('#player-status').value = 'ativo';
      }

      view.querySelector('#team-reset').addEventListener('click', resetTeamForm);
      view.querySelector('#player-reset').addEventListener('click', resetPlayerForm);

      teamForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showMessage('');
        try {
          await DynastyAPI.api('upsertTeam', {
            id: view.querySelector('#team-id').value.trim(),
            nome: view.querySelector('#team-nome').value.trim(),
            responsavel: view.querySelector('#team-responsavel').value.trim(),
            email: view.querySelector('#team-email').value.trim()
          });
          showMessage('Time salvo com sucesso.');
          await App.navigate();
        } catch (e) {
          showMessage(e.message || String(e), 'error');
        }
      });

      playerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showMessage('');
        try {
          await DynastyAPI.api('upsertPlayer', {
            id: view.querySelector('#player-id').value.trim(),
            jogador: view.querySelector('#player-nome').value.trim(),
            timeId: view.querySelector('#player-team').value,
            round: parseInt(view.querySelector('#player-round').value, 10) || 1,
            anoDraft: parseInt(view.querySelector('#player-ano').value, 10) || new Date().getFullYear(),
            status: view.querySelector('#player-status').value
          });
          showMessage('Jogador salvo com sucesso.');
          await App.navigate();
        } catch (e) {
          showMessage(e.message || String(e), 'error');
        }
      });

      view.querySelectorAll('[data-edit-team]').forEach((button) => {
        button.addEventListener('click', async () => {
          const teamId = button.getAttribute('data-edit-team');
          const team = teams.find((item) => item.id === teamId);
          if (!team) return;
          view.querySelector('#team-id').value = team.id;
          view.querySelector('#team-nome').value = team.nome;
          view.querySelector('#team-responsavel').value = team.responsavel || '';
          view.querySelector('#team-email').value = team.email || '';
          view.querySelector('#team-nome').focus();
        });
      });

      view.querySelectorAll('[data-edit-player]').forEach((button) => {
        button.addEventListener('click', () => {
          const playerId = button.getAttribute('data-edit-player');
          const player = players.find((item) => item.id === playerId);
          if (!player) return;
          view.querySelector('#player-id').value = player.id;
          view.querySelector('#player-nome').value = player.jogador || '';
          view.querySelector('#player-team').value = player.timeId || '';
          view.querySelector('#player-round').value = String(player.round || 1);
          view.querySelector('#player-ano').value = String(player.anoDraft || new Date().getFullYear());
          view.querySelector('#player-status').value = player.status || 'ativo';
          view.querySelector('#player-nome').focus();
        });
      });
    } catch (e) {
      view.innerHTML = UI.error(e.message || String(e));
    }
  };
})();
