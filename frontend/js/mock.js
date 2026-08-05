/**
 * In-browser mock API when DynastyAPI URL is set to "mock".
 * Lets you exercise all screens without Apps Script.
 */
(function (global) {
  const TEMPORADA = 2026;

  const teams = [
    { id: 'T001', nome: 'Lakers Legacy', responsavel: 'Alex', email: 'alex@example.com' },
    { id: 'T002', nome: 'Celtics Crown', responsavel: 'Sam', email: 'sam@example.com' },
    { id: 'T003', nome: 'Heat Wave', responsavel: 'Jordan', email: 'jordan@example.com' },
    { id: 'T004', nome: 'Nets Night', responsavel: 'Casey', email: 'casey@example.com' },
    { id: 'T005', nome: 'Suns Empire', responsavel: 'Riley', email: 'riley@example.com' },
    { id: 'T006', nome: 'Bucks Dynasty', responsavel: 'Morgan', email: 'morgan@example.com' },
    { id: 'T007', nome: 'Warriors Gold', responsavel: 'Quinn', email: 'quinn@example.com' },
    { id: 'T008', nome: 'Mavs Mavericks', responsavel: 'Avery', email: 'avery@example.com' },
    { id: 'T009', nome: 'Nuggets Peak', responsavel: 'Reese', email: 'reese@example.com' },
    { id: 'T010', nome: 'Thunder Storm', responsavel: 'Taylor', email: 'taylor@example.com' }
  ];

  const users = [
    { email: 'alex@example.com', isAdmin: true },
    { email: 'sam@example.com', isAdmin: false },
    { email: 'jordan@example.com', isAdmin: false },
    { email: 'casey@example.com', isAdmin: false },
    { email: 'riley@example.com', isAdmin: false },
    { email: 'morgan@example.com', isAdmin: false },
    { email: 'quinn@example.com', isAdmin: false },
    { email: 'avery@example.com', isAdmin: false },
    { email: 'reese@example.com', isAdmin: false },
    { email: 'taylor@example.com', isAdmin: false },
    { email: 'guest@example.com', isAdmin: false }
  ];

  function anos(r) {
    if (r === 1) return 4;
    if (r === 2 || r === 3) return 3;
    return 2;
  }

  function nivel(limite) {
    const y = limite - TEMPORADA;
    if (y <= 0) return 'red';
    if (y === 1) return 'yellow';
    return 'green';
  }

  const names = [
    'SGA', 'Luka', 'Tatum', 'Jokic', 'Giannis', 'Ant', 'Wemby', 'Hali', 'Mitchell', 'Booker',
    'Brown', 'Paolo', 'Cade', 'Franz', 'Chet', 'LaMelo', 'Zion', 'Ja', 'Bam', 'Sabonis'
  ];

  let players = [];
  let picks = [];
  let trades = [];
  let standings = [];
  let p = 1;
  let k = 1;

  teams.forEach((t, ti) => {
    for (let slot = 0; slot < 2; slot++) {
      const round = slot === 0 ? 1 : 2 + (ti % 3);
      const ano = 2023 + ((ti + slot) % 3);
      const limite = ano + anos(round);
      players.push({
        id: 'J' + String(p).padStart(3, '0'),
        jogador: names[(ti + slot * 10) % names.length],
        timeId: t.id,
        round,
        anoDraft: ano,
        limite,
        status: 'ativo'
      });
      p++;
    }
    for (let year = 2026; year <= 2028; year++) {
      for (let r = 1; r <= 7; r++) {
        picks.push({
          id: 'P' + String(k).padStart(3, '0'),
          timeDonoAtual: t.id,
          timeOriginal: t.id,
          rodada: r,
          ano: year,
          usado: 'nao'
        });
        k++;
      }
    }
    standings.push({
      id: 'S' + String(ti + 1).padStart(3, '0'),
      ano: 2025,
      timeId: t.id,
      timeNome: t.nome,
      vitorias: 14 - ti,
      derrotas: ti,
      posicaoFinal: ti + 1,
      campeao: ti === 0
    });
  });

  function enrich(pl) {
    const team = teams.find((t) => t.id === pl.timeId);
    return {
      ...pl,
      timeNome: team ? team.nome : pl.timeId,
      elegivel: TEMPORADA <= pl.limite,
      anosRestantes: pl.limite - TEMPORADA,
      nivel: nivel(pl.limite)
    };
  }

  function teamName(id) {
    const t = teams.find((x) => x.id === id);
    return t ? t.nome : id;
  }

  async function mockApi(action, payload = {}) {
    await new Promise((r) => setTimeout(r, 120));
    switch (action) {
      case 'me': {
        const email = 'alex@example.com';
        const linked = teams.find((t) => String(t.email || '').toLowerCase() === email);
        return {
          email,
          teamId: linked ? linked.id : null,
          teamName: linked ? linked.nome : null,
          role: 'admin',
          isAdmin: true,
          temporadaAtual: TEMPORADA
        };
      }
      case 'listTeams':
        return { times: teams };
      case 'getManagementData':
        return {
          times: teams,
          players: players.map((pl) => ({ ...pl })),
          admins: ['alex@example.com'],
          users
        };
      case 'upsertTeam': {
        const team = payload;
        const existing = teams.find((item) => item.id === team.id);
        if (existing) {
          Object.assign(existing, {
            nome: team.nome || existing.nome,
            responsavel: team.responsavel || existing.responsavel,
            email: team.email || existing.email
          });
        } else {
          teams.push({
            id: team.id || 'T' + String(teams.length + 1).padStart(3, '0'),
            nome: team.nome,
            responsavel: team.responsavel || '',
            email: team.email || ''
          });
        }
        return { ok: true };
      }
      case 'upsertPlayer': {
        const player = payload;
        const existing = players.find((item) => item.id === player.id);
        if (existing) {
          Object.assign(existing, {
            jogador: player.jogador || existing.jogador,
            timeId: player.timeId || existing.timeId,
            round: player.round || existing.round,
            anoDraft: player.anoDraft || existing.anoDraft,
            status: player.status || existing.status
          });
        } else {
          players.push({
            id: player.id || 'J' + String(players.length + 1).padStart(3, '0'),
            jogador: player.jogador,
            timeId: player.timeId,
            round: player.round || 1,
            anoDraft: player.anoDraft || TEMPORADA,
            limite: (player.anoDraft || TEMPORADA) + anos(player.round || 1),
            status: player.status || 'ativo'
          });
        }
        return { ok: true };
      }
      case 'getDashboard':
        return {
          temporadaAtual: TEMPORADA,
          times: teams.map((t) => {
            const roster = players.filter((pl) => pl.timeId === t.id && pl.status !== 'dispensado');
            const fp = picks.filter(
              (pk) => pk.timeDonoAtual === t.id && pk.usado === 'nao' && pk.ano >= TEMPORADA
            );
            const near = roster.filter((pl) => pl.limite - TEMPORADA <= 1);
            return {
              id: t.id,
              nome: t.nome,
              responsavel: t.responsavel,
              email: t.email,
              numJogadores: roster.length,
              numPicksFuturos: fp.length,
              proximosDoLimite: near.length
            };
          })
        };
      case 'getTeam': {
        const timeId = payload.timeId || 'T001';
        const team = teams.find((t) => t.id === timeId);
        return {
          temporadaAtual: TEMPORADA,
          time: team,
          jogadores: players.filter((pl) => pl.timeId === timeId && pl.status !== 'dispensado').map(enrich),
          picks: picks
            .filter((pk) => pk.timeDonoAtual === timeId && pk.usado === 'nao')
            .map((pk) => ({
              id: pk.id,
              rodada: pk.rodada,
              ano: pk.ano,
              timeOriginal: pk.timeOriginal,
              timeOriginalNome: teamName(pk.timeOriginal),
              timeDonoAtual: pk.timeDonoAtual,
              timeDonoAtualNome: teamName(pk.timeDonoAtual),
              original: pk.timeOriginal === timeId,
              usado: pk.usado
            }))
        };
      }
      case 'getExpiring': {
        const ano = payload.ano ? parseInt(payload.ano, 10) : null;
        const list = players
          .filter((pl) => pl.status !== 'dispensado')
          .filter((pl) => (ano ? pl.limite === ano : pl.limite === TEMPORADA || pl.limite === TEMPORADA + 1))
          .map(enrich);
        return { temporadaAtual: TEMPORADA, filtroAno: ano, jogadores: list };
      }
      case 'getTrades': {
        let list = trades.slice().reverse();
        if (payload.timeId) {
          list = list.filter((t) => t.timesEnvolvidos.includes(payload.timeId));
        }
        return { trades: list };
      }
      case 'createTrade': {
        const lados = payload.lados || [];
        
        lados.forEach((lado) => {
          const receiverMap = new Map();
          
          (lado.envia.jogadores || []).forEach((item) => {
            const id = typeof item === 'object' ? item.id : item;
            const receiver = typeof item === 'object' ? item.receiver : null;
            const pl = players.find((x) => x.id === id);
            if (pl && receiver) {
              pl.timeId = receiver;
            } else if (pl && !receiver) {
              const nextSide = lados[(lados.findIndex((l) => l.timeId === lado.timeId) + 1) % lados.length];
              if (nextSide) pl.timeId = nextSide.timeId;
            }
          });
          
          (lado.envia.picks || []).forEach((item) => {
            const id = typeof item === 'object' ? item.id : item;
            const receiver = typeof item === 'object' ? item.receiver : null;
            const pk = picks.find((x) => x.id === id);
            if (pk && receiver) {
              pk.timeDonoAtual = receiver;
            } else if (pk && !receiver) {
              const nextSide = lados[(lados.findIndex((l) => l.timeId === lado.timeId) + 1) % lados.length];
              if (nextSide) pk.timeDonoAtual = nextSide.timeId;
            }
          });
        });
        
        const descricao = lados
          .map((l) => {
            const items = [];
            (l.envia.jogadores || []).forEach((item) => {
              const id = typeof item === 'object' ? item.id : item;
              const receiver = typeof item === 'object' ? item.receiver : null;
              const pl = players.find((x) => x.id === id);
              const name = pl ? pl.jogador : id;
              if (receiver) {
                items.push(name + ' → ' + teamName(receiver));
              } else {
                items.push(name);
              }
            });
            (l.envia.picks || []).forEach((item) => {
              const id = typeof item === 'object' ? item.id : item;
              const receiver = typeof item === 'object' ? item.receiver : null;
              const pk = picks.find((x) => x.id === id);
              const pickDesc = pk ? pk.rodada + 'ª ' + pk.ano : id;
              if (receiver) {
                items.push(pickDesc + ' → ' + teamName(receiver));
              } else {
                items.push(pickDesc);
              }
            });
            return teamName(l.timeId) + ' envia: ' + (items.length ? items.join(', ') : '(nada)');
          })
          .join(' | ');
        
        const trade = {
          id: 'X' + String(trades.length + 1).padStart(3, '0'),
          data: new Date().toISOString(),
          descricao,
          timesEnvolvidos: lados.map((l) => l.timeId),
          timesNomes: lados.map((l) => teamName(l.timeId)),
          payload: { lados }
        };
        trades.push(trade);
        return { trade };
      }
      case 'getKeepCandidates': {
        const timeId = payload.timeId || 'T001';
        return {
          temporadaAtual: TEMPORADA,
          timeId,
          jogadores: players.filter((pl) => pl.timeId === timeId && pl.status !== 'dispensado').map(enrich)
        };
      }
      case 'setKeeps': {
        (payload.decisoes || []).forEach((d) => {
          const pl = players.find((x) => x.id === d.playerId);
          if (!pl) return;
          if (d.status === 'mantido' && TEMPORADA > pl.limite) {
            throw new Error(pl.jogador + ' não é elegível');
          }
          pl.status = d.status;
        });
        return { updated: payload.decisoes, timeId: payload.timeId, temporada: TEMPORADA };
      }
      case 'getStandings': {
        let list = standings.slice();
        if (payload.ano) list = list.filter((s) => s.ano === parseInt(payload.ano, 10));
        return {
          ano: payload.ano || null,
          anos: [...new Set(standings.map((s) => s.ano))].sort((a, b) => b - a),
          standings: list,
          campeoes: standings.filter((s) => s.campeao).sort((a, b) => b.ano - a.ano)
        };
      }
      case 'upsertStanding': {
        const ano = parseInt(payload.ano, 10);
        const timeId = payload.timeId;
        let row = standings.find((s) => s.ano === ano && s.timeId === timeId);
        const campeao = payload.campeao === true || payload.campeao === 'sim';
        if (campeao) {
          standings.forEach((s) => {
            if (s.ano === ano) s.campeao = false;
          });
        }
        if (!row) {
          row = {
            id: 'S' + String(standings.length + 1).padStart(3, '0'),
            ano,
            timeId,
            timeNome: teamName(timeId),
            vitorias: 0,
            derrotas: 0,
            posicaoFinal: 0,
            campeao: false
          };
          standings.push(row);
        }
        row.vitorias = parseInt(payload.vitorias, 10) || 0;
        row.derrotas = parseInt(payload.derrotas, 10) || 0;
        row.posicaoFinal = parseInt(payload.posicaoFinal, 10) || 0;
        row.campeao = campeao;
        return { standing: row };
      }
      case 'linkUserToTeam': {
        const email = String(payload.email || '').toLowerCase().trim();
        const timeId = payload.timeId || '';
        // Remove email from all teams
        teams.forEach((t) => {
          if (String(t.email || '').toLowerCase() === email) t.email = '';
        });
        if (timeId) {
          const team = teams.find((t) => t.id === timeId);
          if (team) team.email = email;
        }
        return { ok: true, message: timeId ? 'Usuário vinculado ao time.' : 'Usuário desvinculado.' };
      }
      case 'seed':
        return { message: 'Mock já está seeded.' };
      default:
        throw new Error('Mock: ação desconhecida ' + action);
    }
  }

  function installMock() {
    const original = global.DynastyAPI.api;
    const originalLogin = global.DynastyAPI.loginWithPopup;
    global.DynastyAPI.api = async function (action, payload) {
      if (global.DynastyAPI.getApiUrl() === 'mock') {
        return mockApi(action, payload);
      }
      return original(action, payload);
    };
    global.DynastyAPI.loginWithPopup = async function () {
      if (global.DynastyAPI.getApiUrl() === 'mock') {
        const user = await mockApi('me');
        global.DynastyAPI.setSession('mock-token', user);
        return user;
      }
      return originalLogin();
    };
  }

  global.DynastyMock = { installMock, mockApi };
})(window);
