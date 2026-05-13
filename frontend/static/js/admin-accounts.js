function adminAccountsInit() {
  const tableBody = document.getElementById('accountsTableBody');
  if (!tableBody) return;

  let currentAccounts = [];
  let filteredAccounts = [];
  let currentPage = 1;
  const itemsPerPage = 10;
  let accountModalInstance = null;

  const getEl = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char] || char));

  const debounce = (func, wait) => {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  const showSuccessToast = (message, title) => {
    if (window.AdminUi && typeof window.AdminUi.showToast === 'function') {
      window.AdminUi.showToast({ title: title || 'Thành công', message, variant: 'success' });
      return;
    }
    alert(message);
  };

  const askConfirmation = (options) => {
    if (window.AdminUi && typeof window.AdminUi.confirmDialog === 'function') {
      return window.AdminUi.confirmDialog(options);
    }
    return Promise.resolve({ confirmed: true, reason: '' });
  };

  const ensureModalInstance = () => {
    const modalElement = getEl('addAccountModal');
    if (!modalElement) return null;
    if (!accountModalInstance) accountModalInstance = new bootstrap.Modal(modalElement);
    return accountModalInstance;
  };

  const getUniqueValues = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'vi', { numeric: true }));

  const fillSelectOptions = (selectId, values) => {
    const select = getEl(selectId);
    if (!select) return;

    const labels = {
      filterFaculty: 'Tất cả khoa',
      filterKhoaHoc: 'Tất cả khóa',
      filterClass: 'Tất cả lớp',
    };

    select.innerHTML = `<option value="all">${labels[selectId] || 'Tất cả'}</option>` + values.map((value) => {
      const label = value || 'Chưa cập nhật';
      return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    }).join('');
  };

  const updateToolbarOptions = () => {
    fillSelectOptions('filterFaculty', getUniqueValues(currentAccounts.map((account) => account.khoa)));
    fillSelectOptions('filterKhoaHoc', getUniqueValues(currentAccounts.map((account) => account.khoa_hoc)));
    fillSelectOptions('filterClass', getUniqueValues(currentAccounts.map((account) => account.lop)));
  };

  const updateResultCount = () => {
    const title = document.querySelector('.card-header-custom h5');
    if (title) title.textContent = `Danh sách tài khoản sinh viên (${filteredAccounts.length}/${currentAccounts.length})`;
  };

  const renderPagination = (totalPages) => {
    const pagination = getEl('accountsPagination');
    if (!pagination) return;

    if (filteredAccounts.length === 0) {
      pagination.innerHTML = '';
      return;
    }

    let html = `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">&laquo;</a></li>`;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        html += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a></li>`;
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
      }
    }

    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">&raquo;</a></li>`;
    pagination.innerHTML = html;
  };

  const renderAccountsTable = () => {
    const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / itemsPerPage));
    const startIdx = (currentPage - 1) * itemsPerPage;
    const rows = filteredAccounts.slice(startIdx, startIdx + itemsPerPage);

    tableBody.innerHTML = rows.map((account) => `
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
        <td>${account.isActive ? '<span class="badge-status badge-active">Hoạt động</span>' : '<span class="badge-status badge-ended">Bị khóa</span>'}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-action edit" title="Chỉnh sửa" type="button" onclick="editAccount(${account.id})"><i class="fas fa-edit"></i></button>
            <button class="btn-action ${account.isActive ? 'lock' : 'key'}" title="${account.isActive ? 'Khóa tài khoản' : 'Mở khóa'}" type="button" onclick="toggleLockAccount(${account.id})"><i class="fas fa-${account.isActive ? 'lock' : 'unlock'}"></i></button>
            <button class="btn-action key" title="Reset mật khẩu" type="button" onclick="resetPasswordAccount(${account.id})"><i class="fas fa-key"></i></button>
            <button class="btn-action delete" title="Xóa tài khoản" type="button" onclick="deleteAccount(${account.id})"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');

    renderPagination(totalPages);
    updateResultCount();
  };

  const filterAccounts = () => {
    const searchValue = (getEl('searchAccount')?.value || getEl('searchInput')?.value || '').trim().toLowerCase();
    const searchCriteria = getEl('searchCriteria')?.value || 'all';
    const facultyFilter = getEl('filterFaculty')?.value || 'all';
    const khoaHocFilter = getEl('filterKhoaHoc')?.value || 'all';
    const classFilter = getEl('filterClass')?.value || 'all';
    const statusFilter = getEl('filterStatus')?.value || 'all';

    filteredAccounts = currentAccounts.filter((account) => {
      const searchableText = [account.username, account.mssv, account.email, account.ho_ten].filter(Boolean).join(' ').toLowerCase();
      let matchSearch = true;

      if (searchValue) {
        if (searchCriteria === 'username') {
          matchSearch = (account.username || '').toLowerCase().includes(searchValue);
        } else if (searchCriteria === 'mssv') {
          matchSearch = (account.mssv || '').toLowerCase().includes(searchValue);
        } else if (searchCriteria === 'name') {
          matchSearch = (account.ho_ten || '').toLowerCase().includes(searchValue);
        } else {
          matchSearch = searchableText.includes(searchValue);
        }
      }

      return matchSearch
        && (facultyFilter === 'all' || account.khoa === facultyFilter)
        && (khoaHocFilter === 'all' || account.khoa_hoc === khoaHocFilter)
        && (classFilter === 'all' || account.lop === classFilter)
        && (statusFilter === 'all' || String(account.isActive) === statusFilter);
    });

    currentPage = 1;
    renderAccountsTable();
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      if (!response.ok) {
        alert('Đang kết nối cơ sở dữ liệu...');
        return;
      }

      const data = await response.json();
      currentAccounts = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      filteredAccounts = [...currentAccounts];
    } catch (error) {
      alert('Đang kết nối cơ sở dữ liệu...');
    }
  };

  const refreshAccounts = async () => {
    await fetchAccounts();
    updateToolbarOptions();
    filterAccounts();
  };

  const openCreateAccountModal = () => {
    const form = getEl('accountForm');
    if (form) form.reset();
    const editId = getEl('accountEditId');
    if (editId) editId.value = '';
    const role = getEl('accountRole');
    if (role) role.value = 'student';
    const password = getEl('passwordInput');
    if (password) password.value = '123456';

    const title = getEl('accountModalTitle');
    const submitButton = getEl('accountSubmitButton');
    if (title) title.textContent = 'Thêm tài khoản sinh viên';
    if (submitButton) submitButton.textContent = 'Tạo tài khoản';

    ensureModalInstance()?.show();
  };

  const fillFormFromAccount = (account) => {
    const setValue = (id, value) => {
      const input = getEl(id);
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
  };

  const getAccountById = (id) => currentAccounts.find((account) => account.id === id) || null;

  const handleMutation404 = async (response) => {
    if (response.status !== 404) return false;
    alert('Tài khoản không còn tồn tại hoặc dữ liệu đã cũ. Vui lòng tải lại danh sách.');
    await refreshAccounts();
    return true;
  };

  const saveAccountFromModal = async () => {
    const editId = Number(getEl('accountEditId')?.value || 0);
    const username = getEl('accountUsername')?.value?.trim() || '';
    const email = getEl('accountEmail')?.value?.trim() || '';
    const mssv = getEl('mssvInput')?.value?.trim() || '';
    const lop = getEl('accountClass')?.value?.trim() || '';
    const hoTen = getEl('accountFullName')?.value?.trim() || '';
    const khoa = getEl('accountFaculty')?.value?.trim() || '';
    const khoaHoc = getEl('accountKhoaHoc')?.value?.trim() || '';
    const role = getEl('accountRole')?.value?.trim() || 'student';
    const passwordValue = getEl('passwordInput')?.value?.trim() || '';

    if (!username || !email || !mssv || !lop) {
      alert('Vui lòng nhập đủ các trường bắt buộc: Username, Email, MSSV, Lớp.');
      return;
    }

    const payload = { username, email, mssv, lop, ho_ten: hoTen, khoa, khoa_hoc: khoaHoc, role };
    if (!editId) {
      payload.password = passwordValue || '123456';
    } else if (passwordValue) {
      payload.password = passwordValue;
    }

    try {
      const response = await fetch(editId ? `/api/accounts/${editId}` : '/api/accounts', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(await response.text());

      await refreshAccounts();
      ensureModalInstance()?.hide();
      showSuccessToast(editId ? 'Đã cập nhật tài khoản thành công.' : 'Đã tạo tài khoản mới thành công.', editId ? 'Sửa tài khoản thành công' : 'Thêm tài khoản thành công');
    } catch (error) {
      alert('Lưu tài khoản thất bại. Vui lòng thử lại.');
    }
  };

  window.changePage = function (page) {
    const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / itemsPerPage));
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderAccountsTable();
  };

  window.editAccount = function (id) {
    const account = getAccountById(id);
    if (!account) {
      refreshAccounts();
      alert('Tài khoản không còn tồn tại hoặc dữ liệu đã cũ. Vui lòng tải lại danh sách.');
      return;
    }

    fillFormFromAccount(account);
    const title = getEl('accountModalTitle');
    const submitButton = getEl('accountSubmitButton');
    if (title) title.textContent = 'Cập nhật tài khoản';
    if (submitButton) submitButton.textContent = 'Cập nhật';
    ensureModalInstance()?.show();
  };

  window.toggleLockAccount = async function (id) {
    const account = getAccountById(id);
    if (!account) {
      await refreshAccounts();
      alert('Tài khoản không còn tồn tại hoặc dữ liệu đã cũ. Vui lòng tải lại danh sách.');
      return;
    }

    const confirmed = await askConfirmation({
      title: account.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
      message: account.isActive
        ? `Bạn có chắc muốn khóa tài khoản ${account.username} không?`
        : `Bạn có chắc muốn mở khóa tài khoản ${account.username} không?`,
      confirmText: account.isActive ? 'Khóa' : 'Mở khóa',
      confirmVariant: account.isActive ? 'danger' : 'primary',
    });

    if (!confirmed.confirmed) return;

    try {
      const response = await fetch(`/api/accounts/${id}/lock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !account.isActive }),
      });

      if (await handleMutation404(response)) return;
      if (!response.ok) throw new Error('lock failed');

      await refreshAccounts();
      showSuccessToast('Đã cập nhật trạng thái tài khoản.', 'Khóa / mở khóa thành công');
    } catch (error) {
      alert('Cập nhật trạng thái tài khoản thất bại.');
    }
  };

  window.resetPasswordAccount = async function (id) {
    const account = getAccountById(id);
    if (!account) {
      await refreshAccounts();
      alert('Tài khoản không còn tồn tại hoặc dữ liệu đã cũ. Vui lòng tải lại danh sách.');
      return;
    }

    const confirmed = await askConfirmation({
      title: 'Reset mật khẩu',
      message: `Bạn có chắc muốn đặt lại mật khẩu tài khoản ${account.username} về 123456 không?`,
      confirmText: 'Reset',
      confirmVariant: 'warning',
    });

    if (!confirmed.confirmed) return;

    try {
      const response = await fetch(`/api/accounts/${id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: '123456' }),
      });

      if (await handleMutation404(response)) return;
      if (!response.ok) throw new Error('reset failed');

      await refreshAccounts();
      showSuccessToast('Mật khẩu đã được đặt lại về 123456.', 'Reset mật khẩu thành công');
    } catch (error) {
      alert('Reset mật khẩu thất bại.');
    }
  };

  window.deleteAccount = async function (id) {
    const account = getAccountById(id);
    if (!account) {
      await refreshAccounts();
      alert('Tài khoản không còn tồn tại hoặc dữ liệu đã cũ. Vui lòng tải lại danh sách.');
      return;
    }

    const confirmed = await askConfirmation({
      title: 'Xóa tài khoản',
      message: `Bạn có chắc muốn xóa tài khoản ${account.username} không? Thao tác này không thể hoàn tác.`,
      confirmText: 'Xóa',
      confirmVariant: 'danger',
    });

    if (!confirmed.confirmed) return;

    try {
      const response = await fetch('/api/accounts-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: id }),
      });

      if (await handleMutation404(response)) return;
      if (!response.ok) throw new Error(await response.text());

      await refreshAccounts();
      showSuccessToast('Tài khoản đã được xóa khỏi hệ thống.', 'Xóa tài khoản thành công');
    } catch (error) {
      alert('Xóa tài khoản thất bại.');
    }
  };

  const setupEventListeners = () => {
    const searchAccount = getEl('searchAccount');
    const searchInput = getEl('searchInput');
    const searchCriteria = getEl('searchCriteria');
    const filterFaculty = getEl('filterFaculty');
    const filterKhoaHoc = getEl('filterKhoaHoc');
    const filterClass = getEl('filterClass');
    const filterStatus = getEl('filterStatus');
    const resetButton = getEl('btnResetAccountFilters');
    const openAddButton = getEl('btnOpenAddAccount');
    const accountForm = getEl('accountForm');
    const togglePassword = getEl('togglePassword');

    const onSearchChange = debounce(filterAccounts, 220);
    [searchAccount, searchInput].forEach((control) => control && control.addEventListener('input', onSearchChange));
    [searchCriteria, filterFaculty, filterKhoaHoc, filterClass, filterStatus].forEach((control) => control && control.addEventListener('change', filterAccounts));

    if (resetButton) {
      resetButton.addEventListener('click', () => {
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

    if (openAddButton) openAddButton.addEventListener('click', openCreateAccountModal);
    if (accountForm) accountForm.addEventListener('submit', (event) => { event.preventDefault(); saveAccountFromModal(); });

    if (togglePassword) {
      togglePassword.addEventListener('click', () => {
        const passwordInput = getEl('passwordInput');
        const toggleIcon = getEl('toggleIcon');
        if (!passwordInput || !toggleIcon) return;

        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        toggleIcon.classList.toggle('fa-eye', !isPassword);
        toggleIcon.classList.toggle('fa-eye-slash', isPassword);
      });
    }
  };

  (async () => {
    await fetchAccounts();
    updateToolbarOptions();
    setupEventListeners();
    filterAccounts();
  })();
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', adminAccountsInit);
} else {
  adminAccountsInit();
}