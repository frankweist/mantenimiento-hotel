// js/utils.js

// EXTRAÍDO de app.js (Sección Data, Helpers, DOM helpers)

// --- Constants ---
export const APP_VERSION = "v1.4.0-local-trabajos-offline";
export const SOLVED_WINDOW_MS = 48*60*60*1000; // 48h

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
    { id: "hidrokit", label: "Hidrokit" },
    { id: "aire", label: "Aire acondicionado (funciona, temp adecuada)" },
    { id: "sensor_inundacion", label: "Sensor de inundación" },
    { id: "jacuzzi", label: "Jacuzzi" },
    { id: "tapa_llave", label: "Tapa de acceso a la llave" },
    { id: "cerradura_electrica", label: "Cerradura eléctrica" },
    { id: "bis_armarios", label: "Bisagras armarios" },
    { id: "bis_puertas_ext", label: "Bisagras puertas exteriores" },
    { id: "humedades", label: "Humedades" },
    { id: "desperfectos", label: "Desperfectos" },
];

export const COLORS = { none:"#e5e7eb", review:"#f59e0b", ok:"#10b981", fail:"#ef4444", dark:"#0f172a", white:"#ffffff", border:"#cbd5e1" };

// --- Helper Functions ---
export function labelState(s){ return s==="ok"?"OK":s==="fail"?"Fallo":s==="pending"?"Por revisar":s==="auto"?"Auto":"—"; }
export function nowISO(){
    var d=new Date();
    function p(n){return String(n).padStart(2,"0");}
    return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+" "+p(d.getHours())+":"+p(d.getMinutes());
}
export function toISO(dt){ return new Date(dt).toISOString(); }
export function fmtHHMM(dt){
    var d=new Date(dt);
    var h=String(d.getHours()).padStart(2,'0');
    var m=String(d.getMinutes()).padStart(2,'0');
    return h+":"+m;
}

export function blockOfRoom(n){
    for (var i=0;i<BLOQUES.length;i++){
        var b=BLOQUES[i]; if (n>=b.from && n<=b.to) return b.id;
    }
    return null;
}
export function checkById(id){
    for (var i=0;i<CHECKS.length;i++){
        if(CHECKS[i].id===id) return CHECKS[i];
    }
    return null;
}

export function autoOverallFromRoom(room){
    var items = (room&&room.items)||{};
    var vals = Object.keys(items).map(function(k){return items[k]}).filter(function(v){return v!=="none"});
    var hasFail = vals.indexOf("fail")>=0;
    var hasPend = vals.indexOf("pending")>=0;
    var anyItemNote = room&&room.itemNotes && Object.keys(room.itemNotes).some(function(k){ return (room.itemNotes[k]||"").trim().length>0; });
    var anyRoomNote = room && (room.notes||"").trim().length>0;
    if (hasFail) return "fail";
    if (!hasFail && !hasPend && (anyItemNote || anyRoomNote)) return "fail";
    if (hasPend) return "pending";
    if (vals.length===0) return room&&room.assumeOk ? "ok" : "none";
    return "ok";
}

export function hashPIN(pin){
    var h=5381;
    for (var i=0;i<pin.length;i++){
        h=((h<<5)+h)+pin.charCodeAt(i);
        h|=0;
    }
    return "h"+(h>>>0).toString(16);
}


// --- DOM Helper (el) ---
export function el(tag, attrs){
    var e=document.createElement(tag);
    if(attrs){
        for (var k in attrs){
            if (k==="class") e.className = attrs[k];
            else if (k==="style"){ for (var sk in attrs[k]) e.style[sk]=attrs[k][sk]; }
            else if (k.slice(0,2)==="on" && typeof attrs[k]==="function"){ e.addEventListener(k.slice(2).toLowerCase(), attrs[k]); }
            else if (attrs[k]!==undefined && attrs[k]!==null){ e.setAttribute(k, attrs[k]); }
        }
    }
    for (var i=2;i<arguments.length;i++){
        var c=arguments[i];
        if (c==null) continue;
        if (Array.isArray(c)){ c.forEach(function(n){ if(n!=null) e.appendChild(typeof n==="string"?document.createTextNode(n):n); }); }
        else e.appendChild(typeof c==="string"?document.createTextNode(c):c);
    }
    return e;
}
