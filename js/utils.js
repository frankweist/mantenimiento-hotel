// --- Constantes & Datos Base ---
export const APP_VERSION = "v2.0.0-modular";
export const SOLVED_WINDOW_MS = 48 * 60 * 60 * 1000; // 48h
export const DATE_FMT_OPTS = { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' };

export const BLOQUES = [
    { id: "A", label: "A", from: 2100, to: 2107 },
    { id: "B", label: "B", from: 2200, to: 2207 },
    { id: "C", label: "C", from: 2300, to: 2307 },
    { id: "D", label: "D", from: 2400, to: 2401 },
    { id: "V", label: "VILLAS", from: 3101, to: 3106 },
];
export const CHECKS = [
    { id: "luces", label: "Luces" },
    { id: "agua_caliente", label: "Agua caliente" },
    // ... (el resto de tus checks)
    { id: "desperfectos", label: "Desperfectos" },
];
export const COLORS = { none: "#e5e7eb", review: "#f59e0b", ok: "#10b981", fail: "#ef4444", dark: "#0f172a", white: "#ffffff", border: "#cbd5e1" };

// --- Funciones de Utilidad ---
export function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) {
        for (const k in attrs) {
            if (k === "class") e.className = attrs[k];
            else if (k === "style") { for (const sk in attrs[k]) e.style[sk] = attrs[k][sk]; }
            else if (k.startsWith("on") && typeof attrs[k] === "function") {
                e.addEventListener(k.substring(2).toLowerCase(), attrs[k]);
            } else if (attrs[k] !== undefined && attrs[k] !== null) {
                e.setAttribute(k, attrs[k]);
            }
        }
    }
    children.flat().forEach(child => {
        if (child === null || child === undefined) return;
        e.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return e;
}

export function labelState(s) { return s === "ok" ? "OK" : s === "fail" ? "Fallo" : s === "pending" ? "Por revisar" : s === "auto" ? "Auto" : "—"; }

export function nowISO() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function autoOverallFromRoom(room) {
    // ... (La lógica de esta función no cambia, cópiala y pégala aquí)
    const items = (room && room.items) || {};
    const vals = Object.values(items).filter(v => v !== "none");
    if (vals.includes("fail")) return "fail";
    if (vals.includes("pending")) return "pending";
    const anyNote = room && ( (room.notes || "").trim().length > 0 || Object.values(room.itemNotes || {}).some(n => (n||"").trim().length > 0) );
    if(anyNote && vals.length === 0) return "fail"; // Nota sin estado es un fallo a revisar
    if (vals.length === 0) return room && room.assumeOk ? "ok" : "none";
    return "ok";
}

export function blockOfRoom(n) {
    for (const b of BLOQUES) {
        if (n >= b.from && n <= b.to) return b.id;
    }
    return null;
}

export function checkById(id) {
    return CHECKS.find(c => c.id === id) || null;
}

// ... (Otras funciones de utilidad como fmtFullDate, fmtHHMM, etc.)