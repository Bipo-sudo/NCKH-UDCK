document.addEventListener('DOMContentLoaded', function () {
  const path = window.location.pathname.toLowerCase();
  const navLinks = document.querySelectorAll('.sidebar-nav .nav-item, .navbar-nav .nav-item');

  navLinks.forEach((link) => {
    link.classList.remove('active');

    const href = (link.getAttribute('href') || '').toLowerCase();
    const dataPage = (link.getAttribute('data-page') || '').toLowerCase();

    const matchByDataPage = dataPage && path.includes(dataPage);
    const matchByHref = href && href !== '#' && path === href;

    const routeFallback =
      (path === '/admin/' || path === '/admin')
        ? (dataPage === 'admin_dashboard.html')
        : (path.includes('/periods') && dataPage === 'admin_periods.html') ||
          (path.includes('/topics') && dataPage === 'topics') ||
          (path.includes('/accounts') && dataPage === 'admin_accounts.html') ||
          (path.includes('/scoring') && dataPage === 'admin_scoring.html');

    if (matchByDataPage || matchByHref || routeFallback) {
      link.classList.add('active');
    }
  });

  const hasOpenOverlay = document.querySelector('.modal.show, .offcanvas.show');
  if (!hasOpenOverlay) {
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');

    document.querySelectorAll('.modal-backdrop, .offcanvas-backdrop').forEach((el) => {
      el.remove();
    });
  }

  document.addEventListener('hidden.bs.modal', function () {
    const stillOpen = document.querySelector('.modal.show, .offcanvas.show');
    if (!stillOpen) {
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
      document.querySelectorAll('.modal-backdrop, .offcanvas-backdrop').forEach((el) => {
        el.remove();
      });
    }
  });

  document.addEventListener('hidden.bs.offcanvas', function () {
    const stillOpen = document.querySelector('.modal.show, .offcanvas.show');
    if (!stillOpen) {
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
      document.querySelectorAll('.modal-backdrop, .offcanvas-backdrop').forEach((el) => {
        el.remove();
      });
    }
  });
});
