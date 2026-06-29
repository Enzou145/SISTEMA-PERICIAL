checkAuthAndRole();

// Estado Local
let currentDate = new Date(); // Mes y año actual
let oficiosAsignados = [];
let listaPeritos = [];

// DOM
const grilla = document.getElementById('grilla-calendario');
const tituloMes = document.getElementById('titulo-mes');
const selectPerito = document.getElementById('filtro-perito');
const modal = document.getElementById('modal');

// 2. CARGAR DATOS
async function inicializar() {
    // Cargar peritos
    const { data: peritos } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('rol', 'perito');
    if (peritos) {
        listaPeritos = peritos;
        peritos.forEach(p => {
            selectPerito.innerHTML += `<option value="${p.id}">${p.nombre_completo}</option>`;
        });
    }

    // Cargar oficios asignados
    const { data: oficios } = await supabaseClient
        .from('oficios')
        .select(`*, perito:perito_asignado_id (nombre_completo)`)
        .neq('estado', 'Pendiente');
        
    if (oficios) {
        // Parsear fecha de puntos_pericia (ej: "Apertura: 2026-06-18 10:00")
        oficiosAsignados = oficios.map(oficio => {
            let fechaAsignacion = null;
            let horaAsignacion = '';
            if (oficio.puntos_pericia && oficio.puntos_pericia.includes('Apertura:')) {
                // Extraer YYYY-MM-DD
                const match = oficio.puntos_pericia.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
                if (match) {
                    fechaAsignacion = match[1];
                    horaAsignacion = match[2];
                }
            }
            return { ...oficio, fechaAsignacion, horaAsignacion };
        });
    }

    renderizarCalendario();
}

// 3. RENDERIZAR CALENDARIO
window.renderizarCalendario = () => {
    const anio = currentDate.getFullYear();
    const mes = currentDate.getMonth();

    // Actualizar Título
    const opcionesMes = { month: 'long', year: 'numeric' };
    tituloMes.textContent = currentDate.toLocaleDateString('es-ES', opcionesMes).replace(/^\w/, c => c.toUpperCase());

    grilla.innerHTML = `
        <div class="encabezado-dia">LUN</div>
        <div class="encabezado-dia">MAR</div>
        <div class="encabezado-dia">MIÉ</div>
        <div class="encabezado-dia">JUE</div>
        <div class="encabezado-dia">VIE</div>
        <div class="encabezado-dia">SÁB</div>
        <div class="encabezado-dia">DOM</div>
    `;

    // Fechas importantes del mes
    const primerDiaMes = new Date(anio, mes, 1);
    const ultimoDiaMes = new Date(anio, mes + 1, 0);
    
    // Obtener día de la semana (0 = domingo, 1 = lunes...) y ajustar para que lunes sea 0
    let diaInicio = primerDiaMes.getDay() - 1;
    if (diaInicio === -1) diaInicio = 6; // Si es domingo

    // Días del mes anterior para rellenar
    const ultimoDiaMesAnterior = new Date(anio, mes, 0).getDate();
    for (let i = diaInicio - 1; i >= 0; i--) {
        grilla.innerHTML += `<div class="celda-dia fuera-mes"><span class="numero-dia">${ultimoDiaMesAnterior - i}</span></div>`;
    }

    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
    const peritoFiltrado = selectPerito.value;

    // Días del mes actual
    for (let i = 1; i <= ultimoDiaMes.getDate(); i++) {
        const mesStr = String(mes + 1).padStart(2, '0');
        const diaStr = String(i).padStart(2, '0');
        const fechaCompleta = `${anio}-${mesStr}-${diaStr}`;

        const esHoy = (fechaCompleta === hoyStr) ? 'hoy' : '';
        const numeroHoy = (fechaCompleta === hoyStr) ? 'numero-hoy' : '';

        // Buscar oficios para este día
        let eventosHtml = '';
        const oficiosDelDia = oficiosAsignados.filter(o => 
            o.fechaAsignacion === fechaCompleta && 
            (peritoFiltrado === "" || o.perito_asignado_id === peritoFiltrado)
        );

        oficiosDelDia.forEach(oficio => {
            // Asignar color por prioridad
            let colorClase = 'evento-azul'; // Normal
            if (oficio.prioridad === 'Urgente') colorClase = 'evento-rojo';
            if (oficio.prioridad === 'Alta') colorClase = 'evento-naranja';

            eventosHtml += `
                <div class="evento ${colorClase}" onclick="abrirModalDetalles('${oficio.id}', event)">
                    ${oficio.horaAsignacion} ${oficio.numero_interno || 'Oficio'} · ${oficio.perito?.nombre_completo || 'Sin perito'}
                </div>
            `;
        });

        grilla.innerHTML += `
            <div class="celda-dia ${esHoy}">
                <span class="numero-dia ${numeroHoy}">${String(i).padStart(2, '0')}</span>
                ${eventosHtml}
            </div>
        `;
    }

    // Rellenar días del mes siguiente (para completar la cuadrícula)
    const totalCeldas = grilla.querySelectorAll('.celda-dia').length;
    const diasFaltantes = (totalCeldas <= 35) ? 35 - totalCeldas : 42 - totalCeldas;
    for (let i = 1; i <= diasFaltantes; i++) {
        grilla.innerHTML += `<div class="celda-dia fuera-mes"><span class="numero-dia">${String(i).padStart(2, '0')}</span></div>`;
    }
};

