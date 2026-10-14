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

const DATA_SHEETS = {
  processes: { name: 'PROCESOS', headers: ['ID_PROCESO', 'RADICADO', 'DATA_JSON', 'FECHA_CREACION', 'FECHA_ACTUALIZACION', 'MODIFICADO_POR'] },
  hearings: { name: 'AUDIENCIAS', headers: ['ID_AUDIENCIA', 'ID_PROCESO', 'TIPO_AUDIENCIA', 'NUMERO_SESION', 'FECHA', 'OBSERVACION'] },
  actions: { name: 'ACTUACIONES', headers: ['ID_ACTUACION', 'ID_PROCESO', 'FECHA_ACTUACION', 'TIPO_ACTUACION', 'TITULO', 'DESCRIPCION', 'ESTADO', 'REGISTRADO_POR', 'FECHA_REGISTRO'] },
  audits: { name: 'AUDITORIA_PROCESOS', headers: ['ID_AUDITORIA', 'ID_PROCESO', 'FECHA_CAMBIO', 'MODIFICADO_POR', 'CAMPOS_CAMBIADOS'] },
  catalogs: { name: 'CATALOGOS', headers: ['CATEGORIA', 'VALOR', 'ACTIVO', 'ACTUALIZADO_POR', 'FECHA_ACTUALIZACION'] }
};

const ALLOWED_CATALOGS = ['lawyer', 'lawyerLinkType', 'type', 'cause', 'hearingType', 'terminationForm'];

function loadCatalogs(sessionToken) {
  requireApplicationUser_(sessionToken);
  const spreadsheet = getDataSpreadsheet_();
  ensureDataSheet_(spreadsheet, DATA_SHEETS.catalogs);
  return readDataRows_(spreadsheet, DATA_SHEETS.catalogs)
    .filter(row => String(row[2]).toUpperCase() === 'SI')
    .reduce((catalogs, row) => {
      const category = String(row[0]);
      catalogs[category] = catalogs[category] || [];
      catalogs[category].push(String(row[1]));
      return catalogs;
    }, {});
}

function saveCatalogs(sessionToken, category, values) {
  const user = requireApplicationUser_(sessionToken);
  if (user.rol !== 'ADMINISTRADOR') throw new Error('Solo los administradores pueden gestionar catálogos.');
  if (ALLOWED_CATALOGS.indexOf(category) < 0 || !Array.isArray(values) || values.length > 500) {
    throw new Error('La categoría o la lista de valores del catálogo no es válida.');
  }
  const cleaned = [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
  if (cleaned.some(value => value.length > 150)) throw new Error('Cada valor de catálogo debe tener 150 caracteres o menos.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = getDataSpreadsheet_();
    const sheet = ensureDataSheet_(spreadsheet, DATA_SHEETS.catalogs);
    const rows = readDataRows_(spreadsheet, DATA_SHEETS.catalogs);
    rows.forEach((row, index) => {
      if (String(row[0]) === category && String(row[2]).toUpperCase() === 'SI') {
        sheet.getRange(index + 2, 3, 1, 3).setValues([['NO', user.correo, new Date().toISOString()]]);
      }
    });
    const activeValues = new Set(rows.filter(row => String(row[0]) === category).map(row => String(row[1])));
    cleaned.forEach(value => {
      const matchingRow = rows.findIndex(row => String(row[0]) === category && String(row[1]) === value);
      if (matchingRow >= 0) {
        sheet.getRange(matchingRow + 2, 3, 1, 3).setValues([['SI', user.correo, new Date().toISOString()]]);
      } else if (!activeValues.has(value)) {
        sheet.appendRow([category, safeSheetText_(value), 'SI', user.correo, new Date().toISOString()]);
      }
    });
    return loadCatalogs(sessionToken);
  } finally {
    lock.releaseLock();
  }
}

const COLLABORATOR_PROCESS_FIELDS = [
  'stage', 'notificationDate', 'cautelar', 'measureResponseDate',
  'maxDemandResponseDate', 'demandResponseDate', 'anticipatedJudgment',
  'closingArgumentsDate', 'firstInstanceDecisionDate',
  'firstInstanceDecisionSense', 'appealStatus', 'appealDate',
  'appealGrantedOrderDate', 'appealAdmittedOrderDate',
  'secondInstanceDecisionDate', 'secondInstanceDecisionSense',
  'secondInstanceDecision', 'secondCourt', 'notes'
];
const ISO_DATE_FIELDS = [
  'endDate', 'notificationDate', 'measureResponseDate', 'maxDemandResponseDate',
  'demandResponseDate', 'closingArgumentsDate', 'firstInstanceDecisionDate',
  'appealDate', 'appealGrantedOrderDate', 'appealAdmittedOrderDate',
  'secondInstanceDecisionDate'
];

function loadApplicationData(sessionToken) {
  const user = requireApplicationUser_(sessionToken);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = getDataSpreadsheet_();
    const processes = readDataRows_(spreadsheet, DATA_SHEETS.processes).map(row => {
    let process;
    try {
      process = JSON.parse(row[2]);
    } catch (error) {
      throw new Error('El proceso ' + row[0] + ' contiene JSON inválido en PROCESOS.');
    }
    process.notificationYear = String(process.notificationDate || '').slice(0, 4);
    return process;
    });
    const permittedProcesses = user.rol === 'ADMINISTRADOR'
      ? processes
      : processes.filter(process => normalizeEmail_(process.assignedEmail) === user.correo);
    const permittedIds = new Set(permittedProcesses.map(process => String(process.id)));
    const hearings = readDataRows_(spreadsheet, DATA_SHEETS.hearings)
      .filter(row => permittedIds.has(String(row[1])))
      .map(row => ({ id: row[0], processId: row[1], type: row[2], number: Number(row[3]), date: row[4], observation: row[5] }));
    const actions = readDataRows_(spreadsheet, DATA_SHEETS.actions)
      .filter(row => permittedIds.has(String(row[1])))
      .map(row => ({ id: row[0], processId: row[1], date: row[2], type: row[3], title: row[4], description: row[5], status: row[6], registeredBy: row[7], createdAt: row[8] }));
    const audits = readDataRows_(spreadsheet, DATA_SHEETS.audits)
      .filter(row => permittedIds.has(String(row[1])))
      .map(row => ({ id: row[0], processId: row[1], changedAt: row[2], changedBy: row[3], changedFields: String(row[4] || '').split('|').filter(Boolean) }));

    return permittedProcesses.map(process => ({
      ...process,
      hearings: hearings.filter(item => item.processId === process.id),
      actions: actions.filter(item => item.processId === process.id),
      audit: audits.filter(item => item.processId === process.id)
    }));
  } finally {
    lock.releaseLock();
  }
}

