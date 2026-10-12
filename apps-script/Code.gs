const AUTH_CONFIG = {
  spreadsheetIdProperty: 'AUTH_SPREADSHEET_ID',
  collaboratorsSheet: 'COLABORADORES',
  administratorsSheet: 'ADMINISTRADORES',
  codeLifetimeSeconds: 600,
  resendDelaySeconds: 60,
  maxCodeAttempts: 5,
  sessionLifetimeSeconds: 21600
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Gestión de procesos judiciales');
}

function verificarPermisoEnvioCorreo() {
  const cuotaDiariaRestante = MailApp.getRemainingDailyQuota();
  console.log('Cuota diaria restante de destinatarios: ' + cuotaDiariaRestante);
  return cuotaDiariaRestante;
}

function solicitarCodigoAcceso(email) {
  const correo = normalizeEmail_(email);
  if (!isValidEmail_(correo)) {
    return { enviado: false, mensaje: 'Escribe una dirección de correo válida.' };
  }

  const usuario = findAuthorizedUserByEmail_(correo);
  if (!usuario) {
    return {
      enviado: false,
      mensaje: 'Este correo no está registrado como activo en COLABORADORES ni en ADMINISTRADORES. Contacta al administrador.'
    };
  }

  const cache = CacheService.getScriptCache();
  const rateLimitKey = getCacheKey_('AUTH_CODE_WAIT_', correo);
  const code = Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  const now = Date.now();
  const codeKey = getCacheKey_('AUTH_CODE_', correo);
  const request = {
    code: code,
    attempts: 0,
    expiresAt: now + AUTH_CONFIG.codeLifetimeSeconds * 1000
  };

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    if (cache.get(rateLimitKey)) {
      return {
        enviado: true,
        mensaje: 'Espera un minuto antes de solicitar otro código. Si el correo está autorizado, el código anterior sigue siendo válido.'
      };
    }
    cache.put(rateLimitKey, '1', AUTH_CONFIG.resendDelaySeconds);
    cache.put(codeKey, JSON.stringify(request), AUTH_CONFIG.codeLifetimeSeconds);
  } finally {
    lock.releaseLock();
  }

  try {
    MailApp.sendEmail(
      correo,
      'Código de acceso - Gestión de procesos judiciales',
      'Tu código de acceso es: ' + code +
      '\n\nVence en 10 minutos. Si no solicitaste este código, puedes ignorar este mensaje.'
    );
  } catch (error) {
    cache.remove(codeKey);
    cache.remove(rateLimitKey);
    console.error('No se pudo enviar el código de acceso a ' + correo, error);
    const detail = error && error.message ? error.message : String(error);
    throw new Error('Apps Script no pudo enviar el correo: ' + detail);
  }

  return {
    enviado: true,
    mensaje: 'Se envió un código a tu correo. Revisa también la carpeta de spam.'
  };
}

function verificarCodigoAcceso(email, submittedCode) {
  const correo = normalizeEmail_(email);
  const code = String(submittedCode || '').trim().toUpperCase();
  if (!isValidEmail_(correo) || !/^[A-F0-9]{8}$/.test(code)) {
    return {
      autorizado: false,
      mensaje: 'Escribe el correo y el código de 8 caracteres que recibiste.'
    };
  }

  const cache = CacheService.getScriptCache();
  const codeKey = getCacheKey_('AUTH_CODE_', correo);
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cachedRequest = cache.get(codeKey);
    if (!cachedRequest) {
      return {
        autorizado: false,
        mensaje: 'El código venció o no existe. Solicita uno nuevo.'
      };
    }

    const request = JSON.parse(cachedRequest);
    const remainingSeconds = Math.ceil((request.expiresAt - Date.now()) / 1000);
    if (remainingSeconds <= 0) {
      cache.remove(codeKey);
      return {
        autorizado: false,
        mensaje: 'El código venció. Solicita uno nuevo.'
      };
    }

    if (request.attempts >= AUTH_CONFIG.maxCodeAttempts) {
      cache.remove(codeKey);
      return {
        autorizado: false,
        mensaje: 'Se agotaron los intentos para este código. Solicita uno nuevo.'
      };
    }

    if (request.code !== code) {
      request.attempts++;
      if (request.attempts >= AUTH_CONFIG.maxCodeAttempts) {
        cache.remove(codeKey);
        return {
          autorizado: false,
          mensaje: 'El código no coincide y se agotaron los intentos. Solicita uno nuevo.'
        };
      }
      cache.put(codeKey, JSON.stringify(request), remainingSeconds);
      return {
        autorizado: false,
        mensaje: 'El código no coincide. Verifícalo e inténtalo de nuevo.'
      };
    }

    cache.remove(codeKey);
  } finally {
    lock.releaseLock();
  }

  const usuario = findAuthorizedUserByEmail_(correo);
  if (!usuario) {
    return {
      autorizado: false,
      mensaje: 'El correo ya no está autorizado. Solicita al administrador que lo active.'
    };
  }

  return createAccessSession_(correo, usuario);
}

function verificarSesionAcceso(sessionToken) {
  const token = String(sessionToken || '');
  if (!/^[A-Fa-f0-9]{64}$/.test(token)) {
    return { autorizado: false, mensaje: 'La sesión no es válida. Ingresa de nuevo.' };
  }

  const cache = CacheService.getScriptCache();
  const sessionKey = getCacheKey_('AUTH_SESSION_', token);
  const correo = cache.get(sessionKey);
  if (!correo) {
    return { autorizado: false, mensaje: 'La sesión venció. Ingresa de nuevo.' };
  }

  const usuario = findAuthorizedUserByEmail_(correo);
  if (!usuario) {
    cache.remove(sessionKey);
    return { autorizado: false, mensaje: 'Tu correo ya no está autorizado. Ingresa de nuevo o contacta al administrador.' };
  }

  return {
    autorizado: true,
    correo: correo,
    nombre: usuario.nombre,
    rol: usuario.rol
  };
}

function cerrarSesionAcceso(sessionToken) {
  const token = String(sessionToken || '');
  if (/^[A-Fa-f0-9]{64}$/.test(token)) {
    CacheService.getScriptCache().remove(getCacheKey_('AUTH_SESSION_', token));
  }
  return true;
}

function createAccessSession_(correo, usuario) {
  const token = Utilities.getUuid().replace(/-/g, '') +
    Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put(
    getCacheKey_('AUTH_SESSION_', token),
    correo,
    AUTH_CONFIG.sessionLifetimeSeconds
  );
  return {
    autorizado: true,
    correo: correo,
    nombre: usuario.nombre,
    rol: usuario.rol,
    sessionToken: token
  };
}

function findAuthorizedUserByEmail_(correo) {
  const spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty(AUTH_CONFIG.spreadsheetIdProperty);
  if (!spreadsheetId) {
    throw new Error('Falta configurar la propiedad AUTH_SPREADSHEET_ID con el ID del archivo de Google Sheets.');
  }

  let spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } catch (error) {
    console.error('No se pudo abrir el archivo de autorización.', error);
    throw new Error('No se pudo abrir el archivo de autorización. Verifica AUTH_SPREADSHEET_ID y los permisos del proyecto.');
  }

  const administrator = findAuthorizedUser_(
    spreadsheet,
    AUTH_CONFIG.administratorsSheet,
    correo,
    'ADMINISTRADOR'
  );
  if (administrator) {
    return administrator;
  }

  return findAuthorizedUser_(
    spreadsheet,
    AUTH_CONFIG.collaboratorsSheet,
    correo,
    'COLABORADOR'
  );
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail_(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getCacheKey_(prefix, correo) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, correo);
  const hash = Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '');
  return prefix + hash;
}

function findAuthorizedUser_(spreadsheet, sheetName, correo, role) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('No existe la hoja "' + sheetName + '" en el archivo de autorización.');
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) {
    throw new Error('La hoja "' + sheetName + '" debe incluir CORREO, NOMBRE y ACTIVO en la primera fila.');
  }

  const headers = values[0].map(value => String(value).trim().toUpperCase());
  const emailColumn = headers.indexOf('CORREO');
  const nameColumn = headers.indexOf('NOMBRE');
  const activeColumn = headers.indexOf('ACTIVO');
  if (emailColumn < 0 || nameColumn < 0 || activeColumn < 0) {
    throw new Error('Revisa los encabezados de la hoja "' + sheetName + '": se requieren CORREO, NOMBRE y ACTIVO.');
  }

  for (let row = 1; row < values.length; row++) {
    const rowEmail = normalizeEmail_(values[row][emailColumn]);
    const active = String(values[row][activeColumn] || '').trim().toUpperCase();
    if (rowEmail === correo && active === 'SI') {
      return {
        nombre: String(values[row][nameColumn] || '').trim(),
        rol: role
      };
    }
  }

  return null;
}
