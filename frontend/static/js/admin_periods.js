function adminPeriodsInit() {
  const periodsHolder = document.getElementById('periodsDataHolder');
  // Fetch periods from backend. No mock data is used here.
  let currentPeriods = [];

  function displayStatusMessage(message, colspan = 8) {
    tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted py-4">${message}</td></tr>`;
  }

  async function fetchPeriods() {
    try {
      const resp = await fetch('/api/periods');
      if (!resp.ok) {
        displayStatusMessage('Đang kết nối cơ sở dữ liệu...');
        return [];
      }
      const data = await resp.json();
      if (!Array.isArray(data) || data.length === 0) {
        displayStatusMessage('Không có dữ liệu thực');
        return [];
      }
      currentPeriods = data;
      return data;
    } catch (err) {
      displayStatusMessage('Đang kết nối cơ sở dữ liệu...');
      return [];
    }
  }

  const tableBody = document.getElementById('periodsTableBody');
  const filterYear = document.getElementById('filterYear');
  const tenDotInput = document.getElementById('ten_dot');
  const namHocInput = document.getElementById('nam_hoc');
  const capBacInput = document.getElementById('cap_bac');
  const periodDetail = document.getElementById('periodDetail');
  const thoiGianThongBao = document.getElementById('thoiGianThongBao');
  const thoiGianMoDangKy = document.getElementById('thoiGianMoDangKy');
  const hanNopDeCuong = document.getElementById('hanNopDeCuong');
  const hanNopBaoCao = document.getElementById('hanNopBaoCao');
  const periodAttachment = document.getElementById('periodAttachment');
  const savePeriodBtn = document.getElementById('savePeriodBtn');
  const addPeriodModalEl = document.getElementById('addPeriodModal');

  if (!tableBody || !filterYear || !savePeriodBtn) {
    return;
  }

  const addPeriodModal = addPeriodModalEl ? bootstrap.Modal.getOrCreateInstance(addPeriodModalEl) : null;

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function toDateTimeLocalValue(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value || '';
    }
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function getSchoolYearValue(item) {
    return String(item.nam_hoc ?? item.namHoc ?? '').trim();
  }

  function getPeriodTitleValue(item) {
    return String(item.ten_dot ?? item.tenDot ?? item.namHoc ?? '').trim();
  }

  function getPeriodLevelValue(item) {
    return String(item.cap_bac ?? item.capBac ?? 'Cấp Trường').trim() || 'Cấp Trường';
  }

  function isValidSchoolYear(value) {
    return /^\d{4}-\d{4}$/.test(value);
  }

  function getStatusBadge(status) {
    if (status === 1) {
      return '<span class="badge text-bg-secondary">Chưa mở đăng ký</span>';
    }
    if (status === 2) {
      return '<span class="badge text-bg-success">Đang mở đăng ký</span>';
    }
    if (status === 3) {
      return '<span class="badge text-bg-warning text-dark">Đang nộp báo cáo</span>';
    }
    return '<span class="badge text-bg-dark">Đã đóng đăng ký</span>';
  }

  function getButtonBadge(status) {
    if (status === 2) {
      return '<a href="/student/register-topic" class="btn btn-success mt-3"><i class="fas fa-check-circle me-2"></i>Đăng ký tham gia</a>';
    }
    if (status === 1) {
      return '<button class="btn btn-outline-secondary mt-3" disabled><i class="fas fa-lock me-2"></i>Chưa mở đăng ký</button>';
    }
    return '<button class="btn btn-outline-secondary mt-3" disabled><i class="fas fa-lock me-2"></i>Đã đóng đăng ký</button>';
  }

  function validateDateOrder(showAlert = true) {
    if (!thoiGianThongBao.value || !thoiGianMoDangKy.value || !hanNopDeCuong.value || !hanNopBaoCao.value) {
      if (showAlert) alert('Vui lòng nhập đủ 4 mốc thời gian.');
      return false;
    }

    if (!(thoiGianThongBao.value <= thoiGianMoDangKy.value && thoiGianMoDangKy.value <= hanNopDeCuong.value && hanNopDeCuong.value <= hanNopBaoCao.value)) {
      if (showAlert) alert('Các mốc phải theo thứ tự: thông báo <= mở đăng ký <= nộp đề cương <= nộp báo cáo.');
      return false;
    }

    return true;
  }

  function renderTable(data) {
    let rowsHtml = '';

    data.forEach(function (item) {
      const status = Number(item.trangThaiDot ?? item.trang_thai_dot ?? 0);
      const canDelete = status <= 1;
      rowsHtml += `
        <tr>
          <td>
            <strong>${getPeriodTitleValue(item)}</strong>
            <div class="small text-muted mt-1">${getSchoolYearValue(item)}</div>
            ${item.chiTiet ? `<div class="small text-muted mt-1">${item.chiTiet}</div>` : ''}
            <div class="mt-2">
              <button
                type="button"
                class="btn btn-sm btn-danger"
                onclick="deletePeriod(${item.id})"
                ${canDelete ? '' : 'disabled'}
                title="${canDelete ? 'Xóa đợt' : 'Không thể xóa đợt đã bắt đầu hoạt động'}"
              >
                <i class="fas fa-trash me-1"></i>Xóa
              </button>
            </div>
          </td>
          <td><span class="badge ${getPeriodLevelValue(item) === 'Cấp Trường' ? 'bg-success' : getPeriodLevelValue(item) === 'Cấp Khoa' ? 'bg-secondary' : 'bg-primary'}">${getPeriodLevelValue(item)}</span></td>
          <td>${formatDateTime(item.thoiGianThongBao)}</td>
          <td>${formatDateTime(item.thoiGianMoDangKy)}</td>
          <td>${formatDateTime(item.hanNopDeCuong)}</td>
          <td>${formatDateTime(item.hanNopBaoCao)}</td>
          <td>
            ${item.tepDinhKem?.fileName
              ? `<a href="${item.tepDinhKem.url}" target="_blank">${item.tepDinhKem.fileName}</a>`
              : '<span class="text-muted">Không có tệp</span>'}
          </td>
          <td>${getStatusBadge(item.trangThaiDot)}</td>
        </tr>
      `;
    });

    if (!rowsHtml) {
      rowsHtml = '<tr><td colspan="8" class="text-center text-muted py-4">Không có dữ liệu phù hợp</td></tr>';
    }

    tableBody.innerHTML = rowsHtml;
  }

  function renderByCurrentFilter() {
    const selectedYear = filterYear.value;
    if (!selectedYear) {
      renderTable(currentPeriods);
      return;
    }

    renderTable((currentPeriods || []).filter(function (item) {
      return getSchoolYearValue(item) === selectedYear;
    }));
  }

  filterYear.addEventListener('change', function () {
    renderByCurrentFilter();
  });

  [thoiGianThongBao, thoiGianMoDangKy, hanNopDeCuong, hanNopBaoCao].forEach(function (input) {
    if (input) {
      input.min = toDateTimeLocalValue(new Date());
    }
  });

  thoiGianThongBao?.addEventListener('change', function () {
    thoiGianMoDangKy.min = thoiGianThongBao.value || toDateTimeLocalValue(new Date());
  });

  thoiGianMoDangKy?.addEventListener('change', function () {
    hanNopDeCuong.min = thoiGianMoDangKy.value || toDateTimeLocalValue(new Date());
  });

  hanNopDeCuong?.addEventListener('change', function () {
    hanNopBaoCao.min = hanNopDeCuong.value || toDateTimeLocalValue(new Date());
  });

  savePeriodBtn.addEventListener('click', function () {
    const tenDot = tenDotInput.value.trim();
    const namHoc = namHocInput.value.trim();
    const capBac = capBacInput?.value.trim() || 'Cấp Trường';
    const chiTiet = periodDetail.value.trim();

    if (!tenDot) {
      alert('Vui lòng nhập tên đợt NCKH.');
      return;
    }

    if (!namHoc) {
      alert('Vui lòng nhập năm học.');
      return;
    }

    if (!isValidSchoolYear(namHoc)) {
      alert('Năm học phải đúng định dạng 2024-2025.');
      return;
    }

    if (!validateDateOrder(true)) {
      return;
    }

    const payload = {
      ten_dot: tenDot,
      nam_hoc: namHoc,
      cap_bac: capBac,
      mo_ta: chiTiet,
      thoi_gian_thong_bao: thoiGianThongBao.value,
      thoi_gian_mo_dang_ky: thoiGianMoDangKy.value,
      han_nop_de_cuong: hanNopDeCuong.value,
      han_nop_bao_cao: hanNopBaoCao.value,
      file_dinh_kem: periodAttachment.files && periodAttachment.files[0] ? `/uploads/thong_bao/${periodAttachment.files[0].name}` : null,
    };

    const editingPeriodId = Number(savePeriodBtn.dataset.periodId || 0);
    const isEditing = editingPeriodId > 0;
    const requestUrl = isEditing ? `/api/periods/${editingPeriodId}` : '/api/periods';
    const requestMethod = isEditing ? 'PUT' : 'POST';

    fetch(requestUrl, {
      method: requestMethod,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async function (response) {
      if (!response.ok) {
        let message = 'Không lưu được đợt NCKH';
        try {
          const err = await response.json();
          if (err && err.error) {
            message = err.error;
          }
        } catch (error) {
          // Keep default message when error payload is not JSON.
        }
        throw new Error(message);
      }
      return response.json();
    }).then(async function () {
      const modalEl = document.getElementById('periodModal') || document.getElementById('addPeriodModal');
      const modalInstance = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
      if (modalInstance) {
        modalInstance.hide();
      }
      alert('Lưu đợt thành công!');
      await fetchPeriods();
      renderByCurrentFilter();
    }).catch(function (error) {
      alert(error.message || 'Không thể lưu đợt mới. Vui lòng thử lại.');
    });
  });

  async function deletePeriod(id) {
    const periodId = Number(id);
    if (!periodId) {
      alert('Đợt không hợp lệ.');
      return;
    }

    const period = (currentPeriods || []).find(function (item) {
      return Number(item.id) === periodId;
    });
    const status = Number(period?.trangThaiDot ?? period?.trang_thai_dot ?? 0);
    if (status > 1) {
      alert('Không thể xóa đợt đã bắt đầu hoạt động');
      return;
    }

    if (!confirm('Bạn có chắc chắn muốn xóa đợt này?')) {
      return;
    }

    try {
      const resp = await fetch(`/api/periods/${periodId}`, { method: 'DELETE' });
      if (!resp.ok) {
        let message = 'Không thể xóa đợt.';
        try {
          const err = await resp.json();
          if (err && err.error) {
            message = err.error;
          }
        } catch (error) {
          // Keep default message when error payload is not JSON.
        }
        throw new Error(message);
      }

      alert('Xóa đợt thành công!');
      await fetchPeriods();
      renderByCurrentFilter();
    } catch (error) {
      alert(error.message || 'Không thể xóa đợt. Vui lòng thử lại.');
    }
  }

  window.deletePeriod = deletePeriod;

  // Initial load
  (async function () {
    await fetchPeriods();
    renderByCurrentFilter();
  })();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', adminPeriodsInit); else adminPeriodsInit();
