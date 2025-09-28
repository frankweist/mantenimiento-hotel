import { getState, onStateChange, loadInitialState, applyRoute } from './state.js';
import { Header, AuthView, PlanView, ParteView, TrabajosView } from './views.js';

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
        app.appendChild(Header(state));
    }

    // Renderizar la página actual
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
        // Añadir una vista para 'cuenta' si es necesario
        // case "cuenta":
        //     mainContent.appendChild(AccountView()); 
        //     break;
        default:
            mainContent.textContent = 'Página no encontrada.';
    }
    app.appendChild(mainContent);
}


// --- Inicialización ---
function init() {
    // Suscribirse a los cambios de estado para volver a renderizar
    onStateChange(render);

    // Cargar estado inicial (usuarios, etc.)
    loadInitialState();

    // Aplicar la ruta inicial (basada en el hash de la URL)
    window.addEventListener("hashchange", applyRoute);
    applyRoute(); // Llamada inicial para cargar la vista correcta
}

// Iniciar la aplicación
init();