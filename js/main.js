/* ==========================================================================
   MAIN.JS — Navigation, scroll behavior, FAQ accordion, gallery
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initFAQ();
  initGallery();
  initLightbox();
  initSmoothScroll();
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
