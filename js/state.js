import { loadUsers, loadCurrentUser, setCurrent, saveUsers, loadUserData, saveUserData, nsKey } from './storage.js';
import { handleRegister, handleLogin } from './auth.js';
import { BLOQUES } from './utils.js';

let _state = {
    page: "plan",
    selBlock: null,
    selRoom: null,
    filter: "",
    statusFilter: "all",
    users: {},
    currentUser: null,
    dataByUser: {}
};

let _listeners = [];

export function getState() { return _state; }

export function onStateChange(listener) {
    _listeners.push(listener);
    return () => { _listeners = _listeners.filter(l => l !== listener); };
}

function notifyStateChange() {
    _listeners.forEach(listener => listener(_state));
}

export function loadInitialState() {
    _state.users = loadUsers();
    _state.currentUser = loadCurrentUser();
    if (_state.currentUser) {
        getUserData(); // Precargar datos si ya hay sesión
    }
    notifyStateChange();
}

// --- User & Auth Management ---
export async function login(alias, pin) {
    const user = await handleLogin(alias, pin, _state.users);
    if (user) {
        _state.currentUser = user.alias;
        setCurrent(user.alias);
        getUserData();
        setRouteTo(null, null); // Redirigir al plano
    } else {
        alert("Alias o PIN incorrecto.");
    }
}

export async function register(alias, pin) {
    const { users, user } = await handleRegister(alias, pin, _state.users);
    if (user) {
        _state.users = users;
        saveUsers(users);
        alert("Usuario registrado con éxito. Ahora puedes iniciar sesión.");
        notifyStateChange();
    } else {
        alert("El alias ya existe.");
    }
}

export function logout() {
    _state.currentUser = null;
    setCurrent(null);
    _state.dataByUser = {};
    applyRoute(); // Vuelve a la vista de autenticación
}


// --- User Data Management ---
export function getUserProfile() {
    return _state.currentUser ? _state.users[_state.currentUser.toLowerCase()] : null;
}

export function getUserData() {
    const k = _state.currentUser;
    if (!k) return {};
    if (!_state.dataByUser[k]) {
        _state.dataByUser[k] = loadUserData(k);
    }
    if (!_state.dataByUser[k]._jobs) _state.dataByUser[k]._jobs = [];
    return _state.dataByUser[k];
}

export function setUserData(updater) {
    const k = _state.currentUser;
    if (!k) return;
    const currentData = getUserData();
    const nextData = updater(currentData);

    _state.dataByUser[k] = nextData;
    saveUserData(k, nextData);
    notifyStateChange();
}


// --- Routing ---
function parseHash() {
    const h = (location.hash || "").replace(/^#\/?/, "");
    if (!h) return { page: "plan", block: null, room: null };
    const p = h.split("/");
    if (["parte", "cuenta", "auth", "trabajos"].includes(p[0])) return { page: p[0], block: null, room: null };
    const block = p[0] || null;
    const room = p[1] ? Number(p[1]) : null;
    return { page: "plan", block, room };
}

export function setRouteTo(pg, room) {
    if (["parte", "cuenta", "auth", "trabajos"].includes(pg)) {
        location.hash = `#/${pg}`;
        return;
    }
    const block = pg;
    if (!block) location.hash = "";
    else if (!room) location.hash = `#/${block}`;
    else location.hash = `#/${block}/${room}`;
}

export function applyRoute() {
    const r = parseHash();
    const needsAuth = !getUserProfile();

    _state.page = needsAuth ? "auth" : r.page;
    if (_state.page === "plan" && !needsAuth) {
        if (!r.block) {
            _state.selBlock = null;
            _state.selRoom = null;
        } else {
            _state.selBlock = BLOQUES.find(b => b.id === r.block) || null;
            _state.selRoom = r.room || null;
        }
    } else {
        _state.selBlock = null;
        _state.selRoom = null;
    }
    notifyStateChange();
}