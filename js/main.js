/* ============================================================
   IIC WORLDWIDE — Site Interactions
   ============================================================ */

(function () {
  'use strict';

  /* --- Sticky Navigation --- */
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('nav--scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --- Mobile Menu --- */
  const toggle = document.querySelector('.nav__toggle');
  const mobileMenu = document.querySelector('.nav__mobile');
  if (toggle && mobileMenu) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      mobileMenu.classList.toggle('active');
      const isOpen = mobileMenu.classList.contains('active');
      document.body.style.overflow = isOpen ? 'hidden' : '';
      if (nav) nav.classList.toggle('nav--menu-open', isOpen);
    });
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        toggle.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
        if (nav) nav.classList.remove('nav--menu-open');
      });
    });
  }

  /* --- Scroll Reveal --- */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach(el => observer.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('visible'));
  }

  /* --- Active Nav Link --- */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__link').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const linkPage = href.split('/').pop();
    if (linkPage === currentPage ||
        (currentPage === '' && linkPage === 'index.html') ||
        (currentPage === 'index.html' && linkPage === 'index.html')) {
      link.classList.add('nav__link--active');
    }
    if ((currentPage.startsWith('oil-gas') ||
         currentPage.startsWith('mining') ||
         currentPage.startsWith('digital-assets') ||
         currentPage.startsWith('investment.')) &&
        linkPage === 'businesses.html') {
      link.classList.add('nav__link--active');
    }
  });

  /* --- Dot Map Pulse Animation --- */
  const pulseDots = document.querySelectorAll('.map-pulse');
  pulseDots.forEach((dot, i) => {
    dot.style.animationDelay = `${i * 0.8}s`;
  });

  /* --- News Carousel --- */
  (function initNewsCarousel() {
    var carousel = document.querySelector('.news-carousel');
    if (!carousel) return;

    var track = carousel.querySelector('.news-carousel__track');
    var dotsContainer = carousel.querySelector('.news-carousel__dots');
    var cards = track.querySelectorAll('.news-card');
    var totalCards = cards.length;

    function getPerPage() {
      if (window.innerWidth <= 768) return 1;
      if (window.innerWidth <= 1024) return 2;
      return 3;
    }

    var perPage = getPerPage();
    var totalPages = Math.ceil(totalCards / perPage);
    var currentPage = 0;
    var autoTimer = null;
    var isPaused = false;

    function shouldPaginate() {
      return totalCards > getPerPage();
    }

    function buildDots() {
      dotsContainer.innerHTML = '';
      for (var i = 0; i < totalPages; i++) {
        var dot = document.createElement('button');
        dot.className = 'news-carousel__dot' + (i === currentPage ? ' news-carousel__dot--active' : '');
        dot.setAttribute('aria-label', 'Go to page ' + (i + 1));
        dot.dataset.page = i;
        dotsContainer.appendChild(dot);
      }
    }

    function updateLayout() {
      perPage = getPerPage();
      totalPages = Math.ceil(totalCards / perPage);
      if (currentPage >= totalPages) currentPage = totalPages - 1;

      if (shouldPaginate()) {
        carousel.classList.add('news-carousel--paginated');
        track.style.gridTemplateColumns = 'repeat(' + perPage + ', 1fr)';

        cards.forEach(function (card, i) {
          var pageOfCard = Math.floor(i / perPage);
          if (pageOfCard === currentPage) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });

        buildDots();
      } else {
        carousel.classList.remove('news-carousel--paginated');
        track.style.gridTemplateColumns = '';
        cards.forEach(function (card) { card.style.display = ''; });
        dotsContainer.innerHTML = '';
      }
    }

    function goToPage(page) {
      currentPage = page;
      if (currentPage >= totalPages) currentPage = 0;
      if (currentPage < 0) currentPage = totalPages - 1;

      cards.forEach(function (card, i) {
        var pageOfCard = Math.floor(i / perPage);
        if (pageOfCard === currentPage) {
          card.style.display = '';
          card.style.opacity = '0';
          card.style.transform = 'translateY(12px)';
          setTimeout(function () {
            card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 30);
        } else {
          card.style.display = 'none';
          card.style.opacity = '';
          card.style.transform = '';
          card.style.transition = '';
        }
      });

      var dots = dotsContainer.querySelectorAll('.news-carousel__dot');
      dots.forEach(function (dot, i) {
        dot.classList.toggle('news-carousel__dot--active', i === currentPage);
      });
    }

    function startAuto() {
      stopAuto();
      if (!shouldPaginate()) return;
      autoTimer = setInterval(function () {
        if (!isPaused) goToPage(currentPage + 1);
      }, 10000);
    }

    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    }

    dotsContainer.addEventListener('click', function (e) {
      var dot = e.target.closest('.news-carousel__dot');
      if (!dot) return;
      goToPage(parseInt(dot.dataset.page, 10));
      startAuto();
    });

    carousel.addEventListener('mouseenter', function () { isPaused = true; });
    carousel.addEventListener('mouseleave', function () { isPaused = false; });

    var resizeTimeout;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function () {
        updateLayout();
        startAuto();
      }, 200);
    });

    updateLayout();
    startAuto();
  })();

  /* --- Smooth anchor scroll (offset for fixed nav) --- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = 100;
      const y = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

})();
