// js/views.js
import { getState, setRouteTo, logout, login, register, setUserData, logJob, setBlockFilter, setTrabajosFilter, jobs, getUserProfile } from './state.js';
import { el, BLOQUES, CHECKS, COLORS, labelState, nowISO, fmtHHMM, blockOfRoom, checkById, autoOverallFromRoom, SOLVED_WINDOW_MS } from './utils.js';
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

/** Genera la vista de una única habitación en el Plan */
function RoomCard(n, roomData, isSelected, selBlockId){
    const state = getState();
    const block = blockOfRoom(n);
    const hasNotes = (roomData.notes || "").trim().length > 0;
    const itemNoteCount = Object.keys(roomData.itemNotes || {}).filter(k => (roomData.itemNotes[k] || "").trim().length > 0).length;

    const overall = roomData.overall === "auto" ? autoOverallFromRoom(roomData) : roomData.overall;

    return el('div', { 
        class: `room-card ${isSelected ? 'selected' : ''}`, 
        style: { 
            backgroundColor: COLORS[overall],
            borderColor: COLORS.dark,
            borderWidth: '2px',
            borderStyle: 'solid',
            marginBottom: '4px',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '4px'
        },
        onclick: () => setRouteTo(selBlockId, n)
    },
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            el('span', { style: { fontWeight: 'bold', fontSize: '1.1em', color: COLORS.dark } }, `${n}`),
            el('div', null, 
                hasNotes ? el('span', { class: 'badge', style: { backgroundColor: COLORS.white, color: COLORS.dark, marginRight: '5px' } }, '💬') : null,
                itemNoteCount > 0 ? el('span', { class: 'badge', style: { backgroundColor: COLORS.white, color: COLORS.dark } }, `📝${itemNoteCount}`) : null,
            )
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
        return el('div', { class: 'card', style: { maxWidth: '300px', margin: '50px auto', padding: '20px', textAlign: 'center' } },
            el('h2', null, mode === 'login' ? 'Iniciar Sesión' : 'Registrarse'),
            msgEl = el('p', { style: { color: COLORS.fail } }),
            
            el('div', { style: { marginBottom: '10px' } },
                el('label', null, 'Alias:'),
                aliasInput = el('input', { type: 'text', style: { width: '100%', padding: '8px' } })
            ),
            el('div', { style: { marginBottom: '20px' } },
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
                style: { padding: '10px 20px', backgroundColor: COLORS.dark, color: COLORS.white, border: 'none', cursor: 'pointer' }
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


// 3. PlanView (Selección de Bloque y Habitación)
export function PlanView(state) {
    const blocksList = el('div', { class: 'blocks-list', style: { marginBottom: '20px', display: 'flex', gap: '10px', overflowX: 'auto', padding: '10px 0' } });

    // 3.1 Lista de Bloques (Filtros)
    BLOQUES.forEach(b => {
        const isSelected = state.selBlock && state.selBlock.id === b.id;
        blocksList.appendChild(el('button', {
            class: 'block-btn',
            style: { 
                padding: '10px 15px', 
                backgroundColor: isSelected ? COLORS.dark : COLORS.none, 
                color: isSelected ? COLORS.white : COLORS.dark, 
                border: `1px solid ${COLORS.dark}`, 
                borderRadius: '4px',
                flexShrink: 0
            },
            onclick: () => setRouteTo(isSelected ? null : b.id)
        }, b.label));
    });

    let roomList = el('div');

    // 3.2 Lista de Habitaciones
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

        roomList = el('div', { class: 'room-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' } }, 
            roomCards
        );
    }

    // 3.3 Vista Detalle de Habitación
    let roomDetail = el('div');
    if (state.selRoom && state.selBlock) {
        roomDetail = RoomDetailView(state.selRoom);
    }
    
    return el('div', null,
        blocksList,
        el('h3', null, state.selBlock ? `Bloque ${state.selBlock.label}` : 'Seleccione un Bloque'),
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
        el('h2', null, `Habitación ${n}`),
        el('section', { class: 'card' },
            el('h3', null, 'Checks de Habitación'),
            el('ul', { style: { listStyle: 'none', padding: 0 } },
                CHECKS.map(c => {
                    const currentState = r.items[c.id] || "none";
                    return el('li', { style: { marginBottom: '10px', borderBottom: '1px dotted #eee', paddingBottom: '5px', display: 'flex', justifyContent: 'space-between' } },
                        el('span', null, c.label),
                        el('div', null, 
                            ['ok', 'fail', 'none'].map(s => el('span', {
                                class: 'badge',
                                style: { 
                                    backgroundColor: s === currentState ? COLORS[s] : COLORS.none,
                                    color: s === currentState ? COLORS.white : COLORS.dark,
                                    marginRight: '5px',
                                    cursor: 'pointer'
                                },
                                onclick: () => setItemState(c.id, s)
                            }, labelState(s)))
                        )
                    );
                })
            )
        ),

        el('section', { class: 'card' },
          el('h3', null, 'Observaciones de Habitación'),
          (function(){
            var ta=el('textarea',{style:{width:'100%',minHeight:'90px'}});
            ta.value=r.notes||""; 
            ta.addEventListener('input', function(){ setNotes(ta.value); });
            return ta;
          })()
        ),
        
        el('section', { class: 'container', style: { paddingLeft: 0, marginTop: '15px' } },
            el('span', null, 'Estado global manual: '),
            ['ok', 'fail', 'pending', 'auto'].map(s => {
                const isCurrent = r.overall === s || (s === "auto" && autoOverallFromRoom(r) === r.overall);
                return el('span', { 
                    class: 'badge', 
                    onclick: () => setOverallState(s),
                    style: { 
                        backgroundColor: isCurrent ? COLORS.dark : COLORS.none,
                        color: isCurrent ? COLORS.white : COLORS.dark,
                        marginRight: '5px',
                        cursor: 'pointer'
                    }
                }, labelState(s));
            })
        ),
        el('button', { 
            onclick: () => setRouteTo(r.overall === "auto" ? blockOfRoom(n) : null),
            style: { 
                marginTop: '20px', 
                backgroundColor: COLORS.fail, 
                color: COLORS.white, 
                padding: '10px 15px', 
                border: 'none', 
                borderRadius: '4px' 
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
        msgEl = el('p', { style: { color: COLORS.dark, fontWeight: 'bold' } }),

        el('section', { class: 'card', style: { marginBottom: '20px', padding: '15px', border: '1px solid #ccc' } },
            el('div', { style: { marginBottom: '10px' } },
                el('label', null, 'Habitación:'),
                roomInput = el('input', { type: 'number', style: { width: '100%', padding: '8px' } })
            ),
            el('div', { style: { marginBottom: '10px' } },
                el('label', null, 'Elemento/Sistema Afectado:'),
                elementoInput = el('input', { type: 'text', style: { width: '100%', padding: '8px' } })
            ),
            el('div', { style: { marginBottom: '10px' } },
                el('label', null, 'Acción Realizada:'),
                accionInput = el('select', { style: { width: '100%', padding: '8px' } },
                    el('option', { value: 'reparación' }, 'Reparación'),
                    el('option', { value: 'revisión' }, 'Revisión'),
                    el('option', { value: 'sustitución' }, 'Sustitución')
                )
            ),
            el('div', { style: { marginBottom: '10px' } },
                el('label', null, 'Tiempo Empleado (minutos):'),
                minutosInput = el('input', { type: 'number', style: { width: '100%', padding: '8px' } })
            ),
            el('div', { style: { marginBottom: '10px' } },
                el('label', null, 'Materiales Utilizados:'),
                materialesInput = el('input', { type: 'text', style: { width: '100%', padding: '8px' } })
            ),
            el('div', { style: { marginBottom: '20px' } },
                el('label', null, 'Notas/Observaciones:'),
                notasInput = el('textarea', { style: { width: '100%', padding: '8px', minHeight: '100px' } })
            ),
            el('button', {
                onclick: handleSave,
                style: { padding: '10px 20px', backgroundColor: COLORS.ok, color: COLORS.white, border: 'none', cursor: 'pointer' }
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
        return el('div', { class: 'job-filters', style: { marginBottom: '15px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' } },
            el('h4', null, 'Filtros'),
            el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '10px' } },
                // Range
                el('label', null, 'Rango:', el('select', { onchange: (e) => setTrabajosFilter('range', e.target.value) },
                    el('option', { value: 'hoy' }, 'Hoy'),
                    el('option', { value: 'semana' }, 'Última Semana'),
                    el('option', { value: 'mes' }, 'Último Mes'),
                    el('option', { value: 'todo' }, 'Todo')
                )),
                // Bloque
                el('label', null, 'Bloque:', el('select', { onchange: (e) => setTrabajosFilter('block', e.target.value) },
                    el('option', { value: 'all' }, 'Todos'),
                    ...BLOQUES.map(b => el('option', { value: b.id }, b.label))
                )),
                // Habitación
                el('label', null, 'Habitación:', el('input', { type: 'number', style: { width: '80px' }, oninput: (e) => setTrabajosFilter('room', e.target.value) })),
                // Checkbox Resuelto
                el('label', null, el('input', { type: 'checkbox', onchange: (e) => setTrabajosFilter('onlySolved', e.target.checked) }), ' Solo Resueltos')
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

        // Only Solved
        // NOTA: No hay un campo 'solved' o 'anulado', usamos una heurística simple o el campo 'estadoDespues'
        if (f.onlySolved && j.accion !== "reparación" && j.estadoDespues !== "ok") return false;
        
        return true;
    }).sort((a,b) => new Date(b.ts) - new Date(a.ts)); // Más recientes primero

    // --- Job List ---
    const jobList = el('ul', { style: { listStyle: 'none', padding: 0 } },
        filteredJobs.length === 0 
            ? el('p', null, 'No hay trabajos que coincidan con los filtros.')
            : filteredJobs.map(j => el('li', { style: { border: '1px solid #eee', padding: '10px', marginBottom: '8px', borderRadius: '4px' } },
                el('div', { style: { display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' } },
                    el('span', null, `Hab: ${j.room} (${j.bloque})`),
                    el('span', null, `⏱️ ${fmtHHMM(j.ts)}`)
                ),
                el('p', null, `Elemento: ${j.elemento}`),
                el('p', null, `Acción: ${j.accion}`),
                j.minutos ? el('p', null, `Minutos: ${j.minutos}`) : null,
                j.materiales ? el('p', null, `Materiales: ${j.materiales}`) : null,
                j.notas ? el('p', null, `Notas: ${j.notas}`) : null,
                el('small', { style: { color: '#666' } }, `Registrado por: ${j.alias} el ${new Date(j.ts).toLocaleDateString()}`)
            ))
    );

    return el('div', { class: 'trabajos-view' },
        el('h2', null, 'Historial de Trabajos'),
        renderFilters(),
        jobList
    );
}
