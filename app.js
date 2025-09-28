(function(){
  // --- Global Utils & Safe Boot ---
  
  var overlay = document.getElementById('error-overlay');
  var errlog = document.getElementById('errlog');
  var reloadBtn = document.getElementById('reload-btn');
  if (reloadBtn) reloadBtn.addEventListener('click', function(){ location.reload(); });
  
  function showError(e){
    try{
      if (overlay) overlay.classList.remove('hidden');
      var message = (e && (e.stack||e.message||e.toString())) || String(e);
      if (errlog) errlog.textContent = message;
      console.error("Application Error:", message);
      // Notificación al usuario si es un error crítico.
      if (!overlay.classList.contains('hidden')) {
          alert("Error crítico en la aplicación. Revisa la consola o recarga.\n" + message.substring(0, 100));
      }
    }catch(_){}
  }
  window.addEventListener('error', function(ev){ showError(ev.error||ev.message); });
  window.addEventListener('unhandledrejection', function(ev){ showError(ev.reason||ev); });

  // --- Constantes & Datos Base ---
  
  var GLOBAL_LS = { users:"mh_users_v1", current:"mh_user_current_v1" };
  var NS_PREFIX = "mh_v1_";
  var APP_VERSION = "v1.5.0-mejorado";
  var SOLVED_WINDOW_MS = 48*60*60*1000; // 48h
  var DATE_FMT_OPTS = { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' };
  
  var BLOQUES = [
    { id: "A", label: "A", from: 2100, to: 2107 },
    { id: "B", label: "B", from: 2200, to: 2207 },
    { id: "C", label: "C", from: 2300, to: 2307 },
    { id: "D", label: "D", from: 2400, to: 2401 },
    { id: "V", label: "VILLAS", from: 3101, to: 3106 },
  ];
  var CHECKS = [
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
  var COLORS = { none:"#e5e7eb", review:"#f59e0b", ok:"#10b981", fail:"#ef4444", dark:"#0f172a", white:"#ffffff", border:"#cbd5e1" };

  // --- Funciones de Utilidad ---
  
  function labelState(s){ return s==="ok"?"OK":s==="fail"?"Fallo":s==="pending"?"Por revisar":s==="auto"?"Auto":"—"; }
  function nsKey(a){ return NS_PREFIX+a+"_state"; }
  function hashPIN(pin){ var h=5381; for (var i=0;i<pin.length;i++){ h=((h<<5)+h)+pin.charCodeAt(i); h|=0; } return "h"+(h>>>0).toString(16); } // Hashing sencillo sin salt
  function nowISO(){ var d=new Date(); function p(n){return String(n).padStart(2,"0");} return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+" "+p(d.getHours())+":"+p(d.getMinutes()); }
  function fmtFullDate(dt){ return new Date(dt).toLocaleString(undefined, DATE_FMT_OPTS); }
  function fmtHHMM(dt){ var d=new Date(dt); var h=String(d.getHours()).padStart(2,'0'); var m=String(d.getMinutes()).padStart(2,'0'); return h+":"+m; }

  function autoOverallFromRoom(room){
    var items = (room&&room.items)||{};
    var vals = Object.keys(items).map(function(k){return items[k]}).filter(function(v){return v!=="none"});
    var hasFail = vals.indexOf("fail")>=0;
    var hasPend = vals.indexOf("pending")>=0;
    var anyItemNote = room&&room.itemNotes && Object.keys(room.itemNotes).some(function(k){ return (room.itemNotes[k]||"").trim().length>0; });
    var anyRoomNote = room && (room.notes||"").trim().length>0;
    
    // Si hay un fallo directo, es fallo.
    if (hasFail) return "fail";
    // Si no hay fallos directos pero hay notas que no se han resuelto o no tienen estado, también se marca como fallo para revisión.
    if (!hasFail && !hasPend && (anyItemNote || anyRoomNote)) {
         var itemNoteIsFailure = Object.keys(room.itemNotes||{}).some(function(k){ 
            var v=(room.itemNotes[k]||"").trim(); 
            var st=(room.items||{})[k];
            // La nota es una falla si está presente Y el estado NO es 'ok' o 'pending' (ya incluido arriba)
            return v.length>0 && (!st || st==='none'); 
        });
        if (itemNoteIsFailure || anyRoomNote) return "fail";
    }
    // Si hay algo pendiente de revisar, es pendiente.
    if (hasPend) return "pending";
    // Si no hay nada de lo anterior
    if (vals.length===0) return room&&room.assumeOk ? "ok" : "none";
    
    return "ok";
  }

  function blockOfRoom(n){
    for (var i=0;i<BLOQUES.length;i++){
      var b=BLOQUES[i]; if (n>=b.from && n<=b.to) return b.id;
    }
    return null;
  }
  function checkById(id){ for (var i=0;i<CHECKS.length;i++){ if(CHECKS[i].id===id) return CHECKS[i]; } return null; }

  // --- State Management & Persistence (Modelo Mejorado) ---
  
  var _state = {
    page: "plan",
    selBlock: null,
    selRoom: null,
    filter: "",
    statusFilter: "all",
    users: {},
    aliasLower: null,
    dataByUser: {}
  };
  var _listeners = [];
  
  function loadInitialState(){
    try{
        _state.users = JSON.parse(localStorage.getItem(GLOBAL_LS.users)||"{}");
        _state.aliasLower = localStorage.getItem(GLOBAL_LS.current)||null;
    }catch(e){
        console.error("Error al cargar usuarios o usuario actual:", e);
        _state.users = {};
        _state.aliasLower = null;
    }
  }
  loadInitialState(); // Carga inicial

  function saveUsers(u){ 
    try{ localStorage.setItem(GLOBAL_LS.users, JSON.stringify(u)); }
    catch(e){ console.error("Error al guardar usuarios:", e); alert("Error al guardar perfiles de usuario. Memoria llena o permisos denegados."); }
  }
  function setCurrent(a){ 
    try{ 
        if(a) localStorage.setItem(GLOBAL_LS.current,a); 
        else localStorage.removeItem(GLOBAL_LS.current); 
    }
    catch(e){ console.error("Error al guardar usuario actual:", e); alert("Error al guardar usuario actual."); }
  }

  function getUserProfile(){ return _state.aliasLower ? _state.users[_state.aliasLower] : null; }
  
  function getUserData(){
    var k=_state.aliasLower; if(!k) return {};
    if(!_state.dataByUser[k]){
      try{
        var s=localStorage.getItem(nsKey(k));
        _state.dataByUser[k]= s? JSON.parse(s): {};
      }catch(e){ 
        console.error("Error al cargar datos del usuario " + k + ":", e);
        _state.dataByUser[k]={}; 
      }
      if (!_state.dataByUser[k]._jobs) _state.dataByUser[k]._jobs=[];
    }
    if (!_state.dataByUser[k]._jobs) _state.dataByUser[k]._jobs=[];
    return _state.dataByUser[k];
  }
  
  // Función centralizada para mutar el estado de los datos del usuario
  function setUserData(updater){
    var k=_state.aliasLower; if(!k) return;
    var cur = getUserData();
    var next = updater(cur);
    if (!next._jobs) next._jobs = cur._jobs||[];
    
    // Asignar el nuevo objeto sin mutar el array de datos
    _state.dataByUser[k]=Object.assign({}, next); 
    
    try{ 
        localStorage.setItem(nsKey(k), JSON.stringify(_state.dataByUser[k])); 
    }catch(e){
        console.error("Error al guardar datos del usuario " + k + ":", e);
        alert("Error al guardar datos. La memoria local podría estar llena o dañada.");
        // Revertir a los datos previos si el guardado falla
        _state.dataByUser[k]=cur; 
    }
    notifyStateChange();
  }

  // Jobs helpers
  function genId(){ return 'j'+Math.random().toString(36).slice(2)+Date.now().toString(36); }
  function jobs(){ return (getUserData()._jobs)||[]; }
  function pushJob(job){
    setUserData(function(s){
      // Previene mutación. Usa slice() para clonar el array.
      var arr = (s._jobs||[]).slice(); arr.push(job); 
      return Object.assign({}, s, {_jobs:arr});
    });
  }
  function logJob(opts){
    var alias=(getUserProfile()&&getUserProfile().alias)||'anon';
    var j = {
      id: genId(),
      ts: new Date().toISOString(), // Usar ISO string para consistencia UTC
      alias: alias,
      bloque: blockOfRoom(opts.room),
      room: opts.room,
      elementoId: opts.elementoId || null,
      // Usar elementoId si es un check conocido, o elementoTexto si es "Otro..."
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
  
  // Notificación de cambio de estado
  function notifyStateChange(){
    _listeners.forEach(function(listener){ listener(_state); });
  }
  
  // Acceder al estado global
  function getState(){ return _state; }
  
  // Suscribirse a cambios (reemplaza las llamadas directas a render())
  function onStateChange(listener){
    _listeners.push(listener);
    return function(){ 
      _listeners = _listeners.filter(function(l){ return l !== listener; });
    };
  }

  // --- Routing (No usa el State Manager para evitar bucles) ---
  
  function parseHash(){
    var h=(location.hash||"").replace(/^#\/?/,"");
    if (!h) return {page:"plan",block:null,room:null};
    var p=h.split("/");
    if (p[0]==="parte"||p[0]==="cuenta"||p[0]==="auth"||p[0]==="trabajos") return {page:p[0],block:null,room:null};
    var block=p[0]||null; var room=p[1]?Number(p[1]):null;
    return {page:"plan",block:block,room:room};
  }
  function setRouteTo(pg,room){
    if (pg==="parte"||pg==="cuenta"||pg==="auth"||pg==="trabajos"){ location.hash = "#/"+pg; return; }
    var block=pg;
    if (!block) location.hash=""; else if (!room) location.hash="#/"+block; else location.hash="#/"+block+"/"+room;
  }
  function applyRoute(){
    var r=parseHash();
    var profile=getUserProfile();
    var needsAuth = !profile;
    
    // Mutación directa del estado de ruteo
    _state.page = needsAuth ? "auth" : r.page;
    if (_state.page==="plan" && profile){
      if (!r.block){ _state.selBlock=null; _state.selRoom=null; }
      else{
        var b=BLOQUES.find(function(x){return x.id===r.block;});
        _state.selBlock=b||null; _state.selRoom=r.room||null;
      }
    } else { _state.selBlock=null; _state.selRoom=null; }
    
    // Recargar datos de usuario si se acaba de autenticar
    if (profile && !_state.dataByUser[_state.aliasLower]) getUserData(); 
    
    notifyStateChange(); // Notificar cambio para re-renderizado
  }
  window.addEventListener("hashchange", applyRoute);

  // --- DOM helpers ---
  
  // Helper de elementos (sin cambios)
  function el(tag, attrs){
    var e=document.createElement(tag);
    if(attrs){ for (var k in attrs){
      if (k==="class") e.className = attrs[k];
      else if (k==="style"){ for (var sk in attrs[k]) e.style[sk]=attrs[k][sk]; }
      else if (k.slice(0,2)==="on" && typeof attrs[k]==="function"){ e.addEventListener(k.slice(2).toLowerCase(), attrs[k]); }
      else if (attrs[k]!==undefined && attrs[k]!==null){ e.setAttribute(k, attrs[k]); }
    } }
    for (var i=2;i<arguments.length;i++){
      var c=arguments[i];
      if (c==null) continue;
      if (Array.isArray(c)){ c.forEach(function(n){ if(n!=null) e.appendChild(typeof n==="string"?document.createTextNode(n):n); }); }
      else e.appendChild(typeof c==="string"?document.createTextNode(c):c);
    }
    return e;
  }

  // --- Modal ---
  
  var modal = document.getElementById('modal');
  var modalTitle = document.getElementById('modal-title');
  var modalBody = document.getElementById('modal-body');
  var modalOk = document.getElementById('modal-ok');
  var modalCancel = document.getElementById('modal-cancel');
  var modalClose = document.getElementById('modal-close');
  function openModal(title, bodyNode, onOk){
    modalTitle.textContent=title||"";
    modalBody.innerHTML='';
    modalBody.appendChild(bodyNode);
    modal.classList.remove('hidden');
    function cleanup(){
      modal.classList.add('hidden');
      modalOk.onclick=null; modalCancel.onclick=null; modalClose.onclick=null;
    }
    modalOk.onclick=function(){ try{ onOk && onOk(); } finally { cleanup(); } };
    modalCancel.onclick=cleanup;
    modalClose.onclick=cleanup;
  }

  // --- Vistas Componentizadas ---

  function Header(state){
    var actions=[];
    if (state.page==="parte"){
      actions.push(el('button',{class:'btn-light',onclick:function(){ setRouteTo(null,null); }},'← Plano'));
    } else if (state.selRoom!=null){
      actions.push(el('button',{class:'btn-light',onclick:function(){ setRouteTo(state.selBlock.id,null); }},'← Residencias'));
    } else if (state.selBlock){
      actions.push(el('button',{class:'btn-light',onclick:function(){ setRouteTo(null,null); }},'← Plano'));
    }
    actions.push(el('button',{class:'btn',onclick:function(){ setRouteTo("parte"); }},'Parte'));
    actions.push(el('button',{class:'btn',onclick:function(){ setRouteTo("trabajos"); }},'Trabajos'));
    var profile = getUserProfile();
    actions.push(el('button',{class:'btn-primary',onclick:function(){ setRouteTo("cuenta"); }}, profile?("Usuario: "+profile.alias):"Acceder"));
    return el('header',{class:'container'},
      el('h1',null,'Mantenimiento Hotel · Residences'),
      el('div',{class:'actions'}, actions)
    );
  }

  function BlockTile(b){
    var rooms=[]; for(var i=b.from;i<=b.to;i++) rooms.push(i);
    var data=getUserData();
    var overalls=rooms.map(function(n){ var r=data[n]; var o=(r && r.overall && r.overall!=="auto")? r.overall : (r?autoOverallFromRoom(r):"none"); return o; });
    var total=rooms.length;
    var fail=overalls.filter(function(x){return x==="fail"}).length;
    var rev=overalls.filter(function(x){return x==="pending"}).length;
    var ok=overalls.filter(function(x){return x==="ok"}).length;
    var none=overalls.filter(function(x){return x==="none"}).length;
    var progress = el('div',{class:'progress',style:{marginTop:'8px'}},
      el('div',{style:{height:'100%',width:(fail/total*100)+'%',background:COLORS.fail,float:'left'}}),
      el('div',{style:{height:'100%',width:(rev/total*100)+'%',background:COLORS.review,float:'left'}}),
      el('div',{style:{height:'100%',width:(ok/total*100)+'%',background:COLORS.ok,float:'left'}})
    );
    return el('button',{class:'tile',onclick:function(){ setRouteTo(b.id,null); }},
      el('div',{style:{width:'100%'}},
        el('div',{style:{fontSize:'24px'}}, b.id==="V"?"🏡":"🏢"),
        el('div',null, b.label+" · "+rooms[0]+"–"+rooms[rooms.length-1]),
        el('div',{class:'kv',style:{marginTop:'4px'}}, "Fallo: "+fail+" · Rev: "+rev+" · OK: "+ok+" · Sin marcar: "+none),
        progress
      )
    );
  }
  
  function RoomChip(n, selBlockId){
    var data=getUserData(); var r=data[n]||{}; var overall=(r.overall && r.overall!=="auto")? r.overall : autoOverallFromRoom(r);
    var key=(overall==="pending"?"review":overall);
    var COLORS_MAP={ none:COLORS.none, review:COLORS.review, ok:COLORS.ok, fail:COLORS.fail };
    var bg=COLORS_MAP[key]||COLORS_MAP.none;
    var isNone=key==="none"; var color=isNone?COLORS.dark:COLORS.white; var border=isNone?COLORS.border:"transparent";
    var realBg=isNone?COLORS.white:bg;
    var btn = el('button',{class:'room',style:{background:realBg,color:color,borderColor:border},onclick:function(){ setRouteTo(selBlockId,n); }}, String(n));
    if (hasRecentSolvedMark(n)){
      btn.appendChild(el('span',{class:'room-badge'},'Solucionado'));
    }
    return btn;
  }
  
  function hasRecentSolvedMark(n){
    var data=getUserData(); var r=data[n]||{};
    if (r.hideSolvedMark) return false;
    var overall=(r.overall && r.overall!=="auto")? r.overall : autoOverallFromRoom(r);
    if (overall!=="ok") return false;
    var arr=jobs().filter(function(j){ return !j.anulado && j.room===n && j.estadoDespues==='ok'; });
    if (!arr.length) return false;
    arr.sort(function(a,b){ return new Date(b.ts)-new Date(a.ts); });
    var last=arr[0]; return (Date.now()-new Date(last.ts).getTime())<=SOLVED_WINDOW_MS;
  }

  function MeasureForm(room){
    var wrap = el('div',{style:{display:'flex',gap:'6px',flexWrap:'wrap'}});
    var sel = el('select',null,
      el('option',{value:'Madera'},'Madera'),
      el('option',{value:'Cerámica'},'Cerámica'),
      el('option',{value:'Mueble'},'Mueble'),
      el('option',{value:'Enser'},'Enser'),
      el('option',{value:'Otro'},'Otro')
    );
    var medida = el('input',{class:'small',placeholder:'Medida (ej. 60x90 cm)'});
    var detalle = el('input',{class:'small',placeholder:'Detalle opcional'});
    var btn = el('button',{class:'btn-primary',onclick:function(){
      if(!medida.value.trim()) return;
      var m={tipo:sel.value,medida:medida.value.trim()}; if(detalle.value.trim()) m.detalle=detalle.value.trim();
      setUserData(function(s){ 
        var r=s[room]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto"}; 
        var next=Object.assign({},s); 
        r.measures=(r.measures||[]).concat([m]); 
        next[room]=r; 
        return next; 
      });
      medida.value=""; detalle.value="";
    }},'Añadir');
    wrap.appendChild(sel); wrap.appendChild(medida); wrap.appendChild(detalle); wrap.appendChild(btn);
    return wrap;
  }

  // --- Vistas de Página ---

  function ParteView(){
    var data=getUserData();
    var parte={}; // { blockId: [{room:N, detalle:[{tipo:..., item:..., label:..., note:...}]}] }
    
    // 1. Construir el parte (la lógica se mantiene)
    BLOQUES.forEach(function(b){
      var rooms=[]; for(var i=b.from;i<=b.to;i++) rooms.push(i);
      var entries=[];
      rooms.forEach(function(n){
        var r=data[n]||{}; var items=r.items||{}; var itemNotes=r.itemNotes||{};
        var fails=Object.keys(items).filter(function(k){return items[k]==='fail'});
        var revs=Object.keys(items).filter(function(k){return items[k]==='pending'});
        var detalle=[];
        
        // Fallos y Por revisar (con o sin nota)
        fails.forEach(function(k){ var lab=(checkById(k)||{label:k}).label; var note=(itemNotes[k]||"").trim(); detalle.push({tipo:"Fallo",item:k,label:lab, note:note}); });
        revs.forEach(function(k){ var lab=(checkById(k)||{label:k}).label; var note=(itemNotes[k]||"").trim(); detalle.push({tipo:"Por revisar",item:k,label:lab, note:note}); });
        
        // Notas sin estado de Fallo/Pendiente
        var roomNote=(r.notes||"").trim();
        var itemNoteOnly = Object.keys(itemNotes).filter(function(k){ 
            var v=(itemNotes[k]||"").trim(); var st=items[k]; 
            return v.length>0 && (!st||st==='none'||st==='ok'); 
        });

        if (roomNote || itemNoteOnly.length > 0){
             itemNoteOnly.forEach(function(k){
                var v=(itemNotes[k]||"").trim(); var lab=(checkById(k)||{label:k}).label;
                // NOTA: Se categoriza como 'Observación' y no 'Fallo' para diferenciar
                detalle.push({tipo:'Observación',item:k,label:lab, note:v}); 
            });
            if (roomNote){ detalle.push({tipo:'Observación',item:'observacion_general',label:'Observación general', note:roomNote}); }
        }
        
        if (detalle.length){ entries.push({room:n,detalle:detalle}); }
      });
      parte[b.id]=entries;
    });

    // 2. Acciones del Parte
    function actHecho(room, itemId, label, prevTipo, prevNote){
      var data=getUserData(); var r=data[room]||{items:{}}; var prev = (r.items||{})[itemId]||"none";
      // si es un check conocido y no es una observación general, ponlo a OK.
      if (checkById(itemId)) { 
        setUserData(function(s){ var rr=s[room]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto"}; rr.items[itemId]='ok'; var next=Object.assign({},s); next[room]=rr; return next; });
      }
      // log
      logJob({source:'parte', room:room, elementoId: checkById(itemId)?itemId:null, elemento: label, accion: (prevTipo==='Por revisar'?'revisión':'reparación'), estadoAntes: prev, estadoDespues: (checkById(itemId)?'ok':null), notas: prevNote||null});
      // La llamada a render() se hace desde setUserData/logJob
    }

    function actDetalles(room, itemId, label, prevTipo, prevNote){
      var form = (function(){
        var wrap=el('div',{class:'grid'});
        var accion=el('select',null, ['reparación','revisión','sustitución','medición','limpieza','otro'].map(function(a){ return el('option',{value:a},a); }));
        var minutos=el('input',{placeholder:'Minutos (opcional)',type:'number',min:'0'});
        var materiales=el('textarea',{placeholder:'Materiales (uno por línea, ej. Bombilla E27 x1)'});
        var notas=el('textarea',{placeholder:'Notas (opcional)'}); notas.value = prevNote||'';
        var update=el('select',null, el('option',{value:'ok'},'Actualizar estado a OK'), el('option',{value:'pending'},'Actualizar a Por revisar'), el('option',{value:'none',selected:true},'No tocar estado'));
        
        // Si no es un check conocido, no se puede cambiar el estado
        var stateControl = checkById(itemId) 
            ? el('label',null,'Estado a Aplicar',update) 
            : el('div',{class:'kv', style:{gridColumn:'span 2'}},'⚠️ No se aplica estado a observaciones generales o elementos no definidos.');
            
        wrap.appendChild(el('label',null,'Acción',accion));
        wrap.appendChild(el('label',null,'Minutos',minutos));
        wrap.appendChild(el('label',null,'Materiales',materiales));
        wrap.appendChild(el('label',null,'Notas',notas));
        wrap.appendChild(stateControl);
        
        return {node:wrap, get: function(){ return {accion:accion.value, minutos: minutos.value? Number(minutos.value):null, materiales: materiales.value? materiales.value.split('\n').map(function(s){return s.trim();}).filter(Boolean):null, notas: notas.value||null, update:update.value}; }};
      })();
      
      openModal('Registrar trabajo — '+label, form.node, function(){
        var v=form.get();
        var data=getUserData(); var r=data[room]||{items:{}}; var prev = (r.items||{})[itemId]||"none";
        
        // estado
        if (checkById(itemId)){
          if (v.update==='ok' || v.update==='pending'){
            setUserData(function(s){ var rr=s[room]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto"}; rr.items[itemId]=v.update; var next=Object.assign({},s); next[room]=rr; return next; });
          }
        }
        
        // log
        logJob({
            source:'parte', 
            room:room, 
            elementoId: checkById(itemId)?itemId:null, 
            elemento: label, 
            accion: v.accion, 
            estadoAntes: prev, 
            estadoDespues: checkById(itemId)? (v.update==='none'? prev : v.update) : null, // Si no es check, no hay estado
            minutos: v.minutos, 
            materiales: v.materiales, 
            notas: v.notas
        });
      });
    }

    // 3. Export CSV
    function onCSV(){ // exporta parte actual
      var rows=[["Usuario","Bloque","Residencia","Tipo","Elemento","Detalle"]];
      var alias=(getUserProfile()&&getUserProfile().alias)||'anon';
      BLOQUES.forEach(function(b){
        (parte[b.id]||[]).forEach(function(e){
          e.detalle.forEach(function(d){
            // Excluir elementos internos como 'observacion_general' del ID, pero no de la etiqueta
            var elementoIdForCSV = d.item === 'observacion_general' ? '' : d.item;
            rows.push([alias,b.id,String(e.room),d.tipo,d.label,d.note||""]);
          });
        });
      });
      var csv=rows.map(function(r){ return r.map(function(x){ var s=(x==null?"":String(x)); return /[\",\n;]/.test(s)?('"'+s.replace(/\"/g,'""')+'"'):s; }).join(","); }).join("\n");
      var blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
      var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="parte_actual_"+(((getUserProfile()||{}).alias)||"anon")+"_"+nowISO().replace(/[: ]/g,'-')+".csv";
      document.body.appendChild(a); a.click(); a.remove();
    }

    // 4. Renderizado
    var main = el('main',{class:'container'},
      el('div',{style:{display:'flex',gap:'8px',alignItems:'center',justifyContent:'space-between'}},
        el('h2',null,'Parte de trabajo'),
        el('div',null,
          el('button',{class:'btn',onclick:function(){ window.print(); }},'Imprimir'),
          el('button',{class:'btn-primary',style:{marginLeft:'8px'},onclick:onCSV},'Exportar CSV')
        )
      )
    );

    Object.keys(parte).forEach(function(bid){
      var entries=parte[bid];
      var section = el('section',{class:'card'},
        el('h3',null,'Bloque '+(bid==='V'?'VILLAS':bid)),
        entries.length===0 ? el('div',{class:'kv'},'Sin fallos ni por revisar.') : el('div',null)
      );
      if (entries.length>0){
        entries.sort(function(a,b){return a.room-b.room;}).forEach(function(e){
          var item = el('div',{style:{margin:'8px 0',padding:'8px',border:'1px solid var(--b2)',borderRadius:'10px'}},
            el('div',{style:{fontWeight:700,display:'flex',alignItems:'center',justifyContent:'space-between'}},
              el('span',null,'Residencia '+e.room),
              // Botón de Resolver todo
              el('span',null,
                el('button',{class:'btn',onclick:function(){
                  if (!confirm('¿Seguro que quieres RESOLVER TODOS los puntos de la Residencia ' + e.room + '? Se registrarán como "Hecho".')) return;
                  e.detalle.forEach(function(d){ actHecho(e.room, d.item, d.label, d.tipo, d.note); });
                }},'Resolver todo')
              )
            ),
            el('div',null,
              e.detalle.map(function(d){
                var isFail = d.tipo === 'Fallo';
                var isPending = d.tipo === 'Por revisar';
                var isObs = d.tipo === 'Observación';
                
                var statusClass = isFail ? 'text-fail' : (isPending ? 'text-review' : 'text-dark');
                var noteText = d.note? (' — ' + d.note):'';

                var row = el('div',{style:{display:'flex',gap:'8px',alignItems:'center',justifyContent:'space-between',padding:'6px 0', borderBottom:'1px dotted var(--b2)'}},
                  el('div',{class:'kv'}, 
                    el('span',{class:statusClass}, d.tipo),
                    document.createTextNode(': '+d.label+noteText)
                  ),
                  el('div',null,
                    el('button',{class:'btn',style:{opacity: isObs? 0.6 : 1}, onclick:function(){ actHecho(e.room, d.item, d.label, d.tipo, d.note); }},'Hecho'),
                    el('button',{class:'btn-primary',style:{marginLeft:'6px'},onclick:function(){ actDetalles(e.room, d.item, d.label, d.tipo, d.note); }},'Hecho + detalles')
                  )
                );
                return row;
              })
            )
          );
          section.appendChild(item);
        });
      }
      main.appendChild(section);
    });

    return main;
  }

  function TrabajosView(){
    var state = getState();
    var filt = state.trabajosFilter || { range:'hoy', block:'all', room:'', accion:'all', elemento:'all', onlySolved:false };
    
    // Función para actualizar el estado del filtro de trabajos
    function setTrabajosFilter(key, value){
        _state.trabajosFilter = Object.assign({}, filt, {[key]: value});
        notifyStateChange();
    }
    
    function applyFilter(arr){
      var now=new Date();
      var start=null;
      if (filt.range==='hoy'){ start=new Date(); start.setHours(0,0,0,0); }
      else if (filt.range==='semana'){ start=new Date(now.getTime()-6*24*60*60*1000); start.setHours(0,0,0,0); }
      
      return arr.filter(function(j){
        if (j.anulado) return false; // Por defecto, ocultar anulados
        if (filt.block!=='all' && j.bloque!==filt.block) return false;
        if (filt.room && String(j.room)!==String(filt.room)) return false;
        if (filt.accion!=='all' && j.accion!==filt.accion) return false;
        if (filt.elemento!=='all' && j.elementoId!==filt.elemento) return false;
        if (filt.onlySolved && j.estadoDespues!=='ok') return false;
        if (start){ if (new Date(j.ts) < start) return false; }
        return true;
      });
    }

    function exportCSV(arr){
      var rows=[["ts (UTC)","alias","bloque","room","elementoId","elemento","accion","estadoAntes","estadoDespues","minutos","materiales","notas","source","anulado"]];
      arr.forEach(function(j){
        rows.push([j.ts,j.alias,j.bloque||"",j.room||"",j.elementoId||"",j.elemento||"",j.accion||"",j.estadoAntes||"",j.estadoDespues||"",j.minutos==null?"":j.minutos,(j.materiales||[]).join(" | "),j.notas||"",j.source||"",j.anulado?"1":"0"]);
      });
      var csv=rows.map(function(r){ return r.map(function(x){ var s=(x==null?"":String(x)); return /[\",\n;]/.test(s)?('"'+s.replace(/\"/g,'""')+'"'):s; }).join(","); }).join("\n");
      var blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
      var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="trabajos_"+(((getUserProfile()||{}).alias)||"anon")+"_"+nowISO().replace(/[: ]/g,'-')+".csv";
      document.body.appendChild(a); a.click(); a.remove();
    }

    function onNuevoManual(){
      var form = (function(){
        var wrap=el('div',{class:'grid'});
        var hab=el('input',{placeholder:'Habitación (nº)', type:'number', min:'1000', step:'1'});
        var elemSel=el('select',null, CHECKS.map(function(c){return el('option',{value:c.id},c.label)}), el('option',{value:'otro'},'Otro…'));
        var elemTxt=el('input',{placeholder:'Elemento (si has elegido Otro)', disabled: elemSel.value!=='otro'});
        elemSel.addEventListener('change', function(){ elemTxt.disabled = elemSel.value!=='otro'; });
        var accion=el('select',null, ['reparación','revisión','sustitución','medición','limpieza','otro'].map(function(a){ return el('option',{value:a},a); }));
        var estado=el('select',null, el('option',{value:'none'},'No tocar estado'), el('option',{value:'ok'},'Marcar OK'), el('option',{value:'pending'},'Marcar Por revisar'));
        var minutos=el('input',{placeholder:'Minutos (opcional)',type:'number',min:'0'});
        var materiales=el('textarea',{placeholder:'Materiales (uno por línea)'});
        var notas=el('textarea',{placeholder:'Notas (opcional)'});
        wrap.appendChild(el('label',null,'Habitación',hab));
        wrap.appendChild(el('label',null,'Elemento',elemSel));
        wrap.appendChild(el('label',null,'Elemento libre',elemTxt));
        wrap.appendChild(el('label',null,'Acción',accion));
        wrap.appendChild(el('label',null,'Estado a aplicar',estado));
        wrap.appendChild(el('label',null,'Minutos',minutos));
        wrap.appendChild(el('label',null,'Materiales',materiales));
        wrap.appendChild(el('label',null,'Notas',notas));
        return {node:wrap, get:function(){ return {
          room: hab.value? Number(hab.value):null,
          elementoId: elemSel.value!=='otro'? elemSel.value : null,
          elementoTexto: elemSel.value==='otro'? (elemTxt.value||"") : null,
          accion: accion.value,
          estado: estado.value,
          minutos: minutos.value? Number(minutos.value):null,
          materiales: materiales.value? materiales.value.split('\n').map(function(s){return s.trim();}).filter(Boolean):null,
          notas: notas.value||null
        };}};
      })();
      openModal('Nuevo trabajo manual', form.node, function(){
        var v=form.get(); 
        if(!v.room || (!v.elementoId && !v.elementoTexto)) { alert("Faltan datos esenciales (Habitación y Elemento)."); return; }
        
        var prev=null;
        if (v.elementoId){
          var data=getUserData(); var r=data[v.room]||{items:{}}; prev=(r.items||{})[v.elementoId]||"none";
        }
        // actualizar estado si procede
        if (v.elementoId && (v.estado==='ok' || v.estado==='pending')){
          setUserData(function(s){ var rr=s[v.room]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto"}; rr.items[v.elementoId]=v.estado; var next=Object.assign({},s); next[v.room]=rr; return next; });
        }
        // log
        logJob({source:'manual', room:v.room, elementoId:v.elementoId||null, elementoTexto:v.elementoTexto||null, accion:v.accion, estadoAntes: prev, estadoDespues: v.elementoId? (v.estado==='none'? prev : v.estado) : null, minutos: v.minutos, materiales: v.materiales, notas: v.notas});
      });
    }

    function onReabrir(job){
      if (!confirm('¿Seguro que quieres REABRIR este trabajo?\nSe marcará el elemento (' + job.elemento + ') en la Residencia ' + job.room + ' como "Por revisar".')) return;
      setUserData(function(s){
        var arr=(s._jobs||[]).slice();
        var idx=arr.findIndex(function(j){return j.id===job.id;});
        if (idx>=0){ arr[idx]=Object.assign({}, arr[idx], {anulado:true}); }
        var next=Object.assign({},s,{_jobs:arr});
        if (job.elementoId && job.room){
          var rr=next[job.room]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto"};
          rr.items[job.elementoId]='pending'; next[job.room]=rr;
        }
        return next;
      });
    }

    var top = el('div',{class:'container'},
      el('div',{style:{display:'flex',gap:'8px',alignItems:'center',justifyContent:'space-between'}},
        el('h2',null,'Trabajos'),
        el('div',null,
          el('button',{class:'btn',onclick:function(){ exportCSV(applyFilter(jobs().filter(function(j){return !j.anulado;}))); }},'Exportar CSV'),
          el('button',{class:'btn-primary',style:{marginLeft:'8px'},onclick:onNuevoManual},'Nuevo trabajo')
        )
      ),
      (function(){
        var bar=el('div',{style:{display:'flex',gap:'8px',flexWrap:'wrap',margin:'8px 0'}});
        var range=el('select',null, ['hoy','semana','todo'].map(function(v){ return el('option',{value:v, selected:filt.range===v},v); }));
        var block=el('select',null, el('option',{value:'all', selected:filt.block==='all'},'Todos los bloques'), BLOQUES.map(function(b){return el('option',{value:b.id, selected:filt.block===b.id},'Bloque '+(b.id==='V'?'VILLAS':b.id))}));
        var room=el('input',{class:'small',placeholder:'Hab.', value:filt.room});
        var accion=el('select',null, el('option',{value:'all', selected:filt.accion==='all'},'Todas las acciones'), ['reparación','revisión','sustitución','medición','limpieza','otro'].map(function(a){ return el('option',{value:a, selected:filt.accion===a},a); }));
        var elemento=el('select',null, el('option',{value:'all', selected:filt.elemento==='all'},'Todos los elementos'), CHECKS.map(function(c){return el('option',{value:c.id, selected:filt.elemento===c.id},c.label)}));
        var solved=el('label',null, (function(){ var cb=el('input',{type:'checkbox', checked:filt.onlySolved}); cb.addEventListener('change',function(){ setTrabajosFilter('onlySolved', cb.checked); }); return cb; })(), ' Solo solucionados');
        
        range.addEventListener('change',function(){ setTrabajosFilter('range', range.value); });
        block.addEventListener('change',function(){ setTrabajosFilter('block', block.value); });
        room.addEventListener('input',function(){ setTrabajosFilter('room', room.value); });
        accion.addEventListener('change',function(){ setTrabajosFilter('accion', accion.value); });
        elemento.addEventListener('change',function(){ setTrabajosFilter('elemento', elemento.value); });
        
        bar.appendChild(range); bar.appendChild(block); bar.appendChild(room); bar.appendChild(accion); bar.appendChild(elemento); bar.appendChild(solved);
        return bar;
      })()
    );

    var list = el('main',{class:'container'});
    var arr = applyFilter(jobs().slice());
    arr.sort(function(a,b){ return new Date(b.ts)-new Date(a.ts); });
    
    if (!arr.length){
      list.appendChild(el('div',{class:'kv'},'Sin trabajos en el rango seleccionado. (Ocultando trabajos anulados)'));
    } else {
      arr.forEach(function(j){
        var noteText = j.notas? (' · Notas: ' + j.notas):'';
        var materialsText = (j.materiales && j.materiales.length) ? (' · Material: ' + j.materiales.join(', ').substring(0, 50) + '...') : '';
        var stateColor = j.estadoDespues === 'ok' ? COLORS.ok : (j.estadoDespues === 'fail' ? COLORS.fail : COLORS.review);
        var elementText = j.elemento || j.elementoId || '—';
        
        var line = el('div',{class:'card', style:{borderLeft:'4px solid ' + stateColor}},
          el('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
            el('div',{class:'kv'}, 
                el('strong',null, fmtFullDate(j.ts)),
                document.createTextNode(' · Residencia: ' + String(j.room||'—') + ' · Elemento: ' + elementText + ' · Acción: ' + j.accion + (j.minutos!=null? (' · ' + j.minutos + ' min'):''))
            ),
            el('div',null,
              el('span',{class:'badge', style:{background: stateColor, color:COLORS.white}}, labelState(j.estadoDespues||'—')),
              j.elementoId && j.estadoDespues !== 'none' && j.estadoDespues !== 'fail' // Reabrir solo si hay elemento y no quedó en Fallo
                ? el('button',{class:'btn',style:{marginLeft:'8px'},onclick:function(){ onReabrir(j); }},'Reabrir') 
                : null
            )
          ),
          (noteText.length > 0 || materialsText.length > 0) 
            ? el('div',{class:'kv', style:{marginTop:'4px'}}, noteText, materialsText)
            : null
        );
        list.appendChild(line);
      });
    }
    return el('div',null, top, list);
  }

  function IncidenciasView(room){
    var data=getUserData(); var r=data[room]||{}; var items=r.items||{}; var itemNotes=r.itemNotes||{};

    function visibles(){ return Object.keys(items).filter(function(k){return items[k]==='fail' || items[k]==='pending'}); }
    function remaining(){
      var set={}; visibles().forEach(function(k){ set[k]=true; });
      return CHECKS.filter(function(c){ return !set[c.id]; });
    }
    function setItem(id,val){
      var prev=(items[id]||"none");
      setUserData(function(s){ var rr=s[room]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto",assumeOk:false}; rr.items[id]=val; var next=Object.assign({},s); next[room]=rr; return next; });
      // Loggear si se resuelve con el botón rápido
      if ((prev==='fail' || prev==='pending') && val==='ok'){
        var c = checkById(id) || {label:id};
        logJob({source:'item', room:room, elementoId:id, elemento:c.label, accion:'reparación', estadoAntes: prev, estadoDespues:'ok'});
      }
    }
    function setNote(id,text){
      setUserData(function(s){ var rr=s[room]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto",assumeOk:false}; rr.itemNotes=rr.itemNotes||{}; rr.itemNotes[id]=text; var next=Object.assign({},s); next[room]=rr; return next; });
    }
    function quitar(id){
      if (!confirm('¿Seguro que quieres quitar el elemento "'+ (checkById(id)||{label:id}).label + '" de la lista de incidencias? Su estado volverá a "—".')) return;
      setUserData(function(s){ var rr=s[room]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto",assumeOk:false}; rr.items[id]="none"; delete rr.itemNotes[id]; var next=Object.assign({},s); next[room]=rr; return next; });
    }

    var section = el('section',{class:'card'},
      el('h3',null, 'Incidencias ', AddIncidencia(room, remaining()))
    );

    var grid = el('div',{class:'grid',style:{gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',marginTop:'8px'}});
    var vis = visibles();
    if (vis.length===0) grid.appendChild(el('div',{class:'kv'},'Sin incidencias añadidas (Fallo o Por revisar).'));
    vis.forEach(function(id){
      var c = checkById(id) || {label:id};
      var cur=items[id]||"none"; var note=itemNotes[id]||"";
      var card = el('div',{class:'card',style:{marginTop:0,padding:'10px', borderLeft:'3px solid '+(cur==='fail'?COLORS.fail:COLORS.review)}},
        el('div',{style:{display:'flex',alignItems:'center',gap:'8px',justifyContent:'space-between'}},
          el('div',{style:{fontSize:'14px', fontWeight:'bold'}}, c.label),
          el('div',null,
            // Resolver rápido solo para Fallo/Pending
            cur!=='ok' ? el('button',{class:'btn',onclick:function(){ setItem(id,'ok'); }}, 'Resolver OK') : null,
            el('button',{class:'btn-primary',style:{marginLeft:'6px'},onclick:function(){ // registrar trabajo con detalles
              var form = (function(){
                var wrap=el('div',{class:'grid'});
                var accion=el('select',null, ['reparación','revisión','sustitución','medición','limpieza','otro'].map(function(a){ return el('option',{value:a, selected:cur==='pending' && a==='revisión'},a); }));
                var minutos=el('input',{placeholder:'Minutos (opcional)',type:'number',min:'0'});
                var materiales=el('textarea',{placeholder:'Materiales (uno por línea)'});
                var notas=el('textarea',{placeholder:'Notas (opcional)'}); notas.value = note||'';
                var update=el('select',null, el('option',{value:'ok'},'Actualizar estado a OK'), el('option',{value:'pending',selected:cur==='pending'},'Actualizar a Por revisar'), el('option',{value:'fail',selected:cur==='fail'},'Actualizar a Fallo'), el('option',{value:'none'},'No tocar estado'));
                wrap.appendChild(el('label',null,'Acción',accion));
                wrap.appendChild(el('label',null,'Minutos',minutos));
                wrap.appendChild(el('label',null,'Materiales',materiales));
                wrap.appendChild(el('label',null,'Notas',notas));
                wrap.appendChild(el('label',null,'Estado',update));
                return {node:wrap, get: function(){ return {accion:accion.value, minutos: minutos.value? Number(minutos.value):null, materiales: materiales.value? materiales.value.split('\n').map(function(s){return s.trim();}).filter(Boolean):null, notas: notas.value||null, update:update.value}; }};
              })();
              openModal('Registrar trabajo — '+c.label, form.node, function(){
                var v=form.get();
                var prev=(items[id]||"none");
                if (v.update!=='none') setItem(id, v.update);
                logJob({source:'item', room:room, elementoId:id, elemento:c.label, accion:v.accion, estadoAntes: prev, estadoDespues: (v.update==='none'? prev : v.update), minutos: v.minutos, materiales: v.materiales, notas: v.notas});
                // También actualizar la nota si se modifica desde el modal
                setNote(id, v.notas || note); 
              });
            }}, 'Registrar trabajo')
          )
        ),
        el('div',{style:{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',marginTop:'8px'}},
          (function(){
            var inp = el('input',{class:'small',placeholder:'Observación del elemento',value:note, style:{flexGrow:1}});
            inp.addEventListener('input', function(){ setNote(id, inp.value); });
            return inp;
          })(),
          el('button',{class:'btn-danger',onclick:function(){ quitar(id); }}, 'Quitar')
        ),
        cur==='ok' ? el('div',{class:'kv', style:{marginTop:'8px', borderTop:'1px solid var(--b2)', paddingTop:'4px'}}, 'Estado: OK. Pulsa "Quitar" para borrarlo de incidencias.') : null
      );
      grid.appendChild(card);
    });
    section.appendChild(grid);
    return section;
  }

  function AddIncidencia(room, remaining){
    var wrap = el('span',null);
    var sel = el('select',null, remaining.length? remaining.map(function(c){ return el('option',{value:c.id},c.label); }) : [el('option',{value:''},'(Sin puntos disponibles)')]);
    var btn = el('button',{class: remaining.length?'btn':'btn-disabled',onclick:function(){ 
        if(!remaining.length) return; 
        var id=sel.value; 
        if(!id) return; 
        setUserData(function(s){ 
            var r=s[room]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto",assumeOk:false}; 
            // Si ya existe y es 'none', se cambia a 'pending'. Si es la primera vez, se añade como 'pending'.
            r.items[id]=r.items[id]==='none' || !r.items[id] ? "pending" : r.items[id];
            var next=Object.assign({},s); 
            next[room]=r; 
            return next; 
        }); 
    }},'Añadir punto');
    wrap.appendChild(sel); wrap.appendChild(document.createTextNode(' ')); wrap.appendChild(btn);
    return wrap;
  }
  
  function CuentaView(){
    var profile=getUserProfile();
    function logout(){ 
        if (confirm('¿Cerrar sesión? Esto no borra tus datos locales.')) {
            setCurrent(null); 
            _state.aliasLower=null; 
            _state.page='auth'; 
            notifyStateChange(); 
        }
    }
    function onExport(){
      var alias=(profile&&profile.alias)||'anon';
      var data = localStorage.getItem(nsKey(_state.aliasLower)) || "{}";
      var payload = { type:"mh-profile", version:APP_VERSION, alias:alias, storedAt: new Date().toISOString(), data: JSON.parse(data) };
      var blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
      var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download="mh-"+alias+"-"+nowISO().replace(/[: ]/g,'-')+".mhjson"; document.body.appendChild(a); a.click(); a.remove();
    }
    function onImport(file){
      var fr=new FileReader();
      fr.onload=function(){
        try{
          var payload=JSON.parse(fr.result);
          if (!payload || !payload.data){ alert("Archivo inválido o no contiene datos válidos."); return; }
          if (confirm('¿Estás seguro de que quieres SOBREESCRIBIR los datos de "'+profile.alias+'" con los datos del archivo?')) {
             localStorage.setItem(nsKey(_state.aliasLower), JSON.stringify(payload.data));
             location.reload();
          }
        }catch(e){ alert("No se pudo importar el archivo JSON. Error: " + e.message); }
      };
      fr.readAsText(file);
    }
    var fileInput = el('input',{type:'file',accept:'.mhjson,application/json',style:{display:'none'}});
    fileInput.addEventListener('change', function(e){ var f=e.target.files&&e.target.files[0]; if(f) onImport(f); });

    return el('main',{class:'container'},
      el('div',{class:'card'},
        el('h3',null, 'Usuario actual: ', profile?el('strong',null,profile.alias):"—"),
        el('div',{class:'kv'},'Gestiona perfiles, copia de seguridad y migración. Versión: ' + APP_VERSION),
        el('div',{style:{marginTop:'10px',display:'flex',gap:'8px',flexWrap:'wrap'}},
          el('button',{class:'btn',onclick:function(){ location.hash="#/auth"; }},'Cambiar usuario'),
          profile ? el('button',{class:'btn-danger',onclick:logout},'Cerrar sesión') : null,
          el('button',{class:'btn',onclick:onExport},'Exportar datos (.mhjson)'),
          fileInput,
          el('button',{class:'btn-primary',onclick:function(){ fileInput.click(); }},'Importar datos')
        )
      )
    );
  }

  function AuthView(){
    var users=loadUsers();
    var alias=""; var pin="";
    
    var main=el('main',{class:'container'},
      el('div',{class:'card',style:{maxWidth:'440px',margin:'64px auto'}},
        el('h2',null,'Acceder'),
        el('div',{class:'kv'},'Perfiles locales. Alias + PIN de 4–8 dígitos.'),
        (function(){
          var box=el('div',{style:{display:'grid',gap:'8px',marginTop:'12px'}});
          var a=el('input',{placeholder:'Alias (ej. Frank)', value:alias});
          var p=el('input',{placeholder:'PIN',type:'password'});
          var m=el('div',{style:{color:'#b91c1c'}});
          var btn=el('button',{class:'btn-primary'},'Entrar / Crear perfil');
          
          function attemptAuth(){
            var al=a.value.trim(); var pi=p.value.trim(); 
            if(!al||!pi){ m.textContent="Alias y PIN requeridos"; return; }
            if(pi.length < 4 || pi.length > 8){ m.textContent="El PIN debe tener entre 4 y 8 dígitos."; return; }
            
            var key=al.toLowerCase(); var u=_state.users[key]; var h=hashPIN(pi);
            
            if(!u){
              _state.users[key]={alias:al,pinHash:h,createdAt:new Date().toISOString()}; 
              saveUsers(_state.users);
              // Migración de datos LEGACY (se mantiene la lógica)
              try{ var legacy=localStorage.getItem("mh_v1_state"); if(legacy && !localStorage.getItem(nsKey(key))){ localStorage.setItem(nsKey(key), legacy); localStorage.removeItem("mh_v1_state");} }catch(e){}
              setCurrent(key); 
              _state.aliasLower=key; 
              location.hash=""; 
              return;
            }
            if(u.pinHash!==h){ m.textContent="PIN incorrecto"; return; }
            
            setCurrent(key); 
            _state.aliasLower=key; 
            location.hash=""; 
          }
          
          a.addEventListener('input',function(){ alias=a.value; m.textContent=""; });
          p.addEventListener('input',function(){ pin=p.value; m.textContent=""; });
          btn.addEventListener('click',attemptAuth);
          a.addEventListener('keydown', function(e){ if (e.key === 'Enter') attemptAuth(); });
          p.addEventListener('keydown', function(e){ if (e.key === 'Enter') attemptAuth(); });

          box.appendChild(a); box.appendChild(p); box.appendChild(btn); box.appendChild(m);
          return box;
        })(),
        Object.values(users).length>0 ? el('div',{style:{marginTop:'12px'}},
          el('div',{class:'kv'},'Perfiles existentes:'),
          el('div',{style:{display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'6px'}},
            Object.values(users).map(function(u){ 
                var b=el('button',{class:'btn'},u.alias); 
                b.addEventListener('click',function(){ 
                    var a=main.querySelector('input[placeholder="Alias (ej. Frank)"]'); 
                    a.value=u.alias; 
                    a.dispatchEvent(new Event('input')); // Para actualizar 'alias'
                    main.querySelector('input[type="password"]').focus();
                }); 
                return b; 
            })
          )
        ) : null
      )
    );
    return main;
  }

  function MainView(state){
    var root = el('div',null,
      Header(state)
    );
    var profile=getUserProfile();

    if (state.page==="auth"){
      root.appendChild(AuthView());
      return root;
    }
    
    // Todas las demás vistas requieren estar autenticado
    if (!profile) {
        // Esto no debería pasar si applyRoute funciona, pero es un fallback seguro
        setRouteTo("auth"); 
        return root;
    }
    
    if (state.page==="cuenta"){
      root.appendChild(CuentaView());
      return root;
    }
    if (state.page==="trabajos"){
      root.appendChild(TrabajosView());
      return root;
    }
    if (state.page==="parte"){
      root.appendChild(ParteView());
      return root;
    }

    if (!state.selBlock){
      var plan = el('main',{class:'container'},
        el('div',{class:'plan'},
          BLOQUES.map(function(b){ return BlockTile(b); })
        ),
        el('p',{class:'kv',style:{marginTop:'10px'}}, 'Usuario: ', (profile?profile.alias:"—"), '. Pulsa un bloque para ver sus residencias.')
      );
      root.appendChild(plan);
      return root;
    }

    if (state.selBlock && state.selRoom==null){
      var b=state.selBlock;
      var rooms=[]; for(var i=b.from;i<=b.to;i++) rooms.push(i);
      var data=getUserData();
      
      function roomOverall(n){ var r=data[n]||{}; return (r.overall && r.overall!=="auto")? r.overall : autoOverallFromRoom(r); }
      
      var filtered = rooms.filter(function(n){
        if (state.filter && String(n).indexOf(state.filter.trim())<0) return false;
        if (state.statusFilter==="all") return true;
        return roomOverall(n)===state.statusFilter;
      });
      
      // Función para actualizar el estado del filtro de la vista de Bloque
      function setBlockFilter(key, value){
          _state[key] = value;
          notifyStateChange();
      }
      
      var main = el('main',{class:'container'},
        el('h2',null, 'Bloque '+b.label),
        (function(){
          var tb=el('div',{style:{display:'flex',gap:'8px',flexWrap:'wrap',margin:'8px 0'}});
          var inp=el('input',{placeholder:'Filtrar número…', value:state.filter}); 
          inp.addEventListener('input',function(){ setBlockFilter('filter', inp.value); });
          tb.appendChild(inp);
          
          ['all','fail','pending','ok','none'].forEach(function(s){
            var btn=el('span',{class: 'badge'+(state.statusFilter===s?' active':''),onclick:function(){ setBlockFilter('statusFilter', s); }}, labelState(s));
            tb.appendChild(btn);
          });
          return tb;
        })(),
        el('div',{class:'rooms'},
          filtered.map(function(n){ return RoomChip(n, b.id); })
        )
      );
      root.appendChild(main);
      return root;
    }

    if (state.selRoom!=null){
      var n=state.selRoom; 
      var data=getUserData(); 
      var r=data[n]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto",assumeOk:false};
      var overall = (r.overall && r.overall!=="auto")? r.overall : autoOverallFromRoom(r);

      function resetRoom(){
        if (!confirm('¿Estás seguro de que quieres REINICIAR COMPLETAMENTE la residencia ' + n + '? Se borrarán todas las incidencias y notas NO REGISTRADAS en el Historial de Trabajos.')) return;
        setUserData(function(s){ var next=Object.assign({},s); next[n]={items:{},itemNotes:{},notes:"",measures:[],overall:"auto",assumeOk:false}; return next; });
      }
      function toggleAssumeOk(){
        setUserData(function(s){ var rr=s[n]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto",assumeOk:false}; rr.assumeOk=!rr.assumeOk; var next=Object.assign({},s); next[n]=rr; return next; });
      }
      function setOverallState(val){
        setUserData(function(s){ var rr=s[n]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto",assumeOk:false}; rr.overall=val; var next=Object.assign({},s); next[n]=rr; return next; });
      }
      function setNotes(val){
        setUserData(function(s){ var rr=s[n]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto",assumeOk:false}; rr.notes=val; var next=Object.assign({},s); next[n]=rr; return next; });
      }
      function hideSolved(){
        setUserData(function(s){ var rr=s[n]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto",assumeOk:false}; rr.hideSolvedMark=true; var next=Object.assign({},s); next[n]=rr; return next; });
      }

      var overallColor = overall==="auto"?"#334155":(overall==="ok"?COLORS.ok:overall==="fail"?COLORS.fail:overall==="pending"?COLORS.review:COLORS.none);

      var main = el('main',{class:'container'},
        el('div',{style:{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}},
          el('h2',null, 'Residencia ', el('strong',null, String(n))),
          el('span',{class:'badge',style:{marginLeft:'auto',background:overallColor,color:COLORS.white}}, labelState(overall)),
          el('button',{class:'btn',onclick:toggleAssumeOk, style:{background:r.assumeOk?COLORS.ok:COLORS.none, color:r.assumeOk?COLORS.white:COLORS.dark}}, r.assumeOk?'✅ Asumir resto OK':'Asumir resto OK: No'),
          hasRecentSolvedMark(n)? el('button',{class:'btn',onclick:hideSolved}, 'Ocultar marca'): null,
          el('button',{class:'btn-danger',onclick:resetRoom}, 'Reiniciar habitación')
        ),
        
        // Incidencias
        IncidenciasView(n),
        
        // Medidas
        el('section',{class:'card'},
          el('h3',null,'Medidas para sustituciones'),
          MeasureForm(n),
          (function(){
            var list = el('ul',{style:{marginTop:'8px',paddingLeft:'18px'}});
            var arr = (r.measures||[]);
            if (!arr.length){ list.appendChild(el('li',{class:'kv'},'Sin medidas aún.')); return list; }
            arr.forEach(function(m,idx){
              var li=el('li',{style:{marginBottom:'4px'}},
                el('span',{style:{fontFamily:'monospace'}}, '['+m.tipo+'] '+m.medida),
                m.detalle? el('span',null,' — '+m.detalle): null,
                el('button',{class:'btn-danger small',style:{marginLeft:'8px',padding:'4px 8px'},onclick:function(){
                  if (!confirm('¿Eliminar la medida "'+m.medida+'"?')) return;
                  setUserData(function(s){ var rr=s[n]||{items:{},itemNotes:{},notes:"",measures:[],overall:"auto",assumeOk:false}; rr.measures=(rr.measures||[]).filter(function(_,i){return i!==idx}); var next=Object.assign({},s); next[n]=rr; return next; });
                }}, 'Eliminar')
              );
              list.appendChild(li);
            });
            return list;
          })()
        ),
        
        // Observaciones
        el('section',{class:'card'},
          el('h3',null,'Observaciones Generales de la Residencia'),
          (function(){
            var ta=el('textarea',{style:{width:'100%',minHeight:'90px'}});
            ta.value=r.notes||""; ta.addEventListener('input', function(){ setNotes(ta.value); });
            return ta;
          })()
        ),
        
        // Estado Global
        el('section',{class:'container',style:{paddingLeft:0, marginTop:'16px'}},
          el('span',null,'Estado global (anular cálculo automático): '),
          ['ok','fail','pending','auto'].map(function(s){
            var isActive = r.overall===s || (r.overall==='auto' && s==='auto');
            var color = s==="auto"?"#334155":(s==="ok"?COLORS.ok:s==="fail"?COLORS.fail:COLORS.review);
            var btn=el('span',{class:'badge'+(isActive?' active':''), style:{background:isActive?color:COLORS.none, color:isActive?COLORS.white:COLORS.dark, borderColor:color}, onclick:function(){ setOverallState(s); }}, labelState(s));
            return btn;
          })
        ),
        el('footer',{class:'container kv'}, 'Versión de la aplicación: ' + APP_VERSION)
      );
      root.appendChild(main);
      return root;
    }

    return root;
  }

  // --- Render & Boot ---
  
  function render(state){
    try{
      var root = document.getElementById('app');
      if (!root) return;
      root.innerHTML='';
      root.appendChild(MainView(state));
      if (overlay) overlay.classList.add('hidden');
    }catch(e){ showError(e); }
  }

  // Inicialización de la aplicación
  onStateChange(render); // Suscribir la función de renderizado
  applyRoute(); // Cargar la ruta y realizar el primer renderizado
})();
