checkAuthAndRole();

// Referencias al DOM (Seleccionamos por orden exacto de tu HTML)
const inputInterno = document.querySelectorAll('.filtro-input')[0];
const inputLegajo = document.querySelectorAll('.filtro-input')[1];
const inputFiscal = document.querySelectorAll('.filtro-input')[2];
const inputCaratula = document.querySelectorAll('.filtro-input')[3];
const inputTipoCausa = document.querySelectorAll('.filtro-input')[4];
const inputAnio = document.querySelectorAll('.filtro-input')[5]; // El índice 5 es el Año
const inputPerito = document.querySelectorAll('.filtro-input')[6];
const inputDispositivos = document.querySelectorAll('.filtro-input')[7];
const selectPrioridad = document.querySelectorAll('.filtro-select')[0];
const selectEstado = document.querySelectorAll('.filtro-select')[1];

const cuerpoTabla = document.querySelector('.tabla tbody');
const contadorTexto = document.querySelector('.contador-texto');
const btnLimpiar = document.querySelector('.btn-limpiar');

let listaOficios = []; // Guardaremos los oficios para mostrarlos en el modal

// 2. FUNCIÓN DE BÚSQUEDA
async function buscarCausas() {
    console.log("Buscando con año:", inputAnio.value);

    let query = supabaseClient
        .from('oficios')
        .select(`
            *,
            perito:perito_asignado_id (nombre_completo)
        `);

    // Filtros de texto
    if (inputInterno.value) query = query.ilike('numero_interno', `%${inputInterno.value}%`);
    if (inputLegajo.value) query = query.ilike('legajo_judicial', `%${inputLegajo.value}%`);
    if (inputFiscal.value) query = query.ilike('autoridad_judicial', `%${inputFiscal.value}%`);
    if (inputCaratula.value) query = query.ilike('caratula', `%${inputCaratula.value}%`);
    if (inputTipoCausa && inputTipoCausa.value) query = query.ilike('numero_pericia', `%${inputTipoCausa.value}%`);
    
    // FILTRO DE AÑO (Corregido para que no bloquee si es el año actual)
    if (inputAnio.value && inputAnio.value !== "") {
        const inicio = `${inputAnio.value}-01-01T00:00:00`;
        const fin = `${inputAnio.value}-12-31T23:59:59`;
        query = query.gte('fecha_ingreso', inicio).lte('fecha_ingreso', fin);
    }

    // Filtros de selección
    if (selectPrioridad.value !== 'Todos') query = query.eq('prioridad', selectPrioridad.value);
    if (selectEstado.value !== 'Todos') query = query.eq('estado', selectEstado.value);

    let { data: oficios, error } = await query.order('fecha_ingreso', { ascending: false });

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (inputPerito && inputPerito.value) {
        const busqueda = inputPerito.value.toLowerCase();
        oficios = oficios.filter(o => o.perito?.nombre_completo?.toLowerCase().includes(busqueda));
    }

    if (inputDispositivos && inputDispositivos.value) {
        const busqueda = inputDispositivos.value.toLowerCase();
        oficios = oficios.filter(o => o.detalle_elementos?.toLowerCase().includes(busqueda));
    }

    listaOficios = oficios;
    renderizarTabla(oficios);
}

// 3. RENDERIZAR TABLA
function renderizarTabla(lista) {
    cuerpoTabla.innerHTML = '';
    contadorTexto.innerText = `Mostrando ${lista.length} oficios encontrados`;

    if (lista.length === 0) {
        cuerpoTabla.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">No se encontraron resultados</td></tr>';
        return;
    }

    lista.forEach(oficio => {
        cuerpoTabla.innerHTML += `
            <tr onclick="abrirModalDetalles('${oficio.id}')" style="cursor: pointer;" title="Haz clic para ver detalles">
                <td>${oficio.numero_interno}</td>
                <td>${oficio.legajo_judicial}</td>
                <td>${oficio.caratula}</td>
                <td>${oficio.autoridad_judicial}</td>
                <td><span class="prioridad-${oficio.prioridad?.toLowerCase()}">${oficio.prioridad}</span></td>
                <td><span class="estado-badge">${oficio.estado}</span></td>
                <td>${oficio.perito?.nombre_completo || 'Sin asignar'}</td>
                <td>
                    <button class="btn-ver" onclick="generarPDFOficio('${oficio.id}', event)">
                        📄 Ver PDF
                    </button>
                </td>
            </tr>
        `;
    });
}

