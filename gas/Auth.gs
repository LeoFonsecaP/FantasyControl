/**
 * Authentication — Google account + allowlist + session token bridge.
 *
 * Cross-origin frontend (GitHub Pages) cannot rely on Session cookies alone.
 * Login opens ?action=authBridge (HtmlService), which mints a CacheService token
 * and postMessages it to the opener. Subsequent API calls send { token }.
 */

var TOKEN_TTL_SECONDS = 21600; // 6 hours

function getActiveEmail_() {
  var email = '';
  try {
    email = Session.getActiveUser().getEmail() || '';
  } catch (e) {
    email = '';
  }
  if (!email) {
    try {
      email = Session.getEffectiveUser().getEmail() || '';
    } catch (e2) {
      email = '';
    }
  }
  return String(email).toLowerCase().trim();
}

function getAllowlistEmails_() {
  var emails = {};
  getAdminEmails_().forEach(function (e) {
    emails[e] = true;
  });
  sheetToObjects_(SHEET_NAMES.TIMES).forEach(function (t) {
    var e = String(t.Email || '')
      .toLowerCase()
      .trim();
    if (e) emails[e] = true;
  });
  return emails;
}

function findTeamByEmail_(email) {
  var e = (email || '').toLowerCase().trim();
  var teams = sheetToObjects_(SHEET_NAMES.TIMES);
  for (var i = 0; i < teams.length; i++) {
    if (
      String(teams[i].Email || '')
        .toLowerCase()
        .trim() === e
    ) {
      return teams[i];
    }
  }
  return null;
}

function mintSessionToken_(email) {
  var token =
    Utilities.getUuid() +
    '-' +
    Utilities.base64EncodeWebSafe(email).replace(/=+$/, '');
  CacheService.getScriptCache().put('sess:' + token, email, TOKEN_TTL_SECONDS);
  return token;
}

function emailFromToken_(token) {
  if (!token) return '';
  var email = CacheService.getScriptCache().get('sess:' + token);
  return email ? String(email).toLowerCase().trim() : '';
}

function resolveEmail_(params) {
  var fromSession = getActiveEmail_();
  if (fromSession) return fromSession;
  return emailFromToken_(params && params.token);
}

function buildUserFromEmail_(email) {
  if (!email) {
    throw new Error('Faça login com sua conta Google.');
  }
  var allow = getAllowlistEmails_();
  if (!allow[email]) {
    throw new Error('Acesso negado. Seu e-mail não está autorizado na liga.');
  }
  var team = findTeamByEmail_(email);
  var admins = getAdminEmails_();
  var isAdmin = admins.indexOf(email) !== -1;
  return {
    email: email,
    teamId: team ? String(team.ID) : null,
    teamName: team ? String(team.Nome_Time) : null,
    role: isAdmin ? 'admin' : 'member',
    isAdmin: isAdmin
  };
}

function requireAuth_(params) {
  var email = resolveEmail_(params || {});
  return buildUserFromEmail_(email);
}

function requireAdmin_(user) {
  if (!user || !user.isAdmin) {
    throw new Error('Ação restrita a administradores.');
  }
}

function actionMe_(user) {
  return {
    email: user.email,
    teamId: user.teamId,
    teamName: user.teamName,
    role: user.role,
    isAdmin: user.isAdmin,
    temporadaAtual: getTemporadaAtual_()
  };
}

/**
 * Called from auth bridge HTML after Google session is available.
 */
function bridgeCompleteLogin() {
  ensureSheets_();
  var email = getActiveEmail_();
  if (!email) {
    return { ok: false, error: 'Não foi possível obter seu e-mail Google. Confirme o login.' };
  }
  var allow = getAllowlistEmails_();
  // During first setup, empty allowlist + no teams emails: allow creating admin via setup
  var allowEmpty = Object.keys(allow).length === 0;
  if (!allow[email] && !allowEmpty) {
    return { ok: false, error: 'Acesso negado. Seu e-mail não está autorizado na liga.' };
  }
  if (allowEmpty) {
    setConfig_('admins', email);
  }
  var token = mintSessionToken_(email);
  var user = buildUserFromEmail_(email);
  return {
    ok: true,
    token: token,
    user: actionMe_(user)
  };
}

function authBridgeHtml_() {
  var html = HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><base target="_top">' +
      '<meta charset="utf-8"><title>Login Liga Dynasty</title>' +
      '<style>body{font-family:system-ui,sans-serif;background:#0c1222;color:#e8eefc;display:flex;' +
      'align-items:center;justify-content:center;min-height:100vh;margin:0}' +
      '.box{text-align:center;padding:2rem}h1{font-size:1.25rem;font-weight:600}' +
      'p{opacity:.75}.err{color:#ff8a8a}</style></head><body><div class="box">' +
      '<h1>Liga Dynasty</h1><p id="msg">Autenticando…</p></div>' +
      '<script>' +
      'function done(result){' +
      '  var msg=document.getElementById("msg");' +
      '  if(!result||!result.ok){msg.className="err";msg.textContent=(result&&result.error)||"Falha no login";return;}' +
      '  msg.textContent="Login ok. Pode fechar esta janela.";' +
      '  try{if(window.opener){window.opener.postMessage({type:"dynasty-auth",payload:result},"*");}}catch(e){}' +
      '  setTimeout(function(){window.close();},800);' +
      '}' +
      'google.script.run.withSuccessHandler(done).withFailureHandler(function(e){' +
      '  done({ok:false,error:String(e&&e.message||e)});' +
      '}).bridgeCompleteLogin();' +
      '</script></body></html>'
  );
  html.setTitle('Login — Liga Dynasty');
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}
