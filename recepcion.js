checkAuthAndRole();

const btnNuevaCausa = document.querySelector('.btn-nueva-causa');
const cuerpoTabla = document.querySelector('.tabla tbody');
const modalFormulario = document.getElementById('modalFormulario');
const modalContent = modalFormulario.querySelector('.modal-content');
const btnCerrarModal = modalFormulario.querySelector('.modal-close');
const formNuevaCausa = document.getElementById('formNuevaCausa');
const pasoOficio = document.getElementById('pasoOficio');
const pasoDispositivos = document.getElementById('pasoDispositivos');
const btnSiguiente = document.getElementById('btnSiguiente');
const btnAtras = document.getElementById('btnAtras');
const btnAgregarDispositivo = document.getElementById('btnAgregarDispositivo');
const listaDispositivos = document.getElementById('listaDispositivos');

let dispositivos = [];
let editId = null;
let currentOficios = [];

function escaparHtml(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function fechaLocalISO() {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts();
    const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
    return `${valores.year}-${valores.month}-${valores.day}`;
}

function horaLocal() {
    return new Intl.DateTimeFormat('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).format(new Date());
}

async function generarNumeroInterno() {
    const anio = document.getElementById('anio').value;
    const inputNumero = document.getElementById('num_interno');
    inputNumero.value = 'Generando...';

    const { data, error } = await supabaseClient
        .from('oficios')
        .select('numero_interno');

    if (error) console.error('No se pudo consultar el último número interno:', error);

    const numerosDelAnio = (data || [])
        .map(({ numero_interno }) => String(numero_interno || ''))
        .filter(numero => numero.includes(String(anio)))
        .map(numero => Number(numero.match(/\d+/)?.[0] || 0));

    const siguiente = (Math.max(0, ...numerosDelAnio) + 1).toString().padStart(4, '0');
    inputNumero.value = `${siguiente}/${anio}`;
}

async function cargarCausas() {
    const { data: oficios, error } = await supabaseClient
        .from('oficios')
        .select(`*, perito:perito_asignado_id (nombre_completo)`)
        .order('fecha_ingreso', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    currentOficios = oficios || [];

    if (!oficios || oficios.length === 0) {
        cuerpoTabla.innerHTML = '<tr class="fila-vacia"><td colspan="8">No hay oficios registrados</td></tr>';
        return;
    }

    cuerpoTabla.innerHTML = oficios.map(oficio => `
        <tr>
            <td>${escaparHtml(oficio.numero_interno)}</td>
            <td>${escaparHtml(oficio.legajo_judicial)}</td>
            <td>${escaparHtml(oficio.caratula)}</td>
            <td>${escaparHtml(oficio.autoridad_judicial)}</td>
            <td><span class="prioridad-${escaparHtml(oficio.prioridad?.toLowerCase())}">${escaparHtml(oficio.prioridad)}</span></td>
            <td><span class="estado-badge">${escaparHtml(oficio.estado)}</span></td>
            <td>${escaparHtml(oficio.perito?.nombre_completo || 'Pendiente')}</td>
            <td class="acciones-celda">
                <button class="btn-accion btn-ver" data-id="${oficio.id}" title="Ver" onclick="verOficio('${oficio.id}')">&#128065;</button>
                <button class="btn-accion btn-editar" data-id="${oficio.id}" title="Editar" onclick="editarOficio('${oficio.id}')">&#9999;</button>
                <button class="btn-accion btn-eliminar" data-id="${oficio.id}" title="Eliminar" onclick="eliminarOficio('${oficio.id}')">&#128465;</button>
            </td>
        </tr>
    `).join('');
}

function mostrarPaso(numeroPaso) {
    const esPrimerPaso = numeroPaso === 1;
    pasoOficio.hidden = !esPrimerPaso;
    pasoDispositivos.hidden = esPrimerPaso;
    modalContent.scrollTop = 0;
}

async function abrirModal() {
    formNuevaCausa.reset();
    dispositivos = [];
    editId = null;
    document.getElementById('modalTitulo').textContent = 'Registrar Nuevo Oficio';
    const btnSubmit = formNuevaCausa.querySelector('button[type="submit"]');
    if (btnSubmit) btnSubmit.textContent = 'Crear Oficio';
    
    renderizarDispositivos();

    const hoy = fechaLocalISO();
    document.getElementById('anio').value = hoy.slice(0, 4);
    const fechaIngreso = document.getElementById('fecha_ingreso');
    fechaIngreso.value = hoy;
    fechaIngreso.min = hoy;

    mostrarPaso(1);
    modalFormulario.hidden = false;
    document.body.classList.add('modal-open');
    await generarNumeroInterno();
    document.getElementById('legajo').focus();
}

function cerrarModal() {
    modalFormulario.hidden = true;
    document.body.classList.remove('modal-open');
    formNuevaCausa.reset();
    dispositivos = [];
    renderizarDispositivos();
}

function avanzarADispositivos() {
    const camposPrimerPaso = [...pasoOficio.querySelectorAll('input[required], select[required]')];
    const campoInvalido = camposPrimerPaso.find(campo => !campo.checkValidity());

    if (campoInvalido) {
        campoInvalido.reportValidity();
        return;
    }

    const archivo = document.getElementById('archivo_pdf').files[0];
    if (archivo && archivo.size > 10 * 1024 * 1024) {
        alert('El documento PDF no puede superar los 10MB.');
        return;
    }

    mostrarPaso(2);
}

function agregarDispositivo() {
    const marca = document.getElementById('marca_dispositivo');
    const modelo = document.getElementById('modelo_dispositivo');

    if (!marca.value.trim()) {
        marca.setCustomValidity('Ingresá la marca del dispositivo.');
        marca.reportValidity();
        marca.setCustomValidity('');
        return;
    }

    if (!modelo.value.trim()) {
        modelo.setCustomValidity('Ingresá el modelo del dispositivo.');
        modelo.reportValidity();
        modelo.setCustomValidity('');
        return;
    }

    dispositivos.push({
        tipo: document.getElementById('tipo_dispositivo').value,
        estado: document.getElementById('estado_dispositivo').value,
        marca: marca.value.trim(),
        modelo: modelo.value.trim(),
        observaciones: document.getElementById('observaciones_dispositivo').value.trim()
    });

    marca.value = '';
    modelo.value = '';
    document.getElementById('observaciones_dispositivo').value = '';
    renderizarDispositivos();
    marca.focus();
}

function eliminarDispositivo(indice) {
    dispositivos.splice(indice, 1);
    renderizarDispositivos();
}

function renderizarDispositivos() {
    listaDispositivos.innerHTML = dispositivos.map((dispositivo, indice) => `
        <div class="device-item">
            <span>
                <strong>${escaparHtml(dispositivo.tipo)}</strong> ·
                ${escaparHtml(dispositivo.marca)} ${escaparHtml(dispositivo.modelo)} ·
                ${escaparHtml(dispositivo.estado)}
            </span>
            <button type="button" data-device-index="${indice}" aria-label="Eliminar dispositivo">&times;</button>
        </div>
    `).join('');
}

async function subirPdf() {
    const archivo = document.getElementById('archivo_pdf').files[0];
    if (!archivo) return '';

    const nombreSeguro = archivo.name.replace(/[^\w.-]+/g, '_');
    const nombreArchivo = `${Date.now()}_${nombreSeguro}`;
    const { error: uploadError } = await supabaseClient.storage
        .from('documentos_oficiales')
        .upload(nombreArchivo, archivo);

    if (uploadError) throw new Error(`Error subiendo el archivo: ${uploadError.message}`);

    const { data } = supabaseClient.storage
        .from('documentos_oficiales')
        .getPublicUrl(nombreArchivo);
    return data.publicUrl;
}

async function guardarNuevoOficio(evento) {
    evento.preventDefault();

    if (dispositivos.length === 0) {
        alert('Agregá al menos un dispositivo antes de crear el oficio.');
        return;
    }

    const botonCrear = evento.submitter || formNuevaCausa.querySelector('button[type="submit"]');
    botonCrear.disabled = true;
    botonCrear.textContent = 'Creando...';

    try {
        const urlPdf = await subirPdf();
        const detalleDispositivos = dispositivos.map(dispositivo => {
            const observacion = dispositivo.observaciones ? ` (${dispositivo.observaciones})` : '';
            return `${dispositivo.tipo}: ${dispositivo.marca} ${dispositivo.modelo}, estado ${dispositivo.estado}${observacion}`;
        }).join('\n');

        const currentUser = getCurrentUser();

        const datosOficio = {
            numero_interno: document.getElementById('num_interno').value,
            legajo_judicial: document.getElementById('legajo').value.trim(),
            caratula: document.getElementById('caratula').value.trim(),
            autoridad_judicial: document.getElementById('fiscal').value.trim(),
            numero_pericia: document.getElementById('tipo_causa').value.trim(),
            prioridad: document.getElementById('prioridad').value,
            fecha_ingreso: document.getElementById('fecha_ingreso').value,
            detalle_elementos: detalleDispositivos,
            creado_por: currentUser ? currentUser.id : null
        };
        
        if (urlPdf) datosOficio.url_documento_pdf = urlPdf;

        let resError;
        let oficioId = editId;

        if (editId) {
            const { error } = await supabaseClient.from('oficios').update(datosOficio).eq('id', editId);
            resError = error;
        } else {
            datosOficio.estado = 'Pendiente';
            const { data, error } = await supabaseClient.from('oficios').insert([datosOficio]).select();
            resError = error;
            if (data && data.length > 0) oficioId = data[0].id;
        }

        if (resError) throw resError;

        cerrarModal();
        await cargarCausas();
        alert(editId ? '¡Oficio actualizado correctamente!' : '¡Oficio creado correctamente!');
    } catch (error) {
        alert(error.message);
    } finally {
        botonCrear.disabled = false;
        botonCrear.textContent = editId ? 'Guardar Cambios' : 'Crear Oficio';
    }
}

btnNuevaCausa.addEventListener('click', abrirModal);
btnCerrarModal.addEventListener('click', cerrarModal);
btnSiguiente.addEventListener('click', avanzarADispositivos);
btnAtras.addEventListener('click', () => mostrarPaso(1));
btnAgregarDispositivo.addEventListener('click', agregarDispositivo);
formNuevaCausa.addEventListener('submit', guardarNuevoOficio);
document.getElementById('anio').addEventListener('change', generarNumeroInterno);

listaDispositivos.addEventListener('click', evento => {
    const boton = evento.target.closest('[data-device-index]');
    if (boton) eliminarDispositivo(Number(boton.dataset.deviceIndex));
});

modalFormulario.addEventListener('click', evento => {
    if (evento.target === modalFormulario) cerrarModal();
});

document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && !modalFormulario.hidden) cerrarModal();
    const modalVerOficio = document.getElementById('modalVerOficio');
    if (evento.key === 'Escape' && modalVerOficio && !modalVerOficio.hidden) cerrarModalVer();
});

document.addEventListener('DOMContentLoaded', cargarCausas);

// Lógica de Acciones (Ver, Modificar, Eliminar)
function parsearDetalleElementos(detalle) {
    if (!detalle) return [];
    return detalle.split('\n').map(linea => {
        const lineaLimpia = linea.trim();
        if (!lineaLimpia) return null;
        const match = lineaLimpia.match(/^([^:]+):\s+(.+?)\s+([^,]+),\s+estado\s+([^\(]+)(?:\s*\((.+)\))?$/);
        if (match) {
            return {
                tipo: match[1].trim(),
                marca: match[2].trim(),
                modelo: match[3].trim(),
                estado: match[4].trim(),
                observaciones: match[5] ? match[5].replace(/\)$/, '').trim() : ''
            };
        }
        return {
            tipo: 'Otro',
            marca: 'Detectado automáticamente',
            modelo: '',
            estado: 'Bueno',
            observaciones: lineaLimpia
        };
    }).filter(Boolean);
}

function cerrarModalVer() {
    const modalVerOficio = document.getElementById('modalVerOficio');
    if(modalVerOficio) modalVerOficio.hidden = true;
    document.body.classList.remove('modal-open');
}

const modalVerOficioEl = document.getElementById('modalVerOficio');
if(modalVerOficioEl) {
    modalVerOficioEl.addEventListener('click', evento => {
        if (evento.target === modalVerOficioEl) cerrarModalVer();
    });
}

function verOficio(id) {
    const oficio = currentOficios.find(o => String(o.id) === String(id) || String(o.numero_interno) === String(id));
    if (!oficio) {
        alert('No se encontró el oficio.');
        return;
    }
    
    document.getElementById('ver_num_interno').textContent = oficio.numero_interno || '-';
    document.getElementById('ver_legajo').textContent = oficio.legajo_judicial || '-';
    document.getElementById('ver_caratula').textContent = oficio.caratula || '-';
    document.getElementById('ver_fiscal').textContent = oficio.autoridad_judicial || '-';
    document.getElementById('ver_tipo_causa').textContent = oficio.numero_pericia || '-';
    document.getElementById('ver_prioridad').textContent = oficio.prioridad || '-';
    document.getElementById('ver_estado').textContent = oficio.estado || '-';
    document.getElementById('ver_perito').textContent = oficio.perito?.nombre_completo || 'Pendiente';
    document.getElementById('ver_fecha').textContent = oficio.fecha_ingreso || '-';
    document.getElementById('ver_puntos_pericia').textContent = oficio.puntos_pericia || 'Sin datos';
    
    const enlacePdf = document.getElementById('ver_pdf');
    if (oficio.url_documento_pdf) {
        enlacePdf.innerHTML = `<a href="${escaparHtml(oficio.url_documento_pdf)}" target="_blank" class="enlace-pdf">&#128196; Ver Documento PDF</a>`;
    } else {
        enlacePdf.textContent = 'No adjunto';
    }
    
    const divDispositivos = document.getElementById('ver_dispositivos');
    if (oficio.detalle_elementos) {
        divDispositivos.className = 'detalle-lista';
        divDispositivos.textContent = oficio.detalle_elementos;
    } else {
        divDispositivos.className = '';
        divDispositivos.textContent = 'Sin dispositivos registrados';
    }
    
    const modalVerOficio = document.getElementById('modalVerOficio');
    if(modalVerOficio) modalVerOficio.hidden = false;
    document.body.classList.add('modal-open');
}

async function editarOficio(id) {
    const oficio = currentOficios.find(o => String(o.id) === String(id) || String(o.numero_interno) === String(id));
    if (!oficio) {
        alert('No se encontró el oficio.');
        return;
    }
    
    formNuevaCausa.reset();
    editId = oficio.id;
    
    document.getElementById('modalTitulo').textContent = 'Modificar Oficio';
    const btnSubmit = formNuevaCausa.querySelector('button[type="submit"]');
    if (btnSubmit) btnSubmit.textContent = 'Guardar Cambios';
    
    document.getElementById('num_interno').value = oficio.numero_interno || '';
    document.getElementById('legajo').value = oficio.legajo_judicial || '';
    document.getElementById('caratula').value = oficio.caratula || '';
    document.getElementById('fiscal').value = oficio.autoridad_judicial || '';
    document.getElementById('tipo_causa').value = oficio.numero_pericia || '';
    
    const anioMatch = String(oficio.numero_interno || '').match(/\/(\d{4})$/);
    document.getElementById('anio').value = anioMatch ? anioMatch[1] : new Date().getFullYear();
    
    document.getElementById('prioridad').value = oficio.prioridad || 'Normal';
    const fechaIngreso = document.getElementById('fecha_ingreso');
    fechaIngreso.value = oficio.fecha_ingreso || fechaLocalISO();
    fechaIngreso.removeAttribute('min');
    
    // Parsear el string de detalle_elementos para recuperar los dispositivos
    dispositivos = [];
    if (oficio.detalle_elementos) {
        const lineas = oficio.detalle_elementos.split('\n');
        lineas.forEach(linea => {
            const match = linea.match(/^(.*?):\s*(.*?)\s*(.*?), estado (.*?)(?:\s*\((.*?)\))?$/);
            if (match) {
                dispositivos.push({
                    tipo: match[1],
                    marca: match[2],
                    modelo: match[3],
                    estado: match[4],
                    observaciones: match[5] || ''
                });
            }
        });
    }
    renderizarDispositivos();
    
    mostrarPaso(1);
    modalFormulario.hidden = false;
    document.body.classList.add('modal-open');
}

async function eliminarOficio(id) {
    if (!confirm('¿Está seguro de que desea eliminar este oficio? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        const { data, error } = await supabaseClient.from('oficios').delete().eq('id', id).select();
        
        if (error) throw new Error(error.message);
        
        if (!data || data.length === 0) {
            alert('No se pudo eliminar el oficio. Es probable que no tengas permisos para eliminar (RLS de Supabase).');
        } else {
            alert('¡Oficio eliminado correctamente!');
        }
        
        await cargarCausas();
    } catch (error) {
        alert('Error al eliminar: ' + error.message);
    }
}
