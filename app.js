
import { h, render } from "https://esm.sh/preact@10.22.0";
import { useState, useEffect, useMemo } from "https://esm.sh/preact@10.22.0/hooks";
import htm from "https://esm.sh/htm@3.1.1";
const html = htm.bind(h);

/*** Constantes ***/
const GLOBAL_LS = { users:"mh_users_v1", current:"mh_user_current_v1" };
const LEGACY = "mh_v1_state";

const BLOQUES = [
  { id: "A", label: "A", from: 2100, to: 2107 },
  { id: "B", label: "B", from: 2200, to: 2207 },
  { id: "C", label: "C", from: 2300, to: 2307 },
  { id: "D", label: "D", from: 2400, to: 2401 },
  { id: "V", label: "VILLAS", from: 3101, to: 3106 },
];
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

const COLORS = { none:"#e5e7eb", review:"#f59e0b", ok:"#10b981", fail:"#ef4444", dark:"#0f172a", white:"#ffffff", border:"#cbd5e1" };
const labelState = s => s==="ok"?"OK":s==="fail"?"Fallo":s==="pending"?"Por revisar":s==="auto"?"Auto":"—";

const nsKey = a => `mh_v1_${a}_state`;
const hashPIN = pin => { let h=5381; for (let i=0;i<pin.length;i++){ h=((h<<5)+h)+pin.charCodeAt(i); h|=0; } return "h"+(h>>>0).toString(16); };
const nowISO = () => { const d=new Date(); const p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

function autoOverallFromRoom(room){
  const items = room?.items || {};
  const vals = Object.values(items).filter(v => v !== "none");
  const hasFail = vals.includes("fail");
  const hasPend = vals.includes("pending");
  const anyItemNote = !!room?.itemNotes && Object.values(room.itemNotes).some(t => (t||"").trim().length>0);
  const anyRoomNote = !!(room?.notes||"").trim().length;
  if (hasFail) return "fail";
  if (hasPend) return "pending";
  if (!hasFail && !hasPend && (anyItemNote || anyRoomNote)) return "fail";
  if (vals.length===0) return "none";
  return "ok";
}

/*** Usuarios ***/
const loadUsers = () => { try{ return JSON.parse(localStorage.getItem(GLOBAL_LS.users)||"{}"); }catch{return {}} };
const saveUsers = u => { try{ localStorage.setItem(GLOBAL_LS.users, JSON.stringify(u)); }catch{} };
const loadCurrent = () => localStorage.getItem(GLOBAL_LS.current)||null;
const setCurrent = a => a?localStorage.setItem(GLOBAL_LS.current,a):localStorage.removeItem(GLOBAL_LS.current);

/*** Hooks ***/
function useUser(){
  const [aliasLower,setAliasLower]=useState(loadCurrent());
  const users = useMemo(loadUsers,[aliasLower]);
  const profile = aliasLower? users[aliasLower]: null;
  return { aliasLower, profile, setAliasLower };
}
function usePersistByUser(aliasLower){
  const [state,setState]=useState(()=>{
    if (!aliasLower) return {};
    try{ const s=localStorage.getItem(nsKey(aliasLower)); return s?JSON.parse(s):{}; }catch{return {}}
  });
  useEffect(()=>{
    if (!aliasLower) return;
    try{ localStorage.setItem(nsKey(aliasLower), JSON.stringify(state)); }catch{}
  },[state,aliasLower]);
  return [state,setState];
}

/*** Routing ***/
function parseHash(){
  const h=(location.hash||"").replace(/^#\/?/,"");
  if (!h) return {page:"plan",block:null,room:null};
  const p=h.split("/");
  if (p[0]==="parte"||p[0]==="cuenta"||p[0]==="auth") return {page:p[0],block:null,room:null};
  const block=p[0]||null; const room=p[1]?Number(p[1]):null;
  return {page:"plan",block,room};
}
const setRouteTo=(pg,room)=>{
  if (pg==="parte"||pg==="cuenta"||pg==="auth"){ location.hash = `#/${pg}`; return; }
  const block=pg;
  if (!block) location.hash=""; else if (!room) location.hash=`#/${block}`; else location.hash=`#/${block}/${room}`;
}

/*** UI helpers ***/
function pillStyle(type, selected){
  const t=(type==="review"?"pending":type);
  if (selected){
    const bg=t==="ok"?COLORS.ok:t==="fail"?COLORS.fail:t==="pending"?COLORS.review:"#334155";
    return `background:${bg};color:${COLORS.white};border-color:${bg};`;
  } else {
    const tc=t==="ok"?COLORS.ok:t==="fail"?COLORS.fail:t==="pending"?COLORS.review:"#334155";
    return `background:${COLORS.white};color:${tc};border:1px solid ${tc};`;
  }
}

/*** Componentes ***/
function Header({ page, selBlock, selRoom, goPlan, goBlock, goParte, goCuenta, user }){
  return html`<header class="container">
    <h1>Mantenimiento Hotel · Residences</h1>
    <div class="actions">
      ${page==="parte"
        ? html`<button class="btn-light" onClick=${goPlan}>← Plano</button>`
        : selRoom!=null
          ? html`<button class="btn-light" onClick=${()=>goBlock(selBlock)}>← Residencias</button>`
          : selBlock
            ? html`<button class="btn-light" onClick=${goPlan}>← Plano</button>`
            : null}
      <button class="btn" onClick=${goParte}>Parte</button>
      <button class="btn-primary" onClick=${goCuenta}>${user?.profile?`Usuario: ${user.profile.alias}`:"Acceder"}</button>
    </div>
  </header>`;
}

export default function App(){
  const user = useUser();
  const [page,setPage]=useState("plan");
  const [selBlock,setSelBlockState]=useState(null);
  const [selRoom,setSelRoomState]=useState(null);
  const [filter,setFilter]=useState("");
  const [state,setState]=usePersistByUser(user.aliasLower);

  useEffect(()=>{
    const apply=()=>{
      const {page,block,room}=parseHash();
      setPage(user.profile? page : "auth");
      if (page==="plan" && user.profile){
        if (!block){ setSelBlockState(null); setSelRoomState(null); return; }
        const b=BLOQUES.find(x=>x.id===block);
        setSelBlockState(b||null); setSelRoomState(room||null);
      } else { setSelBlockState(null); setSelRoomState(null); }
    };
    window.addEventListener("hashchange",apply); apply();
    return ()=>window.removeEventListener("hashchange",apply);
  },[user.aliasLower,user.profile]);

  const goPlan=()=>setRouteTo(null,null);
  const goBlock=b=>setRouteTo(b.id,null);
  const goRoom=n=>setRouteTo(selBlock.id,n);
  const goParte=()=>setRouteTo("parte");
  const goCuenta=()=>setRouteTo("cuenta");

  const roomState = state[selRoom] || { items:{}, itemNotes:{}, notes:"", measures:[], overall:"none" };
  const autoOverall = useMemo(()=>autoOverallFromRoom(roomState),[selRoom,state]);
  const overall = roomState.overall && roomState.overall!=="auto" ? roomState.overall : autoOverall;

  function setItem(room,itemId,value){
    setState(prev=>({...prev,[room]:{items:{...(prev[room]?.items||{}),[itemId]:value},itemNotes:prev[room]?.itemNotes||{},notes:prev[room]?.notes||"",measures:prev[room]?.measures||[],overall:prev[room]?.overall||"auto"}}));
  }
  function setItemNote(room,itemId,text){
    setState(prev=>({...prev,[room]:{items:{...(prev[room]?.items||{})},itemNotes:{...(prev[room]?.itemNotes||{}),[itemId]:text},notes:prev[room]?.notes||"",measures:prev[room]?.measures||[],overall:prev[room]?.overall||"auto"}}));
  }
  const setOverallState=(room,value)=>setState(prev=>({...prev,[room]:{...(prev[room]||{items:{},itemNotes:{},notes:"",measures:[]}),overall:value}}));
  const setNotes=(room,value)=>setState(prev=>({...prev,[room]:{...(prev[room]||{items:{},itemNotes:{},measures:[]}),notes:value,overall:prev[room]?.overall||"auto"}}));
  const addMeasure=(room,m)=>setState(prev=>({...prev,[room]:{...(prev[room]||{items:{},itemNotes:{},notes:""}),measures:[...(prev[room]?.measures||[]),m],overall:prev[room]?.overall||"auto"}}));
  const delMeasure=(room,idx)=>setState(prev=>({...prev,[room]:{...(prev[room]||{items:{},itemNotes:{},notes:""}),measures:(prev[room]?.measures||[]).filter((_,i)=>i!==idx)}}));
  const resetRoom=(room)=>setState(prev=>({...prev,[room]:{items:{},itemNotes:{},notes:"",measures:[],overall:"auto"}}));

  const parte = useMemo(()=>{
    const byBlock={};
    for (const b of BLOQUES){
      const rooms=Array.from({length:b.to-b.from+1},(_,i)=>b.from+i);
      const entries=[];
      for (const n of rooms){
        const r=state[n]||{}; const items=r.items||{}; const itemNotes=r.itemNotes||{};
        const fails=Object.entries(items).filter(([,v])=>v==="fail");
        const revs=Object.entries(items).filter(([,v])=>v==="pending");
        const detalle=[];
        for (const [k] of fails){ const lab=(CHECKS.find(c=>c.id===k)||{}).label||k; const note=(itemNotes[k]||"").trim(); detalle.push({tipo:"Fallo",item:k,label:lab+(note?` — obs: ${note}`:"")}); }
        for (const [k] of revs){ const lab=(CHECKS.find(c=>c.id===k)||{}).label||k; const note=(itemNotes[k]||"").trim(); detalle.push({tipo:"Por revisar",item:k,label:lab+(note?` — obs: ${note}`:"")}); }
        const roomNote=(r.notes||"").trim();
        const anyItemNoteOnly=Object.entries(itemNotes).some(([k,v])=>(v||"").trim().length>0 && (!items[k]||items[k]==="none"||items[k]==="ok"));
        if (detalle.length===0 && (roomNote || anyItemNoteOnly)){
          if (anyItemNoteOnly){
            for (const [k,v] of Object.entries(itemNotes)){
              const note=(v||"").trim(); if(!note) continue; const status=items[k];
              if (!status||status==="none"||status==="ok"){ const lab=(CHECKS.find(c=>c.id===k)||{}).label||k; detalle.push({tipo:"Fallo",item:k,label:`${lab} — obs: ${note}`}); }
            }
          }
          if (roomNote){ detalle.push({tipo:"Fallo",item:"observacion_general",label:`Observación general — ${roomNote}`}); }
        }
        if (detalle.length){ entries.push({room:n,detalle,measures:(r.measures||[]),notes:roomNote}); }
      }
      byBlock[b.id]=entries;
    }
    return byBlock;
  },[state]);

  function exportCSV(){
    const rows=[["Usuario","Bloque","Residencia","Tipo","Elemento","Detalle","Medidas","Notas"]];
    const alias=user.profile?.alias||"anon";
    for (const b of BLOQUES){
      for (const e of (parte[b.id]||[])){
        const medidas=(e.measures||[]).map(m=>`[${m.tipo}] ${m.medida}${m.detalle?` — ${m.detalle}`:""}`).join(" | ");
        if (e.detalle.length===0){ rows.push([alias,b.id,String(e.room),"","","",medidas,e.notes||""]); }
        else{
          for (const d of e.detalle){
            const parts=d.label.split(" — obs: "); rows.push([alias,b.id,String(e.room),d.tipo,parts[0],parts[1]||"",medidas,e.notes||""]);
          }
        }
      }
    }
    const csv=rows.map(r=>r.map(x=>{ const s=(x??"").toString(); return /[\",\n;]/.test(s)?`"${s.replace(/\"/g,'""')}"`:s; }).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}); const a=document.createElement("a");
    a.href=URL.createObjectURL(blob); a.download=`parte_${alias}_${nowISO().replace(/[: ]/g,'-')}.csv`; document.body.appendChild(a); a.click(); a.remove();
  }

  if (!user.profile || page==="auth"){ return html`<${AuthView} user=${user} onReady=${()=>{ setRouteTo(null,null); }}/>`; }

  const blockRooms = useMemo(()=>{
    if(!selBlock) return [];
    const b=BLOQUES.find(x=>x.id===selBlock.id);
    return Array.from({length:b.to-b.from+1},(_,i)=>b.from+i);
  },[selBlock]);

  return html`<div>
    <${Header} page=${page} selBlock=${selBlock} selRoom=${selRoom} goPlan=${()=>setRouteTo(null,null)}
      goBlock=${b=>setRouteTo(b.id,null)} goParte=${()=>setRouteTo("parte")} goCuenta=${()=>setRouteTo("cuenta")} user=${user} />

    ${page==="cuenta" && html`<${CuentaView} user=${user} />`}
    ${page==="parte" && html`<${ParteView} parte=${parte} />`}

    ${page!=="parte" && page!=="cuenta" && !selBlock && html`
      <main class="container">
        <div class="plan">
          ${BLOQUES.map(b=>html`<${BlockTile} key=${b.id} b=${b} state=${state} onClick=${()=>setRouteTo(b.id,null)} />`)}
        </div>
        <p class="kv" style="margin-top:10px">Usuario: ${user.profile.alias}. Pulsa un bloque para ver sus residencias.</p>
      </main>`}

    ${page!=="parte" && page!=="cuenta" && selBlock && selRoom==null && html`
      <main class="container">
        <h2 style="margin-top:8px;font-size:18px;font-weight:600">Bloque ${selBlock.label}</h2>
        <div style="margin-top:8px"><input placeholder="Filtrar número…" value=${filter} onInput=${e=>setFilter(e.target.value)} /></div>
        <div class="rooms">
          ${blockRooms.filter(n=>n.toString().includes(filter.trim())).map(n=>{
            const r=state[n]||{}; const overall=(r.overall && r.overall!=="auto")? r.overall : autoOverallFromRoom(r);
            return html`<${RoomChip} key=${n} n=${n} overall=${overall} onClick=${()=>setRouteTo(selBlock.id,n)} />`;
          })}
        </div>
      </main>`}

    ${page!=="parte" && page!=="cuenta" && selRoom!=null && html`
      <main class="container">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <h2 style="font-size:18px;font-weight:600">Residencia ${selRoom}</h2>
          <span class="pill" style=${`margin-left:auto;background:${overall==="auto"?"#334155":(COLORS[overall]||COLORS.none)};color:${COLORS.white}`}>${labelState(overall)}</span>
          <button class="btn-danger" onClick=${()=>resetRoom(selRoom)}>Reiniciar habitación</button>
        </div>
        <section class="card">
          <h3 style="font-size:16px;font-weight:600">Checklist</h3>
          <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));margin-top:8px">
            ${CHECKS.map(c=>{
              const r=state[selRoom]||{}; const cur=(r.items||{})[c.id]||"none"; const note=(r.itemNotes||{})[c.id]||"";
              return html`<div class="card" style="margin-top:0;padding:10px">
                <div style="font-size:14px;margin-bottom:8px">${c.label}</div>
                <div class="item-row">
                  <div>
                    ${["ok","fail","pending","none"].map(s=>html`<button class="pill" onClick=${()=>setItem(selRoom,c.id,s)} style=${pillStyle(s, s===cur)}>${s==="none"?"Borrar":labelState(s)}</button>`)}
                  </div>
                  <input class="note small" placeholder="Observación del elemento" value=${note} onInput=${e=>setItemNote(selRoom,c.id,e.target.value)} />
                </div>
              </div>`;
            })}
          </div>
        </section>
        <section class="card">
          <h3 class="section-title" style="font-size:16px;font-weight:600">Medidas para sustituciones</h3>
          <${MeasureForm} onAdd=${m=>addMeasure(selRoom,m)} />
          <ul style="margin-top:8px;padding-left:18px">
            ${(state[selRoom]?.measures||[]).map((m,idx)=>html`<li style="margin-bottom:4px">
              <span style="font-family:monospace">[${m.tipo}] ${m.medida}</span>
              ${m.detalle?html`<span> — ${m.detalle}</span>`:null}
              <button class="btn" style="margin-left:8px" onClick=${()=>delMeasure(selRoom,idx)}>Eliminar</button>
            </li>`)}
            ${(!(state[selRoom]?.measures)||state[selRoom].measures.length===0) && html`<li style="color:#64748b">Sin medidas aún.</li>`}
          </ul>
        </section>
        <section class="card">
          <h3 style="font-size:16px;font-weight:600">Observaciones</h3>
          <textarea value=${(state[selRoom]?.notes)||""} onInput=${e=>setNotes(selRoom,e.target.value)} placeholder="Detalles puntuales…" style="width:100%;min-height:90px"></textarea>
        </section>
        <section class="container" style="padding-left:0">
          <span>Estado global:</span>
          ${["ok","fail","pending","auto"].map(s=>html`<button class="pill" onClick=${()=>setOverallState(selRoom,s)} style=${pillStyle(s, s!=="auto")}>${labelState(s)}</button>`)}
        </section>
      </main>`}

      <footer class="container">v1.1 — Perfiles locales. Datos aislados por usuario.</footer>
    </div>`;
}

function ParteView({ parte }){
  const byId=id=>({A:"A",B:"B",C:"C",D:"D",V:"VILLAS"}[id]||id);
  return html`<main class="container">
    <h2 style="font-size:18px;font-weight:600">Parte de trabajo</h2>
    ${Object.entries(parte).map(([bid, entries])=>html`
      <section class="card">
        <h3 style="font-size:16px;font-weight:600">Bloque ${byId(bid)}</h3>
        ${entries.length===0 ? html`<div class="kv">Sin fallos ni por revisar.</div>` : html`
          <div>${entries.sort((a,b)=>a.room-b.room).map(e=>html`
            <div style="margin:8px 0;padding:8px;border:1px solid var(--b2);border-radius:10px">
              <div style="font-weight:700">Residencia ${e.room}</div>
              <ul style="margin:6px 0 0 18px">
                ${e.detalle.map(d=>html`<li>${d.tipo}: ${d.label}</li>`)}
              </ul>
              ${(e.measures&&e.measures.length)?html`<div class="kv" style="margin-top:6px">Medidas: ${e.measures.map(m=>`[${m.tipo}] ${m.medida}${m.detalle?` — ${m.detalle}`:""}`).join(" | ")}</div>`:null}
              ${e.notes?html`<div class="kv" style="margin-top:6px">Notas: ${e.notes}</div>`:null}
            </div>`)}
          </div>`}
      </section>`)}
  </main>`;
}

function BlockTile({ b, state, onClick }){
  const rooms=Array.from({length:b.to-b.from+1},(_,i)=>b.from+i);
  const overalls=rooms.map(n=>{ const r=state[n]; return (r && r.overall && r.overall!=="auto")? r.overall : (r?autoOverallFromRoom(r):"none"); });
  const total=rooms.length;
  const fail=overalls.filter(x=>x==="fail").length;
  const rev=overalls.filter(x=>x==="pending").length;
  const ok=overalls.filter(x=>x==="ok").length;
  const none=overalls.filter(x=>x==="none").length;
  return html`<button class="tile" onClick=${onClick}>
    <div style="width:100%">
      <div style="font-size:24px">${b.id==="V"?"🏡":"🏢"}</div>
      <div>${b.label} · ${rooms[0]}–${rooms[rooms.length-1]}</div>
      <div class="kv" style="margin-top:4px">Fallo: ${fail} · Rev: ${rev} · OK: ${ok} · Sin marcar: ${none}</div>
      <div class="progress" style="margin-top:8px">
        <div style=${`height:100%;width:${(fail/total)*100}%;background:#ef4444;float:left`}></div>
        <div style=${`height:100%;width:${(rev/total)*100}%;background:#f59e0b;float:left`}></div>
        <div style=${`height:100%;width:${(ok/total)*100}%;background:#10b981;float:left`}></div>
      </div>
    </div>
  </button>`;
}

function RoomChip({ n, overall, onClick }){
  const map={pending:"review"}; const key=map[overall]||overall;
  const COLORS_MAP={ none:"#e5e7eb", review:"#f59e0b", ok:"#10b981", fail:"#ef4444" };
  const bg=COLORS_MAP[key]||COLORS_MAP.none;
  const isNone=key==="none"; const color=isNone?"#0f172a":"#ffffff"; const border=isNone?"#cbd5e1":"transparent";
  const realBg=isNone?"#ffffff":bg;
  return html`<button class="room" onClick=${onClick} style=${`background:${realBg};color:${color};border-color:${border}`}>${n}</button>`;
}

function MeasureForm({ onAdd }){
  const [tipo,setTipo]=useState("madera");
  const [medida,setMedida]=useState(""); const [detalle,setDetalle]=useState("");
  const can=medida.trim().length>0;
  return html`<div style="display:flex;gap:6;flex-wrap:wrap">
    <select value=${tipo} onChange=${e=>setTipo(e.target.value)}>
      <option value="madera">Madera</option>
      <option value="ceramica">Cerámica</option>
      <option value="mueble">Mueble</option>
      <option value="enser">Enser</option>
      <option value="otro">Otro</option>
    </select>
    <input class="small" placeholder="Medida (ej. 60x90 cm)" value=${medida} onInput=${e=>setMedida(e.target.value)} />
    <input class="small" placeholder="Detalle opcional" value=${detalle} onInput=${e=>setDetalle(e.target.value)} />
    <button class=${can?"btn-primary":"btn-disabled"} disabled=${!can} onClick=${()=>{ onAdd({tipo,medida,detalle:detalle||undefined}); setMedida(""); setDetalle(""); }}>Añadir</button>
  </div>`;
}

/*** Auth ***/
function AuthView({ user, onReady }){
  const [alias,setAlias]=useState(""); const [pin,setPin]=useState(""); const [msg,setMsg]=useState("");
  const users=loadUsers();
  function enter(){
    const a=alias.trim(); const p=pin.trim();
    if(!a||!p){ setMsg("Alias y PIN requeridos"); return; }
    const key=a.toLowerCase(); const u=users[key]; const h=hashPIN(p);
    if(!u){
      users[key]={alias:a,pinHash:h,createdAt:new Date().toISOString()}; saveUsers(users);
      try{ const legacy=localStorage.getItem(LEGACY); if(legacy && !localStorage.getItem(nsKey(key))){ localStorage.setItem(nsKey(key), legacy); localStorage.removeItem(LEGACY);} }catch{}
      setCurrent(key); user.setAliasLower(key); onReady && onReady(); return;
    }
    if(u.pinHash!==h){ setMsg("PIN incorrecto"); return; }
    setCurrent(key); user.setAliasLower(key); onReady && onReady();
  }
  const list=Object.values(users);
  return html`<main class="container">
    <div class="auth">
      <h2 style="margin:0 0 8px 0">Acceder</h2>
      <div class="kv">Perfiles locales. Alias + PIN de 4–8 dígitos.</div>
      <div style="display:grid;gap:8px;margin-top:12px">
        <input placeholder="Alias (ej. Frank)" value=${alias} onInput=${e=>setAlias(e.target.value)} />
        <input placeholder="PIN" type="password" value=${pin} onInput=${e=>setPin(e.target.value)} />
        <button class="btn-primary" onClick=${enter}>Entrar / Crear perfil</button>
        ${msg && html`<div class="kv" style="color:#b91c1c">${msg}</div>`}
      </div>
      ${list.length>0 && html`<div style="margin-top:12px">
        <div class="kv">Perfiles existentes:</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
          ${list.map(u => html`<button class="btn" onClick=${()=>setAlias(u.alias)}>${u.alias}</button>`)}
        </div>
      </div>`}
    </div>
  </main>`;
}

function CuentaView({ user }){
  const [alias,setAlias]=useState(""); const [pin,setPin]=useState(""); const [msg,setMsg]=useState("");
  const users=loadUsers();
  function logout(){ setCurrent(null); user.setAliasLower(null); location.hash="#/auth"; }
  function delProfile(a){
    const key=a.toLowerCase();
    if(!confirm(`Eliminar perfil ${a}?`)) return;
    delete users[key]; saveUsers(users);
    if(user.aliasLower===key){ logout(); }
  }
  function create(){
    const a=alias.trim(); const p=pin.trim();
    if(!a||!p){ setMsg("Alias y PIN requeridos"); return; }
    const key=a.toLowerCase(); if(users[key]){ setMsg("Ya existe"); return; }
    users[key]={alias:a,pinHash:hashPIN(p),createdAt:new Date().toISOString()}; saveUsers(users); setMsg("Creado");
  }
  return html`<main class="container">
    <div class="card">
      <h3>Usuario actual: ${user.profile?.alias||"—"}</h3>
      <div class="kv">Cambiar o gestionar perfiles locales.</div>
      <div style="margin-top:10px">
        <button class="btn-primary" onClick=${()=>{ location.hash="#/auth"; }}>Cambiar usuario</button>
        <button class="btn" style="margin-left:8px" onClick=${logout}>Cerrar sesión</button>
      </div>
    </div>
    <div class="card">
      <h3>Perfiles</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${Object.values(loadUsers()).map(u=>html`<span class="pill">${u.alias} <button class="btn" onClick=${()=>delProfile(u.alias)} style="margin-left:8px">Eliminar</button></span>`)}
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <input class="small" placeholder="Nuevo alias" value=${alias} onInput=${e=>setAlias(e.target.value)} />
        <input class="small" placeholder="PIN" value=${pin} onInput=${e=>setPin(e.target.value)} />
        <button class="btn-primary" onClick=${create}>Crear</button>
        ${msg && html`<span class="kv">${msg}</span>`}
      </div>
    </div>
  </main>`;
}

// Montaje
render(html`<${App} />`, document.getElementById("app"));
