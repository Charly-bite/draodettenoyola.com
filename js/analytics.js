/**
 * analytics.js — Telemetría y Seguimiento de Conversiones (GA4)
 * Dra. Odette Noyola — Ginecología, Obstetricia & Medicina Materno Fetal
 * 
 * Captura y categoriza automáticamente:
 * - Clics en WhatsApp (identificando botón exacto, página y URL de destino)
 * - Clics en llamadas telefónicas (tel:)
 * - Clics en reseñas y ficha de Google Maps
 * - Disparo del evento estándar 'generate_lead' para Google Ads / GA4
 */

(function () {
  'use strict';

  function determineLocation(element) {
    if (!element) return 'unknown';

    // 1. Elementos específicos por ID
    if (element.id === 'floating-whatsapp' || element.closest('#floating-whatsapp')) {
      return 'floating_whatsapp_button';
    }
    if (element.id === 'hero-cta-whatsapp' || element.closest('#hero-cta-whatsapp')) {
      return 'hero_primary_cta';
    }

    // 2. Estructura de navegación y encabezado
    if (element.closest('.urgency-bar')) {
      return 'top_urgency_bar';
    }
    if (element.closest('#navbar-drawer')) {
      return 'mobile_nav_drawer';
    }
    if (element.closest('header, nav, .navbar, .nav-inner, .nav-container')) {
      return 'header_navbar_cta';
    }

    // 3. Secciones clave del sitio
    if (element.closest('.hero, .hero-wrap, .hero-grid, .blog-hero')) {
      return 'hero_section';
    }
    if (element.closest('.pricing, .pricing-box, .pricing-card, .comp-table, .pricing-grid')) {
      return 'pricing_section';
    }
    if (element.closest('.doctor, .doctor-spotlight, .doctor-card')) {
      return 'doctor_profile_section';
    }
    if (element.closest('.services, .service-detail-card, .cards-grid-3, .pills-grid')) {
      return 'services_grid';
    }
    if (element.closest('.crosslink-banner')) {
      return 'crosslink_banner';
    }
    if (element.closest('.contact, .contact-channels, #contact, .location-box')) {
      return 'contact_location_section';
    }
    if (element.closest('footer, .site-footer, .footer-light')) {
      return 'footer_section';
    }

    // 4. Inferencia por clases
    const classList = typeof element.className === 'string' ? element.className : '';
    if (classList.includes('floating')) return 'floating_button';
    if (classList.includes('hero')) return 'hero_section';
    if (classList.includes('nav')) return 'header_navbar_cta';

    return 'content_body';
  }

  function trackEvent(eventName, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    } else if (window.dataLayer && Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: eventName,
        ...params
      });
    }
  }

  document.addEventListener('click', function (e) {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href') || '';

    // A) Clics en WhatsApp
    if (href.includes('wa.me') || href.includes('whatsapp.com')) {
      const location = determineLocation(link);
      const linkText = (link.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);

      trackEvent('whatsapp_click', {
        event_category: 'conversion',
        event_label: location,
        button_location: location,
        link_text: linkText,
        page_path: window.location.pathname,
        page_title: document.title,
        destination_url: href
      });

      // Disparar evento estándar de Google para conversiones automáticas
      trackEvent('generate_lead', {
        event_category: 'lead',
        event_label: `whatsapp_${location}`,
        lead_type: 'whatsapp',
        value: 1,
        currency: 'MXN'
      });
    }

    // B) Clics en llamada telefónica
    else if (href.startsWith('tel:')) {
      const location = determineLocation(link);
      trackEvent('phone_call_click', {
        event_category: 'conversion',
        event_label: location,
        button_location: location,
        page_path: window.location.pathname,
        destination_url: href
      });

      trackEvent('generate_lead', {
        event_category: 'lead',
        event_label: `phone_${location}`,
        lead_type: 'phone',
        value: 1,
        currency: 'MXN'
      });
    }

    // C) Clics en Reseña de Google Maps
    else if (href.includes('g.page') || href.includes('/review') || href.includes('maps.app.goo.gl')) {
      const location = determineLocation(link);
      trackEvent('google_review_click', {
        event_category: 'engagement',
        event_label: location,
        button_location: location,
        page_path: window.location.pathname
      });
    }
  }, { passive: true });

})();
