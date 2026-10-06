(() => {
  'use strict';

  /* ------------------------------------------------------------------
     Configuración del hero
     - images: en el orden en que se muestran. `focus` (opcional) es el
       punto de interés [x, y] de 0 a 1 que se conserva al recortar.
     - interval: milisegundos que cada imagen queda en pantalla.
     - fade: milisegundos del fundido entre imágenes (0 = corte seco).
     ------------------------------------------------------------------ */
  const HERO = {
    interval: 260,
    fade: 90,
    zoom: 0.05,
    images: [
      { src: 'assets/hero/01.svg' },
      { src: 'assets/hero/02.svg' },
      { src: 'assets/hero/03.svg' },
      { src: 'assets/hero/04.svg' },
      { src: 'assets/hero/05.svg' },
      { src: 'assets/hero/06.svg' },
      { src: 'assets/hero/07.svg' },
      { src: 'assets/hero/08.svg' },
      { src: 'assets/hero/09.svg' },
      { src: 'assets/hero/10.svg' },
      { src: 'assets/hero/11.svg' },
      { src: 'assets/hero/12.svg' },
    ],
  };

  // Tope de píxeles del lienzo: mantiene la memoria acotada en pantallas grandes / retina.
  const MAX_PIXELS = 2_400_000;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Hero ---------- */

  function initHero() {
    const hero = document.querySelector('.hero');
    const canvas = hero && hero.querySelector('.hero__canvas');
    const toggle = hero && hero.querySelector('.hero__toggle');
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    const sources = []; // imágenes decodificadas, en orden
    let frames = [];    // copias ya recortadas al tamaño del lienzo
    let current = 0;
    let previous = 0;
    let switchedAt = 0;
    let rafId = 0;
    let inView = true;
    let userPaused = false;

    const load = ({ src, focus }) => new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const done = () => resolve({ img, focus: focus || [0.5, 0.5] });
        img.decode ? img.decode().then(done, done) : done();
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });

    // Recorta cada imagen una sola vez (tipo `object-fit: cover`) para que
    // el bucle de animación solo copie mapas de bits del tamaño exacto.
    function buildFrame({ img, focus }) {
      const w = canvas.width;
      const h = canvas.height;
      const buffer = document.createElement('canvas');
      buffer.width = w;
      buffer.height = h;
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const bctx = buffer.getContext('2d', { alpha: false });
      bctx.imageSmoothingQuality = 'high';
      bctx.drawImage(img, (w - dw) * focus[0], (h - dh) * focus[1], dw, dh);
      return buffer;
    }

    function resize() {
      const { width, height } = hero.getBoundingClientRect();
      if (!width || !height) return;
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(MAX_PIXELS / (width * height))
      );
      const w = Math.round(width * dpr);
      const h = Math.round(height * dpr);
      if (w === canvas.width && h === canvas.height && frames.length === sources.length) return;
      canvas.width = w;
      canvas.height = h;
      frames = sources.map(buildFrame);
      draw(performance.now());
    }

    function drawFrame(frame, alpha, scale) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.globalAlpha = alpha;
      ctx.drawImage(frame, (w - w * scale) / 2, (h - h * scale) / 2, w * scale, h * scale);
    }

    function draw(now) {
      if (!frames.length) return;
      const reduced = reducedMotion.matches;
      const fade = reduced ? 800 : HERO.fade;
      // Deriva lenta y continua: da sensación de movimiento entre cortes.
      const scale = reduced ? 1 : 1 + HERO.zoom * (0.5 + 0.5 * Math.sin(now / 3200));
      const progress = fade ? Math.min((now - switchedAt) / fade, 1) : 1;

      if (progress < 1 && frames[previous]) drawFrame(frames[previous], 1, scale);
      drawFrame(frames[current % frames.length], progress < 1 ? progress : 1, scale);
      ctx.globalAlpha = 1;
    }

    function tick(now) {
      rafId = requestAnimationFrame(tick);
      const interval = reducedMotion.matches ? 3500 : HERO.interval;
      if (frames.length > 1 && now - switchedAt >= interval) {
        previous = current;
        current = (current + 1) % frames.length;
        switchedAt = now;
      }
      draw(now);
    }

    function update() {
      const shouldRun = inView && !userPaused && !document.hidden && frames.length > 0;
      if (shouldRun && !rafId) {
        switchedAt = performance.now();
        rafId = requestAnimationFrame(tick);
      } else if (!shouldRun && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    if (toggle) {
      toggle.addEventListener('click', () => {
        userPaused = !userPaused;
        toggle.setAttribute('aria-pressed', String(userPaused));
        toggle.setAttribute('aria-label',
          userPaused ? 'Reanudar secuencia de imágenes' : 'Pausar secuencia de imágenes');
        update();
      });
    }

    document.addEventListener('visibilitychange', update);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        update();
      }).observe(hero);
    }

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });

    // La primera imagen se pinta apenas está lista; la secuencia arranca
    // cuando todas están decodificadas, para que no haya saltos ni huecos.
    const pending = HERO.images.map(load);
    pending[0].then((first) => {
      if (!first || sources.length) return;
      sources.push(first);
      resize();
    });
    Promise.all(pending).then((loaded) => {
      sources.length = 0;
      sources.push(...loaded.filter(Boolean));
      frames = [];
      resize();
      update();
    });
  }

  /* ---------- Aparición al hacer scroll ---------- */

  function initReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => observer.observe(el));
  }

  /* ---------- Formulario ---------- */

  function initForm() {
    const form = document.querySelector('.form');
    if (!form) return;
    const status = form.querySelector('.form__status');
    const button = form.querySelector('button[type="submit"]');
    const fields = Array.from(form.querySelectorAll('[required]'));

    const setStatus = (message, state) => {
      status.textContent = message;
      status.dataset.state = state || '';
    };

    fields.forEach((field) => {
      field.addEventListener('input', () => field.removeAttribute('aria-invalid'));
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const invalid = fields.filter((field) => !field.value.trim() || !field.checkValidity());
      fields.forEach((field) => field.removeAttribute('aria-invalid'));
      if (invalid.length) {
        invalid.forEach((field) => field.setAttribute('aria-invalid', 'true'));
        invalid[0].focus();
        setStatus('Revisá los campos marcados.', 'error');
        return;
      }

      const data = new FormData(form);
      // Un bot completó el campo trampa: se descarta en silencio.
      if (data.get('_gotcha')) {
        form.reset();
        setStatus('Gracias. Te vamos a escribir pronto.', 'ok');
        return;
      }

      const endpoint = form.dataset.endpoint;
      button.disabled = true;
      setStatus('Enviando…');

      try {
        if (endpoint) {
          const response = await fetch(endpoint, {
            method: 'POST',
            body: data,
            headers: { Accept: 'application/json' },
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          setStatus('Gracias. Te vamos a escribir pronto.', 'ok');
        } else {
          setStatus('Modo demo: el formulario es válido, pero todavía no hay un destino configurado.', 'ok');
        }
        form.reset();
      } catch (error) {
        setStatus('No pudimos enviar el mensaje. Probá de nuevo en un momento.', 'error');
      } finally {
        button.disabled = false;
      }
    });
  }

  initHero();
  initReveal();
  initForm();
})();
