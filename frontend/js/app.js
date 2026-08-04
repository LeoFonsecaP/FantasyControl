/**
 * App shell + client-side router.
 */
(function () {
  const routes = {
    dashboard: () => window.Pages.dashboard(),
    team: (p) => window.Pages.team(p),
    trade: () => window.Pages.trade(),
    keeps: () => window.Pages.keeps(),
    history: () => window.Pages.history(),
    alerts: () => window.Pages.alerts(),
    standings: () => window.Pages.standings(),
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
        <div class="login-box">
          <h1>Mickey Mouse Dynasty</h1>
          <p class="page-sub">Faça login para acessar a liga</p>
          <div id="login-msg"></div>
          <div class="login-actions">
            <button class="btn" type="button" id="btn-google">Entrar com Google</button>
          </div>
        </div>
      </div>
    `;
  }

  function shell(user) {
    return `
      <header class="app-header">
        <a class="brand" href="#/dashboard">Mickey Mouse Dynasty</a>
        <button class="mobile-nav-toggle" type="button" id="nav-toggle" aria-label="Menu">Menu</button>
        <nav class="nav" id="main-nav">
          <a href="#/dashboard" data-route="dashboard">Dashboard</a>
          <a href="#/alerts" data-route="alerts">Alertas</a>
          <a href="#/trade" data-route="trade">Nova troca</a>
          <a href="#/keeps" data-route="keeps">Keeps</a>
          <a href="#/history" data-route="history">Histórico</a>
          <a href="#/standings" data-route="standings">Standings</a>
          <a href="#/management" data-route="management">Gestão</a>
        </nav>
        <div class="user-info">
          <span class="muted">${escapeHtml(user.email || '')}</span>
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
    window.App = { user: currentUser, navigate };
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

  window.App = { get user() { return currentUser; }, navigate, bootApp, parseHash };

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