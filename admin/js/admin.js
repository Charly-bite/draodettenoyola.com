/**
 * Admin Panel — Core JavaScript
 * SPA router, auth, content editor, blog manager, image manager
 */
const Admin = (() => {
  // ═══════════════════════════════════════
  //  CONFIG & STATE
  // ═══════════════════════════════════════
  const API = '/api';
  let currentPage = 'dashboard';
  let blogEditingSlug = null;

  // ─── Auth helpers ───
  function getToken() { return sessionStorage.getItem('admin_token'); }
  function setToken(token) { sessionStorage.setItem('admin_token', token); }
  function clearToken() { sessionStorage.removeItem('admin_token'); }

  function authHeaders() {
    return {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    };
  }

  function authHeadersMultipart() {
    return { 'Authorization': `Bearer ${getToken()}` };
  }

  // ─── Fetch wrapper ───
  async function apiFetch(endpoint, options = {}) {
    try {
      const res = await fetch(`${API}${endpoint}`, options);
      if (res.status === 401) {
        toast('Sesión expirada. Inicia sesión de nuevo.', 'error');
        logout();
        return null;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error del servidor');
      return data;
    } catch (err) {
      toast(err.message, 'error');
      return null;
    }
  }

  // ═══════════════════════════════════════
  //  TOAST NOTIFICATIONS
  // ═══════════════════════════════════════
  function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `
      <span>${message}</span>
      <button class="toast__close" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  // ═══════════════════════════════════════
  //  AUTH MODULE
  // ═══════════════════════════════════════
  async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errorEl = document.getElementById('login-error');
    const username = document.getElementById('login-user').value;
    const password = document.getElementById('login-pass').value;

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Verificando...';
    errorEl.hidden = true;

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.error;
        errorEl.hidden = false;
        return;
      }

      setToken(data.token);
      showAdminShell();
      toast('¡Bienvenido al panel de administración!', 'success');
    } catch (err) {
      errorEl.textContent = 'Error de conexión con el servidor';
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Iniciar Sesión</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
    }
  }

  function logout() {
    clearToken();
    const loginScreen = document.getElementById('login-screen');
    const adminShell = document.getElementById('admin-shell');
    if (loginScreen) {
      loginScreen.hidden = false;
      loginScreen.style.display = 'flex';
    }
    if (adminShell) {
      adminShell.hidden = true;
      adminShell.style.display = 'none';
    }
  }

  function showAdminShell() {
    const loginScreen = document.getElementById('login-screen');
    const adminShell = document.getElementById('admin-shell');
    if (loginScreen) {
      loginScreen.hidden = true;
      loginScreen.style.display = 'none';
    }
    if (adminShell) {
      adminShell.hidden = false;
      adminShell.style.display = 'grid';
    }
    router.navigate(window.location.hash.slice(1) || 'dashboard');
  }

  // ═══════════════════════════════════════
  //  ROUTER
  // ═══════════════════════════════════════
  const router = {
    navigate(page) {
      if (!page || page === '') page = 'dashboard';
      window.location.hash = page;

      // Hide all pages, show target
      document.querySelectorAll('.page').forEach(p => {
        p.hidden = true;
        p.style.display = 'none';
      });
      const target = document.getElementById(`page-${page}`);
      if (target) {
        target.hidden = false;
        target.style.display = 'block';
        currentPage = page;
      }

      // Update sidebar active
      document.querySelectorAll('.sidebar__link[data-page]').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
      });

      // Update topbar title
      const titles = {
        dashboard: 'Dashboard',
        canvas: 'Live Canvas Studio',
        blog: 'Blog Manager',
        images: 'Gestor de Imágenes',
        waos: 'WhatsApp AI Bot (WAOS)',
        heatmap: 'Mapa de Calor de Clics',
        seo: 'Centro SEO & Contenido IA'
      };
      document.getElementById('topbar-title').textContent = titles[page] || 'Dashboard';

      // Load page data
      switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'canvas': loadLiveCanvas(); break;
        case 'blog': loadBlogList(); break;
        case 'images': loadImages(); break;
        case 'waos': refreshWaos(); break;
        case 'heatmap': loadHeatmap(); break;
        case 'seo': loadSeoOverview(); break;
      }
    }
  };

  // ═══════════════════════════════════════
  //  DASHBOARD
  // ═══════════════════════════════════════
  async function loadDashboard() {
    // Load stats
    const posts = await apiFetch('/blog/posts', { headers: authHeaders() });
    const images = await apiFetch('/content/images', { headers: authHeaders() });
    const pages = await apiFetch('/content/page-list', { headers: authHeaders() });

    if (posts) {
      document.getElementById('stat-posts').textContent = posts.length;
      document.getElementById('stat-published').textContent = posts.filter(p => p.status === 'published').length;

      // Recent posts
      const recentEl = document.getElementById('recent-posts');
      if (posts.length === 0) {
        recentEl.innerHTML = '<p class="text-muted">No hay posts aún. ¡Crea el primero!</p>';
      } else {
        recentEl.innerHTML = posts.slice(0, 5).map(post => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0; border-bottom: 1px solid var(--admin-border);">
            <div>
              <div style="font-weight: 600; font-size: 0.9rem;">${post.title}</div>
              <span class="blog-item__status blog-item__status--${post.status}" style="margin-top: 0.25rem;">
                ${post.status === 'published' ? '● Publicado' : '○ Borrador'}
              </span>
            </div>
            <button class="btn btn--sm btn--ghost" onclick="Admin.editPost('${post.slug}')">Editar</button>
          </div>
        `).join('');
      }
    }

    if (images) {
      document.getElementById('stat-images').textContent = images.length;
    }
  }

  // ═══════════════════════════════════════
  //  LIVE CANVAS STUDIO CONTROLLER
  // ═══════════════════════════════════════
  let canvasCurrentPage = 'index.html';
  let canvasCurrentDevice = 'desktop';
  let canvasIsPreview = false;
  let canvasSelectedEl = null;
  let canvasSections = [];

  function loadLiveCanvas() {
    const iframe = document.getElementById('canvas-iframe');
    if (!iframe) return;

    // Load available pages in selector
    const pageSelect = document.getElementById('canvas-page-select');
    if (pageSelect) {
      pageSelect.value = canvasCurrentPage;
    }

    // Set src if needed
    const targetSrc = canvasCurrentPage === 'index.html' ? '/?canvas=1' : `/${canvasCurrentPage}?canvas=1`;
    if (!iframe.src.endsWith(targetSrc) && !iframe.src.endsWith(canvasCurrentPage)) {
      iframe.src = targetSrc;
    }

    // If iframe already loaded, inject bridge immediately
    try {
      const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
      if (doc && (doc.readyState === 'complete' || doc.readyState === 'interactive')) {
        injectCanvasBridge();
      }
    } catch (e) {}

    iframe.onload = () => {
      injectCanvasBridge();
    };

    // Load modal gallery images
    loadModalGallery();
  }

  function injectCanvasBridge() {
    const iframe = document.getElementById('canvas-iframe');
    if (!iframe) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      if (!doc) return;

      if (!doc.getElementById('canvas-bridge-script')) {
        const script = doc.createElement('script');
        script.id = 'canvas-bridge-script';
        script.src = '/admin/js/canvas-bridge.js?v=' + Date.now();
        doc.body.appendChild(script);
      } else {
        iframe.contentWindow.postMessage({ type: 'parent:scan-sections' }, '*');
      }
    } catch (e) {
      console.warn('Canvas bridge injection note:', e);
    }
  }

  function sendToCanvas(payload) {
    const iframe = document.getElementById('canvas-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(payload, '*');
    }
  }

  function handleCanvasMessage(event) {
    const data = event.data;
    if (!data || !data.type) return;

    switch (data.type) {
      case 'canvas:bridge-ready':
        sendToCanvas({ type: 'parent:scan-sections' });
        break;

      case 'canvas:sections-scanned':
        if (data.sections) {
          canvasSections = data.sections;
          renderSectionsTree(data.sections);
        }
        break;

      case 'canvas:element-selected':
        canvasSelectedEl = data;
        populateInspector(data);
        highlightSectionInTree(data.sectionId);
        break;

      case 'canvas:text-changed':
        const txtInput = document.getElementById('inspector-text-input');
        if (txtInput && canvasSelectedEl && canvasSelectedEl.selector === data.selector) {
          txtInput.value = data.text;
        }
        break;

      case 'canvas:inline-edit-ended':
        if (canvasSelectedEl && canvasSelectedEl.selector === data.selector) {
          canvasSelectedEl.text = data.text;
          canvasSelectedEl.html = data.html;
        }
        break;

      case 'canvas:request-image-picker':
        openImagePickerModal();
        break;

      case 'canvas:serialized-html-response':
        saveCanvasPageToServer(data.page || canvasCurrentPage, data.html);
        break;
    }
  }

  // ─── Sections Tree Renderer ───
  function renderSectionsTree(sections) {
    const container = document.getElementById('canvas-sections-tree');
    if (!container) return;

    if (!sections || sections.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm" style="padding: 1rem;">No se detectaron secciones</p>';
      return;
    }

    const icons = {
      header: '🔝',
      nav: '🧭',
      section: '📑',
      footer: '🦶',
      hero: '🏠',
      promo: '📢',
      services: '🏥',
      ultrasound: '🔬',
      about: '👩‍⚕️',
      gallery: '🖼️',
      testimonials: '💬',
      faq: '❓',
      location: '📍'
    };

    container.innerHTML = sections.map((sec, idx) => {
      let icon = icons[sec.tagName] || '📄';
      const lower = (sec.id + ' ' + sec.title).toLowerCase();
      if (lower.includes('hero')) icon = icons.hero;
      else if (lower.includes('promo')) icon = icons.promo;
      else if (lower.includes('serv')) icon = icons.services;
      else if (lower.includes('ultra')) icon = icons.ultrasound;
      else if (lower.includes('about') || lower.includes('sobre')) icon = icons.about;
      else if (lower.includes('gal')) icon = icons.gallery;
      else if (lower.includes('test')) icon = icons.testimonials;
      else if (lower.includes('faq') || lower.includes('pregunt')) icon = icons.faq;
      else if (lower.includes('loc') || lower.includes('ubic')) icon = icons.location;

      return `
        <div class="canvas-tree-item" data-selector="${sec.selector}" onclick="Admin.jumpToSection('${sec.selector}', this)">
          <span class="canvas-tree-item__title">
            <span>${icon}</span>
            <span>${sec.title}</span>
          </span>
          <span class="canvas-tree-item__badge">${sec.tagName}</span>
        </div>
      `;
    }).join('');
  }

  function jumpToSection(selector, itemEl) {
    sendToCanvas({
      type: 'parent:scroll-to-section',
      selector
    });

    document.querySelectorAll('.canvas-tree-item').forEach(i => i.classList.remove('active'));
    if (itemEl) itemEl.classList.add('active');
  }

  function highlightSectionInTree(sectionId) {
    if (!sectionId) return;
    document.querySelectorAll('.canvas-tree-item').forEach(item => {
      const sel = item.dataset.selector || '';
      if (sel.includes(sectionId)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  // ─── Inspector Controller ───
  function populateInspector(el) {
    const emptyEl = document.getElementById('inspector-empty');
    const formEl = document.getElementById('inspector-form');
    const tagBadge = document.getElementById('inspector-tag-badge');
    const imgTabBtn = document.getElementById('inspector-tab-img-btn');

    if (!el) {
      if (emptyEl) emptyEl.hidden = false;
      if (formEl) formEl.hidden = true;
      if (tagBadge) tagBadge.textContent = 'Selecciona un elemento';
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (formEl) formEl.hidden = false;
    if (tagBadge) tagBadge.textContent = `${el.tagName.toUpperCase()}${el.id ? '#' + el.id : ''}`;

    // Show/hide Image tab
    if (imgTabBtn) {
      imgTabBtn.hidden = !el.isImage;
    }

    if (el.isImage) {
      // Activate Image tab
      switchInspectorTab('image');
      const imgPreview = document.getElementById('inspector-img-preview');
      if (imgPreview) {
        imgPreview.innerHTML = el.src ? `<img src="${el.src}" alt="Preview">` : '<span class="text-muted text-sm">Sin imagen</span>';
      }
      const altInput = document.getElementById('inspector-alt-input');
      if (altInput) altInput.value = el.alt || '';
    } else {
      // Activate Content tab
      switchInspectorTab('content');
      const txtInput = document.getElementById('inspector-text-input');
      if (txtInput) {
        txtInput.value = el.text || el.html || '';
      }

      const linkGroup = document.getElementById('inspector-link-group');
      const hrefInput = document.getElementById('inspector-href-input');
      if (linkGroup && hrefInput) {
        if (el.hasLink || el.tagName === 'a' || el.tagName === 'button') {
          linkGroup.hidden = false;
          hrefInput.value = el.href || '';
        } else {
          linkGroup.hidden = true;
        }
      }
    }
  }

  function switchInspectorTab(tabName) {
    document.querySelectorAll('.inspector-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    document.querySelectorAll('.inspector-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `inspector-pane-${tabName}`);
    });
  }

  function applyInspectorChanges() {
    if (!canvasSelectedEl) return;

    if (canvasSelectedEl.isImage) {
      const altInput = document.getElementById('inspector-alt-input');
      if (altInput) {
        canvasSelectedEl.alt = altInput.value;
        sendToCanvas({
          type: 'parent:update-image',
          alt: altInput.value
        });
      }
    } else {
      const txtInput = document.getElementById('inspector-text-input');
      if (txtInput) {
        canvasSelectedEl.text = txtInput.value;
        sendToCanvas({
          type: 'parent:update-text',
          text: txtInput.value
        });
      }
    }

    toast('Elemento actualizado en el canvas', 'success');
  }

  // ─── Device Switcher ───
  function setCanvasDevice(device) {
    canvasCurrentDevice = device;
    const frame = document.getElementById('canvas-device-frame');
    if (!frame) return;

    frame.classList.remove('tablet', 'mobile');
    if (device === 'tablet') frame.classList.add('tablet');
    else if (device === 'mobile') frame.classList.add('mobile');

    document.querySelectorAll('.canvas-device-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.device === device);
    });
  }

  // ─── Preview Mode Toggle ───
  function toggleCanvasPreview() {
    canvasIsPreview = !canvasIsPreview;
    const btn = document.getElementById('canvas-preview-toggle');
    if (btn) {
      if (canvasIsPreview) {
        btn.classList.remove('btn--secondary');
        btn.classList.add('btn--primary');
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>Modo Editor</span>';
      } else {
        btn.classList.remove('btn--primary');
        btn.classList.add('btn--secondary');
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span>Vista Previa</span>';
      }
    }

    sendToCanvas({
      type: 'parent:set-preview-mode',
      enabled: canvasIsPreview
    });
  }

  // ─── Save Canvas Changes to Backend ───
  function saveLiveCanvas() {
    const saveBtn = document.getElementById('canvas-save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<div class="spinner"></div> Guardando...';
    }

    // Request clean serialized HTML from iframe
    sendToCanvas({
      type: 'parent:get-serialized-html',
      page: canvasCurrentPage
    });
  }

  async function saveCanvasPageToServer(page, html) {
    const saveBtn = document.getElementById('canvas-save-btn');

    try {
      const res = await fetch(`${API}/content/canvas-save`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ page, html })
      });

      const data = await res.json();
      if (res.ok) {
        toast('¡Página guardada y publicada en vivo con éxito! 🎉', 'success');
      } else {
        toast(data.error || 'Error al guardar la página', 'error');
      }
    } catch (err) {
      toast('Error de conexión al guardar canvas', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg><span>Guardar Cambios</span>';
      }
    }
  }

  // ─── Image Picker Modal ───
  async function loadModalGallery() {
    const grid = document.getElementById('modal-images-grid');
    if (!grid) return;

    const images = await apiFetch('/content/images', { headers: authHeaders() });
    if (!images || images.length === 0) {
      grid.innerHTML = '<p class="text-muted text-sm" style="grid-column: 1/-1;">No hay imágenes aún. Sube una arriba.</p>';
      return;
    }

    grid.innerHTML = images.map(img => `
      <div class="modal-img-card" onclick="Admin.selectImageForCanvas('/${img.path}')" title="${img.originalName || img.filename}">
        <img src="/${img.path}" alt="${img.alt || ''}" loading="lazy">
      </div>
    `).join('');
  }

  function openImagePickerModal() {
    const modal = document.getElementById('image-picker-modal');
    if (modal) {
      modal.hidden = false;
      modal.style.display = 'flex';
      loadModalGallery();
    }
  }

  function closeImagePickerModal() {
    const modal = document.getElementById('image-picker-modal');
    if (modal) {
      modal.hidden = true;
      modal.style.display = 'none';
    }
  }

  function selectImageForCanvas(src, objectPosition = '50% 50%') {
    if (canvasSelectedEl) {
      canvasSelectedEl.src = src;
      canvasSelectedEl.objectPosition = objectPosition;
      sendToCanvas({
        type: 'parent:update-image',
        src,
        alt: canvasSelectedEl.alt || '',
        objectPosition
      });

      const preview = document.getElementById('inspector-img-preview');
      if (preview) {
        preview.innerHTML = `<img src="${src}" alt="Preview" style="object-position: ${objectPosition};">`;
      }
      toast('Imagen actualizada en el canvas', 'success');
    }
    closeImagePickerModal();
  }

  function adjustSelectedImageFocal() {
    if (!canvasSelectedEl || !canvasSelectedEl.src) {
      toast('Selecciona una imagen en el canvas primero', 'info');
      return;
    }

    ImageFocalCropper.open(canvasSelectedEl.src, { x: 50, y: 50 }, async (cropRes) => {
      if (cropRes.zoom > 1 || cropRes.rotation !== 0) {
        await uploadImageFromCanvas(cropRes.file, cropRes.objectPosition);
      } else {
        canvasSelectedEl.objectPosition = cropRes.objectPosition;
        sendToCanvas({
          type: 'parent:update-image',
          objectPosition: cropRes.objectPosition
        });
        const preview = document.getElementById('inspector-img-preview');
        if (preview && preview.querySelector('img')) {
          preview.querySelector('img').style.objectPosition = cropRes.objectPosition;
        }
        toast('Punto de enfoque aplicado', 'success');
      }
    });
  }

  async function uploadImageFromCanvas(file, objectPosition = '50% 50%') {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('section', 'canvas');
    formData.append('alt', file.name);

    toast('Subiendo imagen optimizada...', 'info');

    const result = await fetch(`${API}/content/images`, {
      method: 'POST',
      headers: authHeadersMultipart(),
      body: formData
    });

    const data = await result.json();
    if (result.ok && data.image) {
      toast(`Imagen "${file.name}" subida y enfocada con éxito 🎉`, 'success');
      selectImageForCanvas('/' + data.image.path, objectPosition);
    } else {
      toast(data.error || 'Error subiendo imagen', 'error');
    }
  }

  // ═══════════════════════════════════════
  //  BLOG MANAGER
  // ═══════════════════════════════════════
  async function loadBlogList() {
    const listEl = document.getElementById('blog-list');
    const editorEl = document.getElementById('blog-editor');
    if (listEl) {
      listEl.hidden = false;
      listEl.style.display = 'flex';
    }
    if (editorEl) {
      editorEl.hidden = true;
      editorEl.style.display = 'none';
    }
    blogEditingSlug = null;

    const posts = await apiFetch('/blog/posts', { headers: authHeaders() });
    const container = document.getElementById('blog-list');

    if (!posts || posts.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--admin-text-dim);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 1rem;"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
          <p>No hay posts aún. ¡Crea el primero!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map(post => {
      const date = post.updatedAt ? new Date(post.updatedAt).toLocaleDateString('es-MX') : '';
      return `
        <div class="blog-item">
          <div class="blog-item__info">
            <div class="blog-item__title">${post.title}</div>
            <div class="blog-item__meta">
              <span class="blog-item__status blog-item__status--${post.status}">
                ${post.status === 'published' ? '● Publicado' : '○ Borrador'}
              </span>
              <span>${date}</span>
              <span>${post.contentLength || 0} chars</span>
            </div>
          </div>
          <div class="blog-item__actions">
            <button class="btn btn--sm btn--secondary" onclick="Admin.editPost('${post.slug}')">Editar</button>
            ${post.status === 'draft'
              ? `<button class="btn btn--sm btn--primary" onclick="Admin.publishPost('${post.slug}')">Publicar</button>`
              : `<button class="btn btn--sm btn--ghost" onclick="Admin.unpublishPost('${post.slug}')">Despublicar</button>`
            }
            <button class="btn btn--sm btn--danger" onclick="Admin.deletePost('${post.slug}')">Eliminar</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function showBlogEditor(post = null) {
    const listEl = document.getElementById('blog-list');
    const editorEl = document.getElementById('blog-editor');
    if (listEl) {
      listEl.hidden = true;
      listEl.style.display = 'none';
    }
    if (editorEl) {
      editorEl.hidden = false;
      editorEl.style.display = 'block';
    }

    // Reset form
    document.getElementById('blog-form').reset();
    document.getElementById('blog-cover-preview').innerHTML = '';
    document.getElementById('blog-slug').value = '';
    blogEditingSlug = null;

    if (post) {
      blogEditingSlug = post.slug;
      document.getElementById('blog-slug').value = post.slug;
      document.getElementById('blog-title').value = post.title || '';
      document.getElementById('blog-excerpt').value = post.excerpt || '';
      document.getElementById('blog-tags').value = (post.tags || []).join(', ');
      document.getElementById('blog-meta-desc').value = post.metaDescription || '';
      document.getElementById('blog-meta-keys').value = post.metaKeywords || '';
      document.getElementById('blog-content').value = post.content || '';

      if (post.coverImage) {
        document.getElementById('blog-cover-preview').innerHTML = `<img src="/${post.coverImage}" alt="Cover">`;
      }

      // Update publish button text
      document.getElementById('blog-publish-btn').textContent =
        post.status === 'published' ? 'Actualizar y Publicar' : 'Publicar';
    }
  }

  async function editPost(slug) {
    const post = await apiFetch(`/blog/posts/${slug}`, { headers: authHeaders() });
    if (post) showBlogEditor(post);
  }

  async function savePost(publish = false) {
    const form = document.getElementById('blog-form');
    const formData = new FormData(form);

    const slug = blogEditingSlug;
    const method = slug ? 'PUT' : 'POST';
    const endpoint = slug ? `/blog/posts/${slug}` : '/blog/posts';

    const result = await fetch(`${API}${endpoint}`, {
      method,
      headers: authHeadersMultipart(),
      body: formData
    });

    const data = await result.json();

    if (result.ok) {
      toast(slug ? 'Post actualizado correctamente' : 'Post creado correctamente', 'success');

      if (publish && data.post) {
        await publishPost(data.post.slug);
      } else {
        loadBlogList();
      }
    } else {
      toast(data.error || 'Error guardando el post', 'error');
    }
  }

  async function publishPost(slug) {
    const result = await apiFetch(`/blog/posts/${slug}/publish`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (result) {
      toast('Post publicado exitosamente', 'success');
      loadBlogList();
    }
  }

  async function unpublishPost(slug) {
    const result = await apiFetch(`/blog/posts/${slug}/unpublish`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (result) {
      toast('Post despublicado', 'info');
      loadBlogList();
    }
  }

  async function deletePost(slug) {
    if (!confirm('¿Estás seguro de eliminar este post? Esta acción no se puede deshacer.')) return;

    const result = await apiFetch(`/blog/posts/${slug}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (result) {
      toast('Post eliminado', 'success');
      loadBlogList();
    }
  }

  // ═══════════════════════════════════════
  //  IMAGES MANAGER
  // ═══════════════════════════════════════
  async function loadImages() {
    const images = await apiFetch('/content/images', { headers: authHeaders() });
    const grid = document.getElementById('images-grid');

    if (!images || images.length === 0) {
      grid.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--admin-text-dim); grid-column: 1 / -1;">
          <p>No hay imágenes subidas aún. Usa la zona de arriba para subir.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = images.map(img => `
      <div class="image-card">
        <img src="/${img.path}" alt="${img.alt || img.originalName}" class="image-card__img" loading="lazy">
        <div class="image-card__body">
          <div class="image-card__name">${img.originalName || img.filename}</div>
          <div class="image-card__meta">${formatBytes(img.size)} · ${img.section}</div>
          <div class="image-card__actions">
            <button class="btn btn--sm btn--ghost" onclick="Admin.copyImagePath('${img.path}')">📋 Copiar ruta</button>
            <button class="btn btn--sm btn--danger" onclick="Admin.deleteImage('${img.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('section', 'general');
    formData.append('alt', file.name);

    const result = await fetch(`${API}/content/images`, {
      method: 'POST',
      headers: authHeadersMultipart(),
      body: formData
    });

    const data = await result.json();
    if (result.ok) {
      toast(`Imagen "${file.name}" subida correctamente`, 'success');
      loadImages();
    } else {
      toast(data.error || 'Error subiendo imagen', 'error');
    }
  }

  async function deleteImage(imageId) {
    if (!confirm('¿Eliminar esta imagen?')) return;

    const result = await apiFetch(`/content/images/${imageId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (result) {
      toast('Imagen eliminada', 'success');
      loadImages();
    }
  }

  function copyImagePath(path) {
    navigator.clipboard.writeText(path).then(() => {
      toast('Ruta copiada al portapapeles', 'success');
    });
  }

  // ─── Utility ───
  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  // ═══════════════════════════════════════
  //  MARKDOWN PREVIEW
  // ═══════════════════════════════════════
  async function renderMarkdownPreview() {
    const content = document.getElementById('blog-content').value;
    const preview = document.getElementById('blog-preview');

    // Use the server to parse markdown (or a simple client-side fallback)
    try {
      // Simple client-side markdown rendering
      let html = content
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold & italic
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Links
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Images
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')
        // Blockquotes
        .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
        // Unordered lists
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

      html = `<p>${html}</p>`;
      preview.innerHTML = html;
    } catch (err) {
      preview.innerHTML = '<p class="text-muted">Error renderizando preview</p>';
    }
  }

  // ═══════════════════════════════════════
  //  EVENT LISTENERS
  // ═══════════════════════════════════════
  function init() {
    // Check existing token
    if (getToken()) {
      // Verify token
      fetch(`${API}/auth/verify`, { headers: { 'Authorization': `Bearer ${getToken()}` } })
        .then(res => {
          if (res.ok) {
            showAdminShell();
          } else {
            clearToken();
          }
        })
        .catch(() => clearToken());
    }

    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Sidebar navigation
    document.querySelectorAll('.sidebar__link[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        router.navigate(link.dataset.page);

        // Close sidebar on mobile
        document.getElementById('sidebar').classList.remove('open');
      });
    });

    // Sidebar toggle (mobile)
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // Hash routing
    window.addEventListener('hashchange', () => {
      if (getToken()) {
        const page = window.location.hash.slice(1) || 'dashboard';
        router.navigate(page);
      }
    });

    // ─── Blog events ───
    document.getElementById('new-post-btn').addEventListener('click', () => {
      showBlogEditor();
    });

    document.getElementById('blog-back-btn').addEventListener('click', () => {
      loadBlogList();
    });

    document.getElementById('blog-save-btn').addEventListener('click', () => {
      savePost(false);
    });

    document.getElementById('blog-publish-btn').addEventListener('click', () => {
      savePost(true);
    });

    // Editor tabs (Write / Preview)
    document.querySelectorAll('.editor-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        if (target === 'preview') {
          document.getElementById('blog-content').hidden = true;
          document.getElementById('blog-preview').hidden = false;
          renderMarkdownPreview();
        } else {
          document.getElementById('blog-content').hidden = false;
          document.getElementById('blog-preview').hidden = true;
        }
      });
    });

    // Blog cover image preview
    document.getElementById('blog-cover').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          document.getElementById('blog-cover-preview').innerHTML = `<img src="${ev.target.result}" alt="Cover preview">`;
        };
        reader.readAsDataURL(file);
      }
    });

    // ─── Live Canvas Studio Events ───
    window.addEventListener('message', handleCanvasMessage);

    // Page Selector
    const pageSelect = document.getElementById('canvas-page-select');
    if (pageSelect) {
      pageSelect.addEventListener('change', (e) => {
        canvasCurrentPage = e.target.value;
        const iframe = document.getElementById('canvas-iframe');
        if (iframe) {
          const targetSrc = canvasCurrentPage === 'index.html' ? '/?canvas=1' : `/${canvasCurrentPage}?canvas=1`;
          iframe.src = targetSrc;
        }
      });
    }

    // Device Switcher
    document.querySelectorAll('.canvas-device-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setCanvasDevice(btn.dataset.device);
      });
    });

    // Preview Mode Toggle
    const previewToggle = document.getElementById('canvas-preview-toggle');
    if (previewToggle) {
      previewToggle.addEventListener('click', toggleCanvasPreview);
    }

    // Reload Canvas
    const reloadBtn = document.getElementById('canvas-reload-btn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        const iframe = document.getElementById('canvas-iframe');
        if (iframe) {
          iframe.src = iframe.src;
          toast('Canvas recargado', 'info');
        }
      });
    }

    // Save Canvas
    const saveBtn = document.getElementById('canvas-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveLiveCanvas);
    }

    // Filter Sections Tree
    const searchInput = document.getElementById('canvas-section-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.canvas-tree-item').forEach(item => {
          const text = item.textContent.toLowerCase();
          item.style.display = text.includes(query) ? 'flex' : 'none';
        });
      });
    }

    // Inspector Tabs
    document.querySelectorAll('.inspector-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        switchInspectorTab(tab.dataset.tab);
      });
    });

    // Inspector Text Real-Time Sync
    const txtInput = document.getElementById('inspector-text-input');
    if (txtInput) {
      txtInput.addEventListener('input', (e) => {
        if (canvasSelectedEl) {
          canvasSelectedEl.text = e.target.value;
          sendToCanvas({
            type: 'parent:update-text',
            text: e.target.value
          });
        }
      });
    }

    // Inspector Link Sync
    const hrefInput = document.getElementById('inspector-href-input');
    if (hrefInput) {
      hrefInput.addEventListener('input', (e) => {
        if (canvasSelectedEl) {
          canvasSelectedEl.href = e.target.value;
        }
      });
    }

    // Inspector Alt Text Sync
    const altInput = document.getElementById('inspector-alt-input');
    if (altInput) {
      altInput.addEventListener('input', (e) => {
        if (canvasSelectedEl && canvasSelectedEl.isImage) {
          canvasSelectedEl.alt = e.target.value;
          sendToCanvas({
            type: 'parent:update-image',
            alt: e.target.value
          });
        }
      });
    }

    // Inspector Color Chips
    document.querySelectorAll('.color-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (canvasSelectedEl) {
          sendToCanvas({
            type: 'parent:update-style',
            property: 'color',
            value: chip.dataset.color
          });
          toast(`Color aplicado: ${chip.dataset.color}`, 'info');
        }
      });
    });

    // Inspector Alignment Buttons
    document.querySelectorAll('.align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (canvasSelectedEl) {
          sendToCanvas({
            type: 'parent:update-style',
            property: 'textAlign',
            value: btn.dataset.align
          });
        }
      });
    });

    // Inspector Apply Button
    const applyBtn = document.getElementById('inspector-apply-btn');
    if (applyBtn) {
      applyBtn.addEventListener('click', applyInspectorChanges);
    }

    // Image Upload & Gallery in Inspector
    const openGalleryBtn = document.getElementById('inspector-open-gallery-btn');
    if (openGalleryBtn) {
      openGalleryBtn.addEventListener('click', openImagePickerModal);
    }

    const adjustFocalBtn = document.getElementById('inspector-adjust-focal-btn');
    if (adjustFocalBtn) {
      adjustFocalBtn.addEventListener('click', adjustSelectedImageFocal);
    }

    const uploadImgBtn = document.getElementById('inspector-upload-img-btn');
    const fileInput = document.getElementById('inspector-file-input');
    if (uploadImgBtn && fileInput) {
      uploadImgBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          ImageFocalCropper.open(e.target.files[0], { x: 50, y: 50 }, async (cropRes) => {
            await uploadImageFromCanvas(cropRes.file, cropRes.objectPosition);
          });
          e.target.value = '';
        }
      });
    }

    // Modal Events
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeImagePickerModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeImagePickerModal);

    const modalDropZone = document.getElementById('modal-drop-zone');
    const modalImageInput = document.getElementById('modal-image-input');
    if (modalDropZone && modalImageInput) {
      modalDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        modalDropZone.classList.add('dragover');
      });
      modalDropZone.addEventListener('dragleave', () => {
        modalDropZone.classList.remove('dragover');
      });
      modalDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        modalDropZone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) {
          ImageFocalCropper.open(e.dataTransfer.files[0], { x: 50, y: 50 }, async (cropRes) => {
            await uploadImageFromCanvas(cropRes.file, cropRes.objectPosition);
          });
        }
      });
      modalImageInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          ImageFocalCropper.open(e.target.files[0], { x: 50, y: 50 }, async (cropRes) => {
            await uploadImageFromCanvas(cropRes.file, cropRes.objectPosition);
          });
          e.target.value = '';
        }
      });
    }

    // ─── Image upload events (in Images page) ───
    const dropZone = document.getElementById('image-drop-zone');
    const imageInput = document.getElementById('image-upload-input');

    if (dropZone && imageInput) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files[0]) {
          ImageFocalCropper.open(files[0], { x: 50, y: 50 }, async (cropRes) => {
            await uploadImage(cropRes.file);
          });
        }
      });

      imageInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        if (files[0]) {
          ImageFocalCropper.open(files[0], { x: 50, y: 50 }, async (cropRes) => {
            await uploadImage(cropRes.file);
          });
        }
        e.target.value = '';
      });

      dropZone.addEventListener('click', (e) => {
        if (e.target === dropZone || e.target.closest('.image-upload-zone')) {
          imageInput.click();
        }
      });
    }
  }

  // ═══════════════════════════════════════
  //  WAOS CLINICAL BOT + HEATMAP + SEO CENTER
  // ═══════════════════════════════════════
  async function refreshWaos() {
    const data = await apiFetch('/waos/status', { headers: authHeaders() });
    if (!data) return;

    const st = data.waState || {};
    const badge = document.getElementById('waos-status-badge');
    const qrBox = document.getElementById('waos-qr-box');
    const infoEl = document.getElementById('waos-connected-info');
    const aiBtn = document.getElementById('waos-ai-toggle-btn');

    if (badge) {
      if (st.connected) {
        badge.className = 'blog-item__status blog-item__status--published';
        badge.textContent = '● Conectado en Vivo';
      } else if (st.qr) {
        badge.className = 'blog-item__status blog-item__status--draft';
        badge.textContent = '○ Esperando Escaneo de QR';
      } else {
        badge.className = 'blog-item__status blog-item__status--draft';
        badge.textContent = '○ Inicializando QR...';
      }
    }

    if (aiBtn) {
      aiBtn.textContent = st.aiAutoReplyEnabled !== false ? '🤖 IA Activa (Clic para pausar)' : '⏸️ IA en Pausa (Clic para activar)';
    }

    if (qrBox) {
      if (st.connected) {
        qrBox.innerHTML = `<div style="color:#0D7A75; padding:1.5rem; text-align:center;">
          <div style="font-size:3rem; margin-bottom:0.5rem;">✅</div>
          <div style="font-weight:700; font-size:1.05rem;">WhatsApp Vinculado</div>
          <div style="font-size:0.85rem; color:#475569; margin-top:0.25rem;">${st.pushname || 'Dra. Odette'} (${st.phone || 'Activo'})</div>
        </div>`;
        if (infoEl) infoEl.textContent = `Tablas MSSQL activas: ${(data.tables || []).join(' · ')}`;
      } else if (st.qr) {
        const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=8&data=${encodeURIComponent(st.qr)}`;
        qrBox.innerHTML = `<img src="${qrImgUrl}" alt="Código QR WhatsApp Dra. Odette" width="250" height="250" style="display:block; border-radius:8px;">`;
        if (infoEl) infoEl.textContent = 'Listo para escanear desde WhatsApp → Dispositivos vinculados';
      } else {
        qrBox.innerHTML = `<p style="color:#0B1827; font-weight:600; padding:1rem;">Generando código QR en el servidor WAOS...</p>`;
      }
    }

    const tableWrap = document.getElementById('waos-leads-table-wrap');
    if (tableWrap) {
      const leads = data.leads || [];
      if (leads.length === 0) {
        tableWrap.innerHTML = `<p class="text-muted text-sm">Aún no hay pacientes registrados en <code>dbo.odette_patients_leads</code>. Cuando escriban por WhatsApp o usen el Cotizador Web aparecerán aquí automáticamente.</p>`;
      } else {
        tableWrap.innerHTML = `
          <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
            <thead>
              <tr style="border-bottom:1px solid var(--admin-border); text-align:left; color:var(--admin-text-muted);">
                <th style="padding:0.6rem;">Paciente</th>
                <th style="padding:0.6rem;">Teléfono</th>
                <th style="padding:0.6rem;">Servicio / Estudio</th>
                <th style="padding:0.6rem;">Estado</th>
                <th style="padding:0.6rem; text-align:right;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${leads.map(l => `
                <tr style="border-bottom:1px solid var(--admin-border);">
                  <td style="padding:0.6rem; font-weight:600;">${l.patient_name || 'Paciente'}</td>
                  <td style="padding:0.6rem; color:var(--admin-teal);">${l.phone || '-'}</td>
                  <td style="padding:0.6rem;">${l.service_requested || 'Consulta'}</td>
                  <td style="padding:0.6rem;"><span class="blog-item__status blog-item__status--published">${l.appointment_status || 'lead'}</span></td>
                  <td style="padding:0.6rem; text-align:right;">
                    <button type="button" class="btn btn--sm btn--ghost" onclick="Admin.quickReview('${l.phone || ''}', '${(l.patient_name || '').replace(/'/g, '')}')">⭐ Pedir Reseña</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    }
  }

  async function toggleWaosAi() {
    const res = await apiFetch('/waos/toggle-ai', {
      method: 'POST',
      headers: authHeaders()
    });
    if (res) {
      toast(res.aiAutoReplyEnabled ? 'Asistente IA activado' : 'Asistente IA en pausa', 'success');
      refreshWaos();
    }
  }

  async function sendReviewRequest() {
    const nameEl = document.getElementById('waos-review-name');
    const phoneEl = document.getElementById('waos-review-phone');
    const patientName = nameEl ? nameEl.value.trim() : '';
    const phone = phoneEl ? phoneEl.value.trim() : '';
    if (!phone) {
      toast('Ingresa el número de WhatsApp de la paciente', 'error');
      return;
    }
    await quickReview(phone, patientName);
    if (nameEl) nameEl.value = '';
    if (phoneEl) phoneEl.value = '';
  }

  async function quickReview(phone, patientName) {
    const res = await apiFetch('/waos/send-review', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ phone, patientName })
    });
    if (res) {
      toast(res.message || 'Solicitud procesada', 'success');
      if (!res.sentViaBot && res.waMeFallback) {
        window.open(res.waMeFallback, '_blank', 'noopener');
      }
      refreshWaos();
    }
  }

  async function logoutWaos() {
    if (!confirm('¿Reiniciar vinculación de WhatsApp y generar un nuevo código QR?')) return;
    const res = await apiFetch('/waos/logout', { method: 'POST', headers: authHeaders() });
    if (res) {
      toast(res.message || 'Generando nuevo QR...', 'info');
      setTimeout(refreshWaos, 2500);
    }
  }

  let _hmVisualMode = 'thermal';
  let _hmLastData = null;

  function setHeatmapMode(mode) {
    _hmVisualMode = mode;
    const mThermal = document.getElementById('hm-mode-thermal');
    const mPins = document.getElementById('hm-mode-pins');
    const mLive = document.getElementById('hm-mode-live');
    if (mThermal) mThermal.className = mode === 'thermal' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm';
    if (mPins) mPins.className = mode === 'pins' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm';
    if (mLive) mLive.className = mode === 'live' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm';

    const canvas = document.getElementById('hm-canvas');
    const iframe = document.getElementById('hm-iframe');
    if (mode === 'live') {
      if (canvas) canvas.style.display = 'none';
      if (iframe) iframe.style.pointerEvents = 'auto';
    } else {
      if (canvas) canvas.style.display = 'block';
      if (iframe) iframe.style.pointerEvents = 'none';
      renderHeatmapCanvas();
    }
  }

  function updateHeatmapOpacity() {
    const val = Number(document.getElementById('hm-opacity-slider')?.value || 85) / 100;
    const canvas = document.getElementById('hm-canvas');
    if (canvas) canvas.style.opacity = String(val);
  }

  function renderHeatmapCanvas() {
    const canvas = document.getElementById('hm-canvas');
    if (!canvas || !_hmLastData) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const pts = _hmLastData.points || [];
    const maxWeight = Math.max(1, ...pts.map(p => p.weight || 1));
    const baseRadius = Number(document.getElementById('hm-radius-slider')?.value || 40);

    if (_hmVisualMode === 'pins') {
      for (const pt of pts) {
        const cx = (pt.x / 100) * w;
        const cy = (pt.y / 100) * h;
        const r = Math.min(20, 6 + (pt.weight || 1) * 1.4);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20, 168, 161, 0.72)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    } else {
      for (const pt of pts) {
        const cx = (pt.x / 100) * w;
        const cy = (pt.y / 100) * h;
        const intensity = Math.min(1, (pt.weight || 1) / maxWeight);
        const radius = baseRadius * (0.65 + intensity * 0.65);
        const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
        grad.addColorStop(0, `rgba(239, 68, 68, ${0.48 + intensity * 0.44})`);
        grad.addColorStop(0.45, `rgba(245, 158, 11, ${0.32 + intensity * 0.35})`);
        grad.addColorStop(0.8, `rgba(20, 168, 161, ${0.16 + intensity * 0.2})`);
        grad.addColorStop(1, 'rgba(20, 168, 161, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Top 6 Numbered Hotspot Badges (#1 - #6)
    const topEls = (_hmLastData.top_elements || []).slice(0, 6);
    topEls.forEach((el, idx) => {
      if (typeof el.avg_x_pct !== 'number' || typeof el.avg_y_pct !== 'number') return;
      const cx = (el.avg_x_pct / 100) * w;
      const cy = (el.avg_y_pct / 100) * h;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fillStyle = idx === 0 ? '#14A8A1' : '#0B1827';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(idx + 1), cx, cy);
      ctx.restore();
    });
  }

  async function loadHeatmap() {
    const pageSel = document.getElementById('hm-page-select');
    const devSel = document.getElementById('hm-device-select');
    const daysSel = document.getElementById('hm-days-select');
    const pagePath = pageSel ? pageSel.value : '/';
    const device = devSel ? devSel.value : 'all';
    const days = daysSel ? daysSel.value : '28';

    const liveUrlLink = document.getElementById('hm-open-live-url');
    if (liveUrlLink) liveUrlLink.href = pagePath;

    const iframe = document.getElementById('hm-iframe');
    if (iframe && iframe.getAttribute('data-loaded-path') !== pagePath) {
      iframe.src = pagePath;
      iframe.setAttribute('data-loaded-path', pagePath);
    }

    const data = await apiFetch(`/heatmap/report?path=${encodeURIComponent(pagePath)}&device=${encodeURIComponent(device)}&days=${encodeURIComponent(days)}`);
    if (!data) return;
    _hmLastData = data;

    document.getElementById('hm-stat-clicks').textContent = (data.totals && data.totals.clicks) || 0;
    document.getElementById('hm-stat-sessions').textContent = (data.totals && data.totals.unique_sessions) || 0;

    const splitEl = document.getElementById('hm-device-split');
    if (splitEl && data.totals) {
      splitEl.textContent = `${data.totals.desktop_clicks || 0} Desktop · ${data.totals.mobile_clicks || 0} Móvil`;
    }

    const zones = data.scroll_zones || [];
    const topZone = zones.slice().sort((a, b) => b.events - a.events)[0];
    document.getElementById('hm-stat-top-zone').textContent = topZone ? `${topZone.zone}%` : '0-20%';

    const topEls = data.top_elements || [];
    const ctaClicks = topEls.filter(e => /whatsapp|agendar|cita|cotizar|chequeo/i.test(e.text || e.selector)).reduce((s, e) => s + e.share_pct, 0);
    document.getElementById('hm-stat-cta-share').textContent = `${Math.min(100, Math.round(ctaClicks))}%`;

    renderHeatmapCanvas();

    const topContainer = document.getElementById('hm-top-elements');
    if (topContainer) {
      topContainer.innerHTML = topEls.map((el, i) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.55rem 0; border-bottom:1px solid var(--admin-border); font-size:0.84rem;">
          <div style="max-width:74%; display:flex; align-items:center; gap:0.55rem;">
            <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:999px; background:${i === 0 ? 'var(--admin-teal)' : 'var(--admin-surface-2)'}; color:#fff; font-size:0.74rem; font-weight:700; flex-shrink:0;">${i + 1}</span>
            <div style="min-width:0;">
              <div style="font-weight:600; color:var(--admin-text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${el.text || el.tag}</div>
              <div style="font-size:0.74rem; color:var(--admin-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${el.selector}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <span style="font-weight:700; color:var(--admin-teal);">${el.clicks} clics</span>
            <div style="font-size:0.74rem; color:var(--admin-text-muted);">${el.share_pct}%</div>
          </div>
        </div>
      `).join('');
    }

    const zonesContainer = document.getElementById('hm-scroll-zones');
    if (zonesContainer) {
      zonesContainer.innerHTML = zones.map(z => `
        <div style="margin-bottom:0.65rem;">
          <div style="display:flex; justify-content:space-between; font-size:0.82rem; margin-bottom:0.2rem;">
            <span>Profundidad ${z.zone}%</span>
            <strong>${z.events} eventos (${z.share_pct}%)</strong>
          </div>
          <div style="height:8px; background:var(--admin-surface-2); border-radius:999px; overflow:hidden;">
            <div style="width:${Math.min(100, z.share_pct)}%; height:100%; background:linear-gradient(90deg, var(--admin-teal), var(--admin-rose));"></div>
          </div>
        </div>
      `).join('');
    }
  }

  async function loadSeoOverview() {
    const data = await apiFetch('/seo/overview', { headers: authHeaders() });
    if (!data) return;

    const auditEl = document.getElementById('seo-pages-audit');
    if (auditEl) {
      auditEl.innerHTML = `
        <div style="padding:0.85rem; background:var(--admin-surface-2); border-radius:10px; margin-bottom:1rem; border:1px solid var(--admin-border);">
          <div style="font-weight:700; color:var(--admin-teal);">📍 GeoCoordinates Unificadas: ${data.geoCoordinates}</div>
          <div style="font-size:0.83rem; color:var(--admin-text-muted); margin-top:0.25rem;">URLs en Sitemap.xml: <strong>${data.totalSitemapUrls}</strong> · Artículos Publicados: <strong>${data.publishedPostsCount}</strong></div>
        </div>
        ${(data.pageAudits || []).map(p => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0; border-bottom:1px solid var(--admin-border); font-size:0.85rem;">
            <div>
              <div style="font-weight:600;">${p.label}</div>
              <div style="font-size:0.75rem; color:var(--admin-text-muted);">${p.file} · Prioridad ${p.priority}</div>
            </div>
            <div style="display:flex; gap:0.4rem;">
              <span class="blog-item__status blog-item__status--published">${p.hasSchema ? '✓ Schema' : 'Schema'}</span>
              <span class="blog-item__status blog-item__status--published">${p.hasHeatmap ? '✓ Heatmap' : 'Heatmap'}</span>
            </div>
          </div>
        `).join('')}
      `;
    }

    const tplEl = document.getElementById('seo-templates-list');
    if (tplEl) {
      window._seoTemplates = data.templates || [];
      tplEl.innerHTML = (data.templates || []).map((t, idx) => `
        <div style="padding:0.85rem; background:var(--admin-surface-2); border:1px solid var(--admin-border); border-radius:10px; margin-bottom:0.75rem;">
          <div style="font-weight:700; font-size:0.9rem; margin-bottom:0.3rem;">${t.title}</div>
          <div style="font-size:0.8rem; color:var(--admin-text-muted); margin-bottom:0.6rem;">${t.excerpt}</div>
          <button type="button" class="btn btn--sm btn--primary" onclick="Admin.useSeoTemplate(${idx})">✍️ Redactar con esta Plantilla</button>
        </div>
      `).join('');
    }
  }

  function useSeoTemplate(idx) {
    const t = (window._seoTemplates || [])[idx];
    if (!t) return;
    router.navigate('blog');
    showBlogEditor({
      slug: '',
      title: t.title,
      excerpt: t.excerpt,
      tags: t.tags.split(',').map(s => s.trim()),
      metaDescription: t.metaDescription,
      metaKeywords: t.metaKeywords,
      content: `## ¿Qué es y cuáles son los síntomas principales?\n\nEn nuestro consultorio en **Chapalita Oriente, Guadalajara**, atendemos de forma integral a pacientes que buscan un diagnóstico certero y cálido.\n\n### ¿Qué incluye la valoración con la Dra. Odette Noyola?\n\n- **Historia clínica detallada** y resolución de dudas.\n- **Ultrasonido de alta resolución** en tiempo real.\n- **Plan de tratamiento personalizado** basado en guías internacionales.\n\n> Agenda tu cita directamente por WhatsApp al **33 2790 5726** en Av. Niño Obrero 1538, Chapalita Oriente.`
    });
    toast('Plantilla clínica cargada en el editor', 'success');
  }

  async function rebuildSitemap() {
    const res = await apiFetch('/seo/rebuild-sitemap', { method: 'POST', headers: authHeaders() });
    if (res) {
      toast(`Sitemap.xml actualizado (${res.totalUrls} URLs) y sincronizado con GitHub`, 'success');
      loadSeoOverview();
    }
  }

  // ─── Live Clinical LLM Copilot (Blog Editor & SEO Command Center) ───
  async function runBlogAi(mode = 'review') {
    const title = document.getElementById('blog-title')?.value || '';
    const excerpt = document.getElementById('blog-excerpt')?.value || '';
    const tags = document.getElementById('blog-tags')?.value || '';
    const content = document.getElementById('blog-content')?.value || '';
    const instruction = document.getElementById('blog-ai-instruction')?.value || '';

    const outBox = document.getElementById('blog-ai-output-box');
    const outText = document.getElementById('blog-ai-output-text');
    const badge = document.getElementById('blog-ai-engine-badge');
    if (outBox && outText) {
      outBox.hidden = false;
      outText.textContent = '⏳ Consultando a nuestro motor LLM Clínico en vivo...';
    }

    const res = await apiFetch('/seo/ai-assistant', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ mode, title, excerpt, tags, content, instruction })
    });

    if (res && res.ok) {
      if (badge) badge.textContent = `🤖 ${res.engine || 'LLM Clínico'}`;
      if (outText) outText.textContent = res.reply;
      window._lastBlogAiReply = res.reply;
      toast('Análisis / Redacción IA completada', 'success');
    } else if (outText) {
      outText.textContent = 'No se pudo obtener respuesta del motor IA en este momento.';
    }
  }

  function applyAiToBlog(action = 'replace') {
    const reply = window._lastBlogAiReply || document.getElementById('blog-ai-output-text')?.textContent || '';
    const textarea = document.getElementById('blog-content');
    if (!textarea || !reply) return;
    if (action === 'replace') {
      textarea.value = reply;
      toast('Contenido reemplazado con la versión del Copiloto IA', 'success');
    } else {
      textarea.value = (textarea.value ? textarea.value + '\n\n' : '') + reply;
      toast('Sección insertada al final del artículo', 'success');
    }
  }

  async function runSeoCopilot(mode = 'review') {
    const slug = document.getElementById('seo-copilot-post-select')?.value || '';
    const instruction = document.getElementById('seo-copilot-prompt')?.value || '';
    const box = document.getElementById('seo-copilot-result-box');
    const txt = document.getElementById('seo-copilot-result-text');
    const eng = document.getElementById('seo-copilot-engine');

    if (box && txt) {
      box.hidden = false;
      txt.textContent = '⏳ Cargando artículo y consultando al Copiloto Clínico LLM en vivo...';
    }

    let post = { title: slug, content: '', excerpt: '', tags: [] };
    if (slug) {
      const fetched = await apiFetch(`/blog/posts/${slug}`, { headers: authHeaders() });
      if (fetched && fetched.title) post = fetched;
    }

    const res = await apiFetch('/seo/ai-assistant', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        mode: instruction && mode === 'review' ? 'chat' : mode,
        title: post.title,
        excerpt: post.excerpt,
        tags: Array.isArray(post.tags) ? post.tags.join(', ') : (post.tags || ''),
        content: post.content,
        instruction
      })
    });

    if (res && res.ok) {
      if (eng) eng.textContent = res.engine || 'LLM Clínico Activo';
      if (txt) txt.textContent = res.reply;
      window._lastCopilotSlug = slug;
      window._lastCopilotReply = res.reply;
      window._lastCopilotMode = mode;
      toast('Copiloto Clínico LLM respondió en vivo', 'success');
    }
  }

  async function openPostFromCopilot() {
    const slug = window._lastCopilotSlug || document.getElementById('seo-copilot-post-select')?.value;
    if (!slug) return;
    router.navigate('blog');
    await editPost(slug);
    if (window._lastCopilotReply) {
      const outBox = document.getElementById('blog-ai-output-box');
      const outText = document.getElementById('blog-ai-output-text');
      if (outBox && outText) {
        outBox.hidden = false;
        outText.textContent = window._lastCopilotReply;
        window._lastBlogAiReply = window._lastCopilotReply;
      }
    }
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);

  // ─── Public API ───
  return {
    router,
    editPost,
    publishPost,
    unpublishPost,
    deletePost,
    jumpToSection,
    selectImageForCanvas,
    adjustSelectedImageFocal,
    setCanvasDevice,
    toggleCanvasPreview,
    saveLiveCanvas,
    copyImagePath,
    deleteImage,
    refreshWaos,
    toggleWaosAi,
    sendReviewRequest,
    quickReview,
    logoutWaos,
    loadHeatmap,
    setHeatmapMode,
    renderHeatmapCanvas,
    updateHeatmapOpacity,
    loadSeoOverview,
    useSeoTemplate,
    rebuildSitemap,
    runBlogAi,
    applyAiToBlog,
    runSeoCopilot,
    openPostFromCopilot
  };
})();
