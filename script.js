const newsletterForm = document.querySelector('.newsletter-form');

(() => {
  const seasonValue = document.body?.dataset?.season;
  if (!seasonValue) {
    return;
  }

  const SCROLL_KEY = 'inren:season-scroll';
  const CURRENT_PATH = window.location.pathname;

  const readStoredState = () => {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (_error) {
      sessionStorage.removeItem(SCROLL_KEY);
      return null;
    }
  };

  const writeStoredState = (payload) => {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(payload));
  };

  const clearStoredState = () => {
    sessionStorage.removeItem(SCROLL_KEY);
  };

  const waitForImagesToSettle = (timeoutMs = 6000) => {
    const images = Array.from(document.images || []);
    if (images.length === 0) {
      return Promise.resolve();
    }

    const waiters = images.map((img) => {
      if (img.complete) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const done = () => {
          img.removeEventListener('load', done);
          img.removeEventListener('error', done);
          resolve();
        };

        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      });
    });

    return Promise.race([
      Promise.all(waiters),
      new Promise((resolve) => {
        setTimeout(resolve, timeoutMs);
      }),
    ]);
  };

  const restoreScrollPosition = async () => {
    const stored = readStoredState();
    if (!stored || stored.path !== CURRENT_PATH) {
      return;
    }

    const targetY = Number(stored.y);
    if (!Number.isFinite(targetY) || targetY < 0) {
      clearStoredState();
      return;
    }

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    await waitForImagesToSettle();

    requestAnimationFrame(() => {
      window.scrollTo(0, targetY);
      clearStoredState();
    });
  };

  const isPrimaryPointerNavigation = (event, anchor) => {
    if (event.defaultPrevented) {
      return false;
    }
    if (event.button !== 0) {
      return false;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return false;
    }
    if (anchor.target && anchor.target !== '_self') {
      return false;
    }
    return true;
  };

  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a');
    if (!anchor || !isPrimaryPointerNavigation(event, anchor)) {
      return;
    }

    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) {
      return;
    }

    let nextUrl;
    try {
      nextUrl = new URL(anchor.href, window.location.href);
    } catch (_error) {
      return;
    }

    const isDetailPage = /\/product-detail\.html$/i.test(nextUrl.pathname);
    if (!isDetailPage) {
      return;
    }

    writeStoredState({
      path: CURRENT_PATH,
      y: Math.max(0, Math.round(window.scrollY)),
      at: Date.now(),
    });
  }, true);

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) {
      return;
    }

    const stored = readStoredState();
    if (stored && stored.path === CURRENT_PATH) {
      clearStoredState();
    }
  });

  restoreScrollPosition();
})();

if (newsletterForm) {
  newsletterForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const emailInput = newsletterForm.querySelector('input[type="email"]');
    if (!emailInput) {
      return;
    }

    const banner = document.createElement('p');
    banner.textContent = `Thanks, ${emailInput.value}. You are on the list.`;
    banner.style.margin = '0.8rem 0 0';
    banner.style.fontSize = '0.85rem';
    banner.style.letterSpacing = '0.04em';

    const existing = newsletterForm.parentElement?.querySelector('.subscription-confirm');
    if (existing) {
      existing.remove();
    }

    banner.className = 'subscription-confirm';
    newsletterForm.parentElement?.appendChild(banner);
    newsletterForm.reset();
  });
}

// Modal disclaimer handler
const disclaimerModal = document.getElementById('disclaimerModal');

if (disclaimerModal) {
  const modalCloseBtn = disclaimerModal.querySelector('.modal-close-btn');

  // Check if modal has been shown in this session
  if (!sessionStorage.getItem('disclaimerShown')) {
    // First time in this session - show the modal
    disclaimerModal.classList.remove('hidden');
    // Mark as shown on first visit
    sessionStorage.setItem('disclaimerShown', 'true');
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
      disclaimerModal.classList.add('hidden');
    });
  }

  // Close modal if clicking outside the content area
  disclaimerModal.addEventListener('click', (event) => {
    if (event.target === disclaimerModal) {
      disclaimerModal.classList.add('hidden');
    }
  });

  // Auto close modal after 10 seconds
  setTimeout(() => {
    disclaimerModal.classList.add('hidden');
  }, 10000);
}

