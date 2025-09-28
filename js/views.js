// js/views.js

import { getState, setRouteTo, logout, login, register, setUserData, logJob, setBlockFilter, setTrabajosFilter, jobs, getUserProfile } from './state.js';
import { el, BLOQUES, CHECKS, COLORS, labelState, nowISO, fmtHHMM, blockOfRoom, checkById, autoOverallFromRoom, SOLVED_WINDOW_MS } from './utils.js';
import { hashPIN } from './utils.js'; // Necesario para AuthView si se usa localmente
import { handleLogin, handleRegister } from './auth.js';


// --- HELPERS ESPECÍFICOS DE VISTA ---

/** Obtiene los datos específicos de una habitación */
function getRoomData(n){
    const state = getState();
    const data = state.dataByUser[state.currentUser.toLowerCase()] || {};
    return data[n] || { items: {}, itemNotes: {}, notes: "", measures: [], overall: "none", assumeOk: false };
}

/** Guarda los datos de una habitación */
function saveRoomData(n, updater){
    setUserData(function(s){
        const next = Object.assign({}, s);
        const room = next[n] = next[n] || { items: {}, itemNotes: {}, notes: "", measures: [], overall: "none", assumeOk: false };
        
        // Aplicar la actualización
        const updatedRoom = updater(Object.assign({}, room));

        // Recalcular overall si está en 'auto'
        if (updatedRoom.overall === "auto" || updatedRoom.overall === "none") {
             updatedRoom.overall = autoOverallFromRoom(updatedRoom);
        }
        
        next[n] = updatedRoom;
        return next;
    });
}

/** Genera la vista de una única habitación en el Plan (MEJORADO) */
function RoomCard(n, roomData, isSelected, selBlockId){
    const overall = roomData.overall === "auto" ? autoOverallFromRoom(roomData) : roomData.overall;
    const color = COLORS[overall] || COLORS.none;
    const textColor = overall === 'dark' || overall === 'fail' ? COLORS.white : COLORS.dark;
    
    // Iconos de estado más claros
    const icon = overall === 'ok' ? '✅' : 
                 overall === 'fail' ? '❌' : 
                 overall === 'pending' ? '🟡' : '⚫';
    
    const hasNotes = (roomData.notes || "").trim().length > 0;
    const itemNoteCount = Object.keys(roomData.itemNotes || {}).filter(k => (roomData.itemNotes[k] || "").trim().length > 0).length;

    return el('div', { 
        class: `room-card ${isSelected ? 'selected-room' : ''}`, 
        style: { 
            backgroundColor: color,
            color: textColor,
            border: `2px solid ${isSelected ? COLORS.dark : color}`,
            boxShadow: isSelected ? `0 0 0 2px ${COLORS.dark}` : '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'all 0.2s',
            cursor: 'pointer',
            padding: '12px', 
            borderRadius: '8px', 
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'stretch',
            minHeight: '80px', 
        },
        onclick: () => setRouteTo(selBlockId, n)
    },
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            // Número de Habitación Grande y en Negrita
            el('span', { style: { fontWeight: 'bold', fontSize: '1.4em', color: textColor } }, `${n}`),
            // Icono de Estado
            el('span', { style: { fontSize: '1.5em' } }, icon)
        ),
        
        // Indicadores de Notas
        el('div', { style: { display: 'flex', gap: '8px', marginTop: '5px', justifyContent: 'flex-end' } },
            hasNotes ? el('span', { class: 'badge', style: { backgroundColor: COLORS.white, color: COLORS.dark, padding: '3px 8px', borderRadius: '4px', fontSize: '0.8em' } }, 'Notas Hab. 💬') : null,
            itemNoteCount > 0 ? el('span', { class: 'badge', style: { backgroundColor: COLORS.white, color: COLORS.dark, padding: '3px 8px', borderRadius: '4px', fontSize: '0.8em' } }, `Fallos 📝${itemNoteCount}`) : null,
        )
    );
}

// --- VISTAS / COMPONENTES ---

