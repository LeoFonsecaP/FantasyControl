/**
 * API client for Supabase.
 * Uses Supabase JS client with RPC functions that replicate the GAS actions.
 */
(function (global) {
  const STORAGE_USER = 'dynasty_user';

  // Configuração do Supabase (preenchida no index.html)
  const SUPABASE_URL = global.DYNASTY_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = global.DYNASTY_SUPABASE_ANON_KEY || '';
  // URL de redirect pós-login (GitHub Pages). Se vazio, usa a URL atual.
  const REDIRECT_URL = global.DYNASTY_REDIRECT_URL || '';

  let supabase = null;

  function getSupabase() {
    if (supabase) return supabase;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Configure as credenciais do Supabase no index.html.');
    }
    supabase = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
  }

  function getCachedUser() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_USER) || 'null');
    } catch {
      return null;
    }
  }

  function setCachedUser(user) {
    localStorage.setItem(STORAGE_USER, JSON.stringify(user || {}));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_USER);
    const sb = getSupabase();
    return sb.auth.signOut();
  }

  async function getCurrentUser() {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    return user;
  }

  /**
   * Mapeia as actions do GAS para chamadas RPC do Supabase.
   * Mantém a mesma interface: DynastyAPI.api(action, payload) → data
   */
  async function api(action, payload = {}) {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      throw new Error('Faça login para acessar a liga.');
    }

    console.log('[API]', action, payload);

    let result;
    switch (action) {
      case 'me':
        result = await sb.rpc('rpc_me');
        break;
      case 'getDashboard':
        result = await sb.rpc('rpc_get_dashboard');
        break;
      case 'getTeam':
        result = await sb.rpc('rpc_get_team', { p_time_id: payload.timeId });
        break;
      case 'getExpiring':
        result = await sb.rpc('rpc_get_expiring', { p_ano: payload.ano || null });
        break;
      case 'getFreeAgents':
        result = await sb.rpc('rpc_get_free_agents', { p_ano: payload.ano || null });
        break;
      case 'getTrades':
        result = await sb.rpc('rpc_get_trades', { p_time_id: payload.timeId || null });
        break;
      case 'createTrade':
        result = await sb.rpc('rpc_create_trade', { p_lados: payload.lados });
        break;
      case 'getKeepCandidates':
        result = await sb.rpc('rpc_get_keep_candidates', { p_time_id: payload.timeId });
        break;
      case 'setKeeps':
        result = await sb.rpc('rpc_set_keeps', {
          p_time_id: payload.timeId,
          p_decisoes: payload.decisoes
        });
        break;
      case 'getStandings':
        result = await sb.rpc('rpc_get_standings', { p_ano: payload.ano || null });
        break;
      case 'upsertStanding':
        result = await sb.rpc('rpc_upsert_standing', {
          p_ano: payload.ano,
          p_time_id: payload.timeId,
          p_vitorias: payload.vitorias || 0,
          p_derrotas: payload.derrotas || 0,
          p_posicao_final: payload.posicaoFinal || 0,
          p_campeao: payload.campeao === 'sim' || payload.campeao === true
        });
        break;
      case 'getManagementData':
        result = await sb.rpc('rpc_get_management_data');
        break;
      case 'upsertTeam':
        result = await sb.rpc('rpc_upsert_team', {
          p_id: payload.id || null,
          p_nome: payload.nome,
          p_responsavel: payload.responsavel || null,
          p_email: payload.email || null
        });
        break;
      case 'upsertPlayer':
        result = await sb.rpc('rpc_upsert_player', {
          p_id: payload.id || null,
          p_jogador: payload.jogador,
          p_time_id: payload.timeId,
          p_round: payload.round || 1,
          p_ano_draft: payload.anoDraft || null,
          p_status: payload.status || 'ativo'
        });
        break;
      case 'listTeams':
        result = await sb.rpc('rpc_list_teams');
        break;
      case 'linkUserToTeam':
        result = await sb.rpc('rpc_link_user_to_team', {
          p_email: payload.email,
          p_time_id: payload.timeId || null
        });
        break;
      case 'ping':
        return { pong: true };
      default:
        throw new Error('Ação desconhecida: ' + action);
    }

    if (result.error) {
      console.error('[API Error]', action, result.error);
      throw new Error(result.error.message || 'Erro na API');
    }

    console.log('[API Result]', action, result.data);
    return result.data;
  }

  /**
   * Retorna a URL de redirect pós-login.
   * Usa DYNASTY_REDIRECT_URL se configurado, senão a URL atual.
   */
  function getRedirectUrl() {
    const url = REDIRECT_URL || (global.location.origin + global.location.pathname);
    console.log('[Auth] Redirect URL usada:', url);
    return url;
  }

  /**
   * Login com Google OAuth via Supabase.
   */
  async function loginWithGoogle() {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getRedirectUrl()
      }
    });
    if (error) throw error;
    return data;
  }

  /**
   * Login com magic link (e-mail).
   */
  async function loginWithMagicLink(email) {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getRedirectUrl()
      }
    });
    if (error) throw error;
    return data;
  }

  /**
   * Verifica se há sessão ativa e retorna o usuário enriquecido.
   */
  async function ensureSession() {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;

    // Busca dados do usuário (me)
    try {
      const me = await api('me');
      setCachedUser(me);
      return me;
    } catch (e) {
      console.warn('[Session] Não foi possível buscar dados do usuário:', e.message);
      return null;
    }
  }

  /**
   * Escuta mudanças de autenticação (login/logout).
   */
  function onAuthStateChange(callback) {
    const sb = getSupabase();
    return sb.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }

  global.DynastyAPI = {
    api,
    getCachedUser,
    setCachedUser,
    clearSession,
    loginWithGoogle,
    loginWithMagicLink,
    ensureSession,
    onAuthStateChange,
    getSupabase
  };
})(window);