const menuWrap = document.querySelector('.home-btn-wrap');
const menuButton = menuWrap?.querySelector('.home-btn');

if (menuWrap && menuButton) {
  menuButton.addEventListener('click', (event) => {
    event.preventDefault();
    menuWrap.classList.toggle('open');
  });

  document.addEventListener('click', (event) => {
    if (!menuWrap.contains(event.target)) {
      menuWrap.classList.remove('open');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      menuWrap.classList.remove('open');
    }
  });
}

const homeRightImage = document.querySelector('.home-page .home-right-image');

if (homeRightImage) {
  const defaultHomeImage = 'images/visuals/01/IN REN CAMPAIGN/0836x.webp';
  const imageResolver = window.inrenResolveAssetUrl || ((value) => value);
  const imageUrl = imageResolver(defaultHomeImage);

  homeRightImage.style.setProperty('--home-right-image-url', `url("${imageUrl}")`);

  if (imageUrl && imageUrl !== 'none') {
    const probe = new Image();
    probe.onload = () => {
      homeRightImage.style.setProperty('--home-image-ratio', `${probe.naturalWidth} / ${probe.naturalHeight}`);
    };
    probe.src = imageUrl;
  }

  homeRightImage.addEventListener('mouseenter', () => {
    homeRightImage.classList.add('ripple-active');
  });

  homeRightImage.addEventListener('mousemove', (event) => {
    const rect = homeRightImage.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const dx = ((event.clientX - rect.left) / rect.width - 0.5) * 216;
    const dy = ((event.clientY - rect.top) / rect.height - 0.5) * 216;

    homeRightImage.style.setProperty('--ripple-x', `${x}%`);
    homeRightImage.style.setProperty('--ripple-y', `${y}%`);
    homeRightImage.style.setProperty('--wave-shift-x', `${dx}px`);
    homeRightImage.style.setProperty('--wave-shift-y', `${dy}px`);
  });

  homeRightImage.addEventListener('mouseleave', () => {
    homeRightImage.classList.remove('ripple-active');
    homeRightImage.style.setProperty('--ripple-x', '50%');
    homeRightImage.style.setProperty('--ripple-y', '50%');
    homeRightImage.style.setProperty('--wave-shift-x', '0px');
    homeRightImage.style.setProperty('--wave-shift-y', '0px');
  });
}

const brandButton = document.querySelector('.brand-button');

