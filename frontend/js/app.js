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
    standings: () => window.Pages.standings()
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

  function renderLogin() {
    const app = document.getElementById('app');
    const savedUrl = DynastyAPI.getApiUrl();
    app.innerHTML = '';
    const screen = el(`
      <div class="login-screen">
        <div class="login-panel">
          <p class="brand-hero">Liga Dynasty</p>
          <p class="tagline">Keepers, picks e trocas — tudo fora da planilha.</p>
          <label class="field" style="text-align:left;margin-bottom:1rem">
            URL do Apps Script (Web App)
            <input type="text" id="api-url" placeholder="https://script.google.com/macros/s/…/exec ou mock" value="${escapeHtml(savedUrl)}" />
          </label>
          <div id="login-error"></div>
          <button class="btn" id="btn-login" type="button">Entrar com Google</button>
          <p class="muted" style="margin-top:1.25rem;font-size:0.85rem">
            Só e-mails cadastrados na planilha (Times / admins) entram.
            Para demo local, use a URL <code>mock</code>.
          </p>
        </div>
      </div>
    `);
    app.appendChild(screen);
    screen.querySelector('#btn-login').addEventListener('click', async () => {
      const err = screen.querySelector('#login-error');
      err.innerHTML = '';
      const url = screen.querySelector('#api-url').value.trim();
      try {
        DynastyAPI.setApiUrl(url);
        currentUser = await DynastyAPI.loginWithPopup();
        await bootApp();
      } catch (e) {
        err.innerHTML = UI.error(e.message || String(e));
      }
    });
  }

  function shell(user) {
    return `
      <header class="app-header">
        <a class="brand" href="#/dashboard">Liga Dynasty</a>
        <button class="mobile-nav-toggle" type="button" id="nav-toggle" aria-label="Menu">Menu</button>
        <nav class="nav" id="main-nav">
          <a href="#/dashboard" data-route="dashboard">Dashboard</a>
          <a href="#/alerts" data-route="alerts">Alertas</a>
          <a href="#/trade" data-route="trade">Nova troca</a>
          <a href="#/keeps" data-route="keeps">Keeps</a>
          <a href="#/history" data-route="history">Histórico</a>
          <a href="#/standings" data-route="standings">Standings</a>
        </nav>
        <div class="user-chip">
          <div><strong>${UI.escapeHtml(user.teamName || user.email)}</strong></div>
          <div>${UI.escapeHtml(user.email)}${user.isAdmin ? ' · admin' : ''}
            · <a href="#" id="logout">sair</a>
          </div>
        </div>
      </header>
      <main id="view"></main>
    `;
  }

  async function bootApp() {
    if (!DynastyAPI.getToken()) {
      renderLogin();
      return;
    }
    try {
      currentUser = await DynastyAPI.api('me');
      DynastyAPI.setSession(DynastyAPI.getToken(), currentUser);
    } catch (e) {
      DynastyAPI.clearSession();
      renderLogin();
      const app = document.getElementById('app');
      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;top:1rem;left:50%;transform:translateX(-50%);z-index:50;width:min(480px,92%)';
      banner.innerHTML = UI.error(e.message || 'Sessão expirada');
      app.prepend(banner);
      return;
    }

    const app = document.getElementById('app');
    app.innerHTML = shell(currentUser);
    app.querySelector('#logout').addEventListener('click', (ev) => {
      ev.preventDefault();
      DynastyAPI.clearSession();
      location.hash = '#/dashboard';
      renderLogin();
    });
    app.querySelector('#nav-toggle').addEventListener('click', () => {
      app.querySelector('#main-nav').classList.toggle('open');
    });
    window.App = { user: currentUser, navigate };
    await navigate();
  }

  async function navigate() {
    if (!DynastyAPI.getToken()) {
      renderLogin();
      return;
    }
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
