/* ============================================================
   IIC WORLDWIDE — Site interactions & motion (no dependencies)
   ============================================================ */
(function () {
  "use strict";
  const root = document.documentElement;
  root.classList.remove("no-js");

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = (n) => String(n).padStart(2, "0");

  /* ---------- Footer year ---------- */
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---------- Page transition curtain ---------- */
  const curtain = document.createElement("div");
  curtain.className = "page-curtain";
  curtain.setAttribute("aria-hidden", "true");
  curtain.innerHTML = '<img src="Media/IIC Worldwide Square.png" alt="">';
  document.body.appendChild(curtain);
  try {
    if (!reduceMotion && sessionStorage.getItem("iic-curtain")) {
      curtain.classList.add("is-entering");
      curtain.addEventListener("animationend", () => curtain.classList.remove("is-entering"), { once: true });
    }
    sessionStorage.removeItem("iic-curtain");
  } catch (e) { /* storage blocked */ }
  window.addEventListener("pageshow", (e) => { if (e.persisted) curtain.classList.remove("is-leaving", "is-entering"); });
  if (!reduceMotion) {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
      if (url.pathname === location.pathname && url.hash) return;
      e.preventDefault();
      try { sessionStorage.setItem("iic-curtain", "1"); } catch (err) {}
      curtain.classList.add("is-leaving");
      setTimeout(() => (location.href = url.href), 560);
    });
  }

  /* ---------- Header: solid when scrolled, hides on scroll down ---------- */
  const header = $("[data-header]");
  const menu = $("#mobile-menu");
  if (header) {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle("nav--scrolled", y > 40);
      if (!menu || !menu.classList.contains("is-open")) {
        header.classList.toggle("nav--hidden", y > lastY && y > 300);
      }
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Full-screen menu ---------- */
  const toggle = $(".nav__toggle");
  if (header && menu && toggle) {
    $$(".nav__link", menu).forEach((a) => { a.innerHTML = `<span>${a.innerHTML}</span>`; });
    const setOpen = (open) => {
      menu.classList.toggle("is-open", open);
      header.classList.toggle("nav--menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      open ? menu.removeAttribute("inert") : menu.setAttribute("inert", "");
      document.body.style.overflow = open ? "hidden" : "";
      if (open) setTimeout(() => { const f = $(".nav__link", menu); f && f.focus({ preventScroll: true }); }, 400);
    };
    toggle.addEventListener("click", () => setOpen(!menu.classList.contains("is-open")));
    $$("a", menu).forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) { setOpen(false); toggle.focus(); }
    });
  }

  /* ---------- Split text into masked words, staggered by line ---------- */
  function splitWords(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = "1";
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
        const w = document.createElement("span");
        w.className = "w";
        w.innerHTML = "<span></span>";
        w.firstChild.textContent = part;
        frag.appendChild(w);
      });
      node.parentNode.replaceChild(frag, node);
    });
    indexLines(el);
  }
  function indexLines(el) {
    let top = null, line = -1;
    $$(".w", el).forEach((w) => {
      const t = w.offsetTop;
      if (top === null || Math.abs(t - top) > 4) { line++; top = t; }
      w.style.setProperty("--i", line);
    });
  }
  const splitTargets = [
    ".hero__title", ".page-hero h1", ".article-hero h1", ".display", ".statement", ".banner__quote",
    ".cta-band__title", ".pillar__text h2", ".approach-item__title", ".section-header h2",
    ".about-quote", ".values-panel__title", ".form-card h3", ".content-split h2"
  ].join(",");
  const splitEls = reduceMotion ? [] : $$(splitTargets);
  splitEls.forEach(splitWords);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => splitEls.forEach(indexLines));

  /* ---------- Sector cards: 3 or 4 per row, whichever leaves the fullest last row ---------- */
  $$(".sector-detail-cards").forEach((grid) => {
    const n = grid.children.length;
    const fill = (c) => (n % c === 0 ? 1 : (n % c) / c);
    grid.dataset.cols = n <= 4 ? Math.max(n, 3) : (fill(4) >= fill(3) ? 4 : 3);
  });

  /* ---------- Image wipes on common media blocks ---------- */
  if (!reduceMotion) {
    $$(".pillar__media, .approach-item__img-wrap, .card--photo, .news-card__media, .page-hero__logo, [class*='about__image'], [class*='svc-card__image'], .digital-card__image")
      .forEach((el) => el.classList.add("img-reveal"));
    $$(".approach-item, .sector-detail-card, .value-item, .capability, .card:not(.card--photo), .info-row, .values-grid > div, .co-row, [class*='-card']:not(.news-card):not(.price-card):not(.sector-detail-card):not(.card--photo)")
      .forEach((el) => { if (!el.closest(".reveal") && !el.classList.contains("reveal") && !el.closest(".hscroll")) el.classList.add("reveal"); });
  }

  /* ---------- Scroll-in observer ---------- */
  const watched = $$(".reveal, .img-reveal, .side-label, .draw-line, [data-count]").concat(splitEls.filter((e) => !e.closest(".hero__slide")));
  if (reduceMotion || !("IntersectionObserver" in window)) {
    watched.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.classList.add("is-in");
        if (el.hasAttribute("data-count")) countUp(el);
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    // Stagger siblings that enter together
    const groups = new Map();
    watched.forEach((el) => {
      if (el.dataset.delay) el.style.transitionDelay = el.dataset.delay + "ms";
      else if (el.classList.contains("reveal")) {
        const p = el.parentElement;
        const n = groups.get(p) || 0;
        groups.set(p, n + 1);
        if (n && n < 8) el.style.transitionDelay = n * 90 + "ms";
      }
      io.observe(el);
    });
  }

  /* ---------- Count-up numbers ---------- */
  function countUp(el) {
    const target = parseFloat(el.dataset.count);
    const digits = el.dataset.pad ? +el.dataset.pad : 0;
    const node = el.querySelector("[data-num]") || el;
    if (reduceMotion || isNaN(target)) return;
    const dur = 1800, t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const v = Math.round(target * (1 - Math.pow(1 - p, 4)));
      node.textContent = digits ? String(v).padStart(digits, "0") : v;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- Parallax (hero media, banners, photo-filled figures) ---------- */
  const para = reduceMotion ? [] : $$(".page-hero__media, .banner__media, [data-parallax], .figure-big, .about-big--fill");
  if (para.length) {
    let ticking = false;
    const update = () => {
      const vh = window.innerHeight;
      para.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const p = (r.top + r.height / 2 - vh / 2) / vh; // -1..1 around centre
        if (el.matches(".figure-big, .about-big--fill")) el.style.setProperty("--py", (50 + p * 40).toFixed(1) + "%");
        else el.style.transform = `translate3d(0, ${(p * -8).toFixed(2)}%, 0)`;
      });
      ticking = false;
    };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---------- Home hero slider ---------- */
  const hero = $("[data-hero]");
  if (hero) {
    const slides = $$(".hero__slide", hero);
    const num = $("[data-hero-num]", hero);
    const bar = $(".hero__bar span", hero);
    const dots = $("[data-hero-dots]", hero);
    const pauseBtn = $("[data-hero-pause]", hero);
    const DELAY = 7000;
    let i = 0, timer = null, paused = reduceMotion;
    hero.style.setProperty("--hero-delay", DELAY + "ms");
    slides.forEach((s) => $$(".hero__title", s).forEach(indexLines));
    dots.innerHTML = slides.map((s, k) => `<button type="button" aria-label="Go to slide ${k + 1}"></button>`).join("");

    const restartBar = () => { bar.classList.remove("is-running"); void bar.offsetWidth; if (!paused) bar.classList.add("is-running"); };
    const show = (n) => {
      const prev = slides[i];
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => {
        clearTimeout(s._leaveTimer);
        s.classList.remove("is-leaving");
        if (s === prev && k !== i) {
          s.classList.add("is-leaving");
          s._leaveTimer = setTimeout(() => s.classList.remove("is-leaving"), 1500);
        }
        s.classList.toggle("is-active", k === i);
        s.setAttribute("aria-hidden", String(k !== i));
        $$("a, button", s).forEach((el) => (k === i ? el.removeAttribute("tabindex") : el.setAttribute("tabindex", "-1")));
      });
      num.textContent = pad(i + 1);
      $$("button", dots).forEach((b, k) => b.setAttribute("aria-current", String(k === i)));
      restartBar();
      schedule();
    };
    const schedule = () => { clearTimeout(timer); if (!paused) timer = setTimeout(() => show(i + 1), DELAY); };
    dots.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) show($$("button", dots).indexOf(b)); });
    $("[data-hero-prev]", hero).addEventListener("click", () => show(i - 1));
    $("[data-hero-next]", hero).addEventListener("click", () => show(i + 1));
    if (pauseBtn) {
      const sync = () => {
        hero.classList.toggle("is-paused", paused);
        pauseBtn.classList.toggle("is-paused", paused);
        pauseBtn.setAttribute("aria-label", paused ? "Play slideshow" : "Pause slideshow");
        pauseBtn.setAttribute("aria-pressed", String(paused));
      };
      pauseBtn.addEventListener("click", () => { paused = !paused; sync(); if (paused) clearTimeout(timer); else { restartBar(); schedule(); } });
      sync();
    }
    hero.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") show(i + 1); if (e.key === "ArrowLeft") show(i - 1); });
    let x0 = null;
    hero.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden) clearTimeout(timer); else schedule(); });
    requestAnimationFrame(() => show(0));
  }

  /* ---------- Platforms accordion (swaps the bleed image) ---------- */
  $$("[data-accordion]").forEach((acc) => {
    const items = $$(".acc__item", acc);
    const scope = acc.closest("[data-platforms]");
    const imgs = scope ? $$(".platforms__media img", scope) : [];
    const count = scope ? $("[data-platform-num]", scope) : null;
    const open = (k) => {
      items.forEach((it, j) => {
        it.classList.toggle("is-open", j === k);
        $(".acc__btn", it).setAttribute("aria-expanded", String(j === k));
      });
      imgs.forEach((im, j) => im.classList.toggle("is-active", j === k));
      if (count && k > -1) count.textContent = pad(k + 1);
    };
    items.forEach((it, k) => {
      $(".acc__btn", it).addEventListener("click", () => {
        open(it.classList.contains("is-open") && !scope ? -1 : k);
      });
    });
  });

  /* ---------- Horizontal drag scrollers with progress bar ---------- */
  $$("[data-hscroll]").forEach((wrap) => {
    const track = $(".hscroll__track", wrap);
    const bar = $(".hscroll__bar span", wrap);
    const prev = $("[data-hs-prev]", wrap);
    const next = $("[data-hs-next]", wrap);
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const ratio = track.clientWidth / track.scrollWidth;
      const p = max > 0 ? track.scrollLeft / max : 0;
      if (bar) { bar.style.width = Math.max(10, ratio * 100) + "%"; bar.style.transform = `translateX(${p * (1 / Math.max(ratio, .1) - 1) * 100}%)`; }
      if (prev) prev.disabled = track.scrollLeft < 4;
      if (next) next.disabled = track.scrollLeft > max - 4;
    };
    const stepBy = (dir) => {
      const card = track.firstElementChild;
      const w = card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 24) : 320;
      track.scrollBy({ left: dir * w, behavior: reduceMotion ? "auto" : "smooth" });
    };
    prev && prev.addEventListener("click", () => stepBy(-1));
    next && next.addEventListener("click", () => stepBy(1));
    track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    window.addEventListener("resize", update);
    // Mouse drag (touch uses native scrolling)
    let down = false, startX = 0, startLeft = 0, moved = 0;
    track.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; moved = 0; startX = e.clientX; startLeft = track.scrollLeft;
    });
    window.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 6) { track.classList.add("is-dragging"); track.scrollLeft = startLeft - dx; }
    });
    window.addEventListener("pointerup", () => {
      if (!down) return;
      down = false;
      if (track.classList.contains("is-dragging")) {
        setTimeout(() => track.classList.remove("is-dragging"), 30);
      }
    });
    track.addEventListener("click", (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    update();
  });

  /* ---------- Back to top with scroll-progress ring ---------- */
  const toTop = document.createElement("button");
  toTop.type = "button";
  toTop.className = "to-top";
  toTop.setAttribute("aria-label", "Back to top");
  toTop.innerHTML = '<svg class="ring" viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="24"/></svg><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  document.body.appendChild(toTop);
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));
  const ring = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? scrollY / max : 0;
    toTop.style.setProperty("--p", (151 - p * 151).toFixed(1));
    toTop.classList.toggle("is-visible", scrollY > innerHeight * 0.8);
  };
  window.addEventListener("scroll", ring, { passive: true });
  ring();

  /* ---------- Smooth in-page anchors (offset for the fixed header) ---------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - 80, behavior: reduceMotion ? "auto" : "smooth" });
    });
  });
})();
