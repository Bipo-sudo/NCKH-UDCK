function adminAccountsInit() {
  let currentAccounts = [];
  let filteredAccounts = [];
  let currentPage = 1;
  const itemsPerPage = 10;
  let accountModalInstance = null;
  let feedbackToastContainer = null;

  const tableBody = document.getElementById('accountsTableBody');
  if (!tableBody) return;

  // Fetch accounts from backend and initialize UI
  async function fetchAccounts() {
    try {
      const resp = await fetch('/api/accounts');
      if (!resp.ok) {
        alert('Đang kết nối cơ sở dữ liệu...');
        return [];
      }
      const data = await resp.json();
      const accounts = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      currentAccounts = accounts;
      filteredAccounts = [...currentAccounts];
      return currentAccounts;
    } catch (err) {
      alert('Đang kết nối cơ sở dữ liệu...');
      return [];
    }
  }

  (async function init() {
    await fetchAccounts();
    initToolbarOptions();
    setupEventListeners();
    filterAccounts();
  })();

  function initToolbarOptions() {
    fillSelectOptions('filterFaculty', getUniqueValues(currentAccounts.map(account => account.khoa)));
    fillSelectOptions('filterKhoaHoc', getUniqueValues(currentAccounts.map(account => account.khoa_hoc)));
    fillSelectOptions('filterClass', getUniqueValues(currentAccounts.map(account => account.lop)));
  }

  function fillSelectOptions(selectId, values) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const placeholderMap = {
      filterFaculty: 'Tất cả khoa',
      filterKhoaHoc: 'Tất cả khóa',
      filterClass: 'Tất cả lớp'
    };

    select.innerHTML = `<option value="all">${placeholderMap[selectId] || 'Tất cả'}</option>` + values.map(value => {
      const label = value || 'Chưa cập nhật';
      return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    }).join('');
  }

  function getUniqueValues(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'vi', { numeric: true }));
  }

  function setupEventListeners() {
    const searchAccount = document.getElementById('searchAccount');
    const searchInput = document.getElementById('searchInput');
    const searchCriteria = document.getElementById('searchCriteria');
    const filterFaculty = document.getElementById('filterFaculty');
    const filterKhoaHoc = document.getElementById('filterKhoaHoc');
    const filterClass = document.getElementById('filterClass');
    const filterStatus = document.getElementById('filterStatus');
    const resetButton = document.getElementById('btnResetAccountFilters');
    const openAddButton = document.getElementById('btnOpenAddAccount');
    const accountForm = document.getElementById('accountForm');
    const togglePassword = document.getElementById('togglePassword');
    const mssvInput = document.getElementById('mssvInput');

    const searchControls = [searchAccount, searchInput, searchCriteria, filterFaculty, filterKhoaHoc, filterClass, filterStatus].filter(Boolean);
    searchControls.forEach((control) => {
      const eventName = control.tagName === 'INPUT' ? 'input' : 'change';
      control.addEventListener(eventName, control.tagName === 'INPUT' ? debounce(filterAccounts, 220) : filterAccounts);
    });

    if (resetButton) {
      resetButton.addEventListener('click', function () {
        if (searchAccount) searchAccount.value = '';
        if (searchInput) searchInput.value = '';
        if (searchCriteria) searchCriteria.value = 'all';
        if (filterFaculty) filterFaculty.value = 'all';
        if (filterKhoaHoc) filterKhoaHoc.value = 'all';
        if (filterClass) filterClass.value = 'all';
        if (filterStatus) filterStatus.value = 'all';
        filterAccounts();
      });
    }

    if (openAddButton) {
      openAddButton.addEventListener('click', function () {
        openCreateAccountModal();
      });
    }

    if (accountForm) {
      accountForm.addEventListener('submit', function (event) {
        event.preventDefault();
        saveAccountFromModal();
      });
    }

    if (togglePassword) {
      togglePassword.addEventListener('click', function () {
        const passwordInput = document.getElementById('passwordInput');
        const toggleIcon = document.getElementById('toggleIcon');
        if (!passwordInput || !toggleIcon) return;

        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        toggleIcon.classList.toggle('fa-eye', !isPassword);
        toggleIcon.classList.toggle('fa-eye-slash', isPassword);
      });
    }

  }

  function filterAccounts() {
    const searchValue = (document.getElementById('searchAccount')?.value || document.getElementById('searchInput')?.value || '').trim().toLowerCase();
    const searchCriteria = document.getElementById('searchCriteria')?.value || 'all';
    const facultyFilter = document.getElementById('filterFaculty')?.value || 'all';
    const khoaHocFilter = document.getElementById('filterKhoaHoc')?.value || 'all';
    const classFilter = document.getElementById('filterClass')?.value || 'all';
    const statusFilter = document.getElementById('filterStatus')?.value || 'all';

    filteredAccounts = (currentAccounts || []).filter((account) => {
      const searchableText = [account.username, account.mssv, account.email, account.ho_ten]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      let matchSearch = true;
      if (searchValue) {
        if (document.getElementById('searchCriteria')) {
          if (searchCriteria === 'username') {
            matchSearch = (account.username || '').toLowerCase().includes(searchValue);
          } else if (searchCriteria === 'mssv') {
            matchSearch = (account.mssv || '').toLowerCase().includes(searchValue);
          } else if (searchCriteria === 'name') {
            matchSearch = (account.ho_ten || '').toLowerCase().includes(searchValue);
          } else {
            matchSearch = searchableText.includes(searchValue);
          }
        } else {
          matchSearch = searchableText.includes(searchValue);
        }
      }
      const matchFaculty = facultyFilter === 'all' || account.khoa === facultyFilter;
      const matchKhoaHoc = khoaHocFilter === 'all' || account.khoa_hoc === khoaHocFilter;
      const matchClass = classFilter === 'all' || account.lop === classFilter;
      const matchStatus = statusFilter === 'all' || String(account.isActive) === statusFilter;
      return matchSearch && matchFaculty && matchKhoaHoc && matchClass && matchStatus;
    });

    currentPage = 1;
    renderAccountsTable();
  }

  function renderAccountsTable() {
    const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / itemsPerPage));
    const startIdx = (currentPage - 1) * itemsPerPage;
    const currentAccounts = filteredAccounts.slice(startIdx, startIdx + itemsPerPage);

    tableBody.innerHTML = currentAccounts.map((account) => `
      <tr>
        <td>
          <div class="fw-semibold fs-6">${escapeHtml(account.username || '-')}</div>
          <div class="text-muted small">${escapeHtml(account.email || '-')}</div>
        </td>
        <td>
          <div class="fw-semibold">${escapeHtml(account.ho_ten || 'Chưa cập nhật')}</div>
          <div class="mt-1 d-flex flex-wrap gap-1">
            <span class="badge bg-light text-dark border">${escapeHtml(account.mssv || 'N/A')}</span>
            <span class="badge bg-light text-dark border">${escapeHtml(account.lop || 'N/A')}</span>
            <span class="badge bg-light text-dark border">${escapeHtml(account.khoa || 'N/A')}</span>
          </div>
        </td>
        <td><span class="badge bg-info text-dark">${escapeHtml(account.role || 'Sinh viên')}</span></td>
        <td>
          ${account.isActive
            ? '<span class="badge-status badge-active">Hoạt động</span>'
            : '<span class="badge-status badge-ended">Bị khóa</span>'}
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-action edit" title="Chỉnh sửa" type="button" onclick="editAccount(${account.id})">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-action ${account.isActive ? 'lock' : 'key'}" title="${account.isActive ? 'Khóa tài khoản' : 'Mở khóa'}" type="button" onclick="toggleLockAccount(${account.id})">
              <i class="fas fa-${account.isActive ? 'lock' : 'unlock'}"></i>
            </button>
            <button class="btn-action key" title="Reset mật khẩu" type="button" onclick="if (confirmAction('Reset mật khẩu về 123456?')) resetPasswordAccount(${account.id})">
              <i class="fas fa-key"></i>
            </button>
            <button class="btn-action delete" title="Xóa tài khoản" type="button" onclick="if (confirmAction('Bạn có chắc muốn xóa tài khoản này?')) deleteAccount(${account.id})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    renderPagination(totalPages);
    updateResultCount();
  }

  function renderPagination(totalPages) {
    const pagination = document.getElementById('accountsPagination');
    if (!pagination) return;

    if (filteredAccounts.length === 0) {
      pagination.innerHTML = '';
      return;
    }

    let html = '';
    html += `
      <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">&laquo;</a>
      </li>
    `;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        html += `
          <li class="page-item ${i === currentPage ? 'active' : ''}">
            <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
          </li>
        `;
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
      }
    }

    html += `
      <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">&raquo;</a>
      </li>
    `;

    pagination.innerHTML = html;
  }

  function updateResultCount() {
    const title = document.querySelector('.card-header-custom h5');
    if (title) title.textContent = `Danh sách tài khoản sinh viên (${filteredAccounts.length}/${currentAccounts.length})`;
  }

  function getAccountById(id) {
    return (currentAccounts || []).find(account => account.id === id) || null;
  }

  function ensureFeedbackToastContainer() {
    if (feedbackToastContainer && document.body.contains(feedbackToastContainer)) {
      return feedbackToastContainer;
    }

    feedbackToastContainer = document.getElementById('accountFeedbackToastContainer');
    if (!feedbackToastContainer) {
      feedbackToastContainer = document.createElement('div');
      feedbackToastContainer.id = 'accountFeedbackToastContainer';
      feedbackToastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
      feedbackToastContainer.style.zIndex = '1080';
      document.body.appendChild(feedbackToastContainer);
    }

    return feedbackToastContainer;
  }

  function showSuccessToast(message, title) {
    if (!window.bootstrap || !bootstrap.Toast) {
      alert(message);
      return;
    }

    const container = ensureFeedbackToastContainer();
    const toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center text-bg-success border-0 shadow';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    toastEl.setAttribute('aria-atomic', 'true');
    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <div class="fw-semibold mb-1">${escapeHtml(title || 'Thành công')}</div>
          <div>${escapeHtml(message)}</div>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Đóng"></button>
      </div>
    `;

    container.appendChild(toastEl);
    toastEl.addEventListener('hidden.bs.toast', function () {
      toastEl.remove();
    });
    new bootstrap.Toast(toastEl, { delay: 2600 }).show();
  }

  async function handleMutation404(response) {
    if (response.status !== 404) return false;
    alert('Tài khoản không còn tồn tại hoặc dữ liệu đã cũ. Vui lòng tải lại danh sách.');
    await fetchAccounts();
    initToolbarOptions();
    filterAccounts();
    return true;
  }

  function setModalMode(isEdit) {
    const title = document.getElementById('accountModalTitle');
    const submitButton = document.getElementById('accountSubmitButton');
    if (title) title.textContent = isEdit ? 'Cập nhật tài khoản' : 'Thêm tài khoản sinh viên';
    if (submitButton) submitButton.textContent = isEdit ? 'Cập nhật' : 'Tạo tài khoản';
  }

  function openCreateAccountModal() {
    const editId = document.getElementById('accountEditId');
    const form = document.getElementById('accountForm');
    if (form) form.reset();
    if (editId) editId.value = '';
    const roleInput = document.getElementById('accountRole');
    if (roleInput) roleInput.value = 'student';

    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) passwordInput.value = '123456';

    setModalMode(false);
    ensureModalInstance();
  }

  function ensureModalInstance() {
    const modalElement = document.getElementById('addAccountModal');
    if (!modalElement) return;
    if (!accountModalInstance) {
      accountModalInstance = new bootstrap.Modal(modalElement);
    }
  }

  function fillFormFromAccount(account) {
    const setValue = (id, value) => {
      const input = document.getElementById(id);
      if (input) input.value = value ?? '';
    };

    setValue('accountEditId', account.id);
    setValue('accountUsername', account.username);
    setValue('accountEmail', account.email);
    setValue('passwordInput', '');
    setValue('mssvInput', account.mssv);
    setValue('accountClass', account.lop);
    setValue('accountFullName', account.ho_ten);
    setValue('accountFaculty', account.khoa);
    setValue('accountKhoaHoc', account.khoa_hoc);
    setValue('accountRole', account.role || 'student');
  }

  function saveAccountFromModal() {
    const editId = Number(document.getElementById('accountEditId')?.value || 0);
    const username = document.getElementById('accountUsername')?.value?.trim() || '';
    const email = document.getElementById('accountEmail')?.value?.trim() || '';
    const mssv = document.getElementById('mssvInput')?.value?.trim() || '';
    const lop = document.getElementById('accountClass')?.value?.trim() || '';
    const hoTen = document.getElementById('accountFullName')?.value?.trim() || '';
    const khoa = document.getElementById('accountFaculty')?.value?.trim() || '';
    const khoaHoc = document.getElementById('accountKhoaHoc')?.value?.trim() || '';
    const role = document.getElementById('accountRole')?.value?.trim() || 'student';

    if (!username || !email || !mssv || !lop) {
      alert('Vui lòng nhập đủ các trường bắt buộc: Username, Email, MSSV, Lớp.');
      return;
    }

    const payload = {
      username,
      email,
      mssv,
      lop,
      ho_ten: hoTen,
      khoa,
      khoa_hoc: khoaHoc,
      role,
    };

    const passwordValue = document.getElementById('passwordInput')?.value?.trim() || '';
    if (!editId) {
      payload.password = passwordValue || '123456';
    } else if (passwordValue) {
      payload.password = passwordValue;
    }

    const url = editId ? `/api/accounts/${editId}` : '/api/accounts';
    const method = editId ? 'PUT' : 'POST';

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async function (response) {
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Lỗi lưu tài khoản');
      }
      return response.json();
    }).then(async function () {
      await fetchAccounts();
      initToolbarOptions();
      filterAccounts();
      ensureModalInstance();
      if (accountModalInstance) accountModalInstance.hide();
      showSuccessToast(editId ? 'Đã cập nhật tài khoản thành công.' : 'Đã tạo tài khoản mới thành công.', editId ? 'Sửa tài khoản thành công' : 'Thêm tài khoản thành công');
    }).catch(function () {
      alert('Lưu tài khoản thất bại. Vui lòng thử lại.');
    });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]+/g, (match) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    }[match] || match));
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  window.changePage = function (page) {
    const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / itemsPerPage));
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderAccountsTable();
  };

  window.confirmAction = function (message) {
    return confirm(message);
  };

  window.toggleLockAccount = function (id) {
    const account = getAccountById(id);
    if (!account) {
      alert('Tài khoản không còn tồn tại hoặc dữ liệu đã cũ. Vui lòng tải lại danh sách.');
      fetchAccounts().then(function () {
        initToolbarOptions();
        filterAccounts();
      });
      return;
    }
    fetch(`/api/accounts/${id}/lock`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !account.isActive }),
    }).then(async function (response) {
      if (await handleMutation404(response)) return null;
      if (!response.ok) throw new Error('lock failed');
      return response.json();
    }).then(async function () {
      await fetchAccounts();
      filterAccounts();
      showSuccessToast('Đã cập nhật trạng thái tài khoản.', 'Khóa / mở khóa thành công');
    }).catch(function () {
      alert('Cập nhật trạng thái tài khoản thất bại.');
    });
  };

  window.editAccount = function (id) {
    const account = getAccountById(id);
    if (!account) {
      alert('Tài khoản không còn tồn tại hoặc dữ liệu đã cũ. Vui lòng tải lại danh sách.');
      fetchAccounts().then(function () {
        initToolbarOptions();
        filterAccounts();
      });
      return;
    }
    fillFormFromAccount(account);
    setModalMode(true);
    ensureModalInstance();
    if (accountModalInstance) accountModalInstance.show();
  };

  window.resetPasswordAccount = function (id) {
    fetch(`/api/accounts/${id}/reset-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '123456' }),
    }).then(async function (response) {
      if (await handleMutation404(response)) return null;
      if (!response.ok) throw new Error('reset failed');
      return response.json();
    }).then(function () {
      showSuccessToast('Mật khẩu đã được đặt lại về 123456.', 'Reset mật khẩu thành công');
      return fetchAccounts();
    }).catch(function () {
      alert('Reset mật khẩu thất bại.');
    });
  };

  window.deleteAccount = function (id) {
    fetch('/api/accounts-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: id }),
    }).then(async function (response) {
      if (await handleMutation404(response)) return null;
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'delete failed');
      }
      return response.json();
    }).then(async function () {
      await fetchAccounts();
      initToolbarOptions();
      filterAccounts();
      showSuccessToast('Tài khoản đã được xóa khỏi hệ thống.', 'Xóa tài khoản thành công');
    }).catch(function () {
      alert('Xóa tài khoản thất bại.');
    });
  };

}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', adminAccountsInit); else adminAccountsInit();
