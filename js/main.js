// js/main.js
import { getState, onStateChange, loadInitialState, applyRoute } from './state.js';
import { Header, AuthView, PlanView, ParteView, TrabajosView } from './views.js';
// CORRECCIÓN: Importar 'el' de utils.js para resolver el ReferenceError
import { el } from './utils.js'; 

// --- Global Utils & Safe Boot ---
const overlay = document.getElementById('error-overlay');
const errlog = document.getElementById('errlog');
const reloadBtn = document.getElementById('reload-btn');
if (reloadBtn) reloadBtn.addEventListener('click', () => location.reload());

function showError(e) {
    try {
        if (overlay) overlay.classList.remove('hidden');
        const message = (e && (e.stack || e.message || e.toString())) || String(e);
        if (errlog) errlog.textContent = message;
        console.error("Application Error:", message);
        // Mostrar alerta en caso de error crítico
        if (!overlay.classList.contains('hidden')) {
             alert("Error crítico en la aplicación. Revisa la consola o recarga.\n" + message.substring(0, 100));
        }
    } catch (_) {}
}
window.addEventListener('error', (ev) => showError(ev.error || ev.message));
window.addEventListener('unhandledrejection', (ev) => showError(ev.reason || ev));


// --- App Container ---
const app = document.getElementById('app');

// --- Render Loop ---
function render(state) {
    if (!app) return;
    app.innerHTML = ''; // Limpiar la app en cada renderizado

    // Renderizar Header (navegación)
    if (state.page !== "auth") {
        app.appendChild(Header(state)); 
    }

    // Renderizar el contenido principal
    const mainContent = el('main', { class: 'container' }); 
    switch (state.page) {
        case "auth":
            mainContent.appendChild(AuthView());
            break;
        case "plan":
            mainContent.appendChild(PlanView(state));
            break;
        case "parte":
            mainContent.appendChild(ParteView());
            break;
        case "trabajos":
            mainContent.appendChild(TrabajosView());
            break;
        case "cuenta":
            // Asumimos que la vista de Cuenta se manejará aquí
            mainContent.textContent = 'Vista de Cuenta no implementada.'; 
            break;
        default:
            mainContent.textContent = 'Página no encontrada.';
    }
    app.appendChild(mainContent);
    // Ocultar el overlay de error si el renderizado fue exitoso
    if (overlay) overlay.classList.add('hidden'); 
}


// --- Inicialización ---
function init() {
    // Suscribirse a los cambios de estado para volver a renderizar
    onStateChange(render);

    // Cargar estado inicial (usuarios, datos)
    loadInitialState();

    // Aplicar la ruta inicial (basada en el hash de la URL)
    window.addEventListener("hashchange", applyRoute);
    applyRoute(); 
}

init();