// 4. EVENTOS
// Escuchar cambios en todos los inputs y selects
document.querySelectorAll('.filtro-input, .filtro-select').forEach(el => {
    el.addEventListener('input', buscarCausas);
});

btnLimpiar.addEventListener('click', () => {
    document.querySelectorAll('.filtro-input').forEach(i => i.value = '');
    document.querySelectorAll('.filtro-select').forEach(s => s.value = 'Todos');
    inputAnio.value = new Date().getFullYear(); // Poner año actual
    buscarCausas();
});

// Carga inicial
document.addEventListener('DOMContentLoaded', () => {
    // Ponemos el año actual en el input automáticamente
    inputAnio.value = new Date().getFullYear();
    buscarCausas();
});

// 5. FUNCIONES DEL MODAL DE DETALLES
window.abrirModalDetalles = (oficioId) => {
    const oficio = listaOficios.find(o => o.id === oficioId);
    if (!oficio) return;

    document.getElementById('det-numero').textContent = oficio.numero_interno || '-';
    document.getElementById('det-legajo').textContent = oficio.legajo_judicial || '-';
    document.getElementById('det-caratula').textContent = oficio.caratula || '-';
    document.getElementById('det-fiscal').textContent = oficio.autoridad_judicial || '-';
    document.getElementById('det-tipo-causa').textContent = oficio.numero_pericia || '-';
    document.getElementById('det-perito').textContent = oficio.perito?.nombre_completo || '-';
    document.getElementById('det-estado').textContent = oficio.estado || '-';
    document.getElementById('det-prioridad').textContent = oficio.prioridad || '-';
    document.getElementById('det-puntos').textContent = oficio.puntos_pericia || 'Sin datos adicionales';
    document.getElementById('det-dispositivos').textContent = oficio.detalle_elementos || '-';

    const linkDoc = document.getElementById('det-documento');
    if (oficio.url_documento_pdf) {
        linkDoc.href = oficio.url_documento_pdf;
        document.getElementById('det-documento-container').style.display = 'flex';
    } else {
        document.getElementById('det-documento-container').style.display = 'none';
    }

    document.getElementById('modalDetalles').hidden = false;
    document.body.classList.add('modal-open');
};

window.cerrarModalDetalles = () => {
    document.getElementById('modalDetalles').hidden = true;
    document.body.classList.remove('modal-open');
};

// Cerrar modal si se hace clic fuera del contenido
document.getElementById('modalDetalles').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalDetalles')) {
        cerrarModalDetalles();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('modalDetalles').hidden) {
        cerrarModalDetalles();
    }
});

// 6. GENERACIÓN DE PDF
window.generarPDFOficio = (oficioId, event) => {
    if (event) event.stopPropagation();

    const oficio = listaOficios.find(o => o.id === oficioId);
    if (!oficio) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Ficha Detallada del Oficio", 14, 20);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    
    const lineas = [
        `Número Interno: ${oficio.numero_interno || '-'}`,
        `Legajo Judicial: ${oficio.legajo_judicial || '-'}`,
        `Carátula: ${oficio.caratula || '-'}`,
        `Fiscal a Cargo: ${oficio.autoridad_judicial || '-'}`,
        `Tipo de Causa: ${oficio.numero_pericia || '-'}`,
        `Perito Asignado: ${oficio.perito?.nombre_completo || 'Sin asignar'}`,
        `Estado: ${oficio.estado || '-'}`,
        `Prioridad: ${oficio.prioridad || '-'}`,
        `Info Asignación / Apertura: ${oficio.puntos_pericia || 'Sin datos'}`,
        ``,
        `Detalle de Elementos / Dispositivos:`,
        oficio.detalle_elementos || 'Sin dispositivos registrados'
    ];

    let y = 32;
    lineas.forEach(linea => {
        const textoDividido = doc.splitTextToSize(linea, 180);
        doc.text(textoDividido, 14, y);
        y += 7 * textoDividido.length;
        
        // Agregar nueva página si se queda sin espacio
        if (y > 280) {
            doc.addPage();
            y = 20;
        }
    });

    const numSeguro = oficio.numero_interno ? oficio.numero_interno.replace(/[\/\\]/g, '_') : 'Oficio';
    doc.save(`Ficha_${numSeguro}.pdf`);
};