if (brandButton) {
  const glitchCanvas = brandButton.querySelector('.brand-glitch-canvas');
  const glitchCtx = glitchCanvas?.getContext('2d');

  if (glitchCanvas && glitchCtx) {
    const brandGlitch = {
      active: false,
      frame: 0,
      mx: 0,
      my: 0,
      radius: 100,
      t: 0,
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const resizeBrandCanvas = () => {
      const rect = brandButton.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      glitchCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
      glitchCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
      glitchCanvas.style.width = `${rect.width}px`;
      glitchCanvas.style.height = `${rect.height}px`;
      glitchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      brandGlitch.radius = Math.min(rect.width, rect.height) * 1.45;
      brandButton.style.setProperty('--brand-radius', `${brandGlitch.radius}px`);
    };

    const updateBrandPointer = (clientX, clientY) => {
      const rect = brandButton.getBoundingClientRect();
      brandGlitch.mx = clamp(clientX - rect.left, 0, rect.width);
      brandGlitch.my = clamp(clientY - rect.top, 0, rect.height);
      brandButton.style.setProperty('--brand-mx', `${brandGlitch.mx.toFixed(2)}px`);
      brandButton.style.setProperty('--brand-my', `${brandGlitch.my.toFixed(2)}px`);
    };

    const drawBrandGlitch = () => {
      if (!brandGlitch.active) {
        glitchCtx.clearRect(0, 0, glitchCanvas.width, glitchCanvas.height);
        return;
      }

      const rect = brandButton.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const cx = brandGlitch.mx;
      const cy = brandGlitch.my;
      const radius = brandGlitch.radius;

      brandGlitch.t += 0.02;
      glitchCtx.clearRect(0, 0, width, height);

      const bandCount = 7;
      for (let i = 0; i < bandCount; i += 1) {
        const y = Math.floor(Math.random() * height);
        const dy = Math.abs(y - cy);
        const p = clamp(1 - dy / radius, 0, 1);
        if (p < 0.04) {
          continue;
        }

        const h = 1 + Math.floor(Math.random() * 3);
        const shift = (Math.random() * 2 - 1) * 20 * p;
        const alpha = 0.05 + 0.28 * p;
        glitchCtx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        glitchCtx.fillRect(shift, y, width, h);

        const hue = Math.random() > 0.5 ? 6 : 196;
        glitchCtx.fillStyle = `hsla(${hue}, 95%, 55%, ${(alpha * 0.75).toFixed(3)})`;
        glitchCtx.fillRect(-shift * 0.35, y, width, 1);
      }

      const blockCount = 90;
      for (let i = 0; i < blockCount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.pow(Math.random(), 1.65) * radius;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (x < 0 || y < 0 || x > width || y > height) {
          continue;
        }

        const p = 1 - r / radius;
        const size = 2 + Math.random() * 8 * p;
        const jitterX = (Math.random() * 2 - 1) * 12 * p;
        const jitterY = (Math.random() * 2 - 1) * 5 * p;
        const hue = (brandGlitch.t * 65 + Math.random() * 360) % 360;
        const alpha = 0.1 + 0.35 * p;
        glitchCtx.fillStyle = `hsla(${hue.toFixed(1)}, 98%, 62%, ${alpha.toFixed(3)})`;
        glitchCtx.fillRect(x + jitterX, y + jitterY, size, size);
      }

      const noiseCount = 340;
      for (let i = 0; i < noiseCount; i += 1) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const dist = Math.hypot(x - cx, y - cy);
        const p = clamp(1 - dist / radius, 0, 1);
        if (p <= 0) {
          continue;
        }

        const alpha = Math.random() * 0.48 * p;
        const pick = Math.random();
        if (pick < 0.33) {
          glitchCtx.fillStyle = `rgba(255, 40, 40, ${alpha.toFixed(3)})`;
        } else if (pick < 0.66) {
          glitchCtx.fillStyle = `rgba(40, 220, 255, ${alpha.toFixed(3)})`;
        } else {
          glitchCtx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
        }

        const px = Math.random() < 0.2 ? 2 : 1;
        glitchCtx.fillRect(x, y, px, px);
      }

      const centerBias = clamp(
        1 - Math.hypot(cx - width / 2, cy - height / 2) / (Math.max(width, height) * 0.85),
        0.35,
        1
      );
      const rgbOffset = 1 + Math.random() * 6 * centerBias;
      brandButton.style.setProperty('--brand-rgb-offset', `${rgbOffset.toFixed(2)}px`);

      brandGlitch.frame = requestAnimationFrame(drawBrandGlitch);
    };

    const startBrandGlitch = (event) => {
      brandGlitch.active = true;
      brandButton.classList.add('glitch-active');
      updateBrandPointer(event.clientX, event.clientY);
      cancelAnimationFrame(brandGlitch.frame);
      brandGlitch.frame = requestAnimationFrame(drawBrandGlitch);
    };

    const moveBrandGlitch = (event) => {
      if (!brandGlitch.active) {
        return;
      }
      updateBrandPointer(event.clientX, event.clientY);
    };

    const stopBrandGlitch = () => {
      brandGlitch.active = false;
      brandButton.classList.remove('glitch-active');
      cancelAnimationFrame(brandGlitch.frame);
      glitchCtx.clearRect(0, 0, glitchCanvas.width, glitchCanvas.height);
      brandButton.style.setProperty('--brand-rgb-offset', '0px');
    };

    brandButton.addEventListener('mouseenter', startBrandGlitch);
    brandButton.addEventListener('mousemove', moveBrandGlitch);
    brandButton.addEventListener('mouseleave', stopBrandGlitch);
    window.addEventListener('resize', resizeBrandCanvas);

    resizeBrandCanvas();
  }
}
