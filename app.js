
import { h } from "https://esm.sh/preact@10.22.0";
import { useState, useEffect, useMemo } from "https://esm.sh/preact@10.22.0/hooks";
import htm from "https://esm.sh/htm@3.1.1";
const html = htm.bind(h);

const LS_KEY = "mh_v1_state";

const BLOQUES = [
  { id: "A", label: "A", from: 2100, to: 2107 },
  { id: "B", label: "B", from: 2200, to: 2207 },
  { id: "C", label: "C", from: 2300, to: 2307 },
  { id: "D", label: "D", from: 2400, to: 2401 },
  { id: "V", label: "VILLAS", from: 3101, to: 3106 },
];

const COLORS = {
  none: "#e5e7eb",
  pending: "#f59e0b",
  ok: "#10b981",
  fail: "#ef4444",
  dark: "#0f172a",
  white: "#ffffff",
  border: "#cbd5e1",
};

const CHECKS = [
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

function labelState(s){ return s==="ok"?"OK":s==="fail"?"Fallo":s==="pending"?"Pendiente":s==="auto"?"Auto":"—"; }
function autoOverallRoom(room){
  if (!room || !room.items) return "none";
  const vals = Object.values(room.items);
  if (vals.includes("fail")) return "fail";
  if (vals.includes("pending")) return "pending";
  if (vals.length===0) return "none";
  return "ok";
}
function summarizeColor(list){
  if (list.some(s=>"fail"===s)) return COLORS.fail;
  if (list.some(s=>"pending"===s)) return COLORS.pending;
  if (list.every(s=>"none"===s)) return COLORS.none;
  return COLORS.ok;
}

function usePersist(){
  const [state,setState]=useState(()=>{
    try{ const s=localStorage.getItem(LS_KEY); return s?JSON.parse(s):{}; }catch{return {}}
  });
  useEffect(()=>{ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch{} },[state]);
  return [state,setState];
}

// Hash routing simple: "", "#/A", "#/A/2100"
function parseHash(){
  const h = (location.hash||"").replace(/^#\/?/,"");
  if (!h) return { block:null, room:null };
  const p = h.split("/");
  const block = p[0]||null;
  const room = p[1]? Number(p[1]) : null;
  return { block, room };
}
function setRoute(block, room){
  if (!block) location.hash = "";
  else if (!room) location.hash = `#/${block}`;
  else location.hash = `#/${block}/${room}`;
}

function pillStyle(type, selected){
  if (selected){
    const bg = type==="ok"?COLORS.ok : type==="fail"?COLORS.fail : type==="pending"?COLORS.pending : "#334155";
    return `background:${bg};color:${COLORS.white};border-color:${bg};`;
  } else {
    const tc = type==="ok"?COLORS.ok : type==="fail"?COLORS.fail : type==="pending"?COLORS.pending : "#334155";
    return `background:${COLORS.white};color:${tc};border:1px solid ${tc};`;
  }
}

export default function App(){
  const [selBlock,setSelBlockState]=useState(null);
  const [selRoom,setSelRoomState]=useState(null);
  const [filter,setFilter]=useState("");
  const [state,setState]=usePersist();

  // Init from hash + listen back button
  useEffect(()=>{
    const apply = ()=>{
      const { block, room } = parseHash();
      if (!block){ setSelBlockState(null); setSelRoomState(null); return; }
      const b = BLOQUES.find(x=>x.id===block);
      setSelBlockState(b||null);
      setSelRoomState(room||null);
    };
    window.addEventListener("hashchange", apply);
    apply();
    return ()=>window.removeEventListener("hashchange", apply);
  },[]);

  // Navigation helpers that also set hash
  function goPlan(){ setRoute(null,null); }
  function goBlock(b){ setRoute(b.id,null); }
  function goRoom(n){ setRoute(selBlock.id,n); }

  const blockRooms = useMemo(()=>{
    if(!selBlock) return [];
    const b=BLOQUES.find(x=>x.id===selBlock.id);
    return Array.from({length:b.to-b.from+1},(_,i)=>b.from+i);
  },[selBlock]);

  const roomState = state[selRoom] || { items:{}, notes:"", measures:[], overall:"none" };
  const autoOverall = useMemo(()=>autoOverallRoom(roomState),[selRoom,state]);
  const overall = roomState.overall && roomState.overall!=="auto" ? roomState.overall : autoOverall;

  function setItem(room, itemId, value){
    setState(prev => ({
      ...prev,
      [room]:{
        items:{ ...(prev[room]?.items||{}), [itemId]: value },
        notes: prev[room]?.notes || "",
        measures: prev[room]?.measures || [],
        overall: prev[room]?.overall || "auto",
      }
    }));
  }
  function setOverall(room,value){
    setState(prev=>({ ...prev, [room]:{ ...(prev[room]||{items:{},notes:"",measures:[]}), overall:value } }));
  }
  function setNotes(room,value){
    setState(prev=>({ ...prev, [room]:{ ...(prev[room]||{items:{},measures:[]}), notes:value, overall: prev[room]?.overall || "auto" } }));
  }
  function addMeasure(room,m){
    setState(prev=>({ ...prev, [room]:{ ...(prev[room]||{items:{},notes:""}), measures:[ ...(prev[room]?.measures||[]), m ], overall: prev[room]?.overall || "auto" } }));
  }
  function delMeasure(room,idx){
    setState(prev=>({ ...prev, [room]:{ ...(prev[room]||{items:{},notes:""}), measures:(prev[room]?.measures||[]).filter((_,i)=>i!==idx) } }));
  }

  const filteredRooms = blockRooms.filter(n=>n.toString().includes(filter.trim()));

  return html`
    <div>
      <header class="container">
        <h1>Mantenimiento Hotel · Residences</h1>
        <div class="kv">v1.0-rc2 · Plano con iconos · Navegación con botón Atrás</div>
      </header>

      ${!selBlock && html`
        <main class="container">
          <div class="plan">
            ${BLOQUES.map(b=>html`<${BlockTile} key=${b.id} b=${b} state=${state} onClick=${()=>goBlock(b)} />`)}
          </div>
          <p class="kv" style="margin-top:10px">Pulsa un bloque para ver sus residencias.</p>
        </main>
      `}

      ${selBlock && selRoom==null && html`
        <main class="container">
          <button class="btn-light" onClick=${goPlan}>← Plano</button>
          <h2 style="margin-top:8px;font-size:18px;font-weight:600">Bloque ${selBlock.label}</h2>
          <div style="margin-top:8px">
            <input placeholder="Filtrar número…" value=${filter} onInput=${e=>setFilter(e.target.value)} />
          </div>
          <div class="rooms">
            ${filteredRooms.map(n=>html`<${RoomChip} key=${n} n=${n} overall=${(state[n]?.overall||autoOverallRoom(state[n]))} onClick=${()=>goRoom(n)} />`)}
          </div>
        </main>
      `}

      ${selRoom!=null && html`
        <main class="container">
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn-light" onClick=${()=>goBlock(selBlock)}>← Residencias</button>
            <h2 style="font-size:18px;font-weight:600">Residencia ${selRoom}</h2>
            <span class="pill" style=${`margin-left:auto;background:${overall==="auto"?"#334155":(COLORS[overall]||COLORS.none)};color:${COLORS.white}`}>${labelState(overall)}</span>
          </div>

          <section class="card">
            <h3 style="font-size:16px;font-weight:600">Checklist</h3>
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:8px">
              ${CHECKS.map(c=>{
                const cur = roomState.items[c.id] || "none";
                return html`<div class="card" style="margin-top:0;padding:10px">
                  <div style="font-size:14px;margin-bottom:8px">${c.label}</div>
                  <div style="display:flex;gap:6;flex-wrap:wrap">
                    ${["ok","fail","pending","none"].map(s=>html`<button class="pill" onClick=${()=>setItem(selRoom,c.id,s)} style=${pillStyle(s, s===cur)}>${s==="none"?"Borrar":labelState(s)}</button>`)}
                  </div>
                </div>`;
              })}
            </div>
          </section>

          <section class="card">
            <h3 style="font-size:16px;font-weight:600">Medidas para sustituciones</h3>
            <${MeasureForm} onAdd=${m=>addMeasure(selRoom,m)} />
            <ul style="margin-top:8px;padding-left:18px">
              ${(roomState.measures||[]).map((m,idx)=>html`<li style="margin-bottom:4px">
                <span style="font-family:monospace">[${m.tipo}] ${m.medida}</span>
                ${m.detalle?html`<span> — ${m.detalle}</span>`:null}
                <button class="btn" style="margin-left:8px" onClick=${()=>delMeasure(selRoom,idx)}>Eliminar</button>
              </li>`)}
              ${(!roomState.measures || roomState.measures.length===0) && html`<li style="color:#64748b">Sin medidas aún.</li>`}
            </ul>
          </section>

          <section class="card">
            <h3 style="font-size:16px;font-weight:600">Observaciones</h3>
            <textarea value=${roomState.notes||""} onInput=${e=>setNotes(selRoom,e.target.value)} placeholder="Detalles puntuales…" style="width:100%;min-height:90px"></textarea>
          </section>

          <section class="container" style="padding-left:0">
            <span>Estado global:</span>
            ${["ok","fail","pending","auto"].map(s=>html`<button class="pill" onClick=${()=>setOverall(selRoom,s)} style=${pillStyle(s, s!=="auto")}>${labelState(s)}</button>`)}
          </section>
        </main>
      `}

      <footer class="container">v1.0-rc2 — Contraste mejorado + botón Atrás</footer>
    </div>
  `;
}

function BlockTile({ b, state, onClick }){
  const rooms = Array.from({length: b.to-b.from+1},(_,i)=>b.from+i);
  const overalls = rooms.map(n=>(state[n]?.overall || autoOverallRoom(state[n])));
  const bg = summarizeColor(overalls);
  const useDark = bg===COLORS.none;
  const icon = b.id==="V" ? "🏡" : "🏢";
  return html`<button class="tile" onClick=${onClick} style=${`background:${bg};border-color:${COLORS.border};color:${useDark?COLORS.dark:COLORS.white}`}>
    <div>
      <div style="font-size:24px">${icon}</div>
      <div>${b.label}</div>
      <div class="kv" style=${`color:${useDark?COLORS.dark:"#f1f5f9"}`}>${rooms[0]}–${rooms[rooms.length-1]}</div>
    </div>
  </button>`;
}

function RoomChip({ n, overall, onClick }){
  const bg = (overall && COLORS[overall]) || COLORS.none;
  const isNone = overall==="none";
  const color = isNone ? COLORS.dark : COLORS.white;
  const border = isNone ? COLORS.border : "transparent";
  const realBg = isNone ? COLORS.white : bg;
  return html`<button class="room" onClick=${onClick} style=${`background:${realBg};color:${color};border-color:${border}`}>${n}</button>`;
}

function MeasureForm({ onAdd }){
  const [tipo,setTipo]=useState("madera");
  const [medida,setMedida]=useState("");
  const [detalle,setDetalle]=useState("");
  const can = medida.trim().length>0;
  return html`<div style="display:flex;gap:6;flex-wrap:wrap">
    <select value=${tipo} onChange=${e=>setTipo(e.target.value)}>
      <option value="madera">Madera</option>
      <option value="ceramica">Cerámica</option>
      <option value="mueble">Mueble</option>
      <option value="enser">Enser</option>
      <option value="otro">Otro</option>
    </select>
    <input placeholder="Medida (ej. 60x90 cm)" value=${medida} onInput=${e=>setMedida(e.target.value)} />
    <input placeholder="Detalle opcional" value=${detalle} onInput=${e=>setDetalle(e.target.value)} />
    <button class=${can?"btn-primary":"btn-disabled"} disabled=${!can} onClick=${()=>{ onAdd({tipo,medida,detalle:detalle||undefined}); setMedida(""); setDetalle(""); }}>Añadir</button>
  </div>`;
}
