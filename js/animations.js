/* ==========================================================================
   ANIMATIONS.JS — Scroll-triggered reveals with IntersectionObserver & Parallax
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initRevealAnimations();
  initStaggerAnimations();
  initCounterAnimations();
  initHeroScrollParallax();
  initMouseParallax();
});

/* ══════════════════════════════════════════════════════════════════════
   HERO SCROLL PARALLAX — 60fps GPU-accelerated multi-plane depth
   ══════════════════════════════════════════════════════════════════════ */

function initHeroScrollParallax() {
  const hero = document.getElementById('hero');
  const cutout = hero?.querySelector('.hero__cutout');
  const shape1 = hero?.querySelector('.hero__shape-1');
  const shape2 = hero?.querySelector('.hero__shape-2');
  const heroContent = hero?.querySelector('.hero__content');
  const halo = hero?.querySelector('.hero__image-wrapper');

  if (!hero || !cutout) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  let ticking = false;
  let lastScrollY = window.scrollY;

  function updateParallax() {
    const scrollY = window.scrollY;
    const heroRect = hero.getBoundingClientRect();
    const heroHeight = heroRect.height || 600;

    if (scrollY <= heroHeight + 300) {
      const progress = Math.min(1, Math.max(0, scrollY / heroHeight));

      // Cutout moves at a subtle relaxed parallax speed
      if (cutout) {
        cutout.style.transform = `translate3d(0, ${scrollY * 0.18}px, 0)`;
      }

      // Organic background shapes float with distinct rotational depth
      if (shape1) {
        shape1.style.transform = `translate3d(${scrollY * 0.09}px, ${-scrollY * 0.22}px, 0) rotate(${scrollY * 0.05}deg)`;
      }
      if (shape2) {
        shape2.style.transform = `translate3d(${-scrollY * 0.08}px, ${-scrollY * 0.16}px, 0) rotate(${-scrollY * 0.04}deg)`;
      }

      // Text content subtly floats and soft fades into subsequent section
      if (heroContent && window.innerWidth >= 768) {
        heroContent.style.transform = `translate3d(0, ${scrollY * 0.08}px, 0)`;
        heroContent.style.opacity = `${Math.max(0, 1 - progress * 0.85)}`;
      }
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    lastScrollY = window.scrollY;
    if (!ticking) {
      window.requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }, { passive: true });
}

/* ══════════════════════════════════════════════════════════════════════
   INTERACTIVE 3D MOUSE PARALLAX — Desktop hover depth effect
   ══════════════════════════════════════════════════════════════════════ */

function initMouseParallax() {
  const hero = document.getElementById('hero');
  const cutout = hero?.querySelector('.hero__cutout');
  const shape1 = hero?.querySelector('.hero__shape-1');
  const shape2 = hero?.querySelector('.hero__shape-2');

  if (!hero || !cutout || window.innerWidth < 1024) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  let mouseX = 0, mouseY = 0;
  let currentX = 0, currentY = 0;
  let isHovering = false;

  hero.addEventListener('mouseenter', () => {
    isHovering = true;
  });

  hero.addEventListener('mouseleave', () => {
    isHovering = false;
    mouseX = 0;
    mouseY = 0;
  });

  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    mouseX = x * 20; // max shift in px
    mouseY = y * 14;
  });

  function renderMouseParallax() {
    if (window.scrollY < 400) {
      // Smooth linear interpolation (LERP)
      currentX += (mouseX - currentX) * 0.08;
      currentY += (mouseY - currentY) * 0.08;

      if (cutout) {
        const scrollOffset = window.scrollY * 0.18;
        cutout.style.transform = `translate3d(${currentX * 0.8}px, ${scrollOffset + currentY * 0.8}px, 0) rotateY(${currentX * 0.25}deg)`;
      }
    }

    requestAnimationFrame(renderMouseParallax);
  }

  requestAnimationFrame(renderMouseParallax);
}

/* ══════════════════════════════════════════════════════════════════════
   REVEAL ON SCROLL — Fade-in + slide-up for sections
   ══════════════════════════════════════════════════════════════════════ */

function initRevealAnimations() {
  const revealElements = document.querySelectorAll('.reveal');

  if (!revealElements.length) return;

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    revealElements.forEach(el => el.classList.add('revealed'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.05,
    rootMargin: '50px 0px 50px 0px'
  });

  revealElements.forEach(el => observer.observe(el));

  // Safety fallback: reveal all after 3s
  setTimeout(() => {
    revealElements.forEach(el => el.classList.add('revealed'));
  }, 3000);
}

/* ══════════════════════════════════════════════════════════════════════
   STAGGER ANIMATIONS — Children enter with incremental delay
   ══════════════════════════════════════════════════════════════════════ */

function initStaggerAnimations() {
  const staggerContainers = document.querySelectorAll('[data-stagger]');

  if (!staggerContainers.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function revealContainer(container) {
    if (container.dataset.staggerRevealed) return;
    container.dataset.staggerRevealed = 'true';

    const children = container.querySelectorAll('[data-stagger-child]');
    const delay = parseInt(container.dataset.stagger) || 100;

    children.forEach((child, index) => {
      if (prefersReducedMotion) {
        child.style.opacity = '1';
        child.style.transform = 'none';
      } else {
        setTimeout(() => {
          child.style.opacity = '1';
          child.style.transform = 'translateY(0)';
        }, index * delay);
      }
    });
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        revealContainer(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.05,
    rootMargin: '50px 0px 50px 0px'
  });

  // Set initial state for stagger children
  staggerContainers.forEach(container => {
    const children = container.querySelectorAll('[data-stagger-child]');
    children.forEach(child => {
      if (!prefersReducedMotion) {
        child.style.opacity = '0';
        child.style.transform = 'translateY(20px)';
        child.style.transition = 'opacity 0.6s cubic-bezier(0.33, 1, 0.68, 1), transform 0.6s cubic-bezier(0.33, 1, 0.68, 1)';
      }
    });
    observer.observe(container);
  });

  // Safety fallback: reveal all after 2.5s in case observer doesn't fire
  setTimeout(() => {
    staggerContainers.forEach(container => revealContainer(container));
  }, 2500);
}

/* ══════════════════════════════════════════════════════════════════════
   COUNTER ANIMATIONS — Animate numbers counting up
   ══════════════════════════════════════════════════════════════════════ */

function initCounterAnimations() {
  const counters = document.querySelectorAll('[data-count]');

  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count);
        const duration = parseInt(el.dataset.countDuration) || 2000;
        const prefix = el.dataset.countPrefix || '';
        const suffix = el.dataset.countSuffix || '';

        animateCounter(el, target, duration, prefix, suffix);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element, target, duration, prefix, suffix) {
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);

    element.textContent = `${prefix}${current.toLocaleString()}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}
