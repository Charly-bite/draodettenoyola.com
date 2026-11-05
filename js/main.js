/* ==========================================================================
   MAIN.JS — Navigation, scroll behavior, FAQ accordion, gallery
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initUrgencyCarousel();
  initFAQ();
  initGallery();
  initTestimonialsCarousel();
  initLightbox();
  initSmoothScroll();
  initContactModal();
});

/* ══════════════════════════════════════════════════════════════════════
   NAVBAR — Hamburger toggle, scroll shrink, overlay
   ══════════════════════════════════════════════════════════════════════ */

function initNavbar() {
  const hamburger = document.getElementById('navbar-hamburger');
  const drawer = document.getElementById('navbar-drawer');
  const overlay = document.getElementById('navbar-overlay');
  const navbar = document.getElementById('navbar');
  const drawerLinks = drawer?.querySelectorAll('a');

  function toggleDrawer() {
    const isOpen = drawer.classList.contains('open');
    drawer.classList.toggle('open');
    overlay.classList.toggle('visible');
    hamburger.classList.toggle('active');
    document.body.style.overflow = isOpen ? '' : 'hidden';
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('visible');
    hamburger.classList.remove('active');
    document.body.style.overflow = '';
  }

  hamburger?.addEventListener('click', toggleDrawer);
  overlay?.addEventListener('click', closeDrawer);

  // Close drawer on link click
  drawerLinks?.forEach(link => {
    link.addEventListener('click', closeDrawer);
  });

  // Close drawer on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer?.classList.contains('open')) {
      closeDrawer();
    }
  });

  // Auto-close drawer on desktop resize
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024 && drawer?.classList.contains('open')) {
      closeDrawer();
    }
  });

  // Navbar scroll effect
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (scrollY > 50) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }
    lastScroll = scrollY;
  }, { passive: true });
}

/* ══════════════════════════════════════════════════════════════════════
   FAQ ACCORDION
   ══════════════════════════════════════════════════════════════════════ */

function initFAQ() {
  const faqItems = document.querySelectorAll('.faq__item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq__question');
    const answer = item.querySelector('.faq__answer');
    const inner = item.querySelector('.faq__answer-inner');

    question?.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all others
      faqItems.forEach(other => {
        if (other !== item) {
          other.classList.remove('active');
          const otherAnswer = other.querySelector('.faq__answer');
          if (otherAnswer) otherAnswer.style.maxHeight = '0';
        }
      });

      // Toggle current
      item.classList.toggle('active');
      if (!isActive && answer && inner) {
        answer.style.maxHeight = inner.scrollHeight + 'px';
      } else if (answer) {
        answer.style.maxHeight = '0';
      }
    });
  });
}

/* ══════════════════════════════════════════════════════════════════════
   ABOUT ACCORDION (E-E-A-T section)
   ══════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  const accordionItems = document.querySelectorAll('.accordion__item');

  accordionItems.forEach(item => {
    const trigger = item.querySelector('.accordion__trigger');
    const body = item.querySelector('.accordion__body');
    const inner = item.querySelector('.accordion__body-inner');

    trigger?.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all others
      accordionItems.forEach(other => {
        if (other !== item) {
          other.classList.remove('active');
          const otherBody = other.querySelector('.accordion__body');
          if (otherBody) otherBody.style.maxHeight = '0';
        }
      });

      // Toggle current
      item.classList.toggle('active');
      if (!isActive && body && inner) {
        body.style.maxHeight = inner.scrollHeight + 'px';
      } else if (body) {
        body.style.maxHeight = '0';
      }
    });
  });
});

/* ══════════════════════════════════════════════════════════════════════
   GALLERY — Touch-safe scroll carousel with dot indicators
   ══════════════════════════════════════════════════════════════════════ */

let isGallerySwiping = false;

