    const KEY = 'demo_procesos_judiciales_v1'; let records = []; let step = 0; let editingId = null; let actionProcessId = null;
    const fields = ['shortNo', 'radicado', 'currentRadicado', 'siproJ', 'orfeo', 'ids', 'claimant', 'defendant', 'area', 'lawyer', 'quality', 'lawyerLinkType', 'represents', 'instance', 'type', 'court', 'secondCourt', 'cause', 'stage', 'state', 'startDate', 'endDate', 'claim', 'amount', 'cautelar', 'notificationDate', 'measureResponseDate', 'maxDemandResponseDate', 'demandResponseDate', 'initialHearingDate', 'evidence', 'closingArgumentsDate', 'firstInstanceDecisionDate', 'firstInstanceDecisionSense', 'appealDate', 'secondInstanceDecisionDate', 'secondInstanceDecision', 'notes'];
    const labels = { shortNo: 'No. corto', radicado: 'Radicado', currentRadicado: 'Radicado actual', siproJ: 'ID SIPROJ', orfeo: 'Expediente ORFEO', ids: 'Cédulas / identificadores', claimant: 'Demandante', defendant: 'Demandado', area: 'Área generadora del daño', lawyer: 'Abogado a cargo', quality: 'Calidad', lawyerLinkType: 'Tipo de vinculación del abogado', represents: 'Representa', instance: 'Instancia del proceso', type: 'Tipo de proceso', court: 'Despacho judicial inicial', secondCourt: 'Despacho de segunda instancia', cause: 'Causa', stage: 'Etapa del proceso', state: 'Estado del proceso', startDate: 'Fecha de inicio', endDate: 'Fecha de terminación', claim: 'Pretensión / asunto', amount: 'Valor de las pretensiones', cautelar: 'Presenta medida cautelar', notificationDate: 'Fecha de notificación de la demanda', measureResponseDate: 'Fecha de contestación de medida cautelar', maxDemandResponseDate: 'Fecha máxima de contestación de demanda', demandResponseDate: 'Fecha de contestación de demanda', initialHearingDate: 'Audiencia inicial', evidence: 'Pruebas', closingArgumentsDate: 'Fecha de alegatos de conclusión', firstInstanceDecisionDate: 'Fecha de fallo de primera instancia', firstInstanceDecisionSense: 'Sentido del fallo de primera instancia', appealDate: 'Fecha de presentación del recurso', secondInstanceDecisionDate: 'Fecha de fallo de segunda instancia', secondInstanceDecision: 'Fallo de segunda instancia', notes: 'Observaciones' };
    function load() { try { const saved = localStorage.getItem(KEY); records = saved ? JSON.parse(saved) : []; if (!Array.isArray(records)) throw new Error('El almacenamiento de procesos tiene un formato inválido.') } catch (error) { records = []; console.error('No se pudieron cargar los procesos guardados.', error); alert('No se pudieron cargar los procesos guardados en este navegador. No se sobrescribieron los datos. Detalle: ' + error.message) } renderAll() }
    function persist() { localStorage.setItem(KEY, JSON.stringify(records)); renderAll() }
    function showView(id) { document.querySelectorAll('.view').forEach(x => x.classList.add('hidden')); document.getElementById(id).classList.remove('hidden'); document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.view === id)); const titles = { dashboard: ['Resumen general', 'Estado de la información registrada'], processes: ['Procesos', 'Consulta y edición de registros'], processOverview: ['Vista completa de procesos', 'Todos los campos de cada registro'], actions: ['Actuaciones', 'Historial de actuaciones registradas'], form: ['Registro de proceso', 'Formulario por etapas'], backup: ['Descargar datos', 'Descarga de información en formato Excel'] }; document.getElementById('pageTitle').textContent = titles[id][0]; document.getElementById('pageSubtitle').textContent = titles[id][1]; if (id === 'processes') renderProcesses(); if (id === 'processOverview') renderFullProcesses(); if (id === 'actions') renderActions(); }
    document.querySelectorAll('.nav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
    function newProcess() { editingId = null; document.getElementById('processForm').reset(); document.getElementById('formTitle').textContent = 'Registrar proceso'; document.getElementById('editBadge').textContent = 'Nuevo'; document.getElementById('confirmData').checked = false; step = 0; setStep(); showView('form') }
    function editProcess(id) { const r = records.find(x => x.id === id); if (!r) return; editingId = id; const f = document.getElementById('processForm'); f.reset(); fields.forEach(k => { if (f.elements[k]) f.elements[k].value = r[k] ?? '' }); document.getElementById('formTitle').textContent = 'Editar proceso'; document.getElementById('editBadge').textContent = 'Edición'; document.getElementById('confirmData').checked = false; step = 0; setStep(); showView('form') }
    function setStep() { document.querySelectorAll('.form-step').forEach((el, i) => el.classList.toggle('hidden', i !== step)); document.querySelectorAll('.step').forEach((el, i) => { el.classList.toggle('active', i === step); el.classList.toggle('done', i < step) }); document.getElementById('prevBtn').disabled = step === 0; document.getElementById('nextBtn').classList.toggle('hidden', step === 4); document.getElementById('saveBtn').classList.toggle('hidden', step !== 4); if (step === 4) makeReview() }
    function moveStep(delta) { if (delta > 0 && !validateStep()) return; step = Math.max(0, Math.min(4, step + delta)); setStep() }
    function validateStep() {
      const box = document.querySelector(`.form-step[data-step="${step}"]`); for (const el of box.querySelectorAll('[required]')) { if (!el.value.trim()) { el.focus(); alert('Complete el campo obligatorio: ' + (el.closest('.field').querySelector('label')?.textContent || el.name)); return false } }
      if (step === 0) { let rad = document.querySelector('[name=radicado]').value.trim(); if (!/^\d{23}$/.test(rad)) { alert('El radicado debe contener exactamente 23 dígitos. Se conserva como texto para evitar pérdida de ceros.'); return false } }
      return true
    }
    function makeReview() { let f = document.getElementById('processForm'); let data = Object.fromEntries(fields.map(k => [k, f.elements[k]?.value || ''])); document.getElementById('reviewBox').innerHTML = '<b>Resumen de revisión</b><br>' + ['shortNo', 'radicado', 'claimant', 'defendant', 'type', 'stage', 'state', 'lawyer', 'quality', 'endDate', 'firstInstanceDecisionSense', 'secondInstanceDecision'].map(k => `<div>${labels[k]}: ${escapeHtml(data[k] || 'Sin diligenciar')}</div>`).join('') + '<br>Al guardar, el registro quedará disponible en el almacenamiento local de este navegador.' }
    async function saveProcess() { if (!document.getElementById('confirmData').checked) { alert('Marque la confirmación de revisión antes de guardar.'); return } const f = document.getElementById('processForm'); const data = Object.fromEntries(fields.map(k => [k, f.elements[k]?.value.trim() || ''])); if (!/^\d{23}$/.test(data.radicado)) { alert('Radicado inválido.'); step = 0; setStep(); return } const duplicate = records.find(r => r.radicado === data.radicado && r.id !== editingId); if (duplicate) { alert('Ya existe un registro con ese radicado. Revise el listado antes de continuar.'); return } if (data.state === 'Terminado' && !data.endDate && !confirm('El proceso está Terminado pero no tiene fecha de terminación. ¿Guardar de todas formas?')) return; const now = new Date().toISOString(); if (editingId) { let i = records.findIndex(r => r.id === editingId); records[i] = { ...records[i], ...data, updatedAt: now } } else records.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), ...data, createdAt: now, updatedAt: now, actions: [] }); try { await persist(); newProcess(); alert('Registro guardado. El formulario está listo para registrar otro proceso.') } catch (error) { alert(error.message) } }
    function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }
    function fmtDate(s) { return s ? new Date(s + 'T00:00:00').toLocaleDateString('es-CO') : '—' }
    function row(r) { return `<tr><td><div class="record-title">${escapeHtml(r.shortNo || 'Sin número')}</div><div class="record-sub">${escapeHtml(r.radicado)}</div></td><td>${escapeHtml(r.claimant || '—')}<div class="record-sub">Demandado: ${escapeHtml(r.defendant || '—')}</div></td><td>${escapeHtml(r.type || '—')}</td><td>${escapeHtml(r.lawyer || 'Sin asignar')}</td><td><span class="pill ${r.state === 'Activo' ? 'active' : r.state === 'Terminado' ? 'closed' : ''}">${escapeHtml(r.state)}</span></td><td><button class="secondary small" onclick="editProcess('${r.id}')">Editar</button> <button class="secondary small" onclick="openActions('${r.id}')">Actuaciones (${(r.actions || []).length})</button> <button class="danger small" onclick="deleteProcess('${r.id}')">Eliminar</button></td></tr>` }
    function table(list) { return list.length ? `<div class="table-wrap"><table><thead><tr><th>Identificación</th><th>Partes</th><th>Tipo</th><th>Responsable</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>` : '<div class="empty">No hay procesos registrados.</div>' }
    function fullProcessRow(record) {
      const processCells = fields.map(field => {
        const value = record[field];
        const displayValue = value ? (/Date$/.test(field) ? fmtDate(value) : String(value)) : '—';
        return `<td>${escapeHtml(displayValue)}</td>`;
      });
      const actionHistory = (record.actions || []).map(action => `${fmtDate(action.date)} · ${action.description}`).join('\n') || '—';
      return `<tr>${processCells.join('')}<td>${escapeHtml(record.createdAt ? new Date(record.createdAt).toLocaleString('es-CO') : '—')}</td><td>${escapeHtml(record.updatedAt ? new Date(record.updatedAt).toLocaleString('es-CO') : '—')}</td><td>${escapeHtml(actionHistory)}</td><td class="full-table-actions"><button class="secondary small" onclick="editProcess('${record.id}')">Editar</button> <button class="secondary small" onclick="openActions('${record.id}')">Actuaciones (${(record.actions || []).length})</button> <button class="danger small" onclick="deleteProcess('${record.id}')">Eliminar</button></td></tr>`;
    }
    function fullProcessTable(list) {
      if (!list.length) return '<div class="empty">No hay procesos registrados.</div>';
      const headers = [...fields.map(field => labels[field]), 'Creado', 'Actualizado', 'Historial de actuaciones', 'Administrar'];
      return `<div class="table-wrap full-table-wrap" role="region" aria-label="Tabla general de procesos; desplácese horizontalmente para ver todas las columnas" tabindex="0"><table class="full-process-table"><thead><tr>${headers.map(header => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${list.map(fullProcessRow).join('')}</tbody></table></div>`;
    }
    function renderProcesses() { let q = (document.getElementById('search')?.value || '').toLowerCase(); let st = document.getElementById('filterState')?.value || ''; let list = records.filter(r => (!st || r.state === st) && fields.some(k => String(r[k] || '').toLowerCase().includes(q))); document.getElementById('processTable').innerHTML = table(list) }
    function renderFullProcesses() { document.getElementById('fullProcessTable').innerHTML = `<p class="table-summary">${records.length} procesos registrados.</p>${fullProcessTable(records)}` }
    function renderActions() {
      const query = (document.getElementById('actionsSearch')?.value || '').trim().toLowerCase();
      const entries = records.flatMap(record => (record.actions || []).map(action => ({ record, action })))
        .filter(({ record, action }) => [record.shortNo, record.radicado, record.claimant, action.date, action.description]
          .some(value => String(value || '').toLowerCase().includes(query)))
        .sort((a, b) => b.action.date.localeCompare(a.action.date) || String(b.action.createdAt || '').localeCompare(String(a.action.createdAt || '')));
      const groupedEntries = entries.reduce((groups, entry) => {
        const processNumber = String(entry.record.shortNo || '').trim() || 'Sin número';
        if (!groups.has(processNumber)) groups.set(processNumber, []);
        groups.get(processNumber).push(entry);
        return groups;
      }, new Map());
      const actionTable = groupEntries => `<div class="table-wrap"><table><thead><tr><th>Proceso</th><th>Radicado</th><th>Fecha</th><th>Actuación</th><th>Demandante</th><th></th></tr></thead><tbody>${groupEntries.map(({ record, action }) => `<tr><td>${escapeHtml(record.shortNo || 'Sin número')}</td><td>${escapeHtml(record.radicado || '—')}</td><td>${escapeHtml(fmtDate(action.date))}</td><td>${escapeHtml(action.description)}</td><td>${escapeHtml(record.claimant || '—')}</td><td><button class="secondary small" onclick="openActions('${record.id}')">Abrir historial</button></td></tr>`).join('')}</tbody></table></div>`;
      document.getElementById('allActionsTable').innerHTML = groupedEntries.size
        ? [...groupedEntries.entries()]
          .sort(([processA], [processB]) => processA.localeCompare(processB, 'es', { numeric: true }))
          .map(([processNumber, groupEntries]) => `<section class="action-group"><h3>Proceso ${escapeHtml(processNumber)} <span class="record-sub">(${groupEntries.length} actuaciones)</span></h3>${actionTable(groupEntries)}</section>`)
          .join('')
        : '<div class="empty">No hay actuaciones registradas.</div>';
    }
    function renderAll() { document.getElementById('statTotal').textContent = records.length; document.getElementById('statActive').textContent = records.filter(r => r.state === 'Activo').length; document.getElementById('statClosed').textContent = records.filter(r => r.state === 'Terminado').length; document.getElementById('statIssues').textContent = records.filter(issues).length; document.getElementById('recentTable').innerHTML = table(records.slice(0, 5)); renderCharts(); if (!document.getElementById('processes').classList.contains('hidden')) renderProcesses(); if (!document.getElementById('actions').classList.contains('hidden')) renderActions(); }
    function renderCharts() {
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
    }
    function issues(r) { return !r.currentRadicado || !r.lawyer || (r.state === 'Terminado' && !r.endDate) || !r.area }
    async function deleteProcess(id) { if (!confirm('¿Eliminar este registro y sus actuaciones de este navegador?')) return; records = records.filter(r => r.id !== id); try { await persist() } catch (error) { alert(error.message) } }
    function openActions(id) { actionProcessId = id; const record = records.find(item => item.id === id); document.getElementById('actionDate').value = new Date().toISOString().slice(0, 10); document.getElementById('actionDescription').value = ''; document.getElementById('actionState').value = record?.state || ''; renderActionDialog(); document.getElementById('actionsDialog').classList.add('open') }
    function closeActions() { document.getElementById('actionsDialog').classList.remove('open'); actionProcessId = null }
    function renderActionDialog() { const record = records.find(r => r.id === actionProcessId); if (!record) return; document.getElementById('actionsTitle').textContent = 'Actuaciones · ' + (record.shortNo || 'Proceso'); document.getElementById('actionsProcess').textContent = `Radicado ${record.radicado || ''} · Estado actual: ${record.state || 'Sin estado'}`; const list = [...(record.actions || [])].sort((a, b) => b.date.localeCompare(a.date)); document.getElementById('actionList').innerHTML = list.length ? list.map(action => `<article class="action-item"><strong>${escapeHtml(fmtDate(action.date))}</strong><div>${escapeHtml(action.description)}</div></article>`).join('') : '<div class="empty">Este proceso aún no tiene actuaciones registradas.</div>' }
    async function saveAction(event) { event.preventDefault(); const record = records.find(r => r.id === actionProcessId); if (!record) return; record.actions = record.actions || []; record.actions.push({ date: document.getElementById('actionDate').value, description: document.getElementById('actionDescription').value.trim(), createdAt: new Date().toISOString() }); const selectedState = document.getElementById('actionState').value; if (selectedState) record.state = selectedState; record.updatedAt = new Date().toISOString(); try { await persist(); closeActions() } catch (error) { alert(error.message) } }
    function xmlEscape(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char])) }
    function excelCell(value, type = 'String') { return `<Cell><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>` }
    function excelRow(values, style = '') { return `<Row${style ? ` ss:StyleID="${style}"` : ''}>${values.map(value => value && typeof value === 'object' ? excelCell(value.value, value.type) : excelCell(value)).join('')}</Row>` }
    function exportExcel() {
      const processHeaders = [...fields.map(field => labels[field]), 'Creado', 'Actualizado', 'Actuaciones'];
      const processRows = records.map(record => [
        ...fields.map(field => record[field] || ''),
        record.createdAt || '',
        record.updatedAt || '',
        { value: (record.actions || []).length, type: 'Number' }
      ]);
      const actionEntries = records.flatMap(record => (record.actions || []).map(action => [
        record.shortNo || '', record.radicado || '', action.date || '', action.description || '', action.createdAt || ''
      ]));
      const actionHeaders = ['No. corto', 'Radicado', 'Fecha', 'Descripción', 'Registrada'];
      const workbook = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#344554" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="Procesos"><Table>${excelRow(processHeaders, 'Header')}${processRows.map(row => excelRow(row)).join('')}</Table></Worksheet><Worksheet ss:Name="Actuaciones"><Table>${excelRow(actionHeaders, 'Header')}${actionEntries.map(row => excelRow(row)).join('')}</Table></Worksheet></Workbook>`;
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