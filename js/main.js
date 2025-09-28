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
        // Ocultar overlay al recargar, si no es un error persistente
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

    // Renderizar Header (siempre que no estemos en la vista de autenticación)
    if (state.page !== "auth") {
        // Asegúrese de que Header reciba el helper 'el' si lo necesita
        app.appendChild(Header(state)); 
    }

    // Renderizar la página actual
    // CORRECCIÓN: Usar 'el' de la importación
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
            mainContent.appendChild(AccountView());
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

    // Cargar estado inicial (usuarios, etc.)
    loadInitialState();

    // Aplicar la ruta inicial (basada en el hash de la URL)
    window.addEventListener("hashchange", applyRoute);
    applyRoute(); 
}

init();
