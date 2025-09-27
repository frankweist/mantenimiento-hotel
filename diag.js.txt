(async function(){
  const out = document.getElementById('out');
  const log = s => out.textContent += '\n' + s;
  try{
    const u = './app.js?v=' + Date.now();
    log('GET ' + u);
    const r = await fetch(u, {cache:'no-store'});
    log('HTTP ' + r.status + ' ' + (r.statusText||''));
    const ct = r.headers.get('content-type')||'?';
    log('Content-Type: ' + ct);
    const t = await r.text();
    log('Bytes: ' + t.length);
    log('Inicio: ' + t.slice(0,80).replace(/\n/g,' '));
  }catch(e){ log('Error: ' + (e.message||e)); }
})();
