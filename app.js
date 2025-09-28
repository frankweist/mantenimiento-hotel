(function(){
  // Overlay de errores para evitar pantalla en blanco
  var ov=document.getElementById('error-overlay');
  var lg=document.getElementById('errlog');
  function showError(e){
    try{ ov.style.display='block'; lg.textContent=(e&&(e.stack||e.message||e.toString()))||String(e) }catch(_){}
  }
  window.addEventListener('error',ev=>showError(ev.error||ev.message));
  window.addEventListener('unhandledrejection',ev=>showError(ev.reason||ev));

  // UI mínima
  var app=document.getElementById('app');
  if(!app){ showError('No existe #app'); return; }
  app.innerHTML =
    '<div class="container"><div class="card">OK: app.js cargado (boot limpio)</div></div>';
})();
