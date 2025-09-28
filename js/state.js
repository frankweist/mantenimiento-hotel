// js/state.js

import { loadUsers, loadCurrentUser, setCurrent, saveUsers, loadUserData, saveUserData } from './storage.js';
import { handleRegister, handleLogin } from './auth.js';
import { BLOQUES, blockOfRoom, checkById, autoOverallFromRoom } from './utils.js';

let _state = {
    page: "plan",
    selBlock: null,
    selRoom: null,
    filter: "",
    statusFilter: "all",
    users: {},
    currentUser: null,
    dataByUser: {},
    trabajosFilter: { range:'hoy', block:'all', room:'', accion:'all', elemento:'all', onlySolved:false } // Filtros de historial
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

// --- Initial Load ---
export function loadInitialState() {
    _state.users = loadUsers();
    _state.currentUser = loadCurrentUser();
    if (_state.currentUser) {
        getUserData(); // Precargar datos si ya hay sesión
    }
    notifyStateChange();
}

// --- User & Auth Management ---
export function getUserProfile(){ return _state.currentUser ? _state.users[_state.currentUser.toLowerCase()] : null; }
export function getUserData(){
    const k=_state.currentUser ? _state.currentUser.toLowerCase() : null;
    if(!k) return {};
    if(!_state.dataByUser[k]){
      // Usar la función de storage para cargar
      _state.dataByUser[k]= loadUserData(k);
      if (!_state.dataByUser[k]._jobs) _state.dataByUser[k]._jobs=[];
    }
    if (!_state.dataByUser[k]._jobs) _state.dataByUser[k]._jobs=[];
    return _state.dataByUser[k];
}

export function setUserData(updater){
    const k=_state.currentUser ? _state.currentUser.toLowerCase() : null;
    if(!k) return;
    const currentData = getUserData();
    const nextData = updater(Object.assign({}, currentData)); // Clona currentData

    // Asegurar que _jobs exista en el objeto mutado
    if (!nextData._jobs) nextData._jobs = currentData._jobs||[];

    _state.dataByUser[k] = nextData;
    saveUserData(k, nextData);
    notifyStateChange();
}

export async function login(alias, pin) {
    const user = await handleLogin(alias, pin, _state.users);
    if (user) {
        _state.currentUser = user.alias.toLowerCase();
        setCurrent(_state.currentUser);
        _state.users[_state.currentUser] = user;
        getUserData();
        setRouteTo(null, null); // Navegar a 'plan'
        notifyStateChange();
    }
    return user;
}

export async function register(alias, pin) {
    const user = await handleRegister(alias, pin, _state.users);
    if (user) {
        _state.currentUser = user.alias.toLowerCase();
        setCurrent(_state.currentUser);
        _state.users[_state.currentUser] = user;
        saveUsers(_state.users);
        getUserData();
        setRouteTo(null, null);
        notifyStateChange();
    }
    return user;
}

export function logout(){
    setCurrent(null);
    _state.currentUser = null;
    _state.dataByUser = {};
    setRouteTo("auth");
    notifyStateChange();
}


// --- Jobs Management (Lógica de negocio) ---
function genId(){ return 'j'+Math.random().toString(36).slice(2)+Date.now().toString(36); }
export function jobs(){ return (getUserData()._jobs)||[]; }
function pushJob(job){
    setUserData(function(s){
      var arr = (s._jobs||[]).slice(); arr.push(job);
      return Object.assign({}, s, {_jobs:arr});
    });
}
export function logJob(opts){
    const profile = getUserProfile();
    const alias=(profile&&profile.alias)||'anon';
    const j = {
        id: genId(),
        ts: new Date().toISOString(),
        alias: alias,
        bloque: blockOfRoom(opts.room),
        room: opts.room,
        elementoId: opts.elementoId || null,
        elemento: opts.elemento || (opts.elementoId? (checkById(opts.elementoId)||{label:opts.elementoId}).label : (opts.elementoTexto||"")),
        accion: opts.accion || "reparación",
        estadoAntes: opts.estadoAntes || null,
        estadoDespues: opts.estadoDespues || null,
        minutos: opts.minutos || null,
        materiales: opts.materiales || null,
        notas: opts.notas || null,
        source: opts.source || "item",
        anulado: false
    };
    pushJob(j);
    return j;
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
        if (!r.block) { _state.selBlock = null; _state.selRoom = null; }
        else {
            const b = BLOQUES.find(x => x.id === r.block);
            _state.selBlock = b || null; _state.selRoom = r.room || null;
        }
    } else { _state.selBlock = null; _state.selRoom = null; }

    if (!needsAuth && !_state.dataByUser[_state.currentUser.toLowerCase()]) getUserData();

    notifyStateChange();
}

// --- Filters Management ---
export function setBlockFilter(key, value){
    _state[key] = value;
    notifyStateChange();
}

export function setTrabajosFilter(key, value){
    _state.trabajosFilter = Object.assign({}, _state.trabajosFilter, {[key]: value});
    notifyStateChange();
}
