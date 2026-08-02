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
    const token = getToken();
    const body = Object.assign({ action, token }, payload);
    
    console.log('[API]', action, { token: token ? token.slice(0, 20) + '...' : 'NENHUM', ...payload });
    
    try {
      const res = await fetch(base, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      });
      
      console.log('[API Response]', action, res.status, res.statusText);
      
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        console.error('[API Parse Error]', action, text.slice(0, 200));
        throw new Error('Resposta inválida da API. Verifique o deploy do Apps Script.');
      }
      
      console.log('[API Result]', action, json);
      
      if (!json.ok) {
        throw new Error(json.error || 'Erro na API');
      }
      return json.data;
    } catch (e) {
      console.error('[API Error]', action, e.message);
      throw e;
    }
  }

  function authBridgeUrl(bridgeId) {
    const base = getApiUrl();
    return base + '?action=authBridge' + (bridgeId ? '&bridgeId=' + encodeURIComponent(bridgeId) : '');
  }

  function loginWithPopup() {
    return new Promise((resolve, reject) => {
      const bridgeId = 'bridge_' + Math.random().toString(36).slice(2) + Date.now();
      const url = authBridgeUrl(bridgeId);
      if (!getApiUrl()) {
        reject(new Error('Informe a URL do Web App antes de entrar.'));
        return;
      }
      const popup = window.open(url, 'dynasty-auth', 'width=480,height=640');
      if (!popup) {
        reject(new Error('Popup bloqueado. Permita popups para este site.'));
        return;
      }
      let resolved = false;
      let popupClosed = false;
      let pollTimer = null;
      let polling = false;

      function startBridgePoll() {
        pollTimer = setInterval(() => {
          if (resolved || polling) return;
          polling = true;
          api('bridgeCheck', { bridgeId })
            .then((data) => {
              if (resolved || !data || !data.found) return;
              resolved = true;
              cleanup();
              console.log('[Auth Bridge Poll] encontrado', data);
              setSession(data.token, data.user);
              try {
                popup.close();
              } catch (_) {}
              resolve(data.user);
            })
            .catch((e) => {
              console.warn('[Auth Bridge Poll] erro', e.message);
            })
            .finally(() => {
              polling = false;
            });
        }, 500);
      }
      
      const timeoutId = setTimeout(() => {
        cleanup();
        if (!resolved) reject(new Error('Timeout em autenticação. Tente novamente.'));
      }, 30000); // 30 segundos de timeout total
      
      const popupCheckTimer = setInterval(() => {
        if (popup.closed) {
          popupClosed = true;
          clearInterval(popupCheckTimer);
          // Se o popup fecha mas já recebemos sucesso, deixa como está
          // Só rejeita se não recebemos sucesso
          if (!resolved) {
            cleanup();
            reject(new Error('Login cancelado.'));
          }
        }
      }, 1000);
      
      function onMsg(ev) {
        const data = ev.data;
        console.log('[Auth Message]', data);
        if (!data || data.type !== 'dynasty-auth') return;
        
        if (!data.payload || !data.payload.ok) {
          cleanup();
          if (!resolved) {
            resolved = true;
            const err = (data.payload && data.payload.error) || 'Falha no login';
            console.error('[Auth Error]', err);
            reject(new Error(err));
          }
          return;
        }
        
        cleanup();
        resolved = true;
        console.log('[Auth Success]', { email: data.payload.user.email, token: data.payload.token.slice(0, 20) + '...' });
        setSession(data.payload.token, data.payload.user);
        try {
          popup.close();
        } catch (_) {}
        resolve(data.payload.user);
      }
      
      function cleanup() {
        clearTimeout(timeoutId);
        clearInterval(popupCheckTimer);
        clearInterval(pollTimer);
        window.removeEventListener('message', onMsg);
      }
      
      window.addEventListener('message', onMsg);
      startBridgePoll();
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