function initGallery() {
  const wrapper = document.querySelector('.gallery__track-wrapper');
  const track = document.getElementById('gallery-track');
  const prevBtn = document.getElementById('gallery-prev');
  const nextBtn = document.getElementById('gallery-next');
  const dots = document.querySelectorAll('.gallery__dot');

  if (!wrapper || !track) return;

  const slides = track.querySelectorAll('.gallery__slide');
  if (!slides.length) return;

  function scrollToSlide(index) {
    const targetIndex = Math.max(0, Math.min(index, slides.length - 1));
    const slide = slides[targetIndex];
    if (slide) {
      const scrollPos = slide.offsetLeft - (wrapper.clientWidth - slide.offsetWidth) / 2;
      wrapper.scrollTo({
        left: Math.max(0, scrollPos),
        behavior: 'smooth'
      });
    }
  }

  function getActiveIndex() {
    const wrapperCenter = wrapper.scrollLeft + wrapper.clientWidth / 2;
    let closestIndex = 0;
    let minDistance = Infinity;

    slides.forEach((slide, index) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(wrapperCenter - slideCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  function updateDots() {
    const activeIndex = getActiveIndex();
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === activeIndex);
    });
  }

  prevBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const currentIndex = getActiveIndex();
    scrollToSlide(currentIndex - 1);
  });

  nextBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const currentIndex = getActiveIndex();
    scrollToSlide(currentIndex + 1);
  });

  dots.forEach((dot, i) => {
    dot.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSlide(i);
    });
  });

  // Track scroll for active dot updates
  let scrollTimeout;
  wrapper.addEventListener('scroll', () => {
    if (!scrollTimeout) {
      scrollTimeout = requestAnimationFrame(() => {
        updateDots();
        scrollTimeout = null;
      });
    }
  }, { passive: true });

  // Touch gesture disambiguation (prevents accidental Lightbox/modal triggers while swiping)
  let touchStartX = 0;
  let touchStartY = 0;
  let hasMoved = false;

  wrapper.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      hasMoved = false;
      isGallerySwiping = false;
    }
  }, { passive: true });

  wrapper.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      const diffX = Math.abs(e.touches[0].clientX - touchStartX);
      const diffY = Math.abs(e.touches[0].clientY - touchStartY);
      if (diffX > 8 || diffY > 8) {
        hasMoved = true;
        isGallerySwiping = true;
      }
    }
  }, { passive: true });

  wrapper.addEventListener('touchend', () => {
    if (hasMoved) {
      setTimeout(() => {
        isGallerySwiping = false;
      }, 200);
    } else {
      isGallerySwiping = false;
    }
  }, { passive: true });

  // Mouse drag-to-scroll support for desktop
  let isMouseDown = false;
  let mouseStartX = 0;
  let mouseScrollLeft = 0;
  let mouseMoved = false;

  wrapper.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    mouseMoved = false;
    mouseStartX = e.pageX - wrapper.offsetLeft;
    mouseScrollLeft = wrapper.scrollLeft;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    const x = e.pageX - wrapper.offsetLeft;
    const walk = (x - mouseStartX) * 1.5;
    if (Math.abs(walk) > 5) {
      mouseMoved = true;
      isGallerySwiping = true;
    }
    wrapper.scrollLeft = mouseScrollLeft - walk;
  });

  window.addEventListener('mouseup', () => {
    if (isMouseDown) {
      isMouseDown = false;
      if (mouseMoved) {
        setTimeout(() => {
          isGallerySwiping = false;
        }, 150);
      } else {
        isGallerySwiping = false;
      }
    }
  });

  // Initial update
  updateDots();
}

/* ══════════════════════════════════════════════════════════════════════
   TESTIMONIALS CAROUSEL — Touch-ready review carousel with dots & arrows
   ══════════════════════════════════════════════════════════════════════ */

