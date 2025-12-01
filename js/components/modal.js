/**
 * Accessible Modal Component
 * Uses native <dialog> element with focus trapping
 * 
 * @module components/modal
 */

/**
 * Creates an accessible modal dialog.
 * 
 * @param {Object} options - Modal configuration
 * @param {string} options.id - Unique modal ID
 * @param {string} options.title - Modal title
 * @param {string} options.content - Modal body HTML content
 * @param {string} [options.confirmText='Entendi'] - Confirm button text
 * @param {string} [options.cancelText] - Cancel button text (if provided, shows cancel button)
 * @param {Function} [options.onConfirm] - Callback when confirmed
 * @param {Function} [options.onCancel] - Callback when cancelled
 * @param {Function} [options.onClose] - Callback when closed (any method)
 * @returns {{ open: Function, close: Function, destroy: Function, element: HTMLDialogElement }}
 * 
 * @example
 * const cpeModal = createModal({
 *   id: 'cpe-modal',
 *   title: 'Onde encontrar o CPE?',
 *   content: '<p>O CPE está na tua fatura...</p>',
 *   confirmText: 'Entendi'
 * });
 * 
 * // Open modal
 * cpeModal.open();
 * 
 * // Close modal
 * cpeModal.close();
 */
export function createModal({
  id,
  title,
  content,
  confirmText = 'Entendi',
  cancelText,
  onConfirm,
  onCancel,
  onClose
}) {
  // Create dialog element
  const dialog = document.createElement('dialog');
  dialog.id = id;
  dialog.className = 'modal';
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  
  // Build modal HTML
  dialog.innerHTML = `
    <div class="modal-content stack">
      <header class="modal-header">
        <h2 class="modal-title" id="${id}-title">${title}</h2>
        <button type="button" class="modal-close" aria-label="Fechar">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 5L5 15M5 5l10 10"/>
          </svg>
        </button>
      </header>
      <div class="modal-body">
        ${content}
      </div>
      <footer class="modal-footer">
        ${cancelText ? `<button type="button" class="button button-secondary" data-action="cancel">${cancelText}</button>` : ''}
        <button type="button" class="button button-primary" data-action="confirm">${confirmText}</button>
      </footer>
    </div>
  `;
  
  // Add to DOM
  document.body.appendChild(dialog);
  
  // Get elements
  const closeBtn = dialog.querySelector('.modal-close');
  const confirmBtn = dialog.querySelector('[data-action="confirm"]');
  const cancelBtn = dialog.querySelector('[data-action="cancel"]');
  
  // Track previous active element for focus restoration
  let previousActiveElement = null;
  
  /**
   * Opens the modal
   */
  function open() {
    previousActiveElement = document.activeElement;
    dialog.showModal();
    
    // Focus first focusable element
    const firstFocusable = dialog.querySelector('button, [href], input, select, textarea');
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }
  
  /**
   * Closes the modal
   */
  function close() {
    dialog.close();
    
    // Restore focus
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      previousActiveElement.focus();
    }
    
    if (onClose) {
      onClose();
    }
  }
  
  /**
   * Removes modal from DOM
   */
  function destroy() {
    dialog.remove();
  }
  
  // Event handlers
  function handleClose() {
    close();
  }
  
  function handleConfirm() {
    if (onConfirm) {
      onConfirm();
    }
    close();
  }
  
  function handleCancel() {
    if (onCancel) {
      onCancel();
    }
    close();
  }
  
  function handleKeydown(event) {
    // Close on Escape (native dialog behavior, but we add callback)
    if (event.key === 'Escape') {
      if (onClose) {
        onClose();
      }
    }
    
    // Trap focus within modal
    if (event.key === 'Tab') {
      const focusableElements = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }
  
  function handleBackdropClick(event) {
    // Close when clicking backdrop (outside modal content)
    if (event.target === dialog) {
      close();
    }
  }
  
  // Attach event listeners
  closeBtn.addEventListener('click', handleClose);
  confirmBtn.addEventListener('click', handleConfirm);
  if (cancelBtn) {
    cancelBtn.addEventListener('click', handleCancel);
  }
  dialog.addEventListener('keydown', handleKeydown);
  dialog.addEventListener('click', handleBackdropClick);
  
  return {
    open,
    close,
    destroy,
    element: dialog
  };
}

/**
 * Creates a simple confirmation modal.
 * 
 * @param {Object} options - Modal configuration
 * @param {string} options.title - Modal title
 * @param {string} options.message - Confirmation message
 * @param {string} [options.confirmText='Confirmar'] - Confirm button text
 * @param {string} [options.cancelText='Cancelar'] - Cancel button text
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 * 
 * @example
 * const confirmed = await confirm({
 *   title: 'Tens a certeza?',
 *   message: 'Esta ação não pode ser desfeita.'
 * });
 */
export function confirm({
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar'
}) {
  return new Promise((resolve) => {
    const modal = createModal({
      id: `confirm-${Date.now()}`,
      title,
      content: `<p>${message}</p>`,
      confirmText,
      cancelText,
      onConfirm: () => {
        modal.destroy();
        resolve(true);
      },
      onCancel: () => {
        modal.destroy();
        resolve(false);
      },
      onClose: () => {
        // If closed without confirm/cancel (backdrop, escape)
        setTimeout(() => {
          if (document.body.contains(modal.element)) {
            modal.destroy();
            resolve(false);
          }
        }, 100);
      }
    });
    
    modal.open();
  });
}

export default { createModal, confirm };
