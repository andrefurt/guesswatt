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

/**
 * AppCopySplitButton Component
 * Split button with copy functionality and dropdown trigger
 * 
 * Slots:
 * - menu: Dropdown menu content
 * 
 * Events:
 * - copy: Dispatched when copy segment is clicked
 * - toggle: Dispatched when dropdown trigger is clicked
 */
class AppCopySplitButton extends HTMLElement {
  constructor() {
    super();
    
    const shadowRoot = this.attachShadow({ mode: 'open' });
    
    shadowRoot.innerHTML = `
      <style>
        @import url('https://unpkg.com/@phosphor-icons/web@2.0.3/src/regular/style.css');
        
        :host {
          display: inline-block;
          box-sizing: border-box;
        }
        
        * {
          box-sizing: border-box;
        }
        
        /* Outer Wrapper - The Structure */
        .outer-shell {
          display: block;
          border: 0.5px solid var(--border);
          border-radius: var(--radius-md);
          padding: 0;
          background: transparent;
          overflow: hidden;
        }
        
        /* Inner Wrapper - The Glass Container */
        .inner-glass {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          height: 36px;
          border: 0.5px solid var(--color-surface);
          border-radius: calc(var(--radius-md) - 0.5px);
          background: color-mix(in srgb, var(--color-surface), transparent 60%);
          backdrop-filter: blur(8px);
          transition: var(--transition-colors);
        }
        
        :host(:hover) .inner-glass {
          background-color: var(--color-surface);
        }
        
        /* Copy Segment */
        .segment-copy {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: 0 12px;
          background: none;
          border: none;
          cursor: pointer;
          user-select: none;
          transition: var(--transition-colors);
          font-family: var(--font-sans);
          font-size: var(--text-sm-size);
          font-weight: var(--text-sm-weight);
          line-height: var(--text-sm-leading);
          color: var(--foreground);
        }
        
        .segment-copy:hover {
          background-color: color-mix(in srgb, var(--color-surface), transparent 20%);
        }
        
        /* Separator */
        .separator {
          width: 1px;
          background-color: var(--border);
          flex-shrink: 0;
        }
        
        /* Trigger Segment */
        .segment-trigger {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          background: none;
          border: none;
          cursor: pointer;
          user-select: none;
          transition: var(--transition-colors);
          color: var(--foreground);
        }
        
        .segment-trigger:hover {
          background-color: color-mix(in srgb, var(--color-surface), transparent 20%);
        }
        
        /* Icons */
        .segment-copy i,
        .segment-trigger i {
          font-size: 16px;
          line-height: 1;
          display: block;
        }
        
        .segment-copy span {
          font-size: var(--text-sm-size);
          font-weight: var(--text-sm-weight);
          line-height: var(--text-sm-leading);
        }
      </style>
      <div class="outer-shell">
        <div class="inner-glass">
          <button type="button" class="segment-copy" part="copy-button">
            <i class="ph ph-copy" part="copy-icon"></i>
            <span part="copy-text">Copy page</span>
          </button>
          <div class="separator" part="separator"></div>
          <button type="button" class="segment-trigger" part="trigger-button">
            <i class="ph ph-caret-down" part="trigger-icon"></i>
          </button>
          <slot name="menu"></slot>
        </div>
      </div>
    `;
    
    this.copySegment = shadowRoot.querySelector('.segment-copy');
    this.triggerSegment = shadowRoot.querySelector('.segment-trigger');
    this.copyIcon = shadowRoot.querySelector('.segment-copy i');
    this.copyText = shadowRoot.querySelector('.segment-copy span');
    
    this.isCopied = false;
    this.copyTimeout = null;
    
    // Attach event listeners
    this.copySegment.addEventListener('click', () => this.handleCopyClick());
    this.triggerSegment.addEventListener('click', () => this.handleToggleClick());
  }
  
  handleCopyClick() {
    if (this.isCopied) return;
    
    // Dispatch copy event
    this.dispatchEvent(new CustomEvent('copy', {
      bubbles: true,
      cancelable: true
    }));
    
    // Update UI to "Copied" state
    this.copyIcon.className = 'ph ph-check';
    this.copyText.textContent = 'Copied';
    this.isCopied = true;
    
    // Revert after 3 seconds
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }
    this.copyTimeout = setTimeout(() => {
      this.copyIcon.className = 'ph ph-copy';
      this.copyText.textContent = 'Copy page';
      this.isCopied = false;
    }, 3000);
  }
  
  handleToggleClick() {
    // Dispatch toggle event
    this.dispatchEvent(new CustomEvent('toggle', {
      bubbles: true,
      cancelable: true
    }));
  }
  
  disconnectedCallback() {
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }
  }
}

// Register custom elements
customElements.define('app-card', AppCard);
customElements.define('app-tabs', AppTabs);
customElements.define('app-form-section', AppFormSection);
customElements.define('app-result-section', AppResultSection);
customElements.define('app-copy-split-button', AppCopySplitButton);

