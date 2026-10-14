    const KEY = 'demo_procesos_judiciales_v1'; const CATALOG_KEY = 'demo_procesos_judiciales_catalogs_v1'; let records = []; let catalogs = {}; let step = 0; let editingId = null; let actionProcessId = null; let hearingEntries = [];
    const activeFilters = { query: '', state: '', instance: '', type: '', cause: '', lawyer: '', year: '', quality: '' };
    const fields = ['shortNo', 'radicado', 'currentRadicado', 'siproJ', 'orfeo', 'ids', 'claimant', 'defendant', 'area', 'lawyer', 'assignedEmail', 'quality', 'lawyerLinkType', 'represents', 'instance', 'type', 'court', 'secondCourt', 'cause', 'stage', 'state', 'endDate', 'terminationForm', 'terminationInstance', 'terminationNotes', 'claim', 'amount', 'cautelar', 'notificationDate', 'measureResponseDate', 'maxDemandResponseDate', 'demandResponseDate', 'anticipatedJudgment', 'evidence', 'closingArgumentsDate', 'firstInstanceDecisionDate', 'firstInstanceDecisionSense', 'appealStatus', 'appealDate', 'appealGrantedOrderDate', 'appealAdmittedOrderDate', 'secondInstanceDecisionDate', 'secondInstanceDecisionSense', 'secondInstanceDecision', 'notes'];
    const labels = { shortNo: 'No. corto', radicado: 'Radicado', currentRadicado: 'Radicado actual', siproJ: 'ID SIPROJ', orfeo: 'Expediente ORFEO', ids: 'Cédulas / identificadores', claimant: 'Demandante', defendant: 'Demandados / entidades', area: 'Área generadora del daño', lawyer: 'Abogado a cargo', assignedEmail: 'Correo asignado', quality: 'Activa / pasiva', lawyerLinkType: 'Tipo de vinculación del abogado', represents: 'Representa', instance: 'Instancia del proceso', type: 'Tipo de proceso', court: 'Despacho judicial inicial', secondCourt: 'Despacho de segunda instancia', cause: 'Causa', stage: 'Etapa del proceso', state: 'Estado del proceso', endDate: 'Fecha de terminación', terminationForm: 'Forma de terminación', terminationInstance: 'Instancia de terminación', terminationNotes: 'Observaciones de terminación', claim: 'Pretensión / asunto', amount: 'Valor de las pretensiones', cautelar: 'Presenta medida cautelar', notificationDate: 'Fecha de notificación / inicio', measureResponseDate: 'Fecha de contestación de medida cautelar', maxDemandResponseDate: 'Fecha máxima de contestación de demanda', demandResponseDate: 'Fecha de contestación de demanda', anticipatedJudgment: 'Sentencia anticipada', evidence: 'Pruebas', closingArgumentsDate: 'Fecha de alegatos de conclusión', firstInstanceDecisionDate: 'Fecha de fallo de primera instancia', firstInstanceDecisionSense: 'Sentido del fallo de primera instancia', appealStatus: 'Estado del recurso de apelación', appealDate: 'Fecha de presentación del recurso', appealGrantedOrderDate: 'Auto que concede la apelación', appealAdmittedOrderDate: 'Auto que admite la apelación', secondInstanceDecisionDate: 'Fecha de fallo de segunda instancia', secondInstanceDecisionSense: 'Sentido del fallo de segunda instancia', secondInstanceDecision: 'Fallo de segunda instancia', notes: 'Observaciones' };
    function isAppsScript() { return typeof google !== 'undefined' && google.script && google.script.run }
    function accessToken() { try { return localStorage.getItem('judicial_access_session_v1') || '' } catch (error) { console.error('No se pudo leer la sesión de acceso.', error); return '' } }
    function load() {
      if (isAppsScript()) {
        records = [];
        renderAll();
        if (window.currentAuthenticatedUser && accessToken()) loadRemoteApplicationData();
        return;
      }
      try {
        const saved = localStorage.getItem(KEY);
        records = saved ? JSON.parse(saved) : [];
        if (!Array.isArray(records)) throw new Error('El almacenamiento de procesos tiene un formato inválido.');
        records = records.map(record => ({
          ...record,
          notificationDate: record.notificationDate || record.startDate || '',
          notificationYear: (record.notificationDate || record.startDate || '').slice(0, 4),
          hearings: record.hearings || (record.initialHearingDate
            ? [{ id: newId(), type: 'Inicial', number: 1, date: record.initialHearingDate, observation: '' }]
            : []),
          actions: (record.actions || []).map(action => ({
            ...action, id: action.id || newId(), type: action.type || 'Otra',
            title: action.title || action.description || 'Actuación registrada',
            processId: action.processId || record.id
          })),
          audit: record.audit || []
        }));
      } catch (error) {
        records = [];
        console.error('No se pudieron cargar los procesos guardados.', error);
        alert('No se pudieron cargar los procesos guardados en este navegador. No se sobrescribieron los datos. Detalle: ' + error.message);
      }
      try {
        const savedCatalogs = JSON.parse(localStorage.getItem(CATALOG_KEY) || '{}');
        catalogs = savedCatalogs && typeof savedCatalogs === 'object' && !Array.isArray(savedCatalogs)
          ? Object.fromEntries(Object.entries(savedCatalogs).filter(([, values]) => Array.isArray(values)))
          : {};
      } catch (error) {
        catalogs = {};
        console.error('No se pudieron cargar los catálogos locales.', error);
        alert('No se pudieron cargar los catálogos guardados en este navegador. Detalle: ' + error.message);
      }
      updateCatalogControls();
      renderAll();
    }
    function newId() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` }
    function callAppsScript(method, token, payload, category) { return new Promise((resolve, reject) => { let runner = google.script.run.withSuccessHandler(resolve).withFailureHandler(error => reject(new Error(error.message || String(error)))); if (method === 'load') runner.loadApplicationData(token); else if (method === 'save') runner.saveApplicationData(token, payload); else if (method === 'delete') runner.deleteApplicationProcess(token, payload); else if (method === 'catalogs') runner.loadCatalogs(token); else runner.saveCatalogs(token, category, payload) }) }
    async function loadRemoteApplicationData() { if (!isAppsScript() || !accessToken()) return; try { const token = accessToken(); [records, catalogs] = await Promise.all([callAppsScript('load', token), callAppsScript('catalogs', token)]); updateCatalogControls(); renderAll() } catch (error) { console.error('No se pudieron cargar los procesos y catálogos desde Google Sheets.', error); alert('No se pudieron cargar los procesos o catálogos desde Google Sheets. ' + error.message) } }
    window.loadRemoteApplicationData = loadRemoteApplicationData;
    async function persist() { if (isAppsScript()) { const token = accessToken(); if (!token) throw new Error('La sesión no es válida. Ingresa nuevamente.'); await callAppsScript('save', token, records) } else { localStorage.setItem(KEY, JSON.stringify(records)) } updateCatalogControls(); renderAll() }
    function showView(id) { document.querySelectorAll('.view').forEach(x => x.classList.add('hidden')); document.getElementById(id).classList.remove('hidden'); document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.view === id)); const titles = { dashboard: ['Resumen general', 'Estado de la información registrada'], processes: ['Procesos', 'Consulta y edición de registros'], processOverview: ['Vista completa de procesos', 'Todos los campos de cada registro'], actions: ['Actuaciones', 'Historial de actuaciones registradas'], hearings: ['Audiencias', 'Sesiones conservadas cronológicamente'], catalogs: ['Catálogos', 'Listas autorizadas para estandarizar registros'], form: ['Registro de proceso', 'Formulario por etapas'], backup: ['Descargar datos', 'Descarga de información en formato Excel'] }; document.getElementById('pageTitle').textContent = titles[id][0]; document.getElementById('pageSubtitle').textContent = titles[id][1]; if (id === 'processes') renderProcesses(); if (id === 'processOverview') renderFullProcesses(); if (id === 'actions') renderActions(); if (id === 'hearings') renderHearingsTable(); if (id === 'catalogs') { renderCatalogSummary(); renderCatalogEditor() } }
    document.querySelectorAll('.nav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
    function newProcess() { editingId = null; hearingEntries = []; document.getElementById('processForm').reset(); document.getElementById('formTitle').textContent = 'Registrar proceso'; document.getElementById('editBadge').textContent = 'Nuevo'; document.getElementById('confirmData').checked = false; renderHearings(); step = 0; setStep(); showView('form') }
    function editProcess(id) { const r = records.find(x => x.id === id); if (!r) return; editingId = id; hearingEntries = [...(r.hearings || [])]; const f = document.getElementById('processForm'); f.reset(); fields.forEach(k => { if (f.elements[k]) f.elements[k].value = r[k] ?? '' }); if (f.elements.notificationDate && !f.elements.notificationDate.value) f.elements.notificationDate.value = r.startDate || ''; document.getElementById('formTitle').textContent = 'Editar proceso'; document.getElementById('editBadge').textContent = 'Edición'; document.getElementById('confirmData').checked = false; renderHearings(); step = 0; setStep(); showView('form') }
    function setStep() { document.querySelectorAll('.form-step').forEach((el, i) => el.classList.toggle('hidden', i !== step)); document.querySelectorAll('.step').forEach((el, i) => { el.classList.toggle('active', i === step); el.classList.toggle('done', i < step) }); document.getElementById('prevBtn').disabled = step === 0; document.getElementById('nextBtn').classList.toggle('hidden', step === 4); document.getElementById('saveBtn').classList.toggle('hidden', step !== 4); updateConditionalFields(); if (step === 4) makeReview() }
    function moveStep(delta) { if (delta > 0 && !validateStep()) return; step = Math.max(0, Math.min(4, step + delta)); setStep() }
    function validateStep() {
      const box = document.querySelector(`.form-step[data-step="${step}"]`); for (const el of box.querySelectorAll('[required]')) { if (!el.value.trim()) { el.focus(); alert('Complete el campo obligatorio: ' + (el.closest('.field').querySelector('label')?.textContent || el.name)); return false } }
      if (step === 0) { let rad = document.querySelector('[name=radicado]').value.trim(); if (rad && !/^\d{23}$/.test(rad)) { alert('Si registra un radicado, debe contener exactamente 23 dígitos numéricos. Se conserva como texto para evitar pérdida de ceros.'); return false } }
      return true
    }
    function makeReview() { let f = document.getElementById('processForm'); let data = Object.fromEntries(fields.map(k => [k, f.elements[k]?.value || ''])); const storage = isAppsScript() ? 'Google Sheets' : 'el almacenamiento local de este navegador'; document.getElementById('reviewBox').innerHTML = '<b>Resumen de revisión</b><br>' + ['shortNo', 'radicado', 'claimant', 'defendant', 'notificationDate', 'maxDemandResponseDate', 'type', 'stage', 'state', 'lawyer', 'quality', 'endDate', 'appealStatus'].map(k => `<div>${labels[k]}: ${escapeHtml(data[k] || 'Sin diligenciar')}</div>`).join('') + `<div>Sesiones de audiencia: ${hearingEntries.length}</div><br>Los campos obligatorios definitivos y los términos deben ser validados por el equipo jurídico. El registro se guardará en ${storage}.` }
    async function saveProcess() {
      if (!document.getElementById('confirmData').checked) {
        alert('Marque la confirmación de revisión antes de guardar.');
        return;
      }
      const form = document.getElementById('processForm');
      const data = Object.fromEntries(fields.map(key => [key, form.elements[key]?.value.trim() || '']));
      if (data.radicado && !/^\d{23}$/.test(data.radicado)) {
        alert('Si registra un radicado, debe contener exactamente 23 dígitos numéricos.');
        step = 0;
        setStep();
        return;
      }
      const duplicate = data.radicado && records.find(record => record.radicado === data.radicado && record.id !== editingId);
      if (duplicate) {
        alert('Ya existe un registro con ese radicado. Revise el listado antes de continuar.');
        return;
      }
      if (data.state === 'Terminado' && !data.endDate && !confirm('El proceso está Terminado pero no tiene fecha de terminación. ¿Guardar de todas formas?')) return;

      const beforeSave = JSON.stringify(records);
      const now = new Date().toISOString();
      if (editingId) {
        const index = records.findIndex(record => record.id === editingId);
        const previous = records[index];
        const changedFields = fields.filter(key => String(previous[key] ?? '') !== String(data[key] ?? ''));
        if (JSON.stringify(previous.hearings || []) !== JSON.stringify(hearingEntries)) changedFields.push('hearings');
        const audit = [...(previous.audit || [])];
        if (changedFields.length) audit.push({ changedAt: now, changedBy: currentActor(), changedFields });
        records[index] = {
          ...previous, ...data, notificationYear: data.notificationDate.slice(0, 4),
          hearings: hearingEntries, updatedAt: now, updatedBy: currentActor(),
          audit
        };
      } else {
        records.unshift({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          ...data, notificationYear: data.notificationDate.slice(0, 4), hearings: hearingEntries,
          createdAt: now, updatedAt: now, updatedBy: currentActor(), audit: [], actions: []
        });
      }
      try {
        await persist();
        newProcess();
        alert('Registro guardado. El formulario está listo para registrar otro proceso.');
      } catch (error) {
        records = JSON.parse(beforeSave);
        renderAll();
        alert(error.message);
      }
    }
    function currentActor() { return document.getElementById('userName')?.textContent.trim() || 'Usuario local' }
    function addHearing() { const date = document.getElementById('hearingDate').value; const type = document.getElementById('hearingType').value.trim(); if (!date || !type) { alert('Selecciona el tipo y la fecha de la sesión de audiencia.'); return } const number = hearingEntries.filter(item => item.type === type).length + 1; hearingEntries.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), type, number, date, observation: document.getElementById('hearingObservation').value.trim() }); document.getElementById('hearingDate').value = ''; document.getElementById('hearingObservation').value = ''; renderHearings() }
    function renderHearings() { const target = document.getElementById('hearingList'); if (!target) return; const sorted = [...hearingEntries].sort((a, b) => a.date.localeCompare(b.date)); target.innerHTML = sorted.length ? sorted.map(item => `<article class="action-item"><strong>${escapeHtml(item.type)} · Sesión ${item.number} · ${escapeHtml(fmtDate(item.date))}</strong><div>${escapeHtml(item.observation || 'Sin observación')}</div></article>`).join('') : '<div class="empty">Aún no hay sesiones registradas.</div>' }
    function updateConditionalFields() {
      const form = document.getElementById('processForm');
      const anticipated = form.elements.anticipatedJudgment?.value === 'Sí';
      const appealStatus = form.elements.appealStatus?.value || '';
      const hearingField = document.getElementById('hearingList')?.closest('.field');
      const flowNotice = document.getElementById('judicialFlowNotice');
      if (hearingField) hearingField.classList.toggle('hidden', anticipated);
      ['evidence', 'closingArgumentsDate'].forEach(name => {
        const field = form.elements[name]?.closest('.field');
        if (field) field.classList.toggle('hidden', anticipated);
      });
      const appealFiled = appealStatus === 'Presentado en término';
      ['appealGrantedOrderDate', 'appealAdmittedOrderDate', 'secondInstanceDecisionDate', 'secondInstanceDecisionSense', 'secondInstanceDecision'].forEach(name => {
        const field = form.elements[name]?.closest('.field');
        if (field) field.classList.toggle('hidden', appealStatus !== '' && !appealFiled);
      });
      if (flowNotice) {
        flowNotice.textContent = anticipated
          ? 'Sentencia anticipada seleccionada: se ocultan las audiencias, pruebas y alegatos. Cualquier dato ya registrado se conserva.'
          : appealStatus === 'No presentado' || appealStatus === 'Presentado fuera de término'
            ? `Estado del recurso: ${appealStatus}. No se marcará automáticamente el proceso como terminado; confirme el estado y la terminación según el criterio jurídico.`
            : 'Las etapas no aplicables pueden ocultarse temporalmente; los datos registrados se conservan.';
      }
      const deadline = form.elements.maxDemandResponseDate?.value;
      const responded = form.elements.demandResponseDate?.value;
      const notice = document.getElementById('deadlineNotice');
      if (notice && deadline) {
        const today = new Date().toISOString().slice(0, 10);
        notice.textContent = responded
          ? `Fecha máxima registrada: ${fmtDate(deadline)}. Fecha real de contestación: ${fmtDate(responded)}. ${responded > deadline ? 'La contestación fue posterior al vencimiento registrado.' : 'La contestación no fue posterior al vencimiento registrado.'}`
          : deadline < today
            ? `Alerta: la fecha máxima registrada (${fmtDate(deadline)}) ya pasó y no se ha ingresado fecha real de contestación.`
            : deadline === today
              ? `Alerta: la fecha máxima registrada (${fmtDate(deadline)}) es hoy.`
              : `Fecha máxima registrada: ${fmtDate(deadline)}. El cálculo del término no está automatizado y requiere validación jurídica.`;
      }
    }
    document.querySelectorAll('#processForm [name="anticipatedJudgment"], #processForm [name="appealStatus"], #processForm [name="maxDemandResponseDate"], #processForm [name="demandResponseDate"]').forEach(input => input.addEventListener('change', updateConditionalFields));
    function renderHearingsTable() {
      const entries = applyFilters().flatMap(record => (record.hearings || []).map(hearing => ({ record, hearing })))
        .sort((a, b) => a.hearing.date.localeCompare(b.hearing.date));
      document.getElementById('allHearingsTable').innerHTML = entries.length
        ? `<div class="table-wrap"><table><thead><tr><th>Proceso</th><th>Radicado</th><th>Tipo</th><th>Sesión</th><th>Fecha</th><th>Observación</th><th></th></tr></thead><tbody>${entries.map(({ record, hearing }) => `<tr><td>${escapeHtml(record.shortNo || 'Sin número')}</td><td>${escapeHtml(record.radicado || '—')}</td><td>${escapeHtml(hearing.type)}</td><td>${hearing.number}</td><td>${escapeHtml(fmtDate(hearing.date))}</td><td>${escapeHtml(hearing.observation || '—')}</td><td><button class="secondary small" onclick="editProcess('${record.id}')">Ver proceso</button></td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">No hay sesiones de audiencia registradas.</div>';
    }
    function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }
    function fmtDate(s) { return s ? new Date(s + 'T00:00:00').toLocaleDateString('es-CO') : '—' }
    function adminOnlyClass() { return isAppsScript() && window.currentAuthenticatedUser?.rol !== 'ADMINISTRADOR' ? 'hidden' : '' }
    function deadlineStatus(record) { if (!record.maxDemandResponseDate) return ''; if (record.demandResponseDate) return record.demandResponseDate > record.maxDemandResponseDate ? `Contestación ${fmtDate(record.demandResponseDate)} posterior al vencimiento ${fmtDate(record.maxDemandResponseDate)}.` : ''; const today = new Date().toISOString().slice(0, 10); return record.maxDemandResponseDate < today ? 'Vencimiento de contestación superado; verifique la actuación.' : record.maxDemandResponseDate === today ? 'El vencimiento de contestación registrado es hoy.' : `Vencimiento registrado: ${fmtDate(record.maxDemandResponseDate)}.` }
    function row(r) { const deadline = deadlineStatus(r); return `<tr><td><div class="record-title">${escapeHtml(r.shortNo || 'Sin número')}</div><div class="record-sub">${escapeHtml(r.radicado || 'Sin radicado')}</div>${deadline ? `<div class="deadline-alert">${escapeHtml(deadline)}</div>` : ''}</td><td>${escapeHtml(r.claimant || '—')}<div class="record-sub">Demandados: ${escapeHtml(r.defendant || '—')}</div></td><td>${escapeHtml(r.type || '—')}</td><td>${escapeHtml(r.lawyer || 'Sin asignar')}</td><td><span class="pill ${r.state === 'Activo' ? 'active' : r.state === 'Terminado' ? 'closed' : ''}">${escapeHtml(r.state || 'Sin estado')}</span></td><td><button class="secondary small" onclick="editProcess('${r.id}')">Editar</button> <button class="secondary small" onclick="openActions('${r.id}')">Actuaciones (${(r.actions || []).length})</button> <button class="danger small ${adminOnlyClass()}" onclick="deleteProcess('${r.id}')">Eliminar</button></td></tr>` }
    function table(list) { return list.length ? `<div class="table-wrap"><table><thead><tr><th>Identificación</th><th>Partes</th><th>Tipo</th><th>Responsable</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>` : '<div class="empty">No hay procesos registrados.</div>' }
    function fullProcessRow(record) {
      const processCells = fields.map(field => {
        const value = record[field];
        const displayValue = value ? (/Date$/.test(field) ? fmtDate(value) : String(value)) : '—';
        return `<td>${escapeHtml(displayValue)}</td>`;
      });
      const actionHistory = (record.actions || []).map(action => `${fmtDate(action.date)} · ${action.title || action.description}`).join('\n') || '—';
      const hearingHistory = (record.hearings || []).map(item => `${item.type} ${item.number}: ${fmtDate(item.date)}${item.observation ? ` · ${item.observation}` : ''}`).join('\n') || '—';
      const audit = (record.audit || []).map(item => `${new Date(item.changedAt).toLocaleString('es-CO')} · ${item.changedBy}: ${(item.changedFields || []).join(', ')}`).join('\n') || '—';
      return `<tr>${processCells.join('')}<td>${escapeHtml(hearingHistory)}</td><td>${escapeHtml(record.createdAt ? new Date(record.createdAt).toLocaleString('es-CO') : '—')}</td><td>${escapeHtml(record.updatedAt ? new Date(record.updatedAt).toLocaleString('es-CO') : '—')}</td><td>${escapeHtml(record.updatedBy || '—')}</td><td>${escapeHtml(audit)}</td><td>${escapeHtml(actionHistory)}</td><td class="full-table-actions"><button class="secondary small" onclick="editProcess('${record.id}')">Editar</button> <button class="secondary small" onclick="openActions('${record.id}')">Actuaciones (${(record.actions || []).length})</button> <button class="danger small ${adminOnlyClass()}" onclick="deleteProcess('${record.id}')">Eliminar</button></td></tr>`;
    }
    function fullProcessTable(list) {
      if (!list.length) return '<div class="empty">No hay procesos registrados.</div>';
      const headers = [...fields.map(field => labels[field]), 'Sesiones de audiencia', 'Creado', 'Actualizado', 'Modificado por', 'Historial de cambios', 'Historial de actuaciones', 'Administrar'];
      return `<div class="table-wrap full-table-wrap" role="region" aria-label="Tabla general de procesos; desplácese horizontalmente para ver todas las columnas" tabindex="0"><table class="full-process-table"><thead><tr>${headers.map(header => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${list.map(fullProcessRow).join('')}</tbody></table></div>`;
    }
    function fillFilterOptions(id, values, label) {
      const ids = [id];
      if (id.startsWith('filter')) ids.push('dashboard' + id[0].toUpperCase() + id.slice(1));
      const unique = [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
      ids.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const selected = select.value;
        select.innerHTML = `<option value="">${label}</option>` + unique.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
        if (unique.includes(selected)) select.value = selected;
      });
    }
    function catalogValues(category, fallback = []) {
      const values = catalogs[category] || [];
      return [...new Set([...fallback, ...values].map(value => String(value || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'));
    }
    function fillDatalist(id, values) {
      const datalist = document.getElementById(id);
      if (datalist) datalist.innerHTML = values.map(value => `<option value="${escapeHtml(value)}"></option>`).join('');
    }
    function updateCatalogControls() {
      const lawyerSelect = document.getElementById('lawyerSelect');
      const previousLawyer = lawyerSelect?.value || '';
      if (lawyerSelect) {
        const lawyers = catalogValues('lawyer', records.map(record => record.lawyer));
        lawyerSelect.innerHTML = '<option value="">Seleccione</option>' + lawyers.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
        if (previousLawyer && !lawyers.includes(previousLawyer)) lawyerSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(previousLawyer)}">${escapeHtml(previousLawyer)}</option>`);
        lawyerSelect.value = previousLawyer;
      }
      const linkTypeSelect = document.getElementById('lawyerLinkTypeSelect');
      if (linkTypeSelect) {
        const previousValue = linkTypeSelect.value;
        const linkTypes = catalogValues('lawyerLinkType', [...records.map(record => record.lawyerLinkType), 'Planta', 'Contratista', 'Otro', 'No informado']);
        linkTypeSelect.innerHTML = '<option value="">Seleccione</option>' + linkTypes.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
        linkTypeSelect.value = previousValue;
      }
      fillDatalist('typeOptions', catalogValues('type', records.map(record => record.type)));
      fillDatalist('causeOptions', catalogValues('cause', records.map(record => record.cause)));
      fillDatalist('hearingTypeOptions', catalogValues('hearingType', ['Inicial', 'Pruebas', 'Otra']));
      fillDatalist('terminationFormOptions', catalogValues('terminationForm', ['Sentencia', 'Conciliación', 'Transacción', 'Desvinculación', 'Otra']));
      renderCatalogSummary();
    }
    function renderCatalogSummary() {
      const target = document.getElementById('catalogSummary');
      if (!target) return;
      const labelsByCategory = { lawyer: 'Abogados', lawyerLinkType: 'Tipo de vinculación', type: 'Tipo de proceso', cause: 'Causas', hearingType: 'Tipo de audiencia', terminationForm: 'Forma de terminación' };
      target.innerHTML = Object.keys(labelsByCategory).map(category => `<article class="action-item"><strong>${labelsByCategory[category]}</strong><div>${(catalogs[category] || []).map(escapeHtml).join(', ') || 'Sin valores configurados'}</div></article>`).join('');
    }
    function renderCatalogEditor() {
      const category = document.getElementById('catalogCategory').value;
      document.getElementById('catalogValues').value = (catalogs[category] || []).join('\n');
    }
    async function saveCatalog(event) {
      event.preventDefault();
      const category = document.getElementById('catalogCategory').value;
      const values = [...new Set(document.getElementById('catalogValues').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean))];
      try {
        if (isAppsScript()) {
          const token = accessToken();
          if (!token) throw new Error('La sesión no es válida. Ingresa nuevamente.');
          catalogs = await callAppsScript('saveCatalogs', token, values, category);
        } else {
          catalogs[category] = values;
          localStorage.setItem(CATALOG_KEY, JSON.stringify(catalogs));
        }
        updateCatalogControls();
        renderCatalogEditor();
        alert('Catálogo guardado.');
      } catch (error) {
        alert(error.message);
      }
    }
    document.getElementById('catalogCategory').addEventListener('change', renderCatalogEditor);
    function syncFilter(key, value) {
      activeFilters[key] = value;
      const processId = { query: 'search', state: 'filterState', instance: 'filterInstance', type: 'filterType', cause: 'filterCause', lawyer: 'filterLawyer', year: 'filterYear', quality: 'filterQuality' }[key];
      const dashboardId = { query: 'dashboardSearch', state: 'dashboardFilterState', instance: 'dashboardFilterInstance', type: 'dashboardFilterType', cause: 'dashboardFilterCause', lawyer: 'dashboardFilterLawyer', year: 'dashboardFilterYear', quality: 'dashboardFilterQuality' }[key];
      [processId, dashboardId].forEach(id => { const element = document.getElementById(id); if (element && element.value !== value) element.value = value; });
      renderAll();
    }
    function applyFilters(source = records) {
      const query = activeFilters.query.trim().toLowerCase();
      return source.filter(record => {
        const searchable = ['shortNo', 'radicado', 'currentRadicado', 'id', 'orfeo', 'siproJ', 'claimant', 'defendant', 'ids'].some(key => String(record[key] || '').toLowerCase().includes(query));
        const recordYear = (record.notificationDate || '').slice(0, 4);
        return searchable && (!activeFilters.state || record.state === activeFilters.state) &&
          (!activeFilters.instance || record.instance === activeFilters.instance) &&
          (!activeFilters.type || record.type === activeFilters.type) &&
          (!activeFilters.cause || record.cause === activeFilters.cause) &&
          (!activeFilters.lawyer || record.lawyer === activeFilters.lawyer) &&
          (!activeFilters.year || recordYear === activeFilters.year) &&
          (!activeFilters.quality || record.quality === activeFilters.quality);
      });
    }
    function renderProcesses() {
      fillFilterOptions('filterInstance', records.map(record => record.instance), 'Todas las instancias');
      fillFilterOptions('filterType', records.map(record => record.type), 'Todos los tipos');
      fillFilterOptions('filterCause', records.map(record => record.cause), 'Todas las causas');
      fillFilterOptions('filterLawyer', records.map(record => record.lawyer), 'Todos los abogados');
      fillFilterOptions('filterYear', records.map(record => (record.notificationDate || '').slice(0, 4)), 'Todos los años');
      document.getElementById('processTable').innerHTML = table(applyFilters());
    }
    function renderFullProcesses() { const list = applyFilters(); document.getElementById('fullProcessTable').innerHTML = `<p class="table-summary">${list.length} procesos consultados.</p>${fullProcessTable(list)}` }
    function renderActions() {
      const query = (document.getElementById('actionsSearch')?.value || '').trim().toLowerCase();
      const entries = applyFilters().flatMap(record => (record.actions || []).map(action => ({ record, action })))
        .filter(({ record, action }) => [record.shortNo, record.radicado, record.claimant, action.date, action.type, action.title, action.description, action.status, action.registeredBy]
          .some(value => String(value || '').toLowerCase().includes(query)))
        .sort((a, b) => b.action.date.localeCompare(a.action.date) || String(b.action.createdAt || '').localeCompare(String(a.action.createdAt || '')));
      const groupedEntries = entries.reduce((groups, entry) => {
        const processNumber = String(entry.record.shortNo || '').trim() || 'Sin número';
        if (!groups.has(processNumber)) groups.set(processNumber, []);
        groups.get(processNumber).push(entry);
        return groups;
      }, new Map());
      const actionTable = groupEntries => `<div class="table-wrap"><table><thead><tr><th>Proceso</th><th>Radicado</th><th>Fecha</th><th>Tipo</th><th>Título / detalle</th><th>Estado</th><th>Demandante</th><th></th></tr></thead><tbody>${groupEntries.map(({ record, action }) => `<tr><td>${escapeHtml(record.shortNo || 'Sin número')}</td><td>${escapeHtml(record.radicado || '—')}</td><td>${escapeHtml(fmtDate(action.date))}</td><td>${escapeHtml(action.type || 'Otra')}</td><td><strong>${escapeHtml(action.title || '')}</strong><div>${escapeHtml(action.description)}</div></td><td>${escapeHtml(action.status || '—')}</td><td>${escapeHtml(record.claimant || '—')}</td><td><button class="secondary small" onclick="openActions('${record.id}')">Abrir historial</button></td></tr>`).join('')}</tbody></table></div>`;
      document.getElementById('allActionsTable').innerHTML = groupedEntries.size
        ? [...groupedEntries.entries()]
          .sort(([processA], [processB]) => processA.localeCompare(processB, 'es', { numeric: true }))
          .map(([processNumber, groupEntries]) => `<section class="action-group"><h3>Proceso ${escapeHtml(processNumber)} <span class="record-sub">(${groupEntries.length} actuaciones)</span></h3>${actionTable(groupEntries)}</section>`)
          .join('')
        : '<div class="empty">No hay actuaciones registradas.</div>';
    }
    function renderAll() {
      const list = applyFilters();
      fillFilterOptions('filterInstance', records.map(record => record.instance), 'Todas las instancias');
      fillFilterOptions('filterType', records.map(record => record.type), 'Todos los tipos');
      fillFilterOptions('filterCause', records.map(record => record.cause), 'Todas las causas');
      fillFilterOptions('filterLawyer', records.map(record => record.lawyer), 'Todos los abogados');
      fillFilterOptions('filterYear', records.map(record => (record.notificationDate || '').slice(0, 4)), 'Todos los años');
      document.getElementById('statTotal').textContent = list.length;
      document.getElementById('statActive').textContent = list.filter(record => record.state === 'Activo').length;
      document.getElementById('statClosed').textContent = list.filter(record => record.state === 'Terminado').length;
      document.getElementById('statActions').textContent = list.reduce((sum, record) => sum + (record.actions || []).length, 0);
      document.getElementById('statIssues').textContent = list.filter(issues).length;
      document.getElementById('recentTable').innerHTML = table(list.slice(0, 5));
      renderCharts(list);
      if (!document.getElementById('processes').classList.contains('hidden')) renderProcesses();
      if (!document.getElementById('actions').classList.contains('hidden')) renderActions();
      if (!document.getElementById('hearings').classList.contains('hidden')) renderHearingsTable();
      if (!document.getElementById('processOverview').classList.contains('hidden')) renderFullProcesses();
    }
    function renderCharts(chartRecords = applyFilters()) {
      const records = chartRecords;
      const statusColors = { Activo: '#287a59', Terminado: '#7a8792', Desvinculado: '#315d82', 'Sin estado': '#d88d53' };
      const statusCounts = records.reduce((counts, record) => { const status = record.state || 'Sin estado'; counts.set(status, (counts.get(status) || 0) + 1); return counts }, new Map());
      const statuses = [...statusCounts.entries()].sort((a, b) => (Object.keys(statusColors).indexOf(a[0]) + 1 || 99) - (Object.keys(statusColors).indexOf(b[0]) + 1 || 99));
      const circumference = 2 * Math.PI * 52;
      let offset = 0;
      const segments = statuses.map(([status, count]) => {
        const length = records.length ? count / records.length * circumference : 0;
        const color = statusColors[status] || '#a6afb7';
        const segment = `<circle cx="60" cy="60" r="52" fill="none" stroke="${color}" stroke-width="16" stroke-dasharray="${length} ${circumference}" stroke-dashoffset="${-offset}"/>`;
        offset += length;
        return segment;
      }).join('');
      document.getElementById('stateChart').innerHTML = records.length
        ? `<div class="donut-wrap"><svg viewBox="0 0 120 120" role="img" aria-label="Distribución de ${records.length} procesos por estado"><circle cx="60" cy="60" r="52" fill="none" stroke="#edf1f4" stroke-width="16"/><g transform="rotate(-90 60 60)">${segments}</g></svg><div class="donut-center"><strong>${records.length}</strong><span>procesos</span></div></div><div class="chart-legend">${statuses.map(([status, count]) => `<div class="legend-row"><span class="legend-swatch" style="background:${statusColors[status] || '#a6afb7'}"></span><span class="legend-name">${escapeHtml(status)}</span><span class="legend-value">${count} · ${Math.round(count / records.length * 100)}%</span></div>`).join('')}</div>`
        : '<div class="chart-empty">Registra procesos para ver su distribución por estado.</div>';

      const monthlyCounts = new Map();
      let undatedActionCount = 0;
      records.forEach(record => (record.actions || []).forEach(action => {
        const match = String(action.date || '').match(/^(\d{4})-(0[1-9]|1[0-2])/);
        if (!match) {
          undatedActionCount++;
          return;
        }
        const key = `${match[1]}-${match[2]}`;
        monthlyCounts.set(key, (monthlyCounts.get(key) || 0) + 1);
      }));
      const monthIndexes = [...monthlyCounts.keys()].map(key => {
        const [year, month] = key.split('-').map(Number);
        return year * 12 + month - 1;
      });
      const months = [];
      if (monthIndexes.length) {
        const firstMonth = Math.min(...monthIndexes);
        const lastMonth = Math.max(...monthIndexes);
        for (let monthIndex = firstMonth; monthIndex <= lastMonth; monthIndex++) {
          const year = Math.floor(monthIndex / 12);
          const month = monthIndex % 12;
          const key = `${year}-${String(month + 1).padStart(2, '0')}`;
          const date = new Date(year, month, 1);
          const label = new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' }).format(date).replace('.', '');
          months.push({ label, count: monthlyCounts.get(key) || 0 });
        }
      }
      if (undatedActionCount) months.push({ label: 'Sin fecha', count: undatedActionCount });
      const maxMonthlyCount = Math.max(1, ...months.map(month => month.count));
      const actionCount = [...monthlyCounts.values()].reduce((sum, count) => sum + count, 0) + undatedActionCount;
      document.getElementById('activityChart').innerHTML = actionCount
        ? `<div class="month-chart" style="--month-count:${months.length}" role="img" aria-label="Actuaciones registradas por mes en todo el historial">${months.map(month => `<div class="month-column"><span class="month-value">${month.count}</span><div class="month-track"><div class="month-bar" style="--bar-height:${month.count ? Math.max(4, month.count / maxMonthlyCount * 100) : 0}%"></div></div><span class="month-label">${escapeHtml(month.label)}</span></div>`).join('')}</div>`
        : '<div class="chart-empty">No hay actuaciones registradas.</div>';

      const typeCounts = records.reduce((counts, record) => {
        const type = String(record.type || '').trim() || 'Sin clasificar';
        counts.set(type, (counts.get(type) || 0) + 1);
        return counts;
      }, new Map());
      const sortedTypes = [...typeCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
      const visibleTypes = sortedTypes.slice(0, 5);
      if (sortedTypes.length > 5) visibleTypes.push(['Otros', sortedTypes.slice(5).reduce((sum, entry) => sum + entry[1], 0)]);
      const maxTypeCount = Math.max(1, ...visibleTypes.map(([, count]) => count));
      document.getElementById('typeChart').innerHTML = visibleTypes.length
        ? `<div class="rank-chart" role="img" aria-label="Procesos agrupados por tipo">${visibleTypes.map(([type, count]) => `<div class="rank-row"><span class="rank-name" title="${escapeHtml(type)}">${escapeHtml(type)}</span><div class="rank-track"><div class="rank-bar" style="width:${count / maxTypeCount * 100}%"></div></div><span class="rank-count">${count}</span></div>`).join('')}</div>`
        : '<div class="chart-empty">Registra procesos para comparar sus tipos.</div>';
      const ranked = (key, emptyLabel) => {
        const counts = records.reduce((map, record) => {
          const value = String(record[key] || '').trim() || 'Sin clasificar';
          map.set(value, (map.get(value) || 0) + 1);
          return map;
        }, new Map());
        const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, 8);
        const max = Math.max(1, ...entries.map(([, count]) => count));
        return entries.length
          ? `<div class="rank-chart">${entries.map(([name, count]) => `<div class="rank-row"><span class="rank-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span><div class="rank-track"><div class="rank-bar" style="width:${count / max * 100}%"></div></div><span class="rank-count">${count}</span></div>`).join('')}</div>`
          : `<div class="chart-empty">${emptyLabel}</div>`;
      };
      document.getElementById('yearChart').innerHTML = ranked('notificationYear', 'Registra fechas de notificación para consultar por año.');
      document.getElementById('qualityChart').innerHTML = ranked('quality', 'No hay datos de clasificación activa o pasiva.');
      document.getElementById('lawyerChart').innerHTML = ranked('lawyer', 'No hay abogados asignados.');
      document.getElementById('causeChart').innerHTML = ranked('cause', 'No hay causas clasificadas.');
    }
    function issues(r) { return !r.currentRadicado || !r.lawyer || (r.state === 'Terminado' && !r.endDate) || !r.area }
    async function deleteProcess(id) { if (!confirm('¿Eliminar este proceso y sus audiencias, actuaciones e historial de auditoría? Esta acción no se puede deshacer.')) return; const beforeSave = JSON.stringify(records); try { if (isAppsScript()) { const token = accessToken(); if (!token) throw new Error('La sesión no es válida. Ingresa nuevamente.'); await callAppsScript('delete', token, id) } records = records.filter(record => record.id !== id); if (!isAppsScript()) localStorage.setItem(KEY, JSON.stringify(records)); updateCatalogControls(); renderAll() } catch (error) { records = JSON.parse(beforeSave); renderAll(); alert(error.message) } }
    function openActions(id) { actionProcessId = id; document.getElementById('actionForm').reset(); document.getElementById('actionDate').value = new Date().toISOString().slice(0, 10); renderActionDialog(); document.getElementById('actionsDialog').classList.add('open') }
    function closeActions() { document.getElementById('actionsDialog').classList.remove('open'); actionProcessId = null }
    function renderActionDialog() { const record = records.find(r => r.id === actionProcessId); if (!record) return; document.getElementById('actionsTitle').textContent = 'Actuaciones · ' + (record.shortNo || 'Proceso'); document.getElementById('actionsProcess').textContent = `Radicado ${record.radicado || ''} · Estado actual: ${record.state || 'Sin estado'}`; const list = [...(record.actions || [])].sort((a, b) => b.date.localeCompare(a.date)); document.getElementById('actionList').innerHTML = list.length ? list.map(action => `<article class="action-item"><strong>${escapeHtml(fmtDate(action.date))} · ${escapeHtml(action.type || 'Otra')}</strong><div><b>${escapeHtml(action.title || '')}</b></div><div>${escapeHtml(action.description)}</div><div class="record-sub">Estado: ${escapeHtml(action.status || '—')} · Registrado por ${escapeHtml(action.registeredBy || 'Usuario local')}</div></article>`).join('') : '<div class="empty">Este proceso aún no tiene actuaciones registradas.</div>' }
    async function saveAction(event) {
      event.preventDefault();
      const record = records.find(item => item.id === actionProcessId);
      if (!record) return;
      const beforeSave = JSON.stringify(records);
      const now = new Date().toISOString();
      record.actions = record.actions || [];
      record.actions.push({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        processId: record.id,
        date: document.getElementById('actionDate').value,
        type: document.getElementById('actionType').value,
        title: document.getElementById('actionTitle').value.trim(),
        description: document.getElementById('actionDescription').value.trim(),
        status: document.getElementById('actionState').value,
        registeredBy: currentActor(),
        createdAt: now
      });
      record.updatedAt = now;
      record.updatedBy = currentActor();
      try {
        await persist();
        document.getElementById('actionForm').reset();
        closeActions();
      } catch (error) {
        records = JSON.parse(beforeSave);
        renderAll();
        renderActionDialog();
        alert(error.message);
      }
    }
    function xmlEscape(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char])) }
    function excelCell(value, type = 'String') { return `<Cell><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>` }
    function excelRow(values, style = '') { return `<Row${style ? ` ss:StyleID="${style}"` : ''}>${values.map(value => value && typeof value === 'object' ? excelCell(value.value, value.type) : excelCell(value)).join('')}</Row>` }
    function exportExcel() {
      const exportRecords = applyFilters();
      const processHeaders = ['ID proceso', ...fields.map(field => labels[field]), 'Creado', 'Actualizado', 'Modificado por', 'Cantidad de audiencias', 'Cantidad de actuaciones'];
      const processRows = exportRecords.map(record => [
        record.id,
        ...fields.map(field => record[field] || ''),
        record.createdAt || '',
        record.updatedAt || '',
        record.updatedBy || '',
        { value: (record.hearings || []).length, type: 'Number' },
        { value: (record.actions || []).length, type: 'Number' }
      ]);
      const actionEntries = exportRecords.flatMap(record => (record.actions || []).map(action => [
        action.id || '', record.id, record.shortNo || '', record.radicado || '', action.date || '', action.type || '', action.title || '', action.description || '', action.status || '', action.registeredBy || '', action.createdAt || ''
      ]));
      const actionHeaders = ['ID actuación', 'ID proceso', 'No. corto', 'Radicado', 'Fecha', 'Tipo', 'Título', 'Descripción', 'Estado', 'Registrado por', 'Fecha de registro'];
      const hearingEntries = exportRecords.flatMap(record => (record.hearings || []).map(hearing => [hearing.id || '', record.id, record.shortNo || '', record.radicado || '', hearing.type || '', hearing.number || '', hearing.date || '', hearing.observation || '']));
      const hearingHeaders = ['ID audiencia', 'ID proceso', 'No. corto', 'Radicado', 'Tipo de audiencia', 'Sesión', 'Fecha', 'Observación'];
      const auditEntries = exportRecords.flatMap(record => (record.audit || []).map(audit => [record.id, record.shortNo || '', audit.changedAt || '', audit.changedBy || '', (audit.changedFields || []).join(', ')]));
      const auditHeaders = ['ID proceso', 'No. corto', 'Fecha de cambio', 'Modificado por', 'Campos modificados'];
      const worksheet = (name, headers, data) => `<Worksheet ss:Name="${name}"><Table>${excelRow(headers, 'Header')}${data.map(row => excelRow(row)).join('')}</Table></Worksheet>`;
      const workbook = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#344554" ss:Pattern="Solid"/></Style></Styles>${worksheet('Procesos', processHeaders, processRows)}${worksheet('Audiencias', hearingHeaders, hearingEntries)}${worksheet('Actuaciones', actionHeaders, actionEntries)}${worksheet('Auditoria', auditHeaders, auditEntries)}</Workbook>`;
      const blob = new Blob(['\uFEFF', workbook], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'procesos_judiciales.xls';
      link.click();
      URL.revokeObjectURL(url);
    }
    function downloadReport() {
      document.getElementById('reportDate').textContent = `Generado el ${new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(new Date())}`;
      window.print();
    }
    async function clearData() { if (!confirm('Esta acción elimina todos los registros guardados en este navegador. ¿Continuar?')) return; records = []; try { await persist() } catch (error) { alert(error.message) } }
    load();