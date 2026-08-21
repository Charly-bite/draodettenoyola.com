/**
 * Live Canvas Bridge Script
 * Injected / loaded inside the Canvas iframe to enable WYSIWYG editing,
 * hover outlines, double-click inline text editing, and image replacement.
 */
(() => {
  if (window.__CANVAS_BRIDGE_INITIALIZED__) return;
  window.__CANVAS_BRIDGE_INITIALIZED__ = true;

  let isPreviewMode = false;
  let selectedElement = null;
  let hoverElement = null;

  // ─── Inject Canvas Editing Styles ───
  const styleEl = document.createElement('style');
  styleEl.id = 'canvas-bridge-style';
  styleEl.textContent = `
    /* Canvas Bridge Overlays */
    .canvas-hover-outline {
      outline: 2px dashed rgba(20, 168, 161, 0.7) !important;
      outline-offset: 3px !important;
      cursor: pointer !important;
    }
    .canvas-selected-outline {
      outline: 2.5px solid #14A8A1 !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 5px rgba(20, 168, 161, 0.25) !important;
      position: relative !important;
    }
    [contenteditable="true"] {
      outline: 2.5px solid #F59E0B !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.25) !important;
      cursor: text !important;
      min-width: 1ch;
    }
    .canvas-badge {
      position: absolute;
      top: -24px;
      left: 0;
      background: #14A8A1;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      z-index: 999999;
      pointer-events: none;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      line-height: 1.2;
      text-transform: uppercase;
    }
    /* Disable animation freezes while selecting */
    .canvas-no-transition {
      transition: none !important;
    }
  `;
  document.head.appendChild(styleEl);

  // Badge overlay element
  const badgeEl = document.createElement('div');
  badgeEl.className = 'canvas-badge';
  badgeEl.style.display = 'none';
  document.body.appendChild(badgeEl);

  // ─── Helpers ───
  function isTextNode(el) {
    if (!el) return false;
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'li', 'button', 'em', 'strong', 'b', 'i', 'time', 'small'].includes(tag);
  }

  function isImageNode(el) {
    if (!el) return false;
    return el.tagName && el.tagName.toLowerCase() === 'img';
  }

  function getUniqueSelector(el) {
    if (!el || el === document.body) return 'body';
    if (el.id) return `#${el.id}`;
    let path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE && el !== document.body) {
      let selector = el.nodeName.toLowerCase();
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.split(' ').filter(c => c && !c.startsWith('canvas-') && !c.startsWith('reveal'));
        if (classes.length > 0) {
          selector += '.' + classes.slice(0, 2).join('.');
        }
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  }

  function findParentSection(el) {
    let curr = el;
    while (curr && curr !== document.body) {
      if (curr.tagName && (curr.tagName.toLowerCase() === 'section' || curr.tagName.toLowerCase() === 'header' || curr.tagName.toLowerCase() === 'nav' || curr.tagName.toLowerCase() === 'footer')) {
        return curr.id || curr.getAttribute('aria-label') || curr.className || curr.tagName.toLowerCase();
      }
      curr = curr.parentNode;
    }
    return 'General';
  }

  function updateBadge(el) {
    if (!el || isPreviewMode) {
      badgeEl.style.display = 'none';
      return;
    }
    const rect = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.split(' ').filter(c => c && !c.startsWith('canvas-'))[0] || ''
      : '';

    badgeEl.textContent = `${tag}${cls}`;
    badgeEl.style.display = 'block';
    badgeEl.style.top = `${Math.max(4, rect.top + window.scrollY - 22)}px`;
    badgeEl.style.left = `${Math.max(4, rect.left + window.scrollX)}px`;
  }

  function selectElement(el, fromParent = false) {
    if (selectedElement) {
      selectedElement.classList.remove('canvas-selected-outline');
      if (selectedElement.isContentEditable) {
        selectedElement.removeAttribute('contenteditable');
        selectedElement.removeAttribute('spellcheck');
      }
    }

    selectedElement = el;

    if (el) {
      el.classList.add('canvas-selected-outline');
      updateBadge(el);

      const computed = window.getComputedStyle(el);
      const isImg = isImageNode(el);

      // Find nearest link if any
      const linkParent = el.closest('a');
      const href = linkParent ? linkParent.getAttribute('href') || '' : '';

      const payload = {
        type: 'canvas:element-selected',
        tagName: el.tagName.toLowerCase(),
        selector: getUniqueSelector(el),
        id: el.id || '',
        text: isImg ? '' : el.innerText.trim(),
        html: isImg ? '' : el.innerHTML,
        isImage: isImg,
        src: isImg ? el.getAttribute('src') || '' : '',
        alt: isImg ? el.getAttribute('alt') || '' : '',
        href,
        hasLink: !!linkParent,
        sectionId: findParentSection(el),
        styles: {
          color: computed.color,
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          textAlign: computed.textAlign,
          backgroundColor: computed.backgroundColor
        }
      };

      if (!fromParent) {
        window.parent.postMessage(payload, '*');
      }
    } else {
      badgeEl.style.display = 'none';
    }
  }

  // ─── Event Listeners in Canvas Iframe ───

  // Mousemove / Hover
  document.addEventListener('mouseover', (e) => {
    if (isPreviewMode) return;
    const target = e.target;
    if (target === document.body || target === document.documentElement || target === badgeEl) return;

    if (hoverElement && hoverElement !== selectedElement) {
      hoverElement.classList.remove('canvas-hover-outline');
    }

    hoverElement = target;
    if (hoverElement !== selectedElement) {
      hoverElement.classList.add('canvas-hover-outline');
    }
  }, true);

  document.addEventListener('mouseout', (e) => {
    if (isPreviewMode) return;
    if (hoverElement && hoverElement !== selectedElement) {
      hoverElement.classList.remove('canvas-hover-outline');
      hoverElement = null;
    }
  }, true);

  // Click Selection
  document.addEventListener('click', (e) => {
    if (isPreviewMode) return; // Allow normal link clicking in preview mode

    const target = e.target;
    if (target === badgeEl) return;

    // Prevent navigation when in visual editing mode
    e.preventDefault();
    e.stopPropagation();

    selectElement(target);
  }, true);

  // Double Click for Instant Inline Contenteditable
  document.addEventListener('dblclick', (e) => {
    if (isPreviewMode) return;
    const target = e.target;
    if (isImageNode(target)) {
      // For images, request parent image picker
      window.parent.postMessage({
        type: 'canvas:request-image-picker',
        selector: getUniqueSelector(target),
        src: target.getAttribute('src') || ''
      }, '*');
      return;
    }

    if (isTextNode(target) || target.textContent) {
      e.preventDefault();
      e.stopPropagation();

      target.setAttribute('contenteditable', 'true');
      target.setAttribute('spellcheck', 'false');
      target.focus();

      // Notify parent
      window.parent.postMessage({
        type: 'canvas:inline-edit-started',
        selector: getUniqueSelector(target)
      }, '*');
    }
  }, true);

  // Text changes on contenteditable
  document.addEventListener('input', (e) => {
    const target = e.target;
    if (target.isContentEditable) {
      window.parent.postMessage({
        type: 'canvas:text-changed',
        selector: getUniqueSelector(target),
        text: target.innerText,
        html: target.innerHTML
      }, '*');
    }
  }, true);

  document.addEventListener('blur', (e) => {
    const target = e.target;
    if (target.isContentEditable) {
      target.removeAttribute('contenteditable');
      target.removeAttribute('spellcheck');
      window.parent.postMessage({
        type: 'canvas:inline-edit-ended',
        selector: getUniqueSelector(target),
        text: target.innerText,
        html: target.innerHTML
      }, '*');
    }
  }, true);

  // ─── Scan Sections Tree ───
  function scanSections() {
    const sections = [];
    const elements = document.querySelectorAll('header, nav, section, footer, .promo-banner');

    elements.forEach((el, idx) => {
      const id = el.id || `section-${idx}`;
      let title = '';

      // Find first heading inside section
      const heading = el.querySelector('h1, h2, h3, .navbar__title, .promo-banner');
      if (heading) {
        title = heading.innerText.trim().slice(0, 45);
      } else if (el.getAttribute('aria-label')) {
        title = el.getAttribute('aria-label');
      } else {
        title = el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ')[0] : '');
      }

      sections.push({
        id,
        tagName: el.tagName.toLowerCase(),
        title: title || `Sección ${idx + 1}`,
        selector: el.id ? `#${el.id}` : getUniqueSelector(el)
      });
    });

    window.parent.postMessage({
      type: 'canvas:sections-scanned',
      sections
    }, '*');
  }

  // ─── Listen to Messages from Parent Window ───
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || !data.type) return;

    switch (data.type) {
      case 'parent:scan-sections':
        scanSections();
        break;

      case 'parent:scroll-to-section':
        if (data.selector) {
          const target = document.querySelector(data.selector);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            selectElement(target, true);
          }
        }
        break;

      case 'parent:update-text':
        if (selectedElement) {
          if (data.html !== undefined) {
            selectedElement.innerHTML = data.html;
          } else if (data.text !== undefined) {
            selectedElement.innerText = data.text;
          }
          updateBadge(selectedElement);
        }
        break;

      case 'parent:update-image':
        if (selectedElement && isImageNode(selectedElement)) {
          if (data.src) {
            selectedElement.setAttribute('src', data.src);
            // If inside <picture>, update <source> srcset as well
            const picture = selectedElement.closest('picture');
            if (picture) {
              const sources = picture.querySelectorAll('source');
              sources.forEach(src => src.setAttribute('srcset', data.src));
            }
          }
          if (data.alt !== undefined) {
            selectedElement.setAttribute('alt', data.alt);
          }
          if (data.objectPosition) {
            selectedElement.style.objectPosition = data.objectPosition;
          }
          updateBadge(selectedElement);
        }
        break;

      case 'parent:update-style':
        if (selectedElement && data.property && data.value !== undefined) {
          selectedElement.style[data.property] = data.value;
        }
        break;

      case 'parent:set-preview-mode':
        isPreviewMode = !!data.enabled;
        if (isPreviewMode) {
          if (selectedElement) {
            selectedElement.classList.remove('canvas-selected-outline');
            if (selectedElement.isContentEditable) {
              selectedElement.removeAttribute('contenteditable');
            }
          }
          if (hoverElement) {
            hoverElement.classList.remove('canvas-hover-outline');
          }
          badgeEl.style.display = 'none';
        }
        break;

      case 'parent:get-serialized-html':
        // Clean temporary canvas classes before serializing
        document.querySelectorAll('.canvas-hover-outline').forEach(e => e.classList.remove('canvas-hover-outline'));
        document.querySelectorAll('.canvas-selected-outline').forEach(e => e.classList.remove('canvas-selected-outline'));
        badgeEl.style.display = 'none';

        // Remove bridge style and badge temporarily from DOM for clean export
        const tempStyle = document.getElementById('canvas-bridge-style');
        if (tempStyle) tempStyle.remove();
        badgeEl.remove();

        const cleanDoc = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;

        // Restore bridge style and badge
        document.head.appendChild(styleEl);
        document.body.appendChild(badgeEl);

        window.parent.postMessage({
          type: 'canvas:serialized-html-response',
          html: cleanDoc,
          page: data.page || 'index.html'
        }, '*');
        break;
    }
  });

  // Initial notify parent that bridge is ready
  window.parent.postMessage({ type: 'canvas:bridge-ready' }, '*');
  // Initial scan
  setTimeout(scanSections, 400);
})();