// 1. Header (Navegación)
export function Header(state) {
    const user = getUserProfile();
    const alias = (user && user.alias) || 'Invitado';

    function NavLink(pageId, label) {
        const isCurrent = state.page === pageId;
        return el('a', { 
            class: `nav-link ${isCurrent ? 'active' : ''}`, 
            href: isCurrent ? '#' : `#/${pageId}`,
            style: { 
                marginRight: '10px', 
                fontWeight: isCurrent ? 'bold' : 'normal',
                color: isCurrent ? COLORS.dark : COLORS.white,
                textDecoration: 'none'
            } 
        }, label);
    }
    
    return el('header', { style: { backgroundColor: COLORS.dark, padding: '10px', display: 'flex', justifyContent: 'space-between' } },
        el('nav', null,
            NavLink('plan', 'Plan'),
            NavLink('parte', 'Parte'),
            NavLink('trabajos', 'Trabajos'),
            NavLink('cuenta', 'Cuenta'),
        ),
        el('div', { style: { color: COLORS.white } },
            el('span', null, `Hola, ${alias}`),
            el('a', { 
                href: '#/auth', 
                onclick: (e) => { e.preventDefault(); logout(); },
                style: { marginLeft: '10px', color: COLORS.white, textDecoration: 'underline', cursor: 'pointer' }
            }, '(Salir)')
        )
    );
}

// 2. AuthView (Login/Registro)
export function AuthView() {
    let mode = 'login'; // 'login' o 'register'
    let aliasInput;
    let pinInput;
    let msgEl;

    function renderAuthForm(){
        return el('div', { class: 'card', style: { maxWidth: '300px', margin: '50px auto', padding: '20px', textAlign: 'center', border: `1px solid ${COLORS.border}`, borderRadius: '8px' } },
            el('h2', null, mode === 'login' ? 'Iniciar Sesión' : 'Registrarse'),
            msgEl = el('p', { style: { color: COLORS.fail } }),
            
            el('div', { style: { marginBottom: '10px', textAlign: 'left' } },
                el('label', null, 'Alias:'),
                aliasInput = el('input', { type: 'text', style: { width: '100%', padding: '8px' } })
            ),
            el('div', { style: { marginBottom: '20px', textAlign: 'left' } },
                el('label', null, 'PIN (4-8 dígitos):'),
                pinInput = el('input', { type: 'password', style: { width: '100%', padding: '8px' } })
            ),
            
            el('button', {
                onclick: async () => {
                    const alias = aliasInput.value.trim();
                    const pin = pinInput.value.trim();
                    msgEl.textContent = '';
                    
                    if (mode === 'login') {
                        const user = await login(alias, pin);
                        if (!user) { msgEl.textContent = 'Credenciales incorrectas.'; }
                    } else { // register
                        const user = await register(alias, pin);
                        if (!user) { msgEl.textContent = 'Error al registrar. PIN inválido o usuario ya existe.'; }
                    }
                },
                style: { padding: '10px 20px', backgroundColor: COLORS.dark, color: COLORS.white, border: 'none', cursor: 'pointer', borderRadius: '4px' }
            }, mode === 'login' ? 'Entrar' : 'Registrar'),

            el('p', { style: { marginTop: '15px' } },
                el('a', { 
                    href: '#', 
                    onclick: (e) => { 
                        e.preventDefault(); 
                        mode = mode === 'login' ? 'register' : 'login'; 
                        render(); // Forzar el re-renderizado del componente
                    },
                    style: { color: COLORS.dark, textDecoration: 'underline', cursor: 'pointer' }
                }, mode === 'login' ? '¿No tienes cuenta? Regístrate' : 'Ya tengo cuenta. Iniciar Sesión')
            )
        );
    }

    // Proxy para el re-renderizado del componente
    const container = el('div');
    function render(){
        container.innerHTML = '';
        container.appendChild(renderAuthForm());
    }
    render();
    return container;
}


