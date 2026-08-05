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

      // Lista de jogadores removida conforme solicitado

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

        <div class="toolbar" style="margin-top: 1rem;">
          <button class="btn btn-ghost" type="button" id="btn-advance-season">Avançar temporada</button>
        </div>
      `;

      const msg = view.querySelector('#mgmt-msg');
      const teamForm = view.querySelector('#team-form');
      const linkForm = view.querySelector('#link-form');

      function showMessage(text, type) {
        msg.innerHTML = type === 'error' ? UI.error(text) : UI.success(text);
      }

      function resetTeamForm() {
        teamForm.reset();
        view.querySelector('#team-id').value = '';
      }

      view.querySelector('#team-reset').addEventListener('click', resetTeamForm);

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

      linkForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showMessage('');
        try {
          const email = view.querySelector('#link-email').value.trim();
          const timeId = view.querySelector('#link-team').value;
          await DynastyAPI.api('linkUserToTeam', { email, timeId });
          const team = teams.find((t) => t.id === timeId);
          const message = timeId
            ? `Usuário ${email} vinculado a ${team ? team.nome : timeId}. Atualizando...`
            : `Usuário ${email} desvinculado (convidado). Atualizando...`;
          showMessage(message);
          linkForm.reset();
          await new Promise((r) => setTimeout(r, 600));
          location.reload();
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
            showMessage(`Usuário ${email} desvinculado (convidado). Atualizando...`);
            await new Promise((r) => setTimeout(r, 600));
            location.reload();
          } catch (e) {
            showMessage(e.message || String(e), 'error');
          }
        });
      });

      // Botão avançar temporada
      const btnAdvance = view.querySelector('#btn-advance-season');
      if (btnAdvance) {
        btnAdvance.addEventListener('click', async () => {
          const confirmed = confirm('Tem certeza que deseja avançar a temporada?\n\nEsta ação irá:\n- Mudar o ano da temporada para o seguinte\n- Remover jogadores não mantidos de todos os times\n- Deletar todas as escolhas de draft do ano atual\n- Criar novas escolhas 1-8 para todos os times para daqui a 3 temporadas\n\nEsta ação não pode ser desfeita.');
          if (!confirmed) return;
          
          showMessage('');
          try {
            const result = await DynastyAPI.api('advanceSeason');
            showMessage(result.mensagem || 'Temporada avançada com sucesso!');
            await new Promise((r) => setTimeout(r, 2000));
            location.reload();
          } catch (e) {
            showMessage(e.message || String(e), 'error');
          }
        });
      }
    } catch (e) {
      view.innerHTML = UI.error(e.message || String(e));
    }
  };
})();