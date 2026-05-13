// Admin JS - Sidebar Toggle and Interactions
document.addEventListener('DOMContentLoaded', function() {
  // Sidebar Toggle
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', function() {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });
    
    // Restore sidebar state
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
      sidebar.classList.add('collapsed');
    }
  }
  
  // Auto-dismiss alerts
  setTimeout(function() {
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    });
  }, 5000);
});

(function initAdminUiHelpers() {
  if (window.AdminUi) return;

  const state = {
    toastContainer: null,
    confirmModal: null,
    confirmResolver: null,
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char] || char));
  }

  function ensureToastContainer() {
    if (state.toastContainer && document.body.contains(state.toastContainer)) {
      return state.toastContainer;
    }

    state.toastContainer = document.getElementById('adminUiToastContainer');
    if (!state.toastContainer) {
      state.toastContainer = document.createElement('div');
      state.toastContainer.id = 'adminUiToastContainer';
      state.toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
      state.toastContainer.style.zIndex = '1080';
      document.body.appendChild(state.toastContainer);
    }

    return state.toastContainer;
  }

  function showToast({ title = 'Thành công', message, variant = 'success', delay = 2600 }) {
    if (!window.bootstrap || !bootstrap.Toast) {
      alert(message);
      return;
    }

    const container = ensureToastContainer();
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-bg-${variant} border-0 shadow`;
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    toastEl.setAttribute('aria-atomic', 'true');
    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <div class="fw-semibold mb-1">${escapeHtml(title)}</div>
          <div>${escapeHtml(message)}</div>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Đóng"></button>
      </div>
    `;

    container.appendChild(toastEl);
    toastEl.addEventListener('hidden.bs.toast', function () {
      toastEl.remove();
    });
    new bootstrap.Toast(toastEl, { delay }).show();
  }

  function ensureConfirmModal() {
    let modalEl = document.getElementById('adminUiConfirmModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.className = 'modal fade';
      modalEl.id = 'adminUiConfirmModal';
      modalEl.tabIndex = -1;
      modalEl.setAttribute('aria-hidden', 'true');
      modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content shadow-lg border-0">
            <div class="modal-header">
              <h5 class="modal-title" id="adminUiConfirmTitle">Xác nhận thao tác</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
            </div>
            <div class="modal-body">
              <p class="mb-3" id="adminUiConfirmMessage"></p>
              <div class="mb-0 d-none" id="adminUiConfirmReasonWrap">
                <label for="adminUiConfirmReason" class="form-label">Lý do</label>
                <textarea id="adminUiConfirmReason" class="form-control" rows="3" placeholder="Nhập lý do..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Hủy</button>
              <button type="button" class="btn btn-danger" id="adminUiConfirmButton">Xác nhận</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    }

    if (!state.confirmModal) {
      state.confirmModal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
      const confirmButton = modalEl.querySelector('#adminUiConfirmButton');
      confirmButton.addEventListener('click', function () {
        if (state.confirmResolver) {
          const reasonWrap = modalEl.querySelector('#adminUiConfirmReasonWrap');
          const reasonInput = modalEl.querySelector('#adminUiConfirmReason');
          state.confirmResolver({
            confirmed: true,
            reason: reasonWrap && !reasonWrap.classList.contains('d-none') ? reasonInput.value.trim() : ''
          });
          state.confirmResolver = null;
        }
        state.confirmModal.hide();
      });
      modalEl.addEventListener('hidden.bs.modal', function () {
        if (state.confirmResolver) {
          state.confirmResolver({ confirmed: false, reason: '' });
          state.confirmResolver = null;
        }
      });
    }

    return modalEl;
  }

  function confirmDialog({ title = 'Xác nhận thao tác', message = 'Bạn có chắc chắn?', confirmText = 'Xác nhận', confirmVariant = 'danger', requireReason = false, reasonPlaceholder = 'Nhập lý do...' } = {}) {
    const modalEl = ensureConfirmModal();
    const titleEl = modalEl.querySelector('#adminUiConfirmTitle');
    const messageEl = modalEl.querySelector('#adminUiConfirmMessage');
    const reasonWrap = modalEl.querySelector('#adminUiConfirmReasonWrap');
    const reasonInput = modalEl.querySelector('#adminUiConfirmReason');
    const confirmButton = modalEl.querySelector('#adminUiConfirmButton');

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmButton.textContent = confirmText;
    confirmButton.className = `btn btn-${confirmVariant}`;
    reasonInput.value = '';
    reasonInput.placeholder = reasonPlaceholder;
    reasonWrap.classList.toggle('d-none', !requireReason);

    return new Promise((resolve) => {
      state.confirmResolver = resolve;
      state.confirmModal.show();
      if (requireReason) {
        setTimeout(() => reasonInput.focus(), 150);
      }
    });
  }

  window.AdminUi = {
    showToast,
    confirmDialog,
  };
})();

// Helper: Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('vi-VN', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
}

// Helper: Format datetime
function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('vi-VN', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Helper: Get status badge HTML
function getStatusBadge(status) {
  const badges = {
    0: '<span class="badge-status badge-proposed">Đề xuất</span>',
    1: '<span class="badge-status badge-revision">Cần chỉnh sửa</span>',
    2: '<span class="badge-status badge-approved">Đã duyệt</span>',
    3: '<span class="badge-status badge-active">Nghiệm thu</span>',
    4: '<span class="badge-status badge-completed">Hoàn thành</span>',
    5: '<span class="badge-status badge-failed">Không hoàn thành</span>'
  };
  return badges[status] || '<span class="badge-status">Không xác định</span>';
}

// Helper: Get period status
function getPeriodStatus(startDate, endDate) {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (now < start) {
    return '<span class="badge-status badge-upcoming">Sắp diễn ra</span>';
  } else if (now >= start && now <= end) {
    return '<span class="badge-status badge-active">Đang diễn ra</span>';
  } else {
    return '<span class="badge-status badge-ended">Đã kết thúc</span>';
  }
}

// Helper: Check if period is editable
function isPeriodEditable(startDate) {
  const now = new Date();
  const start = new Date(startDate);
  return now < start;
}

// Confirm delete action
async function confirmDelete(message) {
  if (window.AdminUi && typeof window.AdminUi.confirmDialog === 'function') {
    const result = await window.AdminUi.confirmDialog({
      title: 'Xác nhận xóa',
      message: message || 'Bạn có chắc chắn muốn xóa?',
      confirmText: 'Xóa',
      confirmVariant: 'danger'
    });
    return result.confirmed;
  }
  return true;
}

// Confirm action
async function confirmAction(message) {
  if (window.AdminUi && typeof window.AdminUi.confirmDialog === 'function') {
    const result = await window.AdminUi.confirmDialog({
      title: 'Xác nhận thao tác',
      message: message || 'Bạn có chắc chắn?',
      confirmText: 'Xác nhận',
      confirmVariant: 'primary'
    });
    return result.confirmed;
  }
  return true;
}
