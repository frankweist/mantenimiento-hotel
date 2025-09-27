(function () {
  var el = document.getElementById('app');
  if (!el) { document.body.innerHTML = 'Error: #app no encontrado'; return; }
  el.innerHTML = '<div style="padding:12px;font-family:system-ui">OK: app.js cargado (placeholder)</div>';
  console.log('placeholder OK');
})();
