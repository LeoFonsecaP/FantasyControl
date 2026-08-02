/**
 * API client for Google Apps Script Web App.
 * Uses text/plain POST to avoid CORS preflight.
 */
(function (global) {
  const STORAGE_TOKEN = 'dynasty_token';
  const STORAGE_USER = 'dynasty_user';
  const STORAGE_API = 'dynasty_api_url';

  function getApiUrl() {
    const fromStorage = localStorage.getItem(STORAGE_API);
    if (fromStorage) return fromStorage.replace(/\/$/, '');
    if (global.DYNASTY_API_URL) return String(global.DYNASTY_API_URL).replace(/\/$/, '');
    return '';
  }

  function setApiUrl(url) {
    localStorage.setItem(STORAGE_API, url.replace(/\/$/, ''));
  }

  function getToken() {
    return localStorage.getItem(STORAGE_TOKEN) || '';
  }

  function setSession(token, user) {
    localStorage.setItem(STORAGE_TOKEN, token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(user || {}));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
  }

  function getCachedUser() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_USER) || 'null');
    } catch {
      return null;
    }
  }

  async function api(action, payload = {}) {
    const base = getApiUrl();
    if (!base) {
      throw new Error('Configure a URL do Apps Script (API) nas configurações de login.');
    }
    const body = Object.assign({ action, token: getToken() }, payload);
    const res = await fetch(base, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Resposta inválida da API. Verifique o deploy do Apps Script.');
    }
    if (!json.ok) {
      throw new Error(json.error || 'Erro na API');
    }
    return json.data;
  }

  function authBridgeUrl() {
    const base = getApiUrl();
    return base + '?action=authBridge';
  }

  function loginWithPopup() {
    return new Promise((resolve, reject) => {
      const url = authBridgeUrl();
      if (!getApiUrl()) {
        reject(new Error('Informe a URL do Web App antes de entrar.'));
        return;
      }
      const popup = window.open(url, 'dynasty-auth', 'width=480,height=640');
      if (!popup) {
        reject(new Error('Popup bloqueado. Permita popups para este site.'));
        return;
      }
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener('message', onMsg);
          if (!getToken()) reject(new Error('Login cancelado.'));
        }
      }, 500);
      function onMsg(ev) {
        const data = ev.data;
        if (!data || data.type !== 'dynasty-auth') return;
        clearInterval(timer);
        window.removeEventListener('message', onMsg);
        try {
          popup.close();
        } catch (_) {}
        if (!data.payload || !data.payload.ok) {
          reject(new Error((data.payload && data.payload.error) || 'Falha no login'));
          return;
        }
        setSession(data.payload.token, data.payload.user);
        resolve(data.payload.user);
      }
      window.addEventListener('message', onMsg);
    });
  }

  global.DynastyAPI = {
    api,
    getApiUrl,
    setApiUrl,
    getToken,
    getCachedUser,
    setSession,
    clearSession,
    loginWithPopup,
    authBridgeUrl
  };
})(window);
