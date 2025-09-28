import { el, BLOQUES, COLORS, autoOverallFromRoom } from './utils.js';
import { getState, getUserData, getUserProfile, setRouteTo, login, register, logout } from './state.js';

// --- Vista de Autenticación ---
export function AuthView() {
    let isLogin = true;
    
    const container = el('div', { class: 'auth-container' });
    const aliasInput = el('input', { type: 'text', placeholder: 'Alias', required: true });
    const pinInput = el('input', { type: 'password', placeholder: 'PIN', required: true });
    const submitBtn = el('button', { class: 'btn-primary' }, 'Iniciar Sesión');
    const toggleBtn = el('button', { class: 'btn-link' }, '¿No tienes cuenta? Regístrate');
    const form = el('form', { class: 'auth-form' },
        el('h2', {}, 'Acceso'),
        aliasInput,
        pinInput,
        submitBtn,
        toggleBtn
    );

    function toggleMode(e) {
        e.preventDefault();
        isLogin = !isLogin;
        submitBtn.textContent = isLogin ? 'Iniciar Sesión' : 'Registrar';
        toggleBtn.textContent = isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión';
        form.querySelector('h2').textContent = isLogin ? 'Acceso' : 'Registro';
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const alias = aliasInput.value.trim();
        const pin = pinInput.value.trim();
        if (!alias || !pin) {
            alert("Alias y PIN son requeridos.");
            return;
        }
        submitBtn.disabled = true;
        if (isLogin) {
            await login(alias, pin);
        } else {
            await register(alias, pin);
            aliasInput.value = '';
            pinInput.value = '';
            toggleMode(e); // Volver al login
        }
        submitBtn.disabled = false;
    }

    toggleBtn.onclick = toggleMode;
    form.onsubmit = handleSubmit;
    
    container.appendChild(form);
    return container;
}


// --- Componentes ---
export function Header(state) {
    const profile = getUserProfile();
    const actions = [];
    
    if (state.page === "parte" || state.page === "trabajos") {
        actions.push(el('button', { class: 'btn-light', onclick: () => setRouteTo(null, null) }, '← Plano'));
    } else if (state.selRoom != null) {
        actions.push(el('button', { class: 'btn-light', onclick: () => setRouteTo(state.selBlock.id, null) }, '← Residencias'));
    } else if (state.selBlock) {
        actions.push(el('button', { class: 'btn-light', onclick: () => setRouteTo(null, null) }, '← Plano'));
    }

    actions.push(el('button', { class: 'btn', onclick: () => setRouteTo("parte") }, 'Parte'));
    actions.push(el('button', { class: 'btn', onclick: () => setRouteTo("trabajos") }, 'Trabajos'));
    
    // Botón de usuario/logout
    if (profile) {
        const userBtn = el('button', { class: 'btn-primary', onclick: logout }, `Usuario: ${profile.alias} (Salir)`);
        actions.push(userBtn);
    }

    return el('header', { class: 'container' },
        el('h1', {}, 'Mantenimiento Hotel'),
        el('div', { class: 'actions' }, actions)
    );
}

function BlockTile(b) {
    // ... (La lógica de esta función no cambia, cópiala y pégala aquí)
    // Asegúrate de que usa `getUserData()` importada.
    return el('button', {class:'tile',onclick:()=>setRouteTo(b.id,null)}, b.label);
}

function RoomChip(n, selBlockId) {
    // ... (La lógica de esta función no cambia, cópiala y pégala aquí)
    // Asegúrate de que usa `getUserData()` importada.
     return el('button', {class:'room',style:{backgroundColor:COLORS.ok},onclick:()=>setRouteTo(selBlockId,n)}, String(n));
}


// --- Vistas de Página ---
export function PlanView(state) {
    const { selBlock, selRoom } = state;
    const container = el('div', {});

    if (selRoom && selBlock) {
        // --- Vista de Detalle de Habitación ---
        container.appendChild(el('h2', {}, `Residencia ${selRoom}`));
        // Aquí iría la lógica y renderizado de los checks de la habitación
        container.appendChild(el('p', {}, 'Detalle de la habitación y sus checks...'));

    } else if (selBlock) {
        // --- Vista de Bloque (lista de habitaciones) ---
        container.appendChild(el('h2', {}, `Residencias del Bloque ${selBlock.label}`));
        const roomsGrid = el('div', { class: 'grid-rooms' });
        for (let i = selBlock.from; i <= selBlock.to; i++) {
            roomsGrid.appendChild(RoomChip(i, selBlock.id));
        }
        container.appendChild(roomsGrid);

    } else {
        // --- Vista de Plano (lista de bloques) ---
        container.appendChild(el('h2', {}, 'Plano General'));
        const blocksGrid = el('div', { class: 'grid-main' });
        BLOQUES.forEach(b => blocksGrid.appendChild(BlockTile(b)));
        container.appendChild(blocksGrid);
    }
    return container;
}

export function ParteView() {
    // ... (La lógica de esta función no cambia, cópiala y pégala aquí)
    return el('div',{},'Vista del Parte de Trabajo');
}

export function TrabajosView() {
    // ... (La lógica de esta función no cambia, cópiala y pégala aquí)
    return el('div',{},'Vista del Historial de Trabajos');
}