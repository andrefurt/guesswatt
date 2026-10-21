/**
 * Page Actions Module
 * The copy button and its menu (markdown, ChatGPT, Claude). Both pages load it; it imports
 * nothing, so sobre.html does not pull in the calculator or the PDF code.
 */

// =============================================================================
// COPY BUTTON - Emil Kowalski blur transition
// =============================================================================

let copyTimeout = null;

/**
 * The page's address without its query: a result's figures live in the query (url-state.js) and
 * never go into the copied text or the AI prompt links
 * @returns {string}
 */
function pageURL() {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  return (local ? 'https://guesswatts.com' : location.origin) + location.pathname;
}

/**
 * Say the copy result to screen readers (#copy-status is visually hidden)
 * @param {string} text
 */
function announce(text) {
  const status = document.getElementById('copy-status');
  if (status) status.textContent = text;
}

/**
 * Extract HTML content from page and convert to markdown format
 * Similar to shadcn/ui - copies the HTML structure as markdown
 */
function extractPageContent() {
  // Clone the document to avoid modifying the original
  const doc = document.cloneNode(true);
  
  // Remove elements we don't want in the copy
  const elementsToRemove = doc.querySelectorAll('script, style, noscript, .visually-hidden, .sr-only, [aria-hidden="true"]');
  elementsToRemove.forEach(el => el.remove());
  
  // Get the main content area
  let mainContent = doc.querySelector('main');
  if (!mainContent) {
    mainContent = doc.querySelector('.content-wrapper');
  }
  if (!mainContent) {
    mainContent = doc.body;
  }
  
  // Convert HTML to string, preserving structure
  let htmlContent = '';
  if (mainContent) {
    // Get innerHTML of main content
    htmlContent = mainContent.innerHTML;
    
    // Clean up: remove empty lines and normalize whitespace
    htmlContent = htmlContent
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();
    
    // Format with proper indentation for readability
    htmlContent = formatHTML(htmlContent);
  }
  
  return htmlContent;
}

/**
 * Format HTML with basic indentation
 */
function formatHTML(html) {
  // Simple formatting - add line breaks after tags
  return html
    .replace(/></g, '>\n<')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

/**
 * Initialize copy button with blur transition
 * Copies current page HTML content (like shadcn/ui)
 */
function initCopyButton() {
  const copyBtn = document.getElementById('copy-btn');
  if (!copyBtn) return;
  
  copyBtn.addEventListener('click', async function(e) {
    // Prevent event bubbling to parent elements
    e.stopPropagation();
    
    // Prevent multiple clicks during animation
    if (copyBtn.classList.contains('copied')) return;
    
    try {
      // Determine page info
      const isAboutPage = window.location.pathname.includes('sobre');
      const pageTitle = isAboutPage ? 'Sobre' : 'GuessWatts';
      const pageDescription = isAboutPage 
        ? 'Informação sobre o projeto GuessWatts'
        : 'Comparador de tarifas de eletricidade em Portugal';
      
      const currentUrl = pageURL();
      
      // Extract HTML content from current page
      const htmlContent = extractPageContent();
      
      // Add frontmatter with metadata
      const frontmatter = `---
title: ${pageTitle}
description: ${pageDescription}
url: ${currentUrl}
---

`;
      
      const fullContent = frontmatter + htmlContent;
      await navigator.clipboard.writeText(fullContent);
      announce('Página copiada.');
      
      // "Copiado" shows only when the copy worked
      copyBtn.classList.add('copied');
      clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        copyBtn.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      announce('Não foi possível copiar a página.');
    }
  });
}

// =============================================================================
// DROPDOWN - Emil Kowalski animations
// =============================================================================

/**
 * Initialize dropdown with smooth animations
 */
function initDropdown() {
  const dropdownWrapper = document.getElementById('dropdown-wrapper');
  const dropdownTrigger = document.getElementById('dropdown-trigger');
  const dropdownMenu = document.getElementById('dropdown-menu');
  
  if (!dropdownWrapper || !dropdownTrigger || !dropdownMenu) return;
  
  const dropdownItems = dropdownMenu.querySelectorAll('.dropdown-item');
  
  // Toggle dropdown on trigger click
  dropdownTrigger.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdownWrapper.classList.toggle('open');
    
    // Update ARIA
    const isOpen = dropdownWrapper.classList.contains('open');
    dropdownTrigger.setAttribute('aria-expanded', isOpen);
  });
  
  // Close on outside click
  document.addEventListener('click', function(e) {
    if (!dropdownWrapper.contains(e.target)) {
      dropdownWrapper.classList.remove('open');
      dropdownTrigger.setAttribute('aria-expanded', 'false');
    }
  });
  
  const close = () => {
    dropdownWrapper.classList.remove('open');
    dropdownTrigger.setAttribute('aria-expanded', 'false');
  };
  
  // Escape closes it; focus inside the menu goes back to the trigger, since the items are hidden
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape' || !dropdownWrapper.classList.contains('open')) return;
    const focusWasInside = dropdownMenu.contains(document.activeElement);
    close();
    if (focusWasInside) dropdownTrigger.focus();
  });
  
  // Tabbing out of the menu closes it (a disclosure, not a modal)
  dropdownWrapper.addEventListener('focusout', function(e) {
    if (e.relatedTarget && !dropdownWrapper.contains(e.relatedTarget)) close();
  });
  
  // Handle dropdown item clicks
  dropdownItems.forEach(item => {
    item.addEventListener('click', function() {
      const action = this.dataset.action;
      
      // Close dropdown with slight delay for click feedback
      setTimeout(() => {
        dropdownWrapper.classList.remove('open');
        dropdownTrigger.setAttribute('aria-expanded', 'false');
      }, 100);
      
      // Handle actions
      handleDropdownAction(action);
    });
  });
}