// 3. PlanView (Selección de Bloque y Habitación) (MEJORADO)
export function PlanView(state) {
    
    // 3.1 Lista de Bloques (Filtros MEJORADOS)
    const blocksList = el('div', { 
        class: 'blocks-list-improved', 
        style: { 
            marginBottom: '20px', 
            display: 'flex', 
            gap: '10px', 
            overflowX: 'auto', 
            padding: '10px 0',
            borderBottom: `1px solid ${COLORS.border}` 
        } 
    });

    BLOQUES.forEach(b => {
        const isSelected = state.selBlock && state.selBlock.id === b.id;
        blocksList.appendChild(el('button', {
            class: 'block-btn',
            style: { 
                padding: '12px 20px', 
                backgroundColor: isSelected ? COLORS.dark : COLORS.none, 
                color: isSelected ? COLORS.white : COLORS.dark, 
                border: isSelected ? 'none' : `1px solid ${COLORS.border}`, 
                borderRadius: '6px', 
                flexShrink: 0,
                fontWeight: isSelected ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s',
            },
            onclick: () => setRouteTo(isSelected ? null : b.id)
        }, `Bloque ${b.label}`));
    });

    let roomList = el('div');
    let title = el('h2', {style: { color: COLORS.dark, marginTop: '20px', borderBottom: `2px solid ${COLORS.dark}`, paddingBottom: '10px' }}, 
        state.selBlock ? `Habitaciones - Bloque ${state.selBlock.label}` : 'Seleccione un Bloque'
    );

    // 3.2 Lista de Habitaciones (MEJORADA - Grid más limpio)
    if (state.selBlock) {
        const rooms = [];
        for (let n = state.selBlock.from; n <= state.selBlock.to; n++) {
            rooms.push(n);
        }

        const roomCards = rooms.map(n => {
            const roomData = getRoomData(n);
            const isSelected = state.selRoom === n;
            return RoomCard(n, roomData, isSelected, state.selBlock.id);
        });

        // Utilizar una cuadrícula responsiva y elegante
        roomList = el('div', { 
            class: 'room-grid-improved', 
            style: { 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                gap: '15px', 
                marginTop: '20px'
            } 
        }, 
            roomCards
        );
    }

    // 3.3 Vista Detalle de Habitación
    let roomDetail = el('div');
    if (state.selRoom && state.selBlock) {
        roomDetail = RoomDetailView(state.selRoom);
    }
    
    return el('div', { style: { padding: '20px 0' } }, // Contenedor del plan
        blocksList,
        title,
        roomList,
        roomDetail
    );
}

// 3.3.1 RoomDetailView (Detalle de Habitación)
function RoomDetailView(n) {
    const r = getRoomData(n);
    const roomKey = n;

    // --- Actions ---
    const setItemState = (itemId, state) => {
        saveRoomData(roomKey, function(room){
            room.items = Object.assign({}, room.items, { [itemId]: state });
            // Si hay un fallo, se debe registrar
            if(state === "fail") {
                 logJob({
                    room: n,
                    accion: "Anotación de fallo",
                    elementoId: itemId,
                    elemento: (checkById(itemId)||{label:itemId}).label,
                    estadoDespues: "fail",
                    source: "itemCheck"
                });
            }
            return room;
        });
    };
    
    const setNotes = (text) => {
        saveRoomData(roomKey, function(room){
            room.notes = text;
            return room;
        });
    };

    const setOverallState = (s) => {
        saveRoomData(roomKey, function(room){
            room.overall = s;
            return room;
        });
    };

    // --- Render ---
    return el('div', { class: 'room-detail', style: { marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '20px' } },
        el('h2', null, `Detalle Habitación ${n}`),
        el('section', { class: 'card', style: { padding: '15px', border: `1px solid ${COLORS.border}`, borderRadius: '6px', marginBottom: '15px' } },
            el('h3', null, 'Checks de Habitación'),
            el('ul', { style: { listStyle: 'none', padding: 0 } },
                CHECKS.map(c => {
                    const currentState = r.items[c.id] || "none";
                    return el('li', { style: { marginBottom: '10px', borderBottom: '1px dotted #eee', paddingBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                        el('span', null, c.label),
                        el('div', null, 
                            ['ok', 'fail', 'none'].map(s => el('span', {
                                class: 'badge',
                                style: { 
                                    backgroundColor: s === currentState ? COLORS[s] : COLORS.none,
                                    color: s === currentState ? COLORS.white : COLORS.dark,
                                    marginRight: '5px',
                                    padding: '5px 10px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.8em',
                                },
                                onclick: () => setItemState(c.id, s)
                            }, labelState(s)))
                        )
                    );
                })
            )
        ),

        el('section', { class: 'card', style: { padding: '15px', border: `1px solid ${COLORS.border}`, borderRadius: '6px', marginBottom: '15px' } },
          el('h3', null, 'Observaciones de Habitación'),
          (function(){
            var ta=el('textarea',{style:{width:'100%',minHeight:'90px', padding: '8px', border: `1px solid ${COLORS.border}`, borderRadius: '4px'}});
            ta.value=r.notes||""; 
            ta.addEventListener('input', function(){ setNotes(ta.value); });
            return ta;
          })()
        ),
        
        el('section', { class: 'container', style: { paddingLeft: 0, marginTop: '15px' } },
            el('span', { style: { fontWeight: 'bold' } }, 'Estado global manual: '),
            ['ok', 'fail', 'pending', 'auto'].map(s => {
                const isCurrent = r.overall === s || (s === "auto" && autoOverallFromRoom(r) === r.overall);
                return el('span', { 
                    class: 'badge', 
                    onclick: () => setOverallState(s),
                    style: { 
                        backgroundColor: isCurrent ? COLORS.dark : COLORS.none,
                        color: isCurrent ? COLORS.white : COLORS.dark,
                        marginRight: '5px',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }
                }, labelState(s));
            })
        ),
        el('button', { 
            onclick: () => setRouteTo(blockOfRoom(n), null), // Volver solo al bloque
            style: { 
                marginTop: '20px', 
                backgroundColor: COLORS.dark, 
                color: COLORS.white, 
                padding: '10px 15px', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
            }
        }, 'Volver al Plan')
    );
}


// 4. ParteView (Registro de Trabajo)
export function ParteView() {
    let roomInput, elementoInput, accionInput, minutosInput, materialesInput, notasInput;
    let msgEl;
    
    function handleSave() {
        const room = Number(roomInput.value.trim());
        const minutos = Number(minutosInput.value.trim()) || 0;
        const notas = notasInput.value.trim();
        
        if (!room || !blockOfRoom(room)) {
            msgEl.textContent = 'Número de habitación no válido.';
            return;
        }

        const job = logJob({
            room: room,
            elementoTexto: elementoInput.value.trim(),
            accion: accionInput.value.trim(),
            minutos: minutos,
            materiales: materialesInput.value.trim(),
            notas: notas,
            source: "parte"
        });

        if (job) {
            msgEl.textContent = `✅ Trabajo registrado con éxito en Habitación ${room}.`;
            // Limpiar formulario
            roomInput.value = '';
            elementoInput.value = '';
            accionInput.value = 'reparación'; // Default
            minutosInput.value = '';
            materialesInput.value = '';
            notasInput.value = '';
        } else {
            msgEl.textContent = '❌ Error al registrar el trabajo.';
        }
    }

    return el('div', { class: 'parte-view', style: { padding: '20px' } },
        el('h2', null, 'Parte de Trabajo'),
        msgEl = el('p', { style: { color: COLORS.ok, fontWeight: 'bold' } }),

        el('section', { class: 'card', style: { marginBottom: '20px', padding: '15px', border: `1px solid ${COLORS.border}`, borderRadius: '6px' } },
            el('div', { style: { marginBottom: '10px' } },
                el('label', { style: { display: 'block', marginBottom: '5px' } }, 'Habitación:'),
                roomInput = el('input', { type: 'number', style: { width: '100%', padding: '8px', border: `1px solid ${COLORS.border}` } })
            ),
            el('div', { style: { marginBottom: '10px' } },
                el('label', { style: { display: 'block', marginBottom: '5px' } }, 'Elemento/Sistema Afectado:'),
                elementoInput = el('input', { type: 'text', style: { width: '100%', padding: '8px', border: `1px solid ${COLORS.border}` } })
            ),
            el('div', { style: { marginBottom: '10px' } },
                el('label', { style: { display: 'block', marginBottom: '5px' } }, 'Acción Realizada:'),
                accionInput = el('select', { style: { width: '100%', padding: '8px', border: `1px solid ${COLORS.border}` } },
                    el('option', { value: 'reparación' }, 'Reparación'),
                    el('option', { value: 'revisión' }, 'Revisión'),
                    el('option', { value: 'sustitución' }, 'Sustitución')
                )
            ),
            el('div', { style: { marginBottom: '10px' } },
                el('label', { style: { display: 'block', marginBottom: '5px' } }, 'Tiempo Empleado (minutos):'),
                minutosInput = el('input', { type: 'number', style: { width: '100%', padding: '8px', border: `1px solid ${COLORS.border}` } })
            ),
            el('div', { style: { marginBottom: '10px' } },
                el('label', { style: { display: 'block', marginBottom: '5px' } }, 'Materiales Utilizados:'),
                materialesInput = el('input', { type: 'text', style: { width: '100%', padding: '8px', border: `1px solid ${COLORS.border}` } })
            ),
            el('div', { style: { marginBottom: '20px' } },
                el('label', { style: { display: 'block', marginBottom: '5px' } }, 'Notas/Observaciones:'),
                notasInput = el('textarea', { style: { width: '100%', padding: '8px', minHeight: '100px', border: `1px solid ${COLORS.border}` } })
            ),
            el('button', {
                onclick: handleSave,
                style: { padding: '10px 20px', backgroundColor: COLORS.ok, color: COLORS.white, border: 'none', cursor: 'pointer', borderRadius: '4px' }
            }, 'Registrar Parte')
        )
    );
}

// 5. TrabajosView (Historial de Trabajos)
export function TrabajosView() {
    const state = getState();
    const allJobs = jobs();
    const f = state.trabajosFilter;

    // --- Filters ---
    function renderFilters() {
        return el('div', { class: 'job-filters', style: { marginBottom: '15px', padding: '10px', border: `1px solid ${COLORS.border}`, borderRadius: '4px' } },
            el('h4', null, 'Filtros'),
            el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' } },
                // Range
                el('label', { style: { display: 'flex', flexDirection: 'column' } }, 'Rango:', el('select', { onchange: (e) => setTrabajosFilter('range', e.target.value), value: f.range, style: { padding: '8px', border: `1px solid ${COLORS.border}` } },
                    el('option', { value: 'hoy' }, 'Hoy'),
                    el('option', { value: 'semana' }, 'Última Semana'),
                    el('option', { value: 'mes' }, 'Último Mes'),
                    el('option', { value: 'todo' }, 'Todo')
                )),
                // Bloque
                el('label', { style: { display: 'flex', flexDirection: 'column' } }, 'Bloque:', el('select', { onchange: (e) => setTrabajosFilter('block', e.target.value), value: f.block, style: { padding: '8px', border: `1px solid ${COLORS.border}` } },
                    el('option', { value: 'all' }, 'Todos'),
                    ...BLOQUES.map(b => el('option', { value: b.id }, b.label))
                )),
                // Habitación
                el('label', { style: { display: 'flex', flexDirection: 'column' } }, 'Habitación:', el('input', { type: 'number', style: { width: '80px', padding: '8px', border: `1px solid ${COLORS.border}` }, oninput: (e) => setTrabajosFilter('room', e.target.value), value: f.room })),
                // Checkbox Resuelto
                el('label', { style: { display: 'flex', alignItems: 'center', cursor: 'pointer' } }, 
                    el('input', { type: 'checkbox', onchange: (e) => setTrabajosFilter('onlySolved', e.target.checked), checked: f.onlySolved, style: { marginRight: '5px' } }), 
                    ' Solo Resueltos'
                )
            )
        );
    }

    // --- Filtering Logic ---
    const filteredJobs = allJobs.filter(j => {
        // Range filter
        if (f.range !== 'todo') {
            const jobDate = new Date(j.ts);
            const now = new Date();
            let cutoff;
            if (f.range === 'hoy') {
                cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            } else if (f.range === 'semana') {
                cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            } else if (f.range === 'mes') {
                cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            }
            if (jobDate < cutoff) return false;
        }

        // Block filter
        if (f.block !== 'all' && j.bloque !== f.block) return false;

        // Room filter
        if (f.room && j.room !== Number(f.room)) return false;

        // Only Solved: asumimos que un trabajo con estadoDespues = 'ok' es resuelto
        if (f.onlySolved && j.estadoDespues !== "ok") return false;
        
        return true;
    }).sort((a,b) => new Date(b.ts) - new Date(a.ts)); // Más recientes primero

    // --- Job List ---
    const jobList = el('ul', { style: { listStyle: 'none', padding: 0 } },
        filteredJobs.length === 0 
            ? el('p', null, 'No hay trabajos que coincidan con los filtros.')
            : filteredJobs.map(j => el('li', { style: { border: `1px solid ${COLORS.border}`, padding: '15px', marginBottom: '8px', borderRadius: '4px' } },
                el('div', { style: { display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' } },
                    el('span', { style: { color: COLORS.dark } }, `Hab: ${j.room} (${j.bloque})`),
                    el('span', { style: { color: '#666' } }, `⏱️ ${fmtHHMM(j.ts)}`)
                ),
                el('p', { style: { margin: '5px 0' } }, `Elemento: ${j.elemento}`),
                el('p', { style: { margin: '5px 0' } }, `Acción: ${j.accion} ${j.estadoDespues === 'ok' ? '✅' : ''}`),
                j.minutos ? el('p', { style: { margin: '5px 0' } }, `Minutos: ${j.minutos}`) : null,
                j.materiales ? el('p', { style: { margin: '5px 0' } }, `Materiales: ${j.materiales}`) : null,
                j.notas ? el('p', { style: { margin: '10px 0 5px 0', fontStyle: 'italic', borderLeft: `3px solid ${COLORS.border}`, paddingLeft: '10px' } }, `Notas: ${j.notas}`) : null,
                el('small', { style: { color: '#999', display: 'block', marginTop: '5px' } }, `Registrado por: ${j.alias} el ${new Date(j.ts).toLocaleDateString()}`)
            ))
    );

    return el('div', { class: 'trabajos-view' },
        el('h2', null, 'Historial de Trabajos'),
        renderFilters(),
        el('h3', { style: { marginTop: '20px' } }, `Mostrando ${filteredJobs.length} trabajos`),
        jobList
    );
}
