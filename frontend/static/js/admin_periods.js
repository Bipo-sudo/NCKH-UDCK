function adminPeriodsInit() {
  const periodsHolder = document.getElementById('periodsDataHolder');
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
  
  // Khai báo các field thông tin chung
  const tenDotInput = document.getElementById('ten_dot');
  const namHocInput = document.getElementById('nam_hoc');
  const capBacInput = document.getElementById('cap_bac');
  const periodDetail = document.getElementById('periodDetail');
  const periodAttachment = document.getElementById('periodAttachment');
  
  // Khai báo đúng ID của 7 mốc thời gian từ form HTML mới
  const timeThongBao = document.getElementById('timeThongBao');
  const timeMoDangKy = document.getElementById('timeMoDangKy');
  const timeHanDangKy = document.getElementById('timeHanDangKy');
  const timeMoNopBaoCao = document.getElementById('timeMoNopBaoCao');
  const timeHanNopBaoCao = document.getElementById('timeHanNopBaoCao');
  const timeBatDauBaoVe = document.getElementById('timeBatDauBaoVe');
  const timeHanBaoVe = document.getElementById('timeHanBaoVe');
  
  const savePeriodBtn = document.getElementById('savePeriodBtn');
  const addPeriodModalEl = document.getElementById('addPeriodModal');
  const ui = window.AdminUi;

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
    if (status === 1) return '<span class="badge text-bg-secondary">Đăng ký</span>';
    if (status === 2) return '<span class="badge text-bg-info">Đang thực hiện</span>';
    if (status === 3) return '<span class="badge text-bg-warning text-dark">Nghiệm thu</span>';
    if (status === 4) return '<span class="badge text-bg-primary">Kết thúc</span>';
    if (status === 5) return '<span class="badge text-bg-danger">Bảo vệ</span>';
    if (status === 6) return '<span class="badge text-bg-success">Hoàn thành</span>';
    return '<span class="badge text-bg-dark">Không xác định</span>';
  }

  // Thuật toán kiểm tra 7 mốc thời gian phải tăng dần
  function validateDateOrder(showAlert = true) {
    const dates = [
      timeThongBao?.value, timeMoDangKy?.value, timeHanDangKy?.value,
      timeMoNopBaoCao?.value, timeHanNopBaoCao?.value, timeBatDauBaoVe?.value, timeHanBaoVe?.value
    ];

    if (dates.some(d => !d)) {
      if (showAlert) alert('Vui lòng nhập đầy đủ 7 mốc thời gian.');
      return false;
    }

    for (let i = 0; i < dates.length - 1; i++) {
      if (dates[i] >= dates[i+1]) {
         if (showAlert) alert(`Lỗi logic thời gian: Mốc số ${i+2} phải diễn ra SAU mốc số ${i+1}.`);
         return false;
      }
    }
    return true;
  }

  function renderTable(data) {
    let rowsHtml = '';

    data.forEach(function (item) {
      const status = Number(item.trangThaiDot ?? item.trang_thai_dot ?? 0);
      const canDelete = status <= 1; // Chỉ cho xóa nếu đợt chưa tiến hành sâu
      rowsHtml += `
        <tr>
          <td>
            <strong>${getPeriodTitleValue(item)}</strong>
            <div class="small text-muted mt-1">${getSchoolYearValue(item)}</div>
            ${item.mo_ta || item.chiTiet ? `<div class="small text-muted mt-1">${item.mo_ta || item.chiTiet}</div>` : ''}
            <div class="mt-2">
              <button type="button" class="btn btn-sm btn-danger" onclick="deletePeriod(${item.id})"
                ${canDelete ? '' : 'disabled'}
                title="${canDelete ? 'Xóa đợt' : 'Không thể xóa đợt đã bắt đầu hoạt động'}">
                <i class="fas fa-trash me-1"></i>Xóa
              </button>
            </div>
          </td>
          <td><span class="badge ${getPeriodLevelValue(item) === 'Cấp Trường' ? 'bg-success' : getPeriodLevelValue(item) === 'Cấp Khoa' ? 'bg-secondary' : 'bg-primary'}">${getPeriodLevelValue(item)}</span></td>
          <td>${formatDateTime(item.thoiGianThongBao ?? item.thoi_gian_thong_bao)}</td>
          <td>${formatDateTime(item.thoiGianMoDangKy ?? item.thoi_gian_mo_dang_ky)}</td>
          <td>${formatDateTime(item.hanDangKy ?? item.han_dang_ky)}</td>
          <td>${formatDateTime(item.hanNopBaoCao ?? item.han_nop_bao_cao)}</td>
          <td>
            ${item.tepDinhKem?.fileName || item.file_dinh_kem
              ? `<a href="${item.tepDinhKem?.url || item.file_dinh_kem}" target="_blank">Xem tệp</a>`
              : '<span class="text-muted">Không có tệp</span>'}
          </td>
          <td>${getStatusBadge(status)}</td>
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

  // Tự động gán thuộc tính min cho 7 mốc thời gian (Cascading Min Date)
  const timeInputs = [timeThongBao, timeMoDangKy, timeHanDangKy, timeMoNopBaoCao, timeHanNopBaoCao, timeBatDauBaoVe, timeHanBaoVe];
  
  timeInputs.forEach(input => {
    if (input) input.min = toDateTimeLocalValue(new Date());
  });

  for(let i = 0; i < timeInputs.length - 1; i++) {
      if(timeInputs[i] && timeInputs[i+1]) {
          timeInputs[i].addEventListener('change', function() {
              timeInputs[i+1].min = timeInputs[i].value || toDateTimeLocalValue(new Date());
          });
      }
  }

  savePeriodBtn.addEventListener('click', function () {
    const tenDot = tenDotInput.value.trim();
    const namHoc = namHocInput.value.trim();
    const capBac = capBacInput?.value.trim() || 'Cấp Trường';
    const chiTiet = periodDetail.value.trim();

    if (!tenDot || !namHoc) {
      alert('Vui lòng nhập Tên đợt và Năm học.');
      return;
    }

    if (!isValidSchoolYear(namHoc)) {
      alert('Năm học phải đúng định dạng, ví dụ: 2024-2025.');
      return;
    }

    if (!validateDateOrder(true)) {
      return;
    }

    // Đóng gói Payload chứa đúng 7 mốc thời gian để gửi xuống Backend
    const payload = {
      ten_dot: tenDot,
      nam_hoc: namHoc,
      cap_bac: capBac,
      mo_ta: chiTiet,
      thoi_gian_thong_bao: timeThongBao.value,
      thoi_gian_mo_dang_ky: timeMoDangKy.value,
      han_dang_ky: timeHanDangKy.value,
      thoi_gian_mo_nop_bao_cao: timeMoNopBaoCao.value,
      han_nop_bao_cao: timeHanNopBaoCao.value,
      thoi_gian_bat_dau_bao_ve: timeBatDauBaoVe.value,
      han_bao_ve: timeHanBaoVe.value,
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
          if (err && err.message) message = err.message;
          else if (err && err.error) message = err.error;
        } catch (error) {}
        throw new Error(message);
      }
      return response.json();
    }).then(async function (data) {
      if (addPeriodModal) addPeriodModal.hide();
      if (ui && ui.showToast) {
        ui.showToast({
          title: 'Lưu đợt thành công',
          message: data.message || 'Lưu đợt NCKH thành công!'
        });
      } else {
        alert('Thành công: ' + (data.message || 'Lưu đợt NCKH thành công!'));
      }
      
      // Xóa form sau khi tạo thành công
      if(!isEditing) {
          tenDotInput.value = ''; namHocInput.value = ''; periodDetail.value = '';
          timeInputs.forEach(input => input.value = '');
      }

      await fetchPeriods();
      renderByCurrentFilter();
    }).catch(function (error) {
      alert('Lỗi: ' + error.message);
    });
  });

  async function deletePeriod(id) {
    const periodId = Number(id);
    if (!periodId) return;

    const confirmed = ui && ui.confirmDialog
      ? await ui.confirmDialog({
          title: 'Xóa đợt NCKH',
          message: 'Bạn có chắc chắn muốn xóa đợt NCKH này? Toàn bộ đề tài thuộc đợt này cũng có thể bị ảnh hưởng!',
          confirmText: 'Xóa',
          confirmVariant: 'danger'
        })
      : { confirmed: true };

    if (!confirmed.confirmed) {
      return;
    }

    try {
      const resp = await fetch(`/api/periods/${periodId}`, { method: 'DELETE' });
      if (!resp.ok) {
        let message = 'Không thể xóa đợt.';
        try {
          const err = await resp.json();
          if (err && err.message) message = err.message;
        } catch (error) {}
        throw new Error(message);
      }

      if (ui && ui.showToast) {
        ui.showToast({
          title: 'Xóa đợt thành công',
          message: 'Đợt NCKH đã được xóa.'
        });
      } else {
        alert('Xóa đợt thành công!');
      }
      await fetchPeriods();
      renderByCurrentFilter();
    } catch (error) {
      alert(error.message || 'Lỗi kết nối máy chủ.');
    }
  }

  window.deletePeriod = deletePeriod;

  // Khởi động
  (async function () {
    await fetchPeriods();
    renderByCurrentFilter();
  })();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', adminPeriodsInit); else adminPeriodsInit();