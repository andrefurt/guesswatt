/**
 * Toast Notification Component
 * Minimal, accessible notifications
 * 
 * @module components/toast
 */

/** Toast container element */
let container = null;

/** Active toasts for cleanup */
const activeToasts = new Set();

/**
 * Initialize toast container (called automatically on first toast)
 */
function initContainer() {
  if (container) return;
  
  container = document.createElement('div');
  container.className = 'toast-container';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'true');
  document.body.appendChild(container);
}

/**
 * Creates and shows a toast notification.
 * 
 * @param {Object} options - Toast configuration
 * @param {string} options.message - Toast message
 * @param {('success'|'error'|'info')} [options.type='success'] - Toast type
 * @param {number} [options.duration=3000] - Duration in ms (0 for persistent)
 * @param {string} [options.icon] - Custom icon HTML (optional)
 * @returns {{ dismiss: Function }} - Methods to control the toast
 * 
 * @example
 * // Simple success toast
 * toast({ message: 'Link copiado' });
 * 
 * // Error toast
 * toast({ message: 'Algo correu mal', type: 'error' });
 * 
 * // Persistent toast (requires manual dismiss)
 * const t = toast({ message: 'A processar...', duration: 0 });
 * // Later: t.dismiss();
 */
export function toast({
  message,
  type = 'success',
  duration = 3000,
  icon
}) {
  initContainer();
  
  // Create toast element
  const toastEl = document.createElement('div');
  toastEl.className = `toast toast-${type}`;
  
  // Default icons by type
  const icons = {
    success: '<svg class="toast-icon" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg class="toast-icon" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2"/><path d="M8 5v4M8 11v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    info: '<svg class="toast-icon" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2"/><path d="M8 7v4M8 5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  
  const iconHtml = icon || icons[type] || icons.info;
  
  toastEl.innerHTML = `
    ${iconHtml}
    <span class="toast-message">${message}</span>
  `;
  
  // Add to container
  container.appendChild(toastEl);
  activeToasts.add(toastEl);
  
  // Dismiss function
  function dismiss() {
    if (!toastEl.parentNode) return;
    
    toastEl.classList.add('is-leaving');
    
    // Remove after animation
    const handleAnimationEnd = () => {
      toastEl.removeEventListener('animationend', handleAnimationEnd);
      toastEl.remove();
      activeToasts.delete(toastEl);
    };
    
    toastEl.addEventListener('animationend', handleAnimationEnd);
    
    // Fallback if animation doesn't fire
    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.remove();
        activeToasts.delete(toastEl);
      }
    }, 200);
  }
  
  // Auto-dismiss
  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
  
  return { dismiss };
}

/**
 * Shows a success toast.
 * @param {string} message - Toast message
 * @param {number} [duration=3000] - Duration in ms
 */
export function success(message, duration = 3000) {
  return toast({ message, type: 'success', duration });
}

/**
 * Shows an error toast.
 * @param {string} message - Toast message
 * @param {number} [duration=4000] - Duration in ms (longer for errors)
 */
export function error(message, duration = 4000) {
  return toast({ message, type: 'error', duration });
}

/**
 * Shows an info toast.
 * @param {string} message - Toast message
 * @param {number} [duration=3000] - Duration in ms
 */
export function info(message, duration = 3000) {
  return toast({ message, type: 'info', duration });
}

/**
 * Dismisses all active toasts.
 */
export function dismissAll() {
  activeToasts.forEach(toastEl => {
    if (toastEl.parentNode) {
      toastEl.classList.add('is-leaving');
      setTimeout(() => toastEl.remove(), 200);
    }
  });
  activeToasts.clear();
}

export default { toast, success, error, info, dismissAll };
