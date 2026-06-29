checkAuthAndRole();

// Referencias al DOM
const tablaPendientes = document.querySelector('section:nth-of-type(2) tbody');
const tablaAsignados = document.querySelector('section:nth-of-type(3) tbody');
const contenedorPeritos = document.querySelector('.peritos-grilla');

let listaPeritos = []; // Guardaremos los peritos aquí para usarlos en los selectores
let listaOficios = []; // Guardaremos todos los oficios

// 2. CARGAR PERITOS (Para las tarjetas y los selectores)
async function cargarPeritos() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('rol', 'perito');

    if (error) return console.error(error);
    listaPeritos = data;
    renderizarTarjetasPeritos();
}

// 3. CARGAR OFICIOS Y DIVIDIRLOS
async function cargarOficios() {
    const { data: oficios, error } = await supabaseClient
        .from('oficios')
        .select(`
            *,
            perito:perito_asignado_id (nombre_completo)
        `)
        .order('fecha_ingreso', { ascending: false });

    if (error) return console.error(error);

    listaOficios = oficios;

    // Filtramos los datos (case-insensitive para prevenir fallos por enums)
    const pendientes = oficios.filter(o => o.estado === 'Pendiente');
    const asignados = oficios.filter(o => o.estado !== 'Pendiente');

    const prioridadValor = { 'urgente': 3, 'alta': 2, 'normal': 1 };
    asignados.sort((a, b) => {
        // Finalizados al fondo
        const aFin = a.estado === 'Finalizado';
        const bFin = b.estado === 'Finalizado';
        if (aFin && !bFin) return 1;
        if (!aFin && bFin) return -1;
        
        // Prioridad (Urgente > Alta > Normal)
        const pA = prioridadValor[a.prioridad?.toLowerCase()] || 0;
        const pB = prioridadValor[b.prioridad?.toLowerCase()] || 0;
        if (pA !== pB) return pB - pA;
        
        // Fecha de ingreso (el más reciente primero o el más viejo? dejemos el más reciente primero)
        return new Date(b.fecha_ingreso || 0) - new Date(a.fecha_ingreso || 0);
    });

    renderizarTablas(pendientes, asignados);
}

// 4. RENDERIZAR TABLAS
function renderizarTablas(pendientes, asignados) {
    // --- Tabla Pendientes ---
    if (pendientes.length === 0) {
        tablaPendientes.innerHTML = '<tr><td colspan="7">No hay oficios pendientes</td></tr>';
    } else {
        tablaPendientes.innerHTML = '';
        pendientes.forEach(oficio => {
            // Creamos el dropdown con los peritos cargados
            let opciones = '<option value="">Seleccionar Perito...</option>';
            listaPeritos.forEach(p => {
                opciones += `<option value="${p.id}">${p.nombre_completo}</option>`;
            });

            const hoy = new Date();
            const fechaStr = hoy.toISOString().split('T')[0];
            const horaStr = hoy.toTimeString().split(' ')[0].substring(0,5);

            tablaPendientes.innerHTML += `
                <tr>
                    <td>${oficio.numero_interno}</td>
                    <td>${oficio.caratula}</td>
                    <td>${oficio.autoridad_judicial}</td>
                    <td>
                        <select class="select-perito" onclick="event.stopPropagation()" onchange="cambiarPrioridadOficio('${oficio.id}', this.value)">
                            <option value="Normal" ${oficio.prioridad?.toLowerCase() === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="Alta" ${oficio.prioridad?.toLowerCase() === 'alta' ? 'selected' : ''}>Alta</option>
                            <option value="Urgente" ${oficio.prioridad?.toLowerCase() === 'urgente' ? 'selected' : ''}>Urgente</option>
                        </select>
                    </td>
                    <td><span class="badge-pendiente">${oficio.estado}</span></td>
                    <td>
                        <div class="asignacion-controles">
                            <select id="select-${oficio.id}" class="select-perito">
                                ${opciones}
                            </select>
                            <div class="asignacion-fechas">
                                <input type="date" id="fecha-${oficio.id}" class="input-fecha" value="${fechaStr}" min="${fechaStr}" title="Fecha de asignación" required>
                                <input type="time" id="hora-${oficio.id}" class="input-hora" value="${horaStr}" title="Hora de asignación" required>
                            </div>
                        </div>
                    </td>
                    <td>
                        <button class="btn-asignar" onclick="asignarTrabajo('${oficio.id}')">Asignar</button>
                    </td>
                </tr>
            `;
        });
    }

    // --- Tabla Asignados ---
    if (asignados.length === 0) {
        tablaAsignados.innerHTML = '<tr><td colspan="6">No hay oficios asignados</td></tr>';
    } else {
        tablaAsignados.innerHTML = '';
        asignados.forEach(oficio => {
            tablaAsignados.innerHTML += `
                <tr onclick="abrirModalDetalles('${oficio.id}')" class="${oficio.estado === 'Finalizado' ? 'fila-finalizada' : ''}" style="cursor: pointer;" title="Haz clic para ver detalles">
                    <td>${oficio.numero_interno}</td>
                    <td>${oficio.caratula}</td>
                    <td>${oficio.autoridad_judicial}</td>
                    <td>
                        <select class="select-perito" onclick="event.stopPropagation()" onchange="cambiarPrioridadOficio('${oficio.id}', this.value)" ${oficio.estado === 'Finalizado' ? 'disabled' : ''}>
                            <option value="Normal" ${oficio.prioridad?.toLowerCase() === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="Alta" ${oficio.prioridad?.toLowerCase() === 'alta' ? 'selected' : ''}>Alta</option>
                            <option value="Urgente" ${oficio.prioridad?.toLowerCase() === 'urgente' ? 'selected' : ''}>Urgente</option>
                        </select>
                    </td>
                    <td>
                        <select class="select-perito" onclick="event.stopPropagation()" onchange="cambiarEstadoOficio('${oficio.id}', this.value)" ${oficio.estado === 'Finalizado' ? 'disabled' : ''}>
                            ${oficio.estado === 'Asignado' ? `<option value="Asignado" selected>Asignado</option>` : ''}
                            ${oficio.estado !== 'Finalizado' ? `<option value="En proceso" ${oficio.estado === 'En proceso' ? 'selected' : ''}>En proceso</option>` : ''}
                            <option value="Finalizado" ${oficio.estado === 'Finalizado' ? 'selected' : ''}>Finalizado</option>
                        </select>
                    </td>
                    <td><strong>${oficio.perito?.nombre_completo || 'Asignado'}</strong></td>
                </tr>
            `;
        });
    }
}

