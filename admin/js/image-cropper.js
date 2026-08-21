/**
 * Image Focal Point & Crop Engine
 * Handles interactive focal point reticle selection, live multi-format previews,
 * zoom, rotation, and optimized export.
 */
const ImageFocalCropper = (() => {
  let activeImage = null;
  let rawFile = null;
  let focalPoint = { x: 50, y: 50 }; // percentage (0-100)
  let zoomLevel = 1; // 1 to 3
  let rotationDeg = 0; // 0, 90, 180, 270
  let isDraggingFocal = false;
  let onApplyCallback = null;

  // DOM Elements cache
  let elements = {};

  function initElements() {
    elements = {
      modal: document.getElementById('focal-crop-modal'),
      overlay: document.getElementById('focal-crop-overlay'),
      closeBtn: document.getElementById('focal-crop-close'),
      cancelBtn: document.getElementById('focal-crop-cancel'),
      applyBtn: document.getElementById('focal-crop-apply'),
      resetBtn: document.getElementById('focal-crop-reset'),
      container: document.getElementById('focal-canvas-container'),
      imageEl: document.getElementById('focal-source-image'),
      reticle: document.getElementById('focal-reticle'),
      coordsBadge: document.getElementById('focal-coords-badge'),
      zoomSlider: document.getElementById('focal-zoom-slider'),
      zoomValue: document.getElementById('focal-zoom-val'),
      rotateLeftBtn: document.getElementById('focal-rotate-left'),
      rotateRightBtn: document.getElementById('focal-rotate-right'),
      // Previews
      prevCircle: document.getElementById('focal-prev-circle-img'),
      prevBanner: document.getElementById('focal-prev-banner-img'),
      prevMobile: document.getElementById('focal-prev-mobile-img'),
      prevSquare: document.getElementById('focal-prev-square-img')
    };

    attachEvents();
  }

  function attachEvents() {
    if (!elements.container) return;

    // Reticle & Container click / drag
    elements.container.addEventListener('mousedown', startFocalDrag);
    window.addEventListener('mousemove', onFocalDrag);
    window.addEventListener('mouseup', endFocalDrag);

    // Touch events for mobile/tablet
    elements.container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) startFocalDrag(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (isDraggingFocal && e.touches.length === 1) onFocalDrag(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchend', endFocalDrag);

    // Zoom slider
    if (elements.zoomSlider) {
      elements.zoomSlider.addEventListener('input', (e) => {
        zoomLevel = parseFloat(e.target.value);
        if (elements.zoomValue) elements.zoomValue.textContent = `${Math.round(zoomLevel * 100)}%`;
        updateImageTransform();
        updatePreviews();
      });
    }

    // Rotation
    if (elements.rotateLeftBtn) {
      elements.rotateLeftBtn.addEventListener('click', () => {
        rotationDeg = (rotationDeg - 90 + 360) % 360;
        updateImageTransform();
        updatePreviews();
      });
    }
    if (elements.rotateRightBtn) {
      elements.rotateRightBtn.addEventListener('click', () => {
        rotationDeg = (rotationDeg + 90) % 360;
        updateImageTransform();
        updatePreviews();
      });
    }

    // Reset
    if (elements.resetBtn) {
      elements.resetBtn.addEventListener('click', resetTransforms);
    }

    // Modal controls
    if (elements.closeBtn) elements.closeBtn.addEventListener('click', closeModal);
    if (elements.cancelBtn) elements.cancelBtn.addEventListener('click', closeModal);
    if (elements.overlay) elements.overlay.addEventListener('click', closeModal);
    if (elements.applyBtn) elements.applyBtn.addEventListener('click', applyAndExport);
  }

  function startFocalDrag(e) {
    isDraggingFocal = true;
    updateFocalFromPointer(e);
  }

  function onFocalDrag(e) {
    if (!isDraggingFocal) return;
    updateFocalFromPointer(e);
  }

  function endFocalDrag() {
    isDraggingFocal = false;
  }

  function updateFocalFromPointer(e) {
    const rect = elements.container.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    focalPoint.x = Math.round((x / rect.width) * 100);
    focalPoint.y = Math.round((y / rect.height) * 100);

    updateReticlePosition();
    updatePreviews();
  }

  function updateReticlePosition() {
    if (!elements.reticle) return;
    elements.reticle.style.left = `${focalPoint.x}%`;
    elements.reticle.style.top = `${focalPoint.y}%`;

    if (elements.coordsBadge) {
      elements.coordsBadge.textContent = `X: ${focalPoint.x}% · Y: ${focalPoint.y}%`;
    }
  }

  function updateImageTransform() {
    if (!elements.imageEl) return;
    elements.imageEl.style.transform = `scale(${zoomLevel}) rotate(${rotationDeg}deg)`;
  }

  function updatePreviews() {
    const objPos = `${focalPoint.x}% ${focalPoint.y}%`;
    [elements.prevCircle, elements.prevBanner, elements.prevMobile, elements.prevSquare].forEach(img => {
      if (img) {
        img.style.objectPosition = objPos;
        img.style.transform = `scale(${zoomLevel}) rotate(${rotationDeg}deg)`;
      }
    });
  }

  function resetTransforms() {
    focalPoint = { x: 50, y: 50 };
    zoomLevel = 1;
    rotationDeg = 0;
    if (elements.zoomSlider) elements.zoomSlider.value = 1;
    if (elements.zoomValue) elements.zoomValue.textContent = '100%';
    updateReticlePosition();
    updateImageTransform();
    updatePreviews();
  }

  /**
   * Open the Focal Point modal for a File or an Image URL
   */
  function open(source, initialFocal = { x: 50, y: 50 }, onApply = null) {
    if (!elements.modal) initElements();

    onApplyCallback = onApply;
    focalPoint = { ...initialFocal };
    zoomLevel = 1;
    rotationDeg = 0;

    if (elements.zoomSlider) elements.zoomSlider.value = 1;
    if (elements.zoomValue) elements.zoomValue.textContent = '100%';

    const handleLoadedUrl = (url) => {
      activeImage = new Image();
      activeImage.onload = () => {
        elements.imageEl.src = url;
        if (elements.prevCircle) elements.prevCircle.src = url;
        if (elements.prevBanner) elements.prevBanner.src = url;
        if (elements.prevMobile) elements.prevMobile.src = url;
        if (elements.prevSquare) elements.prevSquare.src = url;

        updateReticlePosition();
        updateImageTransform();
        updatePreviews();

        elements.modal.hidden = false;
        elements.modal.style.display = 'flex';
      };
      activeImage.src = url;
    };

    if (source instanceof File || source instanceof Blob) {
      rawFile = source;
      const reader = new FileReader();
      reader.onload = (e) => handleLoadedUrl(e.target.result);
      reader.readAsDataURL(source);
    } else if (typeof source === 'string') {
      rawFile = null;
      handleLoadedUrl(source);
    }
  }

  function closeModal() {
    if (elements.modal) {
      elements.modal.hidden = true;
      elements.modal.style.display = 'none';
    }
    isDraggingFocal = false;
  }

  /**
   * Export the processed image via Canvas or return focal metadata
   */
  async function applyAndExport() {
    if (!activeImage) return;

    if (elements.applyBtn) {
      elements.applyBtn.disabled = true;
      elements.applyBtn.textContent = 'Procesando...';
    }

    try {
      // If image has zoom or rotation, render through offscreen canvas
      let finalFile = rawFile;
      let finalDataUrl = elements.imageEl.src;

      if (zoomLevel > 1 || rotationDeg !== 0) {
        const offCanvas = document.createElement('canvas');
        const ctx = offCanvas.getContext('2d');

        // Set high resolution dimensions
        const maxDim = 1920;
        let w = activeImage.naturalWidth || 1200;
        let h = activeImage.naturalHeight || 800;

        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        // Swap dimensions if rotated 90 or 270 deg
        if (rotationDeg === 90 || rotationDeg === 270) {
          offCanvas.width = h;
          offCanvas.height = w;
        } else {
          offCanvas.width = w;
          offCanvas.height = h;
        }

        ctx.translate(offCanvas.width / 2, offCanvas.height / 2);
        ctx.rotate((rotationDeg * Math.PI) / 180);
        ctx.scale(zoomLevel, zoomLevel);
        ctx.drawImage(activeImage, -w / 2, -h / 2, w, h);

        const blob = await new Promise(resolve => offCanvas.toBlob(resolve, 'image/jpeg', 0.92));
        finalFile = new File([blob], rawFile ? rawFile.name : `focused-${Date.now()}.jpg`, { type: 'image/jpeg' });
        finalDataUrl = offCanvas.toDataURL('image/jpeg', 0.92);
      }

      if (onApplyCallback) {
        await onApplyCallback({
          file: finalFile,
          dataUrl: finalDataUrl,
          focalX: focalPoint.x,
          focalY: focalPoint.y,
          objectPosition: `${focalPoint.x}% ${focalPoint.y}%`,
          zoom: zoomLevel,
          rotation: rotationDeg
        });
      }

      closeModal();
    } catch (err) {
      console.error('Error in focal applyAndExport:', err);
    } finally {
      if (elements.applyBtn) {
        elements.applyBtn.disabled = false;
        elements.applyBtn.textContent = '💾 Aplicar Enfoque y Subir';
      }
    }
  }

  // Auto-init on DOM ready
  document.addEventListener('DOMContentLoaded', initElements);

  return {
    open,
    close: closeModal,
    reset: resetTransforms
  };
})();
