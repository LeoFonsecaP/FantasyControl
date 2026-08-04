(function () {
  window.Pages = window.Pages || {};

  window.Pages.management = async function () {
    const view = document.getElementById('view');

    try {
      const data = await DynastyAPI.api('getManagementData');
      const teams = data.times || [];
      const players = data.players || [];
      const users = data.users || [];

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

      // Build user link rows: for each user, find their linked team
      const userLinkRows = users.length
        ? users
            .map((user) => {
              const linkedTeam = teams.find(
                (team) => String(team.email || '').toLowerCase() === String(user.email || '').toLowerCase()
              );
              return `
              <tr>
                <td>${UI.escapeHtml(user.email)}</td>
                <td>${linkedTeam ? UI.escapeHtml(linkedTeam.nome) : '<span class="muted">Convidado</span>'}</td>
                <td>${user.isAdmin ? '<span class="pill">Admin</span>' : ''}</td>
                <td>
                  <button class="btn btn-ghost" type="button" data-link-user="${UI.escapeHtml(user.email)}">Vincular</button>
                  ${linkedTeam ? `<button class="btn btn-ghost" type="button" data-unlink-user="${UI.escapeHtml(user.email)}">Desvincular</button>` : ''}
                </td>
              </tr>`;
            })
            .join('')
        : `<tr><td colspan="4">${UI.empty('Nenhum usuário cadastrado.')}</td></tr>`;

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

          <section class="side-panel">
            <h2>Vincular usuário a time</h2>
            <form id="link-form" class="form-stack">
              <label class="field">E-mail do usuário<input type="email" id="link-email" placeholder="usuario@gmail.com" required /></label>
              <label class="field">Time<select id="link-team">
                <option value="">— Convidado (desvincular) —</option>
                ${teamOptions}
              </select></label>
              <div class="toolbar">
                <button class="btn" type="submit">Vincular</button>
              </div>
            </form>
          </section>
        </div>

        <h2>Vínculos de usuários</h2>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr><th>E-mail</th><th>Time</th><th>Perfil</th><th></th></tr>
            </thead>
            <tbody>${userLinkRows}</tbody>
          </table>
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
      const linkForm = view.querySelector('#link-form');

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
        } catch (e) {
          showMessage(e.message || String(e), 'error');
        }
      });

      linkForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showMessage('');
        try {
          const email = view.querySelector('#link-email').value.trim();
          const timeId = view.querySelector('#link-team').value;
          await DynastyAPI.api('linkUserToTeam', { email, timeId });
          showMessage(timeId ? 'Usuário vinculado ao time.' : 'Usuário desvinculado (convidado).');
          linkForm.reset();
          if (window.App && typeof window.App.refreshUser === 'function') {
            const me = await window.App.refreshUser();
            if (me && String(me.email || '').toLowerCase() === String(email || '').toLowerCase()) {
              showMessage(timeId ? `Vínculo atualizado: ${me.teamName || 'Convidado'}.` : 'Usuário desvinculado (convidado).');
            }
          }
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

      view.querySelectorAll('[data-link-user]').forEach((button) => {
        button.addEventListener('click', () => {
          const email = button.getAttribute('data-link-user');
          const user = users.find((item) => String(item.email).toLowerCase() === String(email).toLowerCase());
          if (!user) return;
          const linkedTeam = teams.find(
            (team) => String(team.email || '').toLowerCase() === String(user.email || '').toLowerCase()
          );
          view.querySelector('#link-email').value = user.email || '';
          view.querySelector('#link-team').value = linkedTeam ? linkedTeam.id : '';
          view.querySelector('#link-email').focus();
        });
      });

      view.querySelectorAll('[data-unlink-user]').forEach((button) => {
        button.addEventListener('click', async () => {
          const email = button.getAttribute('data-unlink-user');
          showMessage('');
          try {
            await DynastyAPI.api('linkUserToTeam', { email, timeId: '' });
            showMessage('Usuário desvinculado (convidado).');
            if (window.App && typeof window.App.refreshUser === 'function') {
              await window.App.refreshUser();
            }
          } catch (e) {
            showMessage(e.message || String(e), 'error');
          }
        });
      });
    } catch (e) {
      view.innerHTML = UI.error(e.message || String(e));
    }
  };
})();