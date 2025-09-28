// js/auth.js

import { hashPIN } from './utils.js';
import { loadUsers, saveUsers } from './storage.js';

export async function handleLogin(alias, pin, users) {
    const key = alias.trim().toLowerCase();
    const u = users[key];
    const h = hashPIN(pin.trim());

    if (!u) return null; // Usuario no encontrado
    if (u.pinHash !== h) return null; // PIN incorrecto

    return u; // Éxito
}

export async function handleRegister(alias, pin, users) {
    const al = alias.trim();
    const pi = pin.trim();
    const key = al.toLowerCase();

    if (!al || !pi || pi.length < 4 || pi.length > 8) return null; // Validación

    // Si ya existe, no se registra aquí, se hace login (lógica manejada en la vista)
    if (users[key]) return null;

    const h = hashPIN(pi);
    const newUser = { alias: al, pinHash: h, createdAt: new Date().toISOString() };
    users[key] = newUser;
    saveUsers(users); // Guardar la lista de usuarios actualizada
    return newUser;
}
