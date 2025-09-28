// js/storage.js

const GLOBAL_LS = { users:"mh_users_v1", current:"mh_user_current_v1" };
const NS_PREFIX = "mh_v1_";
const LEGACY = "mh_v1_state"; // Clave de estado legacy (mono-usuario)

export function nsKey(a){ return NS_PREFIX+a+"_state"; }

// --- Users ---
export function loadUsers(){
    try{
        return JSON.parse(localStorage.getItem(GLOBAL_LS.users)||"{}");
    } catch(e){
        console.error("Error al cargar usuarios:", e);
        return {};
    }
}
export function saveUsers(u){
    try{ localStorage.setItem(GLOBAL_LS.users, JSON.stringify(u)); }
    catch(e){ console.error("Error al guardar usuarios:", e); }
}

// --- Current User ---
export function loadCurrentUser(){
    return localStorage.getItem(GLOBAL_LS.current)||null;
}
export function setCurrent(a){
    try{
        if(a) localStorage.setItem(GLOBAL_LS.current,a);
        else localStorage.removeItem(GLOBAL_LS.current);
    } catch(e){ console.error("Error al guardar usuario actual:", e); }
}

// --- User Data (Rooms, Jobs) ---
export function loadUserData(aliasLower){
    try{
        let s=localStorage.getItem(nsKey(aliasLower));
        let data = s ? JSON.parse(s) : {};
        // Lógica de migración LEGACY (si existe una clave sin usuario)
        if(!s && aliasLower==="legacy"){
             const legacy=localStorage.getItem(LEGACY);
             if(legacy){ data = JSON.parse(legacy); }
        }
        return data;
    } catch(e){
        console.error("Error al cargar datos del usuario " + aliasLower + ":", e);
        return {};
    }
}
export function saveUserData(aliasLower, data){
    try{
        localStorage.setItem(nsKey(aliasLower), JSON.stringify(data));
        // Limpiar la clave legacy si se ha migrado
        if(localStorage.getItem(LEGACY)){ localStorage.removeItem(LEGACY); }
    } catch(e){
        console.error("Error al guardar datos del usuario " + aliasLower + ":", e);
        alert("Error al guardar datos. La memoria local podría estar llena o dañada.");
    }
}
