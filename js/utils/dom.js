/**
 * GuessWatt - DOM Utilities
 * 
 * Helper functions for DOM manipulation.
 * Keeps main code clean and readable.
 */

/**
 * Query selector shorthand.
 * 
 * @param {string} selector - CSS selector
 * @param {Element} context - Context element (default: document)
 * @returns {Element|null}
 */
export function $(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * Query selector all shorthand.
 * 
 * @param {string} selector - CSS selector
 * @param {Element} context - Context element (default: document)
 * @returns {NodeList}
 */
export function $$(selector, context = document) {
  return context.querySelectorAll(selector);
}

/**
 * Create element with attributes and children.
 * 
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes to set
 * @param {Array|string} children - Child elements or text
 * @returns {Element}
 * 
 * @example
 * createElement('button', { class: 'btn', type: 'submit' }, 'Click me')
 * createElement('div', { class: 'card' }, [header, body])
 */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  
  // Set attributes
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') {
      el.className = value;
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== null && value !== undefined) {
      el.setAttribute(key, value);
    }
  }
  
  // Append children
  if (typeof children === 'string') {
    el.textContent = children;
  } else if (Array.isArray(children)) {
    children.forEach(child => {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        el.appendChild(child);
      }
    });
  }
  
  return el;
}

/**
 * Show element (remove hidden attribute).
 * 
 * @param {Element} el - Element to show
 */
export function show(el) {
  if (el) el.hidden = false;
}

/**
 * Hide element (add hidden attribute).
 * 
 * @param {Element} el - Element to hide
 */
export function hide(el) {
  if (el) el.hidden = true;
}

/**
 * Toggle element visibility.
 * 
 * @param {Element} el - Element to toggle
 * @param {boolean} force - Force state (optional)
 */
export function toggle(el, force) {
  if (el) {
    el.hidden = force !== undefined ? !force : !el.hidden;
  }
}

/**
 * Add event listener with automatic cleanup.
 * Returns a function to remove the listener.
 * 
 * @param {Element} el - Target element
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {Object} options - Event listener options
 * @returns {Function} Cleanup function
 */
export function on(el, event, handler, options = {}) {
  el.addEventListener(event, handler, options);
  return () => el.removeEventListener(event, handler, options);
}

/**
 * Delegate event handling to parent element.
 * Useful for dynamic content.
 * 
 * @param {Element} parent - Parent element
 * @param {string} event - Event name
 * @param {string} selector - Child selector to match
 * @param {Function} handler - Event handler
 * @returns {Function} Cleanup function
 * 
 * @example
 * delegate(list, 'click', '.item', (e, item) => console.log(item))
 */
export function delegate(parent, event, selector, handler) {
  const delegatedHandler = (e) => {
    const target = e.target.closest(selector);
    if (target && parent.contains(target)) {
      handler(e, target);
    }
  };
  
  parent.addEventListener(event, delegatedHandler);
  return () => parent.removeEventListener(event, delegatedHandler);
}

/**
 * Wait for DOM to be ready.
 * 
 * @param {Function} callback - Function to run when ready
 */
export function ready(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

/**
 * Debounce function calls.
 * 
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
