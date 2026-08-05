/**
 * App shell + client-side router.
 */
(function () {
  const routes = {
    dashboard: () => window.Pages.dashboard(),
    team: (p) => window.Pages.team(p),
    trade: () => window.Pages.trade(),
    keeps: () => window.Pages.keeps(),
    history: (p) => window.Pages.history(p),
    alerts: (p) => window.Pages.alerts(p),
    standings: (p) => window.Pages.standings(p),
    management: () => window.Pages.management()
  };

  let currentUser = null;
  let isBooted = false;

  function parseHash() {
    const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    const [path, query = ''] = raw.split('?');
    const params = {};
    query.split('&').forEach((pair) => {
      if (!pair) return;
      const [k, v] = pair.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    const parts = path.split('/').filter(Boolean);
    return { name: parts[0] || 'dashboard', parts, params };
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/\x26/g, '\x26amp;')
      .replace(/</g, '\x26lt;')
      .replace(/>/g, '\x26gt;')
      .replace(/"/g, '\x26quot;');
  }

  window.UI = {
    el,
    escapeHtml,
    badge(nivel) {
      const map = { green: 'OK', yellow: 'Atenção', red: 'Expira' };
      return `<span class="badge ${escapeHtml(nivel)}">${map[nivel] || nivel}</span>`;
    },
    loading(msg = 'Carregando…') {
      return `<div class="loading">${escapeHtml(msg)}</div>`;
    },
    error(msg) {
      return `<div class="error-banner">${escapeHtml(msg)}</div>`;
    },
    success(msg) {
      return `<div class="success-banner">${escapeHtml(msg)}</div>`;
    },
    empty(msg) {
      return `<div class="empty">${escapeHtml(msg)}</div>`;
    }
  };

  function loginScreen() {
    return `
      <div class="login-screen">
        <div class="login-panel">
          <div class="brand-hero">Mickey Mouse Dynasty</div>
          <p class="tagline">Acesse sua liga de Fantasy</p>
          <div class="login-box">
            <div id="login-msg"></div>
            <button class="btn btn-google" type="button" id="btn-google">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.29v3.1A12 12 0 0 0 12 24z"/>
                <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.61H1.29a12 12 0 0 0 0 10.78l3.98-3.1z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.61l3.98 3.1C6.22 6.86 8.87 4.75 12 4.75z"/>
              </svg>
              Entrar com Google
            </button>
            <div class="login-divider"><span>ou</span></div>
            <form class="login-magic" id="login-magic">
              <label class="field" for="login-email">E-mail</label>
              <input type="email" id="login-email" placeholder="voce@email.com" autocomplete="email" required />
              <button class="btn btn-ghost" type="submit">Receber magic link</button>
            </form>
            <p class="login-hint">Enviaremos um link mágico para seu e-mail. Sem senha necessária.</p>
          </div>
        </div>
      </div>
    `;
  }

  function shell(user) {
    const hasTeam = !!(user && user.teamId);
    const isAdmin = !!(user && user.isAdmin);
    
    // Keeps: disponível para usuários com time OU admins
    const showKeeps = hasTeam || isAdmin;
    // Nova troca: disponível apenas para usuários com time
    const showTrade = hasTeam;
    // Gestão: disponível apenas para admins
    const showManagement = isAdmin;

    return `
      <header class="app-header">
        <a class="brand" href="#/dashboard">Mickey Mouse Dynasty</a>
        <button class="mobile-nav-toggle" type="button" id="nav-toggle" aria-label="Menu">Menu</button>
        <nav class="nav" id="main-nav">
          <a href="#/dashboard" data-route="dashboard">Dashboard</a>
          <a href="#/alerts" data-route="alerts">Free Agents</a>
          ${showTrade ? `<a href="#/trade" data-route="trade">Nova troca</a>` : ''}
          ${showKeeps ? `<a href="#/keeps" data-route="keeps">Keeps</a>` : ''}
          <a href="#/history" data-route="history">Histórico</a>
          <a href="#/standings" data-route="standings">Standings</a>
          ${showManagement ? `<a href="#/management" data-route="management">Gestão</a>` : ''}
        </nav>
        <div class="user-info">
          <span class="user-chip" id="user-chip" style="cursor: ${hasTeam ? 'pointer' : 'default'};" title="${hasTeam ? 'Clique para editar seu time' : ''}">
            <strong>${escapeHtml(user.teamName || 'Convidado')}</strong>
          </span>
          <button class="btn btn-ghost" type="button" id="btn-logout">Sair</button>
        </div>
      </header>
      <main id="view"></main>
    `;
  }

  function bindLoginEvents() {
    const btnGoogle = document.getElementById('btn-google');
    if (btnGoogle) {
      btnGoogle.addEventListener('click', async () => {
        const msg = document.getElementById('login-msg');
        msg.innerHTML = '';
        try {
          await DynastyAPI.loginWithGoogle();
          // O Supabase redireciona para o Google; ao voltar, onAuthStateChange dispara
        } catch (e) {
          msg.innerHTML = UI.error(e.message || String(e));
        }
      });
    }

    const magicForm = document.getElementById('login-magic');
    if (magicForm) {
      magicForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('login-msg');
        msg.innerHTML = '';
        const email = document.getElementById('login-email').value.trim();
        try {
          await DynastyAPI.loginWithMagicLink(email);
          msg.innerHTML = UI.success('Magic link enviado! Verifique seu e-mail.');
        } catch (err) {
          msg.innerHTML = UI.error(err.message || String(err));
        }
      });
    }
  }

  async function refreshUser() {
    try {
      const me = await DynastyAPI.api('me');
      currentUser = me;
      DynastyAPI.setCachedUser(me);
      const chip = document.querySelector('.user-chip strong');
      if (chip) {
        chip.textContent = me.teamName || 'Convidado';
      }
      window.App = { user: currentUser, navigate, refreshUser };
      return me;
    } catch (e) {
      console.warn('[Session] Erro ao atualizar usuário:', e.message);
      return null;
    }
  }

  async function bootApp() {
    if (isBooted) return;
    isBooted = true;
    console.log('[Boot] Iniciando bootApp');
    const app = document.getElementById('app');

    // Verifica sessão do Supabase
    try {
      const user = await DynastyAPI.ensureSession();
      if (!user) {
        // Não autenticado → tela de login
        // Reseta isBooted para permitir que o SIGNED_IN (OAuth redirect) inicialize o app depois
        isBooted = false;
        app.innerHTML = loginScreen();
        bindLoginEvents();
        return;
      }
      currentUser = user;
    } catch (e) {
      console.warn('[Boot] Erro ao verificar sessão:', e.message);
      isBooted = false;
      app.innerHTML = loginScreen();
      bindLoginEvents();
      return;
    }

    console.log('[Boot] Renderizando shell');
    app.innerHTML = shell(currentUser);
    app.querySelector('#nav-toggle').addEventListener('click', () => {
      app.querySelector('#main-nav').classList.toggle('open');
    });
    app.querySelector('#btn-logout').addEventListener('click', async () => {
      await DynastyAPI.clearSession();
      location.reload();
    });
    
    // Se usuário tem time, adiciona evento para editar ao clicar no chip
    const userChip = app.querySelector('#user-chip');
    if (userChip && currentUser && currentUser.teamId) {
      userChip.addEventListener('click', () => {
        location.hash = '#/team/' + currentUser.teamId + '?edit=1';
      });
    }
    
    window.App = { user: currentUser, navigate, refreshUser };
    console.log('[Boot] Completo, navegando...');
    await navigate();
  }

  async function navigate() {
    const view = document.getElementById('view');
    if (!view) {
      await bootApp();
      return;
    }
    const route = parseHash();
    document.querySelectorAll('.nav a').forEach((a) => {
      a.classList.toggle('active', a.dataset.route === route.name);
    });
    const nav = document.getElementById('main-nav');
    if (nav) nav.classList.remove('open');

    view.innerHTML = UI.loading();
    try {
      const fn = routes[route.name] || routes.dashboard;
      await fn(route);
    } catch (e) {
      view.innerHTML = UI.error(e.message || String(e));
    }
  }

  window.App = { get user() { return currentUser; }, navigate, bootApp, parseHash, refreshUser };

  // Escuta mudanças de autenticação (login via magic link / OAuth redirect)
  DynastyAPI.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      console.log('[Auth] Usuário autenticado');
      // Se o app ainda não foi inicializado, inicializa (evita loop de reload)
      if (!isBooted) {
        bootApp();
      }
    }
    if (event === 'SIGNED_OUT') {
      console.log('[Auth] Usuário deslogado');
      isBooted = false;
      bootApp();
    }
  });

  window.addEventListener('hashchange', () => navigate());
  document.addEventListener('DOMContentLoaded', () => bootApp());
})();