
// Watchdog + overlay de errores
const boot = { mounted:false };
const bootMsg = document.getElementById('boot-msg');
const overlay = document.getElementById('error-overlay');
const errlog = document.getElementById('errlog');
function showError(e){
  if (errlog) errlog.textContent = (e && (e.stack||e.message||e.toString())) || String(e);
  if (overlay) overlay.style.display = 'block';
  if (bootMsg) bootMsg.style.display = 'none';
}
window.addEventListener('error', ev => showError(ev.error||ev.message));
window.addEventListener('unhandledrejection', ev => showError(ev.reason||ev));
setTimeout(()=>{ if (!boot.mounted) showError(new Error('Timeout cargando módulos/CDN.')); }, 6000);

// Import dinámico con fallback de CDNs (sin eval)
async function importWithFallback(urls){
  let lastErr;
  for (const u of urls){
    try{ return await import(/* @vite-ignore */ u); }
    catch(e){ lastErr = e; }
  }
  throw lastErr || new Error('No se pudo importar módulos');
}
const PREACT_URLS = [
  'https://esm.sh/preact@10.22.0',
  'https://cdn.jsdelivr.net/npm/preact@10.22.0/dist/preact.module.js',
  'https://unpkg.com/preact@10.22.0/dist/preact.module.js'
];
const HOOKS_URLS = [
  'https://esm.sh/preact@10.22.0/hooks',
  'https://cdn.jsdelivr.net/npm/preact@10.22.0/hooks/dist/hooks.module.js',
  'https://unpkg.com/preact@10.22.0/hooks/dist/hooks.module.js'
];
const [{ h, render }, hooks] = await Promise.all([
  importWithFallback(PREACT_URLS),
  importWithFallback(HOOKS_URLS)
]);
const { useState, useEffect, useMemo, useRef } = hooks;

// --- App data ---
const GLOBAL_LS = { users:"mh_users_v1", current:"mh_user_current_v1" };
const LEGACY = "mh_v1_state";
const APP_VERSION = "v1.3.2-local-csp-safe";

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
const labelState = s => s==="ok"?"OK":s==="fail"?"Fallo":s==="pending"?"Por revisar":s==="auto"?"Auto":"—";
const COLORS = { none:"#e5e7eb", review:"#f59e0b", ok:"#10b981", fail:"#ef4444", dark:"#0f172a", white:"#ffffff", border:"#cbd5e1" };
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
  if (!hasFail && !hasPend && (anyItemNote || anyRoomNote)) return "fail";
  if (hasPend) return "pending";
  if (vals.length===0) return room?.assumeOk ? "ok" : "none";
  return "ok";
}

// Storage helpers
const loadUsers = () => { try{ return JSON.parse(localStorage.getItem(GLOBAL_LS.users)||"{}"); }catch{return {}} };
const saveUsers = u => { try{ localStorage.setItem(GLOBAL_LS.users, JSON.stringify(u)); }catch{} };
const loadCurrent = () => localStorage.getItem(GLOBAL_LS.current)||null;
const setCurrent = a => a?localStorage.setItem(GLOBAL_LS.current,a):localStorage.removeItem(GLOBAL_LS.current);

function useUser(){
  const [aliasLower,setAliasLower]=useState(loadCurrent());
  const [users,setUsers]=useState(loadUsers());
  useEffect(()=>{ setUsers(loadUsers()); },[aliasLower]);
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

// Routing
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
};

// UI helpers
function pill(styleSel){ return styleSel ? {background:'#0a4077',color:'#fff',borderColor:'#0a4077'} : {}; }
function pillState(type, selected){
  const t=(type==="review"?"pending":type);
  let bg="#334155";
  if(t==="ok") bg=COLORS.ok; else if(t==="fail") bg=COLORS.fail; else if(t==="pending") bg=COLORS.review;
  return selected ? {background:bg,color:"#fff",borderColor:bg} : {background:"#fff",color:bg,border:`1px solid ${bg}`};
}

// Components
function Header({ page, selBlock, selRoom, goPlan, goBlock, goParte, goCuenta, user }){
  const actions = [];
  if (page==="parte"){
    actions.push(h('button',{onClick:goPlan},'← Plano'));
  } else if (selRoom!=null){
    actions.push(h('button',{onClick:()=>goBlock(selBlock)},'← Residencias'));
  } else if (selBlock){
    actions.push(h('button',{onClick:goPlan},'← Plano'));
  }
  actions.push(h('button',{onClick:goParte},'Parte'));
  actions.push(h('button',{onClick:goCuenta}, user?.profile?`Usuario: ${user.profile.alias}`:'Acceder'));
  return h('header',{style:{maxWidth:'1100px',margin:'0 auto',padding:'12px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}},
    h('h1',{style:{fontSize:'22px',margin:0}},'Mantenimiento Hotel · Residences'),
    h('div',{style:{display:'flex',gap:'8px',alignItems:'center'}}, actions)
  );
}

function MeasureForm({ onAdd }){
  const [tipo,setTipo]=useState('madera');
  const [medida,setMedida]=useState('');
  const [detalle,setDetalle]=useState('');
  const can = (medida.trim().length>0);
  return h('div',{style:{display:'flex',gap:'6px',flexWrap:'wrap'}},
    h('select',{value:tipo,onChange:e=>setTipo(e.target.value)},
      ['madera','ceramica','mueble','enser','otro'].map(v=>h('option',{value:v},v[0].toUpperCase()+v.slice(1)))
    ),
    h('input',{placeholder:'Medida (ej. 60x90 cm)',value:medida,onInput:e=>setMedida(e.target.value)}),
    h('input',{placeholder:'Detalle opcional',value:detalle,onInput:e=>setDetalle(e.target.value)}),
    h('button',{disabled:!can,onClick:()=>{onAdd({tipo,medida,detalle:detalle||undefined});setMedida('');setDetalle('');}},'Añadir')
  );
}

function BlockTile({ b, state, onClick }){
  const rooms=Array.from({length:b.to-b.from+1},(_,i)=>b.from+i);
  const overalls=rooms.map(n=>{ const r=state[n]; return (r && r.overall && r.overall!=="auto")? r.overall : (r?autoOverallFromRoom(r):"none"); });
  const total=rooms.length;
  const fail=overalls.filter(x=>x==="fail").length;
  const rev=overalls.filter(x=>x==="pending").length;
  const ok=overalls.filter(x=>x==="ok").length;
  const none=overalls.filter(x=>x==="none").length;
  return h('button',{onClick,style:{minHeight:'140px',border:'1px solid #cbd5e1',borderRadius:'16px',padding:'16px',background:'#fff',width:'100%'}},
    h('div',{style:{width:'100%'}},
      h('div',{style:{fontSize:'24px'}}, b.id==='V'?'🏡':'🏢'),
      h('div',null, `${b.label} · ${rooms[0]}–${rooms[rooms.length-1]}`),
      h('div',{style:{fontSize:'12px',color:'#475569',marginTop:'4px'}}, `Fallo: ${fail} · Rev: ${rev} · OK: ${ok} · Sin marcar: ${none}`),
      h('div',{style:{height:'8px',borderRadius:'6px',background:'#e5e7eb',border:'1px solid #cbd5e1',marginTop:'8px',overflow:'hidden'}},
        h('div',{style:{height:'100%',width:`${(fail/total)*100}%`,background:'#ef4444',float:'left'}}),
        h('div',{style:{height:'100%',width:`${(rev/total)*100}%`,background:'#f59e0b',float:'left'}}),
        h('div',{style:{height:'100%',width:`${(ok/total)*100}%`,background:'#10b981',float:'left'}})
      )
    )
  );
}

function RoomChip({ n, overall, onClick }){
  const key = (overall==='pending'?'review':overall);
  const COLORS_MAP={ none:"#e5e7eb", review:"#f59e0b", ok:"#10b981", fail:"#ef4444" };
  const bg=COLORS_MAP[key]||COLORS_MAP.none;
  const isNone=key==="none";
  const color=isNone?"#0f172a":"#ffffff";
  const border=isNone?"#cbd5e1":"transparent";
  const realBg=isNone?"#ffffff":bg;
  return h('button',{onClick,style:{background:realBg,color,border:`1px solid ${border}`,borderRadius:'10px',padding:'10px 12px',fontWeight:700}}, String(n));
}

function ParteView({ parte, onPrint, onCSV }){
  const byId=id=>({A:"A",B:"B",C:"C",D:"D",V:"VILLAS"}[id]||id);
  return h('main',{style:{maxWidth:'1100px',margin:'0 auto',padding:'12px'}},
    h('div',{style:{display:'flex',gap:'8px',alignItems:'center',justifyContent:'space-between'}},
      h('h2',{style:{fontSize:'18px',fontWeight:600}},'Parte de trabajo'),
      h('div',null,
        h('button',{onClick:onPrint},'Imprimir'),
        ' ',
        h('button',{onClick:onCSV},'Exportar CSV')
      )
    ),
    ...Object.entries(parte).map(([bid,entries])=>
      h('section',{style:{background:'#fff',border:'1px solid #cbd5e1',borderRadius:'12px',padding:'12px',marginTop:'12px'}},
        h('h3',{style:{fontSize:'16px',fontWeight:600}},`Bloque ${byId(bid)}`),
        entries.length===0 ? h('div',{style:{fontSize:'12px',color:'#475569'}},'Sin fallos ni por revisar.') :
        h('div',null, ...entries.sort((a,b)=>a.room-b.room).map(e=>
          h('div',{style:{margin:'8px 0',padding:'8px',border:'1px solid #e2e8f0',borderRadius:'10px'}},
            h('div',{style:{fontWeight:700}},`Residencia ${e.room}`),
            h('ul',{style:{margin:'6px 0 0 18px'}},
              ...e.detalle.map(d=>h('li',null,`${d.tipo}: ${d.label}`))
            ),
            (e.measures&&e.measures.length)?h('div',{style:{fontSize:'12px',color:'#475569',marginTop:'6px'}},`Medidas: ${e.measures.map(m=>`[${m.tipo}] ${m.medida}${m.detalle?` — ${m.detalle}`:""}`).join(" | ")}`):null,
            e.notes? h('div',{style:{fontSize:'12px',color:'#475569',marginTop:'6px'}},`Notas: ${e.notes}`): null
          )
        ))
      )
    )
  );
}

function AuthView({ user, onReady }){
  const [alias,setAlias]=useState(''); const [pin,setPin]=useState(''); const [msg,setMsg]=useState('');
  const users=loadUsers();
  function enter(){
    const a=alias.trim(); const p=pin.trim();
    if(!a||!p){ setMsg('Alias y PIN requeridos'); return; }
    const key=a.toLowerCase(); const u=users[key]; const hsh=hashPIN(p);
    if(!u){
      users[key]={alias:a,pinHash:hsh,createdAt:new Date().toISOString()}; saveUsers(users);
      try{ const legacy=localStorage.getItem(LEGACY); if(legacy && !localStorage.getItem(nsKey(key))){ localStorage.setItem(nsKey(key), legacy); localStorage.removeItem(LEGACY);} }catch{}
      setCurrent(key); user.setAliasLower(key); onReady && onReady(); return;
    }
    if(u.pinHash!==hsh){ setMsg('PIN incorrecto'); return; }
    setCurrent(key); user.setAliasLower(key); onReady && onReady();
  }
  return h('main',{style:{maxWidth:'1100px',margin:'0 auto',padding:'12px'}},
    h('div',{style:{maxWidth:'440px',margin:'64px auto',background:'#fff',border:'1px solid #cbd5e1',borderRadius:'14px',padding:'16px'}},
      h('h2',{style:{margin:'0 0 8px 0'}},'Acceder'),
      h('div',{style:{fontSize:'12px',color:'#475569'}},'Perfiles locales. Alias + PIN de 4–8 dígitos.'),
      h('div',{style:{display:'grid',gap:'8px',marginTop:'12px'}},
        h('input',{placeholder:'Alias (ej. Frank)',value:alias,onInput:e=>setAlias(e.target.value)}),
        h('input',{placeholder:'PIN',type:'password',value:pin,onInput:e=>setPin(e.target.value)}),
        h('button',{onClick:enter},'Entrar / Crear perfil'),
        msg && h('div',{style:{color:'#b91c1c'}},msg)
      ),
      Object.values(users).length>0 && h('div',{style:{marginTop:'12px'}},
        h('div',{style:{fontSize:'12px',color:'#475569'}},'Perfiles existentes:'),
        h('div',{style:{display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'6px'}},
          ...Object.values(users).map(u=>h('button',{onClick:()=>setAlias(u.alias)},u.alias))
        )
      )
    )
  );
}

function CuentaView({ user, onExport, onImport }){
  const fileRef = useRef(null);
  function logout(){ setCurrent(null); user.setAliasLower(null); location.hash="#/auth"; }
  function delProfile(a){
    const users=loadUsers();
    const key=a.toLowerCase();
    if(!confirm(`Eliminar perfil ${a}?`)) return;
    delete users[key]; saveUsers(users);
    if(user.aliasLower===key){ logout(); }
  }
  return h('main',{style:{maxWidth:'1100px',margin:'0 auto',padding:'12px'}},
    h('div',{style:{background:'#fff',border:'1px solid #cbd5e1',borderRadius:'12px',padding:'12px'}},
      h('h3',null,`Usuario actual: ${user.profile?.alias||"—"}`),
      h('div',{style:{fontSize:'12px',color:'#475569'}},'Gestiona perfiles, copia de seguridad y migración.'),
      h('div',{style:{marginTop:'10px',display:'flex',gap:'8px',flexWrap:'wrap'}},
        h('button',{onClick:()=>{ location.hash="#/auth"; }},'Cambiar usuario'),
        h('button',{onClick:logout},'Cerrar sesión'),
        h('button',{onClick:onExport},'Exportar datos (.mhjson)'),
        h('input',{type:'file',accept:'.mhjson,application/json',style:{display:'none'},ref:fileRef,onChange:e=>{ const f=e.target.files?.[0]; if(f) onImport(f); }}),
        h('button',{onClick:()=>fileRef.current && fileRef.current.click()},'Importar datos')
      )
    ),
    h('div',{style:{background:'#fff',border:'1px solid #cbd5e1',borderRadius:'12px',padding:'12px',marginTop:'12px'}},
      h('h3',null,'Perfiles'),
      h('div',{style:{display:'flex',gap:'8px',flexWrap:'wrap'}},
        ...Object.values(loadUsers()).map(u=>h('span',{style:{border:'1px solid #e2e8f0',borderRadius:'999px',padding:'6px 10px'}},u.alias,' ',h('button',{onClick:()=>delProfile(u.alias),style:{marginLeft:'8px'}},'Eliminar')))
      )
    )
  );
}

function IncidenciasView({ selRoom, state, setItem, setItemNote, addIncidencia, quitarIncidencia }){
  function visibleItemsFor(room){
    const r = state[room] || {};
    const items = r.items || {};
    return Object.keys(items).filter(k => items[k]==="fail" || items[k]==="pending");
  }
  function remainingItemsFor(room){
    const visible = new Set(visibleItemsFor(room));
    return CHECKS.filter(c => !visible.has(c.id));
  }
  const visibles = visibleItemsFor(selRoom);
  const remaining = remainingItemsFor(selRoom);
  const [sel,setSel] = useState(remaining[0]?.id||"");
  return h('section',{style:{background:'#fff',border:'1px solid #cbd5e1',borderRadius:'12px',padding:'12px',marginTop:'12px'}},
    h('h3',{style:{fontSize:'16px',fontWeight:600,display:'flex',justifyContent:'space-between',alignItems:'center'}},
      h('span',null,'Incidencias'),
      h('span',null,
        h('select',{value:sel||"",onChange:e=>setSel(e.target.value)},
          ...(remaining.length?remaining:[{id:"",label:"(Sin puntos disponibles)"}]).map(c=>h('option',{value:c.id},c.label))
        ),
        ' ',
        h('button',{onClick:()=>sel && addIncidencia(selRoom, sel),disabled:!remaining.length},'Añadir punto')
      )
    ),
    h('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:'12px',marginTop:'8px'}},
      ...visibles.map(id=>{
        const c = CHECKS.find(x=>x.id===id) || {label:id};
        const r=state[selRoom]||{}; const cur=(r.items||{})[id]||"none"; const note=(r.itemNotes||{})[id]||"";
        return h('div',{style:{border:'1px solid #cbd5e1',borderRadius:'12px',padding:'10px'}},
          h('div',{style:{display:'flex',alignItems:'center',gap:'8px',justifyContent:'space-between'}},
            h('div',{style:{fontSize:'14px'}},c.label),
            h('button',{onClick:()=>quitarIncidencia(selRoom,id)},'Quitar')
          ),
          h('div',{style:{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',marginTop:'8px'}},
            h('div',null,
              h('button',{onClick:()=>setItem(selRoom,id,'fail'),style:pillState('fail',cur==='fail')},labelState('fail')),' ',
              h('button',{onClick:()=>setItem(selRoom,id,'pending'),style:pillState('pending',cur==='pending')},labelState('pending'))
            ),
            h('input',{placeholder:'Observación del elemento',value:note,onInput:e=>setItemNote(selRoom,id,e.target.value)})
          )
        );
      }),
      visibles.length===0 && h('div',{style:{color:'#64748b'}},'Sin incidencias añadidas.')
    )
  );
}

function App(){
  const user = useUser();
  const [page,setPage]=useState('plan');
  const [selBlock,setSelBlockState]=useState(null);
  const [selRoom,setSelRoomState]=useState(null);
  const [filter,setFilter]=useState('');
  const [statusFilter,setStatusFilter]=useState('all');
  const [state,setState]=usePersistByUser(user.aliasLower);

  useEffect(()=>{
    const apply=()=>{
      const {page,block,room}=parseHash();
      setPage(user.profile? page : 'auth');
      if (page==='plan' && user.profile){
        if (!block){ setSelBlockState(null); setSelRoomState(null); return; }
        const b=BLOQUES.find(x=>x.id===block);
        setSelBlockState(b||null); setSelRoomState(room||null);
      } else { setSelBlockState(null); setSelRoomState(null); }
    };
    window.addEventListener('hashchange',apply); apply();
    return ()=>window.removeEventListener('hashchange',apply);
  },[user.aliasLower,user.profile]);

  useEffect(()=>{ boot.mounted = true; if (bootMsg) bootMsg.style.display='none'; },[]);

  const goPlan=()=>setRouteTo(null,null);
  const goBlock=b=>{ setStatusFilter('all'); setFilter(''); setRouteTo(b.id,null); };
  const goRoom=n=>setRouteTo(selBlock.id,n);
  const goParte=()=>setRouteTo('parte');
  const goCuenta=()=>setRouteTo('cuenta');

  const roomState = state[selRoom] || { items:{}, itemNotes:{}, notes:"", measures:[], overall:"none", assumeOk:false };
  const autoOverall = useMemo(()=>autoOverallFromRoom(roomState),[selRoom,state]);
  const overall = roomState.overall && roomState.overall!=="auto" ? roomState.overall : autoOverall;

  function setItem(room,itemId,value){
    setState(prev=>({...prev,[room]:{...((prev[room])||{items:{},itemNotes:{},notes:"",measures:[],assumeOk:false,overall:"auto"}),items:{...(prev[room]?.items||{}),[itemId]:value}}}));
  }
  function setItemNote(room,itemId,text){
    setState(prev=>({...prev,[room]:{...((prev[room])||{items:{},itemNotes:{},notes:"",measures:[],assumeOk:false,overall:"auto"}),itemNotes:{...(prev[room]?.itemNotes||{}),[itemId]:text}}}));
  }
  const setOverallState=(room,value)=>setState(prev=>({...prev,[room]:{...(prev[room]||{items:{},itemNotes:{},notes:"",measures:[],assumeOk:false}),overall:value}}));
  const setNotes=(room,value)=>setState(prev=>({...prev,[room]:{...(prev[room]||{items:{},itemNotes:{},measures:[]}),notes:value,overall:prev[room]?.overall||'auto'}}));
  const addMeasure=(room,m)=>setState(prev=>({...prev,[room]:{...(prev[room]||{items:{},itemNotes:{},notes:""}),measures:[...(prev[room]?.measures||[]),m],overall:prev[room]?.overall||'auto'}}));
  const delMeasure=(room,idx)=>setState(prev=>({...prev,[room]:{...(prev[room]||{items:{},itemNotes:{},notes:""}),measures:(prev[room]?.measures||[]).filter((_,i)=>i!==idx)}}));
  const resetRoom=(room)=>setState(prev=>({...prev,[room]:{items:{},itemNotes:{},notes:"",measures:[],overall:'auto',assumeOk:false}}));
  const toggleAssumeOk=(room)=>setState(prev=>({...prev,[room]:{...(prev[room]||{items:{},itemNotes:{},notes:"",measures:[]}),assumeOk:!(prev[room]?.assumeOk)}}));

  function addIncidencia(room,id){
    if(!id) return;
    setState(prev=>({...prev,[room]:{...(prev[room]||{items:{},itemNotes:{},notes:"",measures:[],assumeOk:false,overall:'auto'}),items:{...(prev[room]?.items||{}),[id]:'pending'}}}));
  }
  function quitarIncidencia(room,id){
    setState(prev=>({...prev,[room]:{...(prev[room]||{items:{},itemNotes:{},notes:"",measures:[],assumeOk:false,overall:'auto'}),items:{...(prev[room]?.items||{},[id]:'none')}}}));
  }

  const parte = useMemo(()=>{
    const byBlock={};
    for (const b of BLOQUES){
      const rooms=Array.from({length:b.to-b.from+1},(_,i)=>b.from+i);
      const entries=[];
      for (const n of rooms){
        const r=state[n]||{}; const items=r.items||{}; const itemNotes=r.itemNotes||{};
        const fails=Object.entries(items).filter(([,v])=>v==='fail');
        const revs=Object.entries(items).filter(([,v])=>v==='pending');
        const detalle=[];
        for (const [k] of fails){ const lab=(CHECKS.find(c=>c.id===k)||{}).label||k; const note=(itemNotes[k]||"").trim(); detalle.push({tipo:'Fallo',item:k,label:lab+(note?` — obs: ${note}`:"")}); }
        for (const [k] of revs){ const lab=(CHECKS.find(c=>c.id===k)||{}).label||k; const note=(itemNotes[k]||"").trim(); detalle.push({tipo:'Por revisar',item:k,label:lab+(note?` — obs: ${note}`:"")}); }
        const roomNote=(r.notes||"").trim();
        const anyItemNoteOnly=Object.entries(itemNotes).some(([k,v])=>(v||"").trim().length>0 && (!items[k]||items[k]==='none'||items[k]==='ok'));
        if (detalle.length===0 && (roomNote || anyItemNoteOnly)){
          if (anyItemNoteOnly){
            for (const [k,v] of Object.entries(itemNotes)){
              const note=(v||"").trim(); if(!note) continue; const status=items[k];
              if (!status||status==='none'||status==='ok'){ const lab=(CHECKS.find(c=>c.id===k)||{}).label||k; detalle.push({tipo:'Fallo',item:k,label:`${lab} — obs: ${note}`}); }
            }
          }
          if (roomNote){ detalle.push({tipo:'Fallo',item:'observacion_general',label:`Observación general — ${roomNote}`}); }
        }
        if (detalle.length){ entries.push({room:n,detalle,measures:(r.measures||[]),notes:roomNote}); }
      }
      byBlock[b.id]=entries;
    }
    return byBlock;
  },[state]);

  function exportCSV(){
    const rows=[["Usuario","Bloque","Residencia","Tipo","Elemento","Detalle","Medidas","Notas"]];
    const alias=user.profile?.alias||'anon';
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
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}); const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=`parte_${alias}_${nowISO().replace(/[: ]/g,'-')}.csv`; document.body.appendChild(a); a.click(); a.remove();
  }

  if (!user.profile || page==='auth'){
    return h(AuthView,{user,onReady:()=>{ setRouteTo(null,null); }});
  }

  const blockRooms = useMemo(()=>{
    if(!selBlock) return [];
    const b=BLOQUES.find(x=>x.id===selBlock.id);
    return Array.from({length:b.to-b.from+1},(_,i)=>b.from+i);
  },[selBlock]);

  const filteredRooms = useMemo(()=>{
    if (!selBlock) return [];
    const rooms = blockRooms.filter(n=>n.toString().includes(filter.trim()));
    if (statusFilter==='all') return rooms;
    return rooms.filter(n=>{
      const r=state[n]||{}; const o=(r.overall && r.overall!=='auto')? r.overall : autoOverallFromRoom(r);
      return o===statusFilter;
    });
  },[blockRooms, filter, statusFilter, state, selBlock]);

  return h('div',null,
    h(Header,{page,selBlock,selRoom,goPlan,goBlock,goParte,goCuenta,user}),
    page==='cuenta' && h(CuentaView,{user,
      onExport:()=>{
        const alias=user.profile?.alias||'anon';
        const data = localStorage.getItem(nsKey(user.aliasLower)) || "{}";
        const payload = { type:"mh-profile", version:APP_VERSION, alias, storedAt: new Date().toISOString(), data: JSON.parse(data) };
        const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
        const a=document.createElement('a');
        a.href=URL.createObjectURL(blob); a.download=`mh-${alias}-${nowISO().replace(/[: ]/g,'-')}.mhjson`; document.body.appendChild(a); a.click(); a.remove();
      },
      onImport:(file)=>{
        const fr=new FileReader();
        fr.onload=()=>{
          try{
            const payload=JSON.parse(fr.result);
            if (!payload || !payload.data){ alert("Archivo inválido"); return; }
            localStorage.setItem(nsKey(user.aliasLower), JSON.stringify(payload.data));
            location.reload();
          }catch(e){ alert("No se pudo importar"); }
        };
        fr.readAsText(file);
      }
    }),
    page==='parte' && h(ParteView,{parte,onPrint:()=>window.print(),onCSV:exportCSV}),

    page!=='parte' && page!=='cuenta' && !selBlock &&
      h('main',{style:{maxWidth:'1100px',margin:'0 auto',padding:'12px'}},
        h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}},
          ...BLOQUES.map(b=>h(BlockTile,{b,state,onClick:()=>goBlock(b)}))
        ),
        h('p',{style:{marginTop:'10px',fontSize:'12px',color:'#475569'}},`Usuario: ${user.profile.alias}. Pulsa un bloque para ver sus residencias.`)
      ),

    page!=='parte' && page!=='cuenta' && selBlock && selRoom==null &&
      h('main',{style:{maxWidth:'1100px',margin:'0 auto',padding:'12px'}},
        h('h2',{style:{marginTop:'8px',fontSize:'18px',fontWeight:600}},`Bloque ${selBlock.label}`),
        h('div',{style:{display:'flex',gap:'8px',flexWrap:'wrap',margin:'8px 0'}},
          h('input',{placeholder:'Filtrar número…',value:filter,onInput:e=>setFilter(e.target.value)}),
          ...['all','fail','pending','ok','none'].map(s=>h('button',{onClick:()=>setStatusFilter(s),style: s===statusFilter?{background:'#0a4077',color:'#fff',borderRadius:'999px',padding:'6px 10px'}:{border:'1px solid #cbd5e1',borderRadius:'999px',padding:'6px 10px',background:'#fff'}},s))
        ),
        h('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:'10px',marginTop:'12px'}},
          ...filteredRooms.map(n=>{
            const r=state[n]||{}; const overall=(r.overall && r.overall!=='auto')? r.overall : autoOverallFromRoom(r);
            return h(RoomChip,{n,overall,onClick:()=>goRoom(n)});
          })
        )
      ),

    page!=='parte' && page!=='cuenta' && selRoom!=null &&
      h('main',{style:{maxWidth:'1100px',margin:'0 auto',padding:'12px'}},
        h('div',{style:{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}},
          h('h2',{style:{fontSize:'18px',fontWeight:600}},`Residencia ${selRoom}`),
          h('span',{style:{marginLeft:'auto',background:overall==='auto'?'#334155':(overall==='ok'?COLORS.ok:overall==='fail'?COLORS.fail:overall==='pending'?COLORS.review:COLORS.none),color:'#fff',borderRadius:'999px',padding:'4px 8px'}},labelState(overall)),
          h('button',{onClick:()=>toggleAssumeOk(selRoom)}, roomState.assumeOk ? 'Asumir resto OK: Sí' : 'Asumir resto OK: No'),
          h('button',{onClick:()=>resetRoom(selRoom)}, 'Reiniciar habitación')
        ),
        h(IncidenciasView,{selRoom,state,setItem,setItemNote,addIncidencia,quitarIncidencia}),
        h('section',{style:{background:'#fff',border:'1px solid #cbd5e1',borderRadius:'12px',padding:'12px',marginTop:'12px'}},
          h('h3',{style:{fontSize:'16px',fontWeight:600}},'Medidas para sustituciones'),
          h(MeasureForm,{onAdd:(m)=>addMeasure(selRoom,m)}),
          h('ul',{style:{marginTop:'8px',paddingLeft:'18px'}},
            ...((state[selRoom]?.measures||[]).map((m,idx)=>h('li',{style:{marginBottom:'4px'}},
              h('span',{style:{fontFamily:'monospace'}},`[${m.tipo}] ${m.medida}`),
              m.detalle? h('span',null,` — ${m.detalle}`): null,
              h('button',{style:{marginLeft:'8px'},onClick:()=>delMeasure(selRoom,idx)},'Eliminar')
            ))),
            (!state[selRoom]?.measures || state[selRoom].measures.length===0) && h('li',{style:{color:'#64748b'}},'Sin medidas aún.')
          )
        ),
        h('section',{style:{background:'#fff',border:'1px solid #cbd5e1',borderRadius:'12px',padding:'12px',marginTop:'12px'}},
          h('h3',{style:{fontSize:'16px',fontWeight:600}},'Observaciones'),
          h('textarea',{value:(state[selRoom]?.notes)||'',onInput:e=>setNotes(selRoom,e.target.value),placeholder:'Detalles puntuales…',style:{width:'100%',minHeight:'90px'}})
        ),
        h('footer',{style:{color:'#64748b',fontSize:'12px',padding:'12px 0'}}, APP_VERSION)
      )
  );
}

// Mount
render(h(App), document.getElementById('app'));