// 5. FUNCIÓN PARA ASIGNAR (La que llama el botón)
window.asignarTrabajo = async (oficioId) => {
    const select = document.getElementById(`select-${oficioId}`);
    const inputFecha = document.getElementById(`fecha-${oficioId}`);
    const inputHora = document.getElementById(`hora-${oficioId}`);
    
    const peritoId = select.value;
    const fecha = inputFecha ? inputFecha.value : '';
    const hora = inputHora ? inputHora.value : '';

    if (!peritoId) {
        alert("Por favor, selecciona un perito antes de asignar.");
        return;
    }
    if (!fecha || !hora) {
        alert("Por favor, completa la fecha y hora de asignación.");
        return;
    }

    // Actualizamos en Supabase
    const { error } = await supabaseClient
        .from('oficios')
        .update({ 
            perito_asignado_id: peritoId,
            estado: 'Asignado',
            puntos_pericia: `Apertura: ${fecha} ${hora}`
        })
        .eq('id', oficioId);

    if (error) {
        alert("Error al asignar: " + error.message);
    } else {
        // Si todo sale bien, recargamos los datos para que se muevan de tabla
        console.log("Asignado con éxito");
        await cargarOficios(); 
        await cargarPeritos(); // Recargamos peritos para actualizar las tarjetas de arriba
    }
};

window.cambiarEstadoOficio = async (oficioId, nuevoEstado) => {
    const { error } = await supabaseClient
        .from('oficios')
        .update({ estado: nuevoEstado })
        .eq('id', oficioId);
    
    if (error) {
        alert("Error al cambiar estado: " + error.message);
    } else {
        await cargarOficios(); // Recargar datos
    }
};

// 7. FUNCIÓN PARA CAMBIAR PRIORIDAD
window.cambiarPrioridadOficio = async (oficioId, nuevaPrioridad) => {
    const { error } = await supabaseClient
        .from('oficios')
        .update({ prioridad: nuevaPrioridad })
        .eq('id', oficioId);

    if (error) {
        alert("Error al cambiar la prioridad: " + error.message);
    } else {
        await cargarOficios(); // Recargar datos
    }
};

// Función para las tarjetas de arriba (opcional pero recomendada)
async function renderizarTarjetasPeritos() {
    contenedorPeritos.innerHTML = '';
    for (const perito of listaPeritos) {
        const { count } = await supabaseClient
            .from('oficios')
            .select('*', { count: 'exact', head: true })
            .eq('perito_asignado_id', perito.id);

        contenedorPeritos.innerHTML += `
            <div class="perito-tarjeta">
                <div class="perito-header">
                    <div class="perito-info">
                        <div>
                            <p class="perito-nombre">${perito.nombre_completo}</p>
                            <p class="perito-email">${perito.email}</p>
                        </div>
                    </div>
                    <span class="badge-libre">Libre</span>
                </div>
                <div class="perito-casos">
                    <span>${count || 0} casos asignados</span>
                </div>
            </div>
        `;
    }
}

// 6. FUNCIONES DEL MODAL DE DETALLES
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

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    await cargarPeritos();
    await cargarOficios();
});