function saveApplicationData(sessionToken, submittedRecords) {
  const user = requireApplicationUser_(sessionToken);
  if (!Array.isArray(submittedRecords) || submittedRecords.length > 5000) {
    throw new Error('La lista de procesos tiene un formato inválido o excede el máximo permitido.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = getDataSpreadsheet_();
    const sheets = {};
    Object.keys(DATA_SHEETS).forEach(key => sheets[key] = ensureDataSheet_(spreadsheet, DATA_SHEETS[key]));
    const existingRows = readDataRows_(spreadsheet, DATA_SHEETS.processes);
    const existing = new Map(existingRows.map(row => [String(row[0]), JSON.parse(row[2])]));
    readDataRows_(spreadsheet, DATA_SHEETS.hearings).forEach(row => {
      const process = existing.get(String(row[1]));
      if (process) {
        process.hearings = process.hearings || [];
        process.hearings.push({ id: row[0], processId: row[1], type: row[2], number: Number(row[3]), date: row[4], observation: row[5] });
      }
    });
    readDataRows_(spreadsheet, DATA_SHEETS.actions).forEach(row => {
      const process = existing.get(String(row[1]));
      if (process) {
        process.actions = process.actions || [];
        process.actions.push({ id: row[0], processId: row[1], date: row[2], type: row[3], title: row[4], description: row[5], status: row[6], registeredBy: row[7], createdAt: row[8] });
      }
    });
    const submittedIds = new Set();
    const allRadicados = new Map();
    const existingRadicados = new Map();
    existing.forEach((process, id) => {
      const radicado = String(process.radicado || '');
      if (radicado) existingRadicados.set(radicado, id);
    });

    submittedRecords.forEach(process => {
      if (!process || !process.id || !/^[A-Za-z0-9_-]{1,128}$/.test(String(process.id)) || submittedIds.has(String(process.id))) {
        throw new Error('Cada proceso debe tener un identificador único.');
      }
      submittedIds.add(String(process.id));
      ISO_DATE_FIELDS.forEach(field => {
        if (process[field] && !isValidIsoDate_(process[field])) {
          throw new Error('La fecha del campo ' + field + ' no tiene formato válido.');
        }
      });
      const radicado = String(process.radicado || '').trim();
      if (radicado && !/^\d{23}$/.test(radicado)) {
        throw new Error('El radicado del proceso ' + process.id + ' debe contener exactamente 23 dígitos.');
      }
      if (radicado && allRadicados.has(radicado)) {
        throw new Error('El radicado ' + radicado + ' está repetido.');
      }
      const existingOwner = existingRadicados.get(radicado);
      if (radicado && existingOwner && existingOwner !== String(process.id)) {
        throw new Error('El radicado ' + radicado + ' ya está asignado a otro proceso.');
      }
      if (radicado) allRadicados.set(radicado, String(process.id));

      const previous = existing.get(String(process.id));
      if (user.rol !== 'ADMINISTRADOR') {
        if (!previous || normalizeEmail_(previous.assignedEmail) !== user.correo) {
          throw new Error('Solo puedes modificar procesos asignados a tu correo.');
        }
        const changedFields = Object.keys(process).filter(key =>
          !['actions', 'hearings', 'audit', 'createdAt', 'updatedAt', 'updatedBy', 'notificationYear'].includes(key) &&
          JSON.stringify(process[key]) !== JSON.stringify(previous[key])
        );
        const forbidden = changedFields.filter(key => COLLABORATOR_PROCESS_FIELDS.indexOf(key) < 0);
        if (forbidden.length) {
          throw new Error('No tienes permiso para modificar estos campos: ' + forbidden.join(', '));
        }
        assertAppendOnly_(previous.actions || [], process.actions || [], 'actuaciones');
        assertAppendOnly_(previous.hearings || [], process.hearings || [], 'audiencias');
      }
    });

    if (user.rol !== 'ADMINISTRADOR') {
      existing.forEach((process, id) => {
        if (normalizeEmail_(process.assignedEmail) === user.correo && !submittedIds.has(id)) {
          throw new Error('No se permite eliminar procesos desde el perfil colaborador.');
        }
      });
    }

    submittedRecords.forEach(process => {
      const previous = existing.get(String(process.id));
      const now = new Date().toISOString();
      const changedFields = previous
        ? Object.keys(process).filter(key =>
          !['actions', 'hearings', 'audit', 'createdAt', 'updatedAt', 'updatedBy', 'notificationYear'].includes(key) &&
          JSON.stringify(process[key]) !== JSON.stringify(previous[key]))
        : [];
      if (previous && (process.hearings || []).length > (previous.hearings || []).length) changedFields.push('hearings');
      if (previous && (process.actions || []).length > (previous.actions || []).length) changedFields.push('actions');
      const saved = {
        ...process,
        createdAt: (previous && previous.createdAt) || now,
        updatedAt: now,
        updatedBy: user.correo
      };
      const processData = { ...saved };
      delete processData.actions;
      delete processData.hearings;
      delete processData.audit;
      delete processData.notificationYear;
      const processRow = upsertSheetRow_(sheets.processes, DATA_SHEETS.processes.headers, process.id, [
        String(process.id), String(process.radicado || ''), JSON.stringify(processData),
        saved.createdAt, saved.updatedAt, user.correo
      ]);
      sheets.processes.getRange(processRow, 2).setNumberFormat('@');
      sheets.processes.getRange(processRow, 2).setValue(String(process.radicado || ''));

      (process.hearings || []).forEach(hearing => {
        if (!hearing.id || !/^[A-Za-z0-9_-]{1,128}$/.test(String(hearing.id)) || !isValidIsoDate_(hearing.date)) throw new Error('Cada audiencia requiere un identificador válido y una fecha válida.');
        upsertSheetRow_(sheets.hearings, DATA_SHEETS.hearings.headers, hearing.id, [
          String(hearing.id), String(process.id), safeSheetText_(hearing.type || ''),
          Number(hearing.number) || 1, String(hearing.date), safeSheetText_(hearing.observation || '')
        ]);
      });
      (process.actions || []).forEach(action => {
        if (!action.id || !/^[A-Za-z0-9_-]{1,128}$/.test(String(action.id)) || !isValidIsoDate_(action.date) || !action.title || !action.description) {
          throw new Error('Cada actuación requiere identificador, fecha, título y descripción.');
        }
        upsertSheetRow_(sheets.actions, DATA_SHEETS.actions.headers, action.id, [
          String(action.id), String(process.id), String(action.date), safeSheetText_(action.type || ''),
          safeSheetText_(action.title), safeSheetText_(action.description), safeSheetText_(action.status || ''),
          user.correo, String(action.createdAt || now)
        ]);
      });
      if (changedFields.length) {
        const auditId = Utilities.getUuid();
        upsertSheetRow_(sheets.audits, DATA_SHEETS.audits.headers, auditId, [
          auditId, String(process.id), now, user.correo, changedFields.join('|')
        ]);
      }
    });

    return { saved: true, count: submittedRecords.length };
  } finally {
    lock.releaseLock();
  }
}

function deleteApplicationProcess(sessionToken, processId) {
  const user = requireApplicationUser_(sessionToken);
  if (user.rol !== 'ADMINISTRADOR') throw new Error('Solo los administradores pueden eliminar procesos.');
  const id = String(processId || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('El identificador del proceso no es válido.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = getDataSpreadsheet_();
    const processSheet = ensureDataSheet_(spreadsheet, DATA_SHEETS.processes);
    const processRows = readDataRows_(spreadsheet, DATA_SHEETS.processes);
    const processIndex = processRows.findIndex(row => String(row[0]) === id);
    if (processIndex < 0) throw new Error('No se encontró el proceso que intentas eliminar.');
    processSheet.deleteRow(processIndex + 2);

    ['hearings', 'actions', 'audits'].forEach(key => {
      const sheet = ensureDataSheet_(spreadsheet, DATA_SHEETS[key]);
      const rows = readDataRows_(spreadsheet, DATA_SHEETS[key]);
      for (let index = rows.length - 1; index >= 0; index--) {
        if (String(rows[index][1]) === id) sheet.deleteRow(index + 2);
      }
    });
    return { deleted: true };
  } finally {
    lock.releaseLock();
  }
}

function requireApplicationUser_(sessionToken) {
  const token = String(sessionToken || '');
  if (!/^[A-Fa-f0-9]{64}$/.test(token)) throw new Error('Se requiere una sesión válida para esta operación.');
  const correo = CacheService.getScriptCache().get(getCacheKey_('AUTH_SESSION_', token));
  if (!correo) throw new Error('La sesión venció. Ingresa nuevamente.');
  const user = findAuthorizedUserByEmail_(correo);
  if (!user || ['ADMINISTRADOR', 'COLABORADOR'].indexOf(user.rol) < 0) {
    throw new Error('No tienes autorización para esta operación.');
  }
  return { correo: normalizeEmail_(correo), rol: user.rol };
}

function getDataSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(AUTH_CONFIG.spreadsheetIdProperty);
  if (!spreadsheetId) throw new Error('Falta configurar AUTH_SPREADSHEET_ID.');
  return SpreadsheetApp.openById(spreadsheetId);
}

function ensureDataSheet_(spreadsheet, config) {
  let sheet = spreadsheet.getSheetByName(config.name);
  if (!sheet) sheet = spreadsheet.insertSheet(config.name);
  const headerRange = sheet.getRange(1, 1, 1, config.headers.length);
  const current = headerRange.getDisplayValues()[0];
  if (current.every(value => !value)) {
    headerRange.setValues([config.headers]);
  } else if (config.headers.some((header, index) => current[index] !== header)) {
    throw new Error('Los encabezados de la hoja "' + config.name + '" no coinciden con el modelo requerido.');
  }
  return sheet;
}

function readDataRows_(spreadsheet, config) {
  const sheet = ensureDataSheet_(spreadsheet, config);
  const lastRow = sheet.getLastRow();
  return lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, config.headers.length).getDisplayValues();
}

function upsertSheetRow_(sheet, headers, id, values) {
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    const index = ids.findIndex(row => String(row[0]) === String(id));
    if (index >= 0) {
      const oldValues = sheet.getRange(index + 2, 1, 1, headers.length).getDisplayValues()[0];
      if (sheet.getName() === DATA_SHEETS.hearings.name || sheet.getName() === DATA_SHEETS.actions.name) {
        if (JSON.stringify(oldValues.map(sheetComparisonValue_)) !== JSON.stringify(values.map(sheetComparisonValue_))) throw new Error('No se permite reemplazar un registro de historial existente.');
      } else {
        sheet.getRange(index + 2, 1, 1, headers.length).setValues([values]);
      }
      return index + 2;
    }
  }
  sheet.appendRow(values);
  return sheet.getLastRow();
}

function assertAppendOnly_(oldEntries, newEntries, label) {
  const canonical = entry => {
    const copy = { ...entry };
    delete copy.processId;
    return JSON.stringify(copy);
  };
  const nextById = new Map(newEntries.map(entry => [String(entry.id), canonical(entry)]));
  oldEntries.forEach(entry => {
    if (!nextById.has(String(entry.id)) || nextById.get(String(entry.id)) !== canonical(entry)) {
      throw new Error('El historial de ' + label + ' no se puede borrar ni reemplazar.');
    }

    function isValidIsoDate_(value) {
      const text = String(value || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
      const date = new Date(text + 'T00:00:00Z');
      return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
    }

    function safeSheetText_(value) {
      const text = String(value || '');
      return /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;
    }

    function sheetComparisonValue_(value) {
      return String(value).replace(/^'(?=[\s]*[=+\-@])/, '');
    }
  });
}