function initTestimonialsCarousel() {
  const wrapper = document.getElementById('testimonials-track-wrapper');
  const track = document.getElementById('testimonials-track');
  const prevBtn = document.getElementById('testimonials-prev');
  const nextBtn = document.getElementById('testimonials-next');
  const dots = document.querySelectorAll('.testimonials__dot');

  if (!wrapper || !track) return;

  const slides = track.querySelectorAll('.testimonials__slide');
  if (!slides.length) return;

  function scrollToSlide(index) {
    const targetIndex = Math.max(0, Math.min(index, slides.length - 1));
    const slide = slides[targetIndex];
    if (slide) {
      const scrollPos = slide.offsetLeft - (wrapper.clientWidth - slide.offsetWidth) / 2;
      wrapper.scrollTo({
        left: Math.max(0, scrollPos),
        behavior: 'smooth'
      });
    }
  }

  function getActiveIndex() {
    const wrapperCenter = wrapper.scrollLeft + wrapper.clientWidth / 2;
    let closestIndex = 0;
    let minDistance = Infinity;

    slides.forEach((slide, index) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(wrapperCenter - slideCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  function updateDots() {
    const activeIndex = getActiveIndex();
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === activeIndex);
    });
  }

  prevBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const currentIndex = getActiveIndex();
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : slides.length - 1;
    scrollToSlide(prevIndex);
  });

  nextBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const currentIndex = getActiveIndex();
    const nextIndex = currentIndex < slides.length - 1 ? currentIndex + 1 : 0;
    scrollToSlide(nextIndex);
  });

  dots.forEach((dot, i) => {
    dot.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSlide(i);
    });
  });

  // Track scroll for active dot updates
  let scrollTimeout;
  wrapper.addEventListener('scroll', () => {
    if (!scrollTimeout) {
      scrollTimeout = requestAnimationFrame(() => {
        updateDots();
        scrollTimeout = null;
      });
    }
  }, { passive: true });

  // Subtle auto-advance every 6.5s, pausing on interaction
  let autoTimer = null;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function startAuto() {
    if (prefersReducedMotion) return;
    stopAuto();
    autoTimer = setInterval(() => {
      const currentIndex = getActiveIndex();
      const nextIndex = (currentIndex + 1) % slides.length;
      scrollToSlide(nextIndex);
    }, 6500);
  }

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  startAuto();

  wrapper.addEventListener('mouseenter', stopAuto);
  wrapper.addEventListener('mouseleave', startAuto);
  wrapper.addEventListener('touchstart', stopAuto, { passive: true });
  wrapper.addEventListener('focusin', stopAuto);
  wrapper.addEventListener('focusout', startAuto);

  // Initial update
  updateDots();
}

/* ══════════════════════════════════════════════════════════════════════
   LIGHTBOX — Gallery image viewer (safe from swipe triggers)
   ══════════════════════════════════════════════════════════════════════ */

function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.getElementById('lightbox-close');
  const gallerySlides = document.querySelectorAll('.gallery__slide img');

  if (!lightbox) return;

  gallerySlides.forEach(img => {
    img.addEventListener('click', (e) => {
      // Prevent opening lightbox if user was swiping or dragging
      if (isGallerySwiping) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  lightboxClose?.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('open')) {
      closeLightbox();
    }
  });
}

/* ══════════════════════════════════════════════════════════════════════
   SMOOTH SCROLL — For anchor links
   ══════════════════════════════════════════════════════════════════════ */

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

/* ══════════════════════════════════════════════════════════════════════
   URGENCY BAR TEXT CAROUSEL — Rotador dinámico de mensajes clave
   ══════════════════════════════════════════════════════════════════════ */

function initUrgencyCarousel() {
  const carousel = document.getElementById('urgency-carousel');
  if (!carousel) return;

  const slides = carousel.querySelectorAll('.urgency-bar__slide');
  if (slides.length <= 1) return;

  let currentIndex = 0;
  let timer = null;
  const delay = 3600; // 3.6 segundos de rotación

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  function nextSlide() {
    const current = slides[currentIndex];
    current.classList.remove('active');
    current.classList.add('exiting');

    currentIndex = (currentIndex + 1) % slides.length;
    const next = slides[currentIndex];

    setTimeout(() => {
      current.classList.remove('exiting');
    }, 450);

    next.classList.add('active');
  }

  function start() {
    if (!timer) {
      timer = setInterval(nextSlide, delay);
    }
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  start();

  // Pausar rotación en hover o foco
  carousel.addEventListener('mouseenter', stop);
  carousel.addEventListener('mouseleave', start);
  carousel.addEventListener('focusin', stop);
  carousel.addEventListener('focusout', start);
}

/* ══════════════════════════════════════════════════════════════════════
   CONTACT & SUPPORT SECTION — Form handler & smooth navigation
   ══════════════════════════════════════════════════════════════════════ */

function initContactModal() {
  const form = document.getElementById('contact-form');
  const statusEl = document.getElementById('contact-status');
  const submitBtn = document.getElementById('contact-submit-btn');
  const submitText = submitBtn?.querySelector('.btn-submit__text');
  const submitSpinner = submitBtn?.querySelector('.btn-submit__spinner');
  const firstInput = document.getElementById('contact-name');
  const contactSection = document.getElementById('contacto');

  const openBtn = document.getElementById('open-contact-modal-btn');
  const footerLink = document.getElementById('footer-contact-modal-link');

  function scrollToContact(e) {
    if (contactSection) {
      if (e) e.preventDefault();
      contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => firstInput?.focus(), 600);
    }
  }

  // Smooth scroll trigger listeners
  openBtn?.addEventListener('click', scrollToContact);
  footerLink?.addEventListener('click', scrollToContact);

  // Form submission via Fetch
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Clear previous status
      if (statusEl) {
        statusEl.style.display = 'none';
        statusEl.className = 'contact-form__status';
        statusEl.textContent = '';
      }

      const formData = new FormData(form);
      const name = (formData.get('name') || '').toString().trim();
      const email = (formData.get('email') || '').toString().trim();
      const phone = (formData.get('phone') || '').toString().trim();
      const service = (formData.get('service') || '').toString().trim();
      const message = (formData.get('message') || '').toString().trim();
      const privacy = formData.get('privacy');
      const _hp = (formData.get('_hp') || '').toString();

      // Client-side validations
      if (name.length < 2) {
        showStatus('Por favor ingresa tu nombre completo.', 'error');
        firstInput?.focus();
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        showStatus('Por favor ingresa un correo electrónico válido.', 'error');
        document.getElementById('contact-email')?.focus();
        return;
      }

      if (message.length < 5) {
        showStatus('Por favor escribe un mensaje o consulta detallada.', 'error');
        document.getElementById('contact-message')?.focus();
        return;
      }

      if (!privacy) {
        showStatus('Debes aceptar el Aviso de Privacidad para continuar.', 'error');
        return;
      }

      // Set loading state
      setLoading(true);

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ name, email, phone, service, message, _hp })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          showStatus('✓ ¡Mensaje enviado con éxito! Nos comunicaremos contigo a la brevedad.', 'success');
          form.reset();
        } else {
          showStatus(result.error || 'Ocurrió un error al procesar tu solicitud. Por favor intenta más tarde o comunícate por WhatsApp.', 'error');
        }
      } catch (err) {
        console.error('[Contact Form Error]:', err);
        showStatus('Error de conexión con el servidor. Por favor intenta de nuevo o escríbenos directamente por WhatsApp.', 'error');
      } finally {
        setLoading(false);
      }
    });
  }

  function showStatus(text, type) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = `contact-form__status ${type}`;
    statusEl.style.display = 'block';
  }

  function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    if (submitText) submitText.style.display = isLoading ? 'none' : 'flex';
    if (submitSpinner) submitSpinner.style.display = isLoading ? 'flex' : 'none';
  }
}




/* ══════════════════════════════════════════════════════════════════════════
   CLINICAL PRE-TRIAGE & QUOTE WIDGET (Cotizador y Pre-Cita Rápida 3 Clics)
   ══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('clinical-triage-form');
  if (!form) return;

  const serviceSelect = document.getElementById('triage-service');
  const priceBadge = document.getElementById('triage-price-badge');

  const prices = {
    'Chequeo Ginecológico Completo ($1,200 MXN)': '$1,200 MXN · Incluye Papanicolaou, Colposcopía, Vaginoscopía y Ultrasonido',
    'Consulta Ginecológica / Control Prenatal ($800 MXN)': '$800 MXN · Diagnóstico, SOP, Miomas, Anticonceptivos o Seguimiento',
    'Ultrasonido Estructural 2do Trimestre ($1,700 MXN)': '$1,700 MXN · Semanas 18–24 (Alta Definición GE Voluson)',
    'Tamizaje Genético 1er Trimestre ($1,700 MXN)': '$1,700 MXN · Semanas 11–13.6 (Cálculo de Riesgo Fetal)',
    'Ultrasonido 3er Trimestre / Doppler ($1,500 MXN)': '$1,500 MXN · Semana 28 en adelante (Crecimiento y Bienestar)'
  };

  if (serviceSelect && priceBadge) {
    serviceSelect.addEventListener('change', () => {
      priceBadge.textContent = prices[serviceSelect.value] || '$800 – $1,700 MXN';
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const service = document.getElementById('triage-service')?.value || 'Chequeo Ginecológico Completo ($1,200 MXN)';
    const context = document.getElementById('triage-context')?.value || 'Primera vez / Revisión preventiva';
    const insurance = document.getElementById('triage-insurance')?.value || 'Particular';
    const name = (document.getElementById('triage-name')?.value || '').trim();
    const phone = (document.getElementById('triage-phone')?.value || '').trim();

    try {
      fetch('/api/waos/lead-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: name || 'Paciente Web (Cotizador)',
          phone: phone || 'web_triage',
          serviceRequested: service,
          gestationalWeeks: context,
          insuranceCarrier: insurance
        })
      }).catch(() => {});
    } catch (_) {}

    const greeting = name ? `Hola Dra. Odette, soy *${name}*.` : 'Hola Dra. Odette,';
    const msg = `${greeting} Me gustaría agendar cita desde su sitio web:\n• *Estudio/Consulta:* ${service}\n• *Motivo/Semanas:* ${context}\n• *Modalidad:* ${insurance}\n¿Qué horarios tiene disponibles?`;
    window.open(`https://wa.me/523327905726?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   HEATMAP TRACKER v2 — Zero-PII Click & Scroll Telemetry (dra_odette)
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.location.search.includes('canvas=1') || window.self !== window.top) return;

  const ENDPOINT = '/api/heatmap';
  const SITE_ID = 'dra_odette';
  const queue = [];
  let maxScrollZone = '';

  let sid = sessionStorage.getItem('_odette_hm_sid');
  if (!sid) {
    sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    try { sessionStorage.setItem('_odette_hm_sid', sid); } catch (_) {}
  }

  function getDevice() {
    const w = window.innerWidth || document.documentElement.clientWidth || 1024;
    if (w < 768) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  }

  function getScrollZone(yPct) {
    if (yPct < 20) return '0-20';
    if (yPct < 40) return '20-40';
    if (yPct < 60) return '40-60';
    if (yPct < 80) return '60-80';
    return '80-100';
  }

  function buildSelector(el) {
    if (!el || !el.tagName) return '';
    const target = el.closest('a,button,[role="button"],input,select,.service-card,.faq__item') || el;
    const tag = (target.tagName || '').toLowerCase();
    const id = target.id ? '#' + target.id : '';
    const cls = (typeof target.className === 'string' && target.className.trim())
      ? '.' + target.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '';
    return (tag + id + cls).slice(0, 140);
  }

  function getSafeLabel(el) {
    if (!el) return '';
    const target = el.closest('a,button,[role="button"],.service-card,.faq__question') || el;
    const tag = (target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return target.getAttribute('placeholder') || target.name || tag;
    return (target.getAttribute('aria-label') || target.innerText || target.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 75);
  }

  function flush() {
    if (!queue.length) return;
    const batch = queue.splice(0, 25);
    const payload = JSON.stringify({
      site: SITE_ID,
      path: window.location.pathname || '/',
      device: getDevice(),
      sid: sid,
      events: batch
    });
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon(ENDPOINT, blob)) return;
      }
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(() => {});
    } catch (_) {}
  }

  document.addEventListener('click', (e) => {
    const vw = Math.max(window.innerWidth || 0, 1);
    const vh = Math.max(window.innerHeight || 0, 1);
    const dh = Math.max(document.documentElement.scrollHeight || 0, document.body.scrollHeight || 0, vh);
    const pageX = typeof e.pageX === 'number' ? e.pageX : (e.clientX + window.scrollX);
    const pageY = typeof e.pageY === 'number' ? e.pageY : (e.clientY + window.scrollY);
    const xPct = Math.max(0, Math.min(100, (pageX / vw) * 100));
    const yPct = Math.max(0, Math.min(100, (pageY / dh) * 100));

    queue.push({
      t: 'click',
      x: Number(xPct.toFixed(2)),
      y: Number(yPct.toFixed(2)),
      yp: Math.round(pageY),
      sz: getScrollZone(yPct),
      vw: vw,
      vh: vh,
      dh: dh,
      tag: (e.target && e.target.tagName ? e.target.tagName.toLowerCase() : ''),
      sel: buildSelector(e.target),
      txt: getSafeLabel(e.target)
    });

    if (queue.length >= 6) flush();
  }, { passive: true, capture: true });

  window.addEventListener('scroll', () => {
    const vh = Math.max(window.innerHeight || 0, 1);
    const dh = Math.max(document.documentElement.scrollHeight || 0, document.body.scrollHeight || 0, vh);
    const bottomPct = Math.min(100, ((window.scrollY + vh) / dh) * 100);
    const zone = getScrollZone(bottomPct);
    if (zone > maxScrollZone) {
      maxScrollZone = zone;
      queue.push({
        t: 'scroll',
        x: 50,
        y: Number(bottomPct.toFixed(1)),
        yp: Math.round(window.scrollY + vh),
        sz: zone,
        vw: window.innerWidth || 0,
        vh: vh,
        dh: dh
      });
    }
  }, { passive: true });

  setInterval(flush, 6000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
})();
