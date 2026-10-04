/**
 * consent.js — Registro de Consentimiento Legal (LFPDPPP) & Gestión de Cookies
 * Dra. Odette Noyola — Ginecología, Obstetricia & Medicina Materno Fetal
 *
 * Módulos integrados:
 *   1. Registro dual de consentimiento de formularios (localStorage + POST /api/consent)
 *   2. Banner y Centro de Preferencias Interactivo de Cookies (Técnicas vs Analíticas)
 *   3. Sincronización con Google Tag Manager / gtag('consent', 'update')
 *   4. Control para enlazar directamente desde el Aviso de Privacidad
 */

(function () {
  'use strict';

  /** Versión vigente del documento de términos y privacidad */
  var CONSENT_VERSION = 'v1_2026-09';

  /** Clave de localStorage para respaldo local de consentimientos de formulario */
  var LS_KEY = 'dra_odette_consent_log';

  /** Clave de localStorage para preferencias de cookies */
  var LS_COOKIE_KEY = 'dra_odette_cookie_preferences';

  // ══════════════════════════════════════════════════════════════
  // 1. RESPALDO EN LOCALSTORAGE (FORMULARIOS)
  // ══════════════════════════════════════════════════════════════

  function saveToLocalStorage(record) {
    try {
      var existing = [];
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        existing = JSON.parse(raw);
      }
      existing.unshift(record);
      if (existing.length > 50) existing.length = 50;
      localStorage.setItem(LS_KEY, JSON.stringify(existing));
    } catch (err) {
      console.warn('[Consent] No se pudo guardar en localStorage:', err.message);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // 2. ENVÍO AL SERVIDOR (POST /api/consent)
  // ══════════════════════════════════════════════════════════════

  function sendToServer(record) {
    try {
      fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      })
      .then(function (response) {
        if (response.ok) {
          return response.json();
        }
        throw new Error('HTTP ' + response.status);
      })
      .then(function (data) {
        if (data.success) {
          console.log('[Consent] ✅ Registrado en servidor:', data.consentId);
          try {
            var stored = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
            if (stored.length > 0 && stored[0].email === record.email) {
              stored[0].serverId = data.consentId;
              stored[0].serverSynced = true;
              localStorage.setItem(LS_KEY, JSON.stringify(stored));
            }
          } catch (e) { /* silencioso */ }
        }
      })
      .catch(function (err) {
        console.warn('[Consent] ⚠️ Error al enviar al servidor (respaldo en localStorage activo):', err.message);
      });
    } catch (err) {
      console.warn('[Consent] ⚠️ Fetch no disponible:', err.message);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // 3. REGISTRO DUAL DE CONSENTIMIENTO
  // ══════════════════════════════════════════════════════════════

  function registerConsent(email, options) {
    if (!email) return;

    var opts = options || {};
    var record = {
      email: email.trim().toLowerCase(),
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
      page: opts.page || window.location.pathname,
      termsAccepted: opts.termsAccepted !== false,
      privacyAccepted: opts.privacyAccepted !== false,
      serverSynced: false
    };

    saveToLocalStorage(record);
    sendToServer(record);
  }

  // ══════════════════════════════════════════════════════════════
  // 4. INTEGRACIÓN CON FORMULARIOS EXISTENTES
  // ══════════════════════════════════════════════════════════════

  function enhanceContactForms() {
    var privacyCheckbox = document.getElementById('contact-privacy');
    if (privacyCheckbox) {
      var label = document.querySelector('label[for="contact-privacy"]');
      if (label) {
        label.innerHTML =
          'He leído y acepto los ' +
          '<a href="terminos-y-condiciones.html" target="_blank" rel="noopener">Términos y Condiciones</a>' +
          ' y el ' +
          '<a href="aviso-de-privacidad.html" target="_blank" rel="noopener">Aviso de Privacidad</a>' +
          ' para el tratamiento confidencial de mis datos.';
      }
    }

    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i++) {
      (function (form) {
        form.addEventListener('submit', function () {
          var emailInput = form.querySelector('input[type="email"], input[name="email"]');
          var consentCheckbox = form.querySelector('#contact-privacy, input[name="privacy"]');

          if (emailInput && emailInput.value && consentCheckbox && consentCheckbox.checked) {
            registerConsent(emailInput.value, {
              termsAccepted: true,
              privacyAccepted: true,
              page: window.location.pathname
            });
          }
        });
      })(forms[i]);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // 5. GESTIÓN INTERACTIVA DE COOKIES (BANNER & MODAL)
  // ══════════════════════════════════════════════════════════════

  function getCookiePreferences() {
    try {
      var saved = localStorage.getItem(LS_COOKIE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  }

  function saveCookiePreferences(prefs) {
    try {
      var data = {
        necessary: true,
        analytics: !!prefs.analytics,
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION
      };
      localStorage.setItem(LS_COOKIE_KEY, JSON.stringify(data));
      applyGtagConsent(data.analytics);

      // Despachar evento para listeners
      if (typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('dra_odette_cookie_updated', { detail: data }));
      }
      return data;
    } catch (e) {
      console.warn('[Consent] Error al guardar preferencias de cookies:', e.message);
    }
  }

  function applyGtagConsent(analyticsGranted) {
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        'analytics_storage': analyticsGranted ? 'granted' : 'denied',
        'ad_storage': 'denied'
      });
    }
  }

  function injectCookieStyles() {
    if (document.getElementById('dra-consent-styles')) return;
    var style = document.createElement('style');
    style.id = 'dra-consent-styles';
    style.textContent = `
      .cookie-banner-wrap {
        position: fixed;
        bottom: 24px;
        left: 24px;
        right: 24px;
        max-width: 620px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 12px 36px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(13, 148, 136, 0.2);
        padding: 20px 24px;
        z-index: 99998;
        display: flex;
        flex-direction: column;
        gap: 14px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        color: #1e293b;
        animation: cookieSlideUp 0.35s ease-out;
      }
      @keyframes cookieSlideUp {
        from { transform: translateY(40px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .cookie-banner-header {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .cookie-banner-title {
        font-size: 15px;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
      }
      .cookie-banner-desc {
        font-size: 13.5px;
        color: #475569;
        line-height: 1.5;
        margin: 0;
      }
      .cookie-banner-desc a {
        color: #0f766e;
        font-weight: 600;
        text-decoration: underline;
      }
      .cookie-banner-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }
      .btn-cookie-accept {
        background: #0f766e;
        color: #ffffff;
        border: none;
        padding: 9px 18px;
        border-radius: 9999px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      }
      .btn-cookie-accept:hover { background: #115e59; }
      .btn-cookie-reject {
        background: #f1f5f9;
        color: #334155;
        border: 1px solid #cbd5e1;
        padding: 9px 16px;
        border-radius: 9999px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      }
      .btn-cookie-reject:hover { background: #e2e8f0; }
      .btn-cookie-prefs {
        background: transparent;
        color: #0f766e;
        border: none;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: underline;
        padding: 6px 10px;
      }
      .btn-cookie-prefs:hover { color: #115e59; }

      /* Modal de Preferencias */
      .cookie-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(4px);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .cookie-modal-card {
        background: #ffffff;
        border-radius: 20px;
        max-width: 540px;
        width: 100%;
        padding: 28px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        max-height: 90vh;
        overflow-y: auto;
      }
      .cookie-modal-card h3 {
        font-size: 1.25rem;
        font-weight: 700;
        color: #0f172a;
        margin-top: 0;
        margin-bottom: 8px;
      }
      .cookie-modal-card p.subtitle {
        font-size: 0.9rem;
        color: #64748b;
        margin-bottom: 20px;
        line-height: 1.5;
      }
      .cookie-item {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px 16px;
        margin-bottom: 12px;
      }
      .cookie-item-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      .cookie-item-top strong {
        font-size: 14px;
        color: #0f172a;
      }
      .cookie-badge {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 3px 8px;
        border-radius: 999px;
      }
      .cookie-badge-req { background: #dcfce7; color: #166534; }
      .cookie-item p {
        font-size: 12.5px;
        color: #64748b;
        line-height: 1.45;
        margin: 0;
      }
      .cookie-modal-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
      }
    `;
    document.head.appendChild(style);
  }

  function showCookieBanner() {
    if (document.getElementById('dra-cookie-banner')) return;
    injectCookieStyles();

    var banner = document.createElement('aside');
    banner.id = 'dra-cookie-banner';
    banner.className = 'cookie-banner-wrap';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Gestión de Cookies y Privacidad');

    banner.innerHTML = `
      <div class="cookie-banner-header">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#0f766e"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-.55-.45-1-1-1s-1 .45-1 1c0 4.41-3.59 8-8 8s-8-3.59-8-8 3.59-8 8-8c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>
        <h4 class="cookie-banner-title">Privacidad y Preferencias de Cookies</h4>
      </div>
      <p class="cookie-banner-desc">
        Utilizamos cookies técnicas necesarias para el agendamiento y funcionamiento del portal, así como cookies analíticas para mejorar su experiencia. Conforme a la LFPDPPP, usted decide cuáles autorizar. Conozca los detalles en nuestro <a href="aviso-de-privacidad.html#cookies">Aviso de Privacidad</a>.
      </p>
      <div class="cookie-banner-actions">
        <button type="button" class="btn-cookie-accept" id="btn-cookie-accept-all">Aceptar todas</button>
        <button type="button" class="btn-cookie-reject" id="btn-cookie-only-req">Solo necesarias</button>
        <button type="button" class="btn-cookie-prefs" id="btn-cookie-custom">Configurar cookies</button>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('btn-cookie-accept-all').addEventListener('click', function () {
      saveCookiePreferences({ analytics: true });
      closeCookieBanner();
    });

    document.getElementById('btn-cookie-only-req').addEventListener('click', function () {
      saveCookiePreferences({ analytics: false });
      closeCookieBanner();
    });

    document.getElementById('btn-cookie-custom').addEventListener('click', function () {
      openCookiePreferencesModal();
    });
  }

  function closeCookieBanner() {
    var banner = document.getElementById('dra-cookie-banner');
    if (banner && banner.parentNode) {
      banner.parentNode.removeChild(banner);
    }
  }

  function openCookiePreferencesModal() {
    injectCookieStyles();
    var existingModal = document.getElementById('dra-cookie-modal');
    if (existingModal) existingModal.remove();

    var currentPrefs = getCookiePreferences() || { analytics: true };

    var backdrop = document.createElement('div');
    backdrop.id = 'dra-cookie-modal';
    backdrop.className = 'cookie-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'cookie-modal-title');

    backdrop.innerHTML = `
      <div class="cookie-modal-card">
        <h3 id="cookie-modal-title">Centro de Preferencias de Cookies</h3>
        <p class="subtitle">
          Administre de forma transparente las tecnologías de rastreo y almacenamiento web que utilizamos en <strong>draodettenoyola.com</strong>, en estricto cumplimiento con la LFPDPPP.
        </p>

        <!-- Necesarias -->
        <div class="cookie-item">
          <div class="cookie-item-top">
            <strong>Cookies Técnicas y Esenciales</strong>
            <span class="cookie-badge cookie-badge-req">Siempre Activas</span>
          </div>
          <p>
            Indispensables para la navegación, seguridad SSL, persistencia de sesión segura y funcionamiento del sistema de citas en línea. No pueden desactivarse.
          </p>
        </div>

        <!-- Analíticas -->
        <div class="cookie-item">
          <div class="cookie-item-top">
            <strong>Cookies Analíticas y de Rendimiento</strong>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="checkbox" id="modal-chk-analytics" ${currentPrefs.analytics ? 'checked' : ''} style="width:18px;height:18px;accent-color:#0f766e;cursor:pointer;">
              <span style="font-size:12px;font-weight:600;color:#0f766e;">Permitir</span>
            </label>
          </div>
          <p>
            Nos permiten evaluar el tráfico, el tiempo de permanencia y las secciones de artículos médicos más visitadas mediante métricas anónimas disociadas (Google Tag Manager / Analytics).
          </p>
        </div>

        <div class="cookie-modal-buttons">
          <button type="button" class="btn-cookie-reject" id="btn-modal-cancel">Cerrar</button>
          <button type="button" class="btn-cookie-accept" id="btn-modal-save">Guardar preferencias</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    document.getElementById('btn-modal-cancel').addEventListener('click', function () {
      backdrop.remove();
    });

    document.getElementById('btn-modal-save').addEventListener('click', function () {
      var analyticsChecked = document.getElementById('modal-chk-analytics').checked;
      saveCookiePreferences({ analytics: analyticsChecked });
      backdrop.remove();
      closeCookieBanner();

      // Feedback visual opcional
      if (typeof window.alert === 'function') {
        alert('Tus preferencias de cookies han sido guardadas exitosamente.');
      }
    });

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) {
        backdrop.remove();
      }
    });
  }

  function initCookieSystem() {
    var prefs = getCookiePreferences();
    if (!prefs) {
      // Si no ha decidido, mostramos el banner tras breve espera de 800ms
      setTimeout(showCookieBanner, 800);
    } else {
      applyGtagConsent(prefs.analytics);
    }

    // Vincular cualquier botón con clase o atributo en la página
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-open-cookie-preferences], #btn-cookie-settings, #open-cookie-preferences, .btn-open-cookie-settings');
      if (trigger) {
        e.preventDefault();
        openCookiePreferencesModal();
      }
    });
  }

  // ══════════════════════════════════════════════════════════════
  // 6. INICIALIZACIÓN
  // ══════════════════════════════════════════════════════════════

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      enhanceContactForms();
      initCookieSystem();
    });
  } else {
    enhanceContactForms();
    initCookieSystem();
  }

  // Exponer API para uso programático y vinculación directa
  window.DraOdetteConsent = {
    register: registerConsent,
    version: CONSENT_VERSION,
    getCookiePreferences: getCookiePreferences,
    openCookiePreferences: openCookiePreferencesModal,
    getLocalLog: function () {
      try {
        return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      } catch (e) { return []; }
    }
  };

})();