// 4. NAVEGACIÓN
window.cambiarMes = (delta) => {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderizarCalendario();
};

window.irAHoy = () => {
    currentDate = new Date();
    renderizarCalendario();
};

// 5. MODAL
window.abrirModalDetalles = (oficioId, event) => {
    if (event) event.stopPropagation();
    const oficio = oficiosAsignados.find(o => o.id === oficioId);
    if (!oficio) return;

    const nombrePerito = modal.querySelector('.nombre-perito');
    const fechaPerito = modal.querySelector('.fecha-perito');
    const valoresInfo = modal.querySelectorAll('.valor-info');
    const insignias = modal.querySelectorAll('.insignia');

    nombrePerito.textContent = oficio.perito?.nombre_completo || 'No asignado';
    fechaPerito.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Asignado el: ${oficio.fechaAsignacion} a las ${oficio.horaAsignacion}`;

    valoresInfo[0].textContent = oficio.numero_interno || '-';
    valoresInfo[1].textContent = oficio.legajo_judicial || '-';
    valoresInfo[2].textContent = oficio.caratula || '-';
    valoresInfo[3].textContent = oficio.autoridad_judicial || '-';
    valoresInfo[4].textContent = oficio.numero_pericia || '-'; 
    valoresInfo[5].textContent = oficio.numero_interno ? oficio.numero_interno.split('/').pop() : new Date(oficio.created_at).getFullYear();

    insignias[0].textContent = oficio.prioridad || '-';
    insignias[0].className = `insignia insignia-${oficio.prioridad === 'Alta' ? 'roja' : (oficio.prioridad === 'Media' ? 'naranja' : 'azul')}`;
    
    insignias[1].textContent = oficio.estado || '-';
    insignias[1].className = `insignia insignia-azul`; 

    valoresInfo[6].textContent = oficio.fecha_ingreso ? oficio.fecha_ingreso.split('T')[0] : '-';
    valoresInfo[7].textContent = oficio.fechaAsignacion || '-';
    valoresInfo[8].textContent = oficio.horaAsignacion || '-';

    modal.classList.add('visible');
};

window.cerrarModal = (e) => {
    if (!e || e.target === modal || e.target.classList.contains('modal-close')) {
        modal.classList.remove('visible');
    }
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('visible')) {
        window.cerrarModal();
    }
});

// Arrancar
document.addEventListener('DOMContentLoaded', inicializar);
