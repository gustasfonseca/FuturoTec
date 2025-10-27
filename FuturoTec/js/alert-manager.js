/**
 * alert-manager.js
 * * Este módulo gerencia e exibe alertas estilizados (toasts/snackbars)
 * em todas as páginas do site.
 */

// 1. Definição da Estrutura HTML do Alerta (Para ser inserida no DOM)
const ALERT_CONTAINER_ID = 'custom-alert-container';

/**
 * Cria o contêiner de alerta se ele ainda não existir no DOM.
 * Deve ser chamado antes de exibir o primeiro alerta.
 */
function ensureAlertContainerExists() {
    if (!document.getElementById(ALERT_CONTAINER_ID)) {
        const container = document.createElement('div');
        container.id = ALERT_CONTAINER_ID;
        // Adiciona o contêiner ao corpo do documento
        document.body.appendChild(container);
    }
}

/**
 * Remove um elemento de alerta do DOM após a transição de saída.
 * @param {HTMLElement} alertElement - O elemento de alerta a ser removido.
 */
function hideAlert(alertElement) {
    alertElement.classList.remove('visible');
    
    // Espera a animação de opacidade terminar (definida no CSS)
    alertElement.addEventListener('transitionend', function handler() {
        alertElement.remove();
        alertElement.removeEventListener('transitionend', handler);
    }, { once: true });
}


/**
 * Exibe um alerta estilizado (toast) na tela.
 * * @param {string} message - A mensagem de texto a ser exibida no alerta.
 * @param {'error'|'success'|'info'} [type='error'] - O tipo de alerta para estilização.
 * @param {number} [duration=5000] - Duração em milissegundos antes do fechamento automático.
 * @returns {void}
 */
export function showAlert(message, type = 'error', duration = 5000) {
    ensureAlertContainerExists();
    const container = document.getElementById(ALERT_CONTAINER_ID);
    if (!container) return; // Se o contêiner falhar, sai.

    // 1. Cria o elemento do alerta
    const alertElement = document.createElement('div');
    alertElement.className = `custom-alert ${type}`;
    alertElement.innerHTML = `
        <p class="alert-message">${message}</p>
        <button class="alert-close-btn" aria-label="Fechar Alerta">&times;</button>
    `;

    // 2. Adiciona ao topo do contêiner
    container.prepend(alertElement); // 'prepend' coloca no topo da lista (mais recente em cima)

    // 3. Força um pequeno atraso para iniciar a transição (animação de entrada)
    setTimeout(() => {
        alertElement.classList.add('visible');
    }, 10); 

    // 4. Configura o fechamento automático
    const timer = setTimeout(() => {
        hideAlert(alertElement);
    }, duration);

    // 5. Configura o botão de fechar
    const closeButton = alertElement.querySelector('.alert-close-btn');
    closeButton.addEventListener('click', () => {
        clearTimeout(timer); // Cancela o fechamento automático
        hideAlert(alertElement);
    });
}