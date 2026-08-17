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
   GALLERY — Horizontal scroll carousel
   ══════════════════════════════════════════════════════════════════════ */

function initGallery() {
  const track = document.getElementById('gallery-track');
  const prevBtn = document.getElementById('gallery-prev');
  const nextBtn = document.getElementById('gallery-next');
  const dots = document.querySelectorAll('.gallery__dot');

  if (!track) return;

  let currentIndex = 0;
  const slides = track.querySelectorAll('.gallery__slide');
  const totalSlides = slides.length;
  const slideWidth = 300; // approximate slide width + gap

  function getVisibleSlides() {
    const viewportWidth = track.parentElement.offsetWidth;
    return Math.floor(viewportWidth / slideWidth) || 1;
  }

  function updatePosition() {
    const visibleSlides = getVisibleSlides();
    const maxIndex = Math.max(0, totalSlides - visibleSlides);
    currentIndex = Math.min(currentIndex, maxIndex);
    currentIndex = Math.max(0, currentIndex);

    const offset = currentIndex * slideWidth;
    track.style.transform = `translateX(-${offset}px)`;

    // Update dots
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentIndex);
    });
  }

  prevBtn?.addEventListener('click', () => {
    currentIndex = Math.max(0, currentIndex - 1);
    updatePosition();
  });

  nextBtn?.addEventListener('click', () => {
    currentIndex++;
    updatePosition();
  });

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      currentIndex = i;
      updatePosition();
    });
  });

  // Touch swipe
  let touchStartX = 0;
  let touchEndX = 0;

  track.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        currentIndex++;
      } else {
        currentIndex = Math.max(0, currentIndex - 1);
      }
      updatePosition();
    }
  }, { passive: true });

  // Recalculate on resize
  window.addEventListener('resize', updatePosition, { passive: true });
}

/* ══════════════════════════════════════════════════════════════════════
   LIGHTBOX — Gallery image viewer
   ══════════════════════════════════════════════════════════════════════ */

function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.getElementById('lightbox-close');
  const gallerySlides = document.querySelectorAll('.gallery__slide img');

  if (!lightbox) return;

  gallerySlides.forEach(img => {
    img.addEventListener('click', () => {
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
