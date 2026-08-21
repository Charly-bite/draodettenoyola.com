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
      const titles = { dashboard: 'Dashboard', content: 'Editor de Contenido', blog: 'Blog Manager', images: 'Gestor de Imágenes' };
      document.getElementById('topbar-title').textContent = titles[page] || 'Dashboard';

      // Load page data
      switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'canvas': loadLiveCanvas(); break;
        case 'blog': loadBlogList(); break;
        case 'images': loadImages(); break;
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
    deleteImage
  };
})();
