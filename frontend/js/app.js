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
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  function getInitialUser() {
    const cached = DynastyAPI.getCachedUser();
    if (cached && typeof cached === 'object') {
      return cached;
    }
    return { email: 'usuario@liga', teamName: 'Liga Dynasty', isAdmin: false };
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
      </header>
      <main id="view"></main>
    `;
  }

  async function bootApp() {
    console.log('[Boot] Iniciando bootApp');
    currentUser = getInitialUser();
    DynastyAPI.setSession('direct-access', currentUser);

    console.log('[Boot] Renderizando shell');
    const app = document.getElementById('app');
    app.innerHTML = shell(currentUser);
    app.querySelector('#nav-toggle').addEventListener('click', () => {
      app.querySelector('#main-nav').classList.toggle('open');
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

  window.addEventListener('hashchange', () => navigate());
  document.addEventListener('DOMContentLoaded', () => bootApp());
})();
