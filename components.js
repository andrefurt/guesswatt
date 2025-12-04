/**
 * Web Components for GuessWatt
 * 
 * Native Web Components using Shadow DOM and Slots.
 * Business logic remains in app.js - components only provide structure.
 */

/**
 * AppCard Component
 * Main container for calculator sections and result displays
 * 
 * Slots:
 * - header: Header content (tabs, title, etc.)
 * - default: Main content (forms, results, etc.)
 * 
 * Uses container queries to adapt internal layout based on card width
 */
class AppCard extends HTMLElement {
  constructor() {
    super();
    
    const shadowRoot = this.attachShadow({ mode: 'open' });
    
    shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background-color: var(--color-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-md);
          padding: var(--space-6);
          container-type: inline-size;
        }
        
        ::slotted([slot="header"]) {
          margin-block-end: var(--space-4);
        }
        
        /* Container query: stack content vertically on narrow cards */
        @container (max-width: 25rem) {
          ::slotted([slot="header"]) {
            margin-block-end: var(--space-3);
          }
        }
      </style>
      <slot name="header"></slot>
      <slot></slot>
    `;
  }
}

/**
 * AppTabs Component
 * Tab navigation container
 * 
 * Slots:
 * - default: Tab container with buttons (projected from light DOM)
 */
class AppTabs extends HTMLElement {
  constructor() {
    super();
    
    const shadowRoot = this.attachShadow({ mode: 'open' });
    
    shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        
        /* Style the tabs container and buttons via slotted content */
        ::slotted(.tabs) {
          display: flex;
          gap: var(--space-2);
        }
        
        ::slotted(.tabs button) {
          display: inline-block;
          padding: var(--space-2) var(--space-4);
          background-color: transparent;
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition-colors);
        }
        
        ::slotted(.tabs button:hover) {
          background-color: var(--color-gray-1);
        }
        
        ::slotted(.tabs button.active) {
          background-color: var(--color-accent-soft);
          border-color: var(--color-accent);
        }
      </style>
      <slot></slot>
    `;
  }
}

/**
 * AppFormSection Component
 * Container for form content
 * 
 * Slots:
 * - default: Form content (projected from light DOM)
 * 
 * Uses container queries to adapt form layout based on component width
 */
class AppFormSection extends HTMLElement {
  constructor() {
    super();
    
    const shadowRoot = this.attachShadow({ mode: 'open' });
    
    shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          container-type: inline-size;
        }
        
        /* Container query: adapt form layout when component is wide enough */
        @container (min-width: 30rem) {
          ::slotted(form) {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
            gap: var(--space-4);
          }
        }
      </style>
      <slot></slot>
    `;
  }
}

/**
 * AppResultSection Component
 * Container for result displays
 * 
 * Slots:
 * - default: Result content (projected from light DOM)
 */
class AppResultSection extends HTMLElement {
  constructor() {
    super();
    
    const shadowRoot = this.attachShadow({ mode: 'open' });
    
    shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          container-type: inline-size;
        }
        
        /* Container query: adapt result layout based on parent width */
        @container (min-width: 30rem) {
          ::slotted(article) {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
            gap: var(--space-4);
          }
        }
      </style>
      <slot></slot>
    `;
  }
}

// Register custom elements
customElements.define('app-card', AppCard);
customElements.define('app-tabs', AppTabs);
customElements.define('app-form-section', AppFormSection);
customElements.define('app-result-section', AppResultSection);