/**
 * Handle dropdown action
 * @param {string} action - Action identifier
 */
async function handleDropdownAction(action) {
  const copyBtn = document.getElementById('copy-btn');
  
  // Determine which markdown file to use based on current page
  const isAboutPage = window.location.pathname.includes('sobre');
  const markdownFile = isAboutPage ? 'sobre.md' : 'index.md';
  
  switch(action) {
    case 'markdown':
      // Fetch markdown and display in new tab (prevents download, shows as text)
      try {
        const response = await fetch(markdownFile);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${markdownFile}`);
        }
        const markdown = await response.text();
        
        // Create a new window with the markdown content
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <!DOCTYPE html>
            <html lang="pt">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${isAboutPage ? 'Sobre' : 'GuessWatts'} - Markdown</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  max-width: 800px;
                  margin: 0 auto;
                  padding: 2rem;
                  line-height: 1.6;
                  color: #333;
                  background: #fff;
                }
                pre {
                  background: #f5f5f5;
                  padding: 1rem;
                  border-radius: 4px;
                  overflow-x: auto;
                }
                code {
                  background: #f5f5f5;
                  padding: 0.2em 0.4em;
                  border-radius: 3px;
                  font-size: 0.9em;
                }
                pre code {
                  background: transparent;
                  padding: 0;
                }
              </style>
            </head>
            <body>
              <pre><code>${markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
            </body>
            </html>
          `);
          newWindow.document.close();
        }
      } catch (err) {
        console.error('Failed to open markdown:', err);
        // Fallback: try opening the markdown URL directly
        const currentPath = window.location.pathname;
        const markdownUrl = currentPath.endsWith('.html') 
          ? currentPath.replace('.html', '.md')
          : currentPath === '/' || currentPath === '/index.html'
            ? '/index.md'
            : `${currentPath}.md`;
        window.open(markdownUrl, '_blank');
      }
      break;
      
    case 'chatgpt':
      const productionUrl = pageURL();
      const chatGPTPrompt = encodeURIComponent(
        `I'm looking at this GuessWatts electricity tariff comparison tool: ${productionUrl}\n\n` +
        `GuessWatts compares electricity tariffs in Portugal using official ERSE data. ` +
        `Help me get a good electricity proposal using GuessWatts's algorithm, based on my consumption, ` +
        `to see if I'm paying more than I should and missing better proposals. ` +
        `Be ready to explain how to use the tool, interpret results, and guide me through the process.`
      );
      window.open(`https://chatgpt.com/?q=${chatGPTPrompt}`, '_blank');
      break;
      
    case 'claude':
      const productionUrlClaude = pageURL();
      const claudePrompt = encodeURIComponent(
        `I'm looking at this GuessWatts electricity tariff comparison tool: ${productionUrlClaude}\n\n` +
        `GuessWatts compares electricity tariffs in Portugal using official ERSE data. ` +
        `Help me get a good electricity proposal using GuessWatts's algorithm, based on my consumption, ` +
        `to see if I'm paying more than I should and missing better proposals. ` +
        `Be ready to explain how to use the tool, interpret results, and guide me through the process.`
      );
      window.open(`https://claude.ai/new?q=${claudePrompt}`, '_blank');
      break;
  }
}

/**
 * Initialize the copy button and its menu
 */
export function initPageActions() {
  initCopyButton();
  initDropdown();
}
