async function registerTopicInit() {
  // No frontend mock data. Fetch profile and periods from backend.
  let profileStudentData = null;
  let currentPeriods = [];

  async function fetchProfile() {
    try {
      const resp = await fetch('/api/me');
      if (!resp.ok) {
        alert('Đang kết nối cơ sở dữ liệu...');
        return null;
      }
      const data = await resp.json();
      profileStudentData = data || null;
      return profileStudentData;
    } catch (err) {
      alert('Đang kết nối cơ sở dữ liệu...');
      return null;
    }
  }

  async function fetchPeriods() {
    try {
      const resp = await fetch('/api/periods');
      if (!resp.ok) {
        alert('Đang kết nối cơ sở dữ liệu...');
        return [];
      }
      const data = await resp.json();
      currentPeriods = Array.isArray(data) ? data : [];
      return currentPeriods;
    } catch (err) {
      alert('Đang kết nối cơ sở dữ liệu...');
      return [];
    }
  }

  // ==================== AUTO-FILL ĐỢT ĐĂNG KY ====================
  function autofillRegistrationPeriod() {
    const params = new URLSearchParams(window.location.search);
    const dotId = params.get('dot_id') || null;
    const dotInput = document.getElementById('dotDangKy');
    if (dotInput) {
      if (!currentPeriods.length) {
        dotInput.value = '';
        dotInput.placeholder = 'Đang kết nối cơ sở dữ liệu...';
        return;
      }
      const period = dotId ? currentPeriods.find(p => Number(p.id) === Number(dotId)) : currentPeriods[0];
      dotInput.value = period ? (period.ten_dot || period.name || '') : '';
    }
  }

  // ==================== AUTO-FILL TÁC GIẢ 1 (CHỦ NHIỆM) ====================

  function autofillCurrentStudent() {
    const studentContainer = document.getElementById('studentContainer');
    const firstStudent = studentContainer.querySelector('.student-row:first-child');
    
    if (firstStudent && profileStudentData) {
      const nameInput = firstStudent.querySelector('.student-name');
      const mssvInput = firstStudent.querySelector('.student-mssv');
      const classInput = firstStudent.querySelector('.student-class');
      const khoaInput = firstStudent.querySelector('.student-khoa');
      const facultyInput = firstStudent.querySelector('.student-faculty');
      const dobInput = firstStudent.querySelector('.student-dob');
      const phoneInput = firstStudent.querySelector('.student-phone');
      const emailInput = firstStudent.querySelector('.student-email');
      const addressInput = firstStudent.querySelector('.student-address');

      const safeSet = (input, value) => {
        if (input && value) input.value = value;
      };

      safeSet(nameInput, profileStudentData.name);
      safeSet(mssvInput, profileStudentData.mssv);
      safeSet(classInput, profileStudentData.class);
      safeSet(khoaInput, profileStudentData.khoa);
      safeSet(facultyInput, profileStudentData.faculty);
      safeSet(dobInput, profileStudentData.dob);
      safeSet(phoneInput, profileStudentData.phone);
      safeSet(emailInput, profileStudentData.email);
      safeSet(addressInput, profileStudentData.address);
    } else if (!profileStudentData) {
      alert('Đang kết nối cơ sở dữ liệu...');
    }
  }
  // ==================== THÊM GVHD ====================
  const btnAddTeacher = document.getElementById('btnAddTeacher');
  const teacherContainer = document.getElementById('teacherContainer');
  let teacherCount = 1;

  btnAddTeacher.addEventListener('click', function () {
    teacherCount++;
    const teacherRow = document.createElement('div');
    teacherRow.className = 'teacher-row mb-3';
    teacherRow.innerHTML = `
      <div class="input-group">
        <input type="text" class="form-control" value="" placeholder="Nhập tên giảng viên hướng dẫn" name="gvhd_ten[]" required>
        <span class="input-group-text text-muted">GVHD ${teacherCount}</span>
        <button type="button" class="btn btn-outline-danger btn-delete-teacher" title="Xóa">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    teacherContainer.appendChild(teacherRow);
  });

  // ==================== XÓA GVHD (Event Delegation) ====================
  teacherContainer.addEventListener('click', function (e) {
    if (e.target.closest('.btn-delete-teacher')) {
      const teacherRow = e.target.closest('.teacher-row');
      if (teacherRow) {
        teacherRow.remove();
        updateTeacherLabels();
      }
    }
  });

  // ==================== CẬP NHẬT SỐ THỨ TỰ GVHD ====================
  function updateTeacherLabels() {
    const teacherRows = teacherContainer.querySelectorAll('.teacher-row');
    let index = 1;
    teacherRows.forEach(row => {
      const label = row.querySelector('.input-group-text');
      if (label) {
        label.textContent = `GVHD ${index}`;
      }
      index++;
    });
    teacherCount = teacherRows.length;
  }

  // ==================== THÊM TÁC GIẢ ====================
  const btnAddStudent = document.getElementById('btnAddStudent');
  const studentContainer = document.getElementById('studentContainer');

  btnAddStudent.addEventListener('click', function () {
    const studentRow = document.createElement('div');
    studentRow.className = 'student-row border p-3 mb-3 rounded position-relative';
    studentRow.innerHTML = `
      <!-- Nút Xóa - Góc trên cùng bên phải -->
      <button type="button" class="btn btn-sm btn-danger btn-delete-student position-absolute" style="top: 10px; right: 10px;" title="Xóa tác giả">
        <i class="fas fa-trash"></i>
      </button>

      <!-- Dòng 1: Thông tin học tập -->
      <div class="row mb-3">
        <div class="col-md-3 mb-2">
          <label class="form-label text-muted small">Họ và Tên <span class="text-danger">*</span></label>
          <input type="text" class="form-control student-name" name="tac_gia_ten[]" value="" placeholder="Nhập họ tên" required>
        </div>
        <div class="col-md-2 mb-2">
          <label class="form-label text-muted small">Mã SV <span class="text-danger">*</span></label>
          <input type="text" class="form-control student-mssv" name="tac_gia_mssv[]" value="" placeholder="K23TT0002" required>
        </div>
        <div class="col-md-2 mb-2">
          <label class="form-label text-muted small">Lớp <span class="text-danger">*</span></label>
          <input type="text" class="form-control student-class" name="tac_gia_lop[]" value="" placeholder="K23TT" required>
        </div>
        <div class="col-md-2 mb-2">
          <label class="form-label text-muted small">Khóa <span class="text-danger">*</span></label>
          <input type="text" class="form-control student-khoa" name="tac_gia_khoa[]" value="" placeholder="2023" required>
        </div>
        <div class="col-md-3 mb-2">
          <label class="form-label text-muted small">Khoa <span class="text-danger">*</span></label>
          <input type="text" class="form-control student-faculty" name="tac_gia_khoa_vien[]" value="" placeholder="CNTT" required>
        </div>
      </div>

      <!-- Dòng 2: Thông tin liên lạc -->
      <div class="row mb-3">
        <div class="col-md-2 mb-2">
          <label class="form-label text-muted small">Ngày sinh <span class="text-danger">*</span></label>
          <input type="date" class="form-control student-dob" name="tac_gia_ngay_sinh[]" value="" required>
        </div>
        <div class="col-md-3 mb-2">
          <label class="form-label text-muted small">Số điện thoại <span class="text-danger">*</span></label>
          <input type="tel" class="form-control student-phone" name="tac_gia_so_dien_thoai[]" value="" placeholder="0987654321" required>
        </div>
        <div class="col-md-3 mb-2">
          <label class="form-label text-muted small">Email <span class="text-danger">*</span></label>
          <input type="email" class="form-control student-email" name="tac_gia_email[]" value="" placeholder="email@udn.vn" required>
        </div>
        <div class="col-md-4 mb-2">
          <label class="form-label text-muted small">Địa chỉ <span class="text-danger">*</span></label>
          <input type="text" class="form-control student-address" name="tac_gia_dia_chi[]" value="" placeholder="123 Đường ABC, Quận 1" required>
        </div>
      </div>

      <!-- Dòng 3: Tệp đính kèm -->
      <div class="row">
        <div class="col-md-4 mb-2">
          <label class="form-label text-muted small">Ảnh thẻ 3x4 <span class="text-danger">*</span></label>
          <input type="file" class="form-control student-photo" name="tac_gia_anh_the[]" accept="image/*" required>
          <small class="text-muted d-block mt-1">Hỗ trợ: JPG, PNG (Tối đa 5MB)</small>
        </div>
      </div>
    `;
    studentContainer.appendChild(studentRow);
  });

  // ==================== XÓA TÁC GIẢ (Event Delegation) ====================
  studentContainer.addEventListener('click', function (e) {
    if (e.target.closest('.btn-delete-student')) {
      const studentRow = e.target.closest('.student-row');
      if (studentRow) {
        studentRow.remove();
      }
    }
  });

  // ==================== SUBMIT FORM ====================
  document.getElementById('registerTopicForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const payload = {
      dot_dang_ky: document.getElementById('dotDangKy').value,
      ten_de_tai: document.getElementById('topicName').value,
      linh_vuc: document.getElementById('researchField').value,
      muc_tieu: document.getElementById('researchGoal').value,
      giang_vien_hd: (document.querySelector('input[name="gvhd_ten[]"]')?.value || '').trim(),
    };

    const fileInput = document.getElementById('thuyetMinh');
    const formData = new FormData();
    formData.append('dot_dang_ky', payload.dot_dang_ky);
    formData.append('ten_de_tai', payload.ten_de_tai);
    formData.append('linh_vuc', payload.linh_vuc);
    formData.append('muc_tieu', payload.muc_tieu);
    formData.append('giang_vien_hd', payload.giang_vien_hd);
    if (fileInput?.files?.[0]) {
      formData.append('file_thuyet_minh', fileInput.files[0]);
    }

    fetch('/api/topics', {
      method: 'POST',
      body: formData,
    }).then(async function (response) {
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Lỗi khi gửi đăng ký');
      }
      return response.json();
    }).then(function () {
      alert('Đã gửi đăng ký đề tài lên server.');
      window.location.href = '/student/my-topic';
    }).catch(function () {
      alert('Gửi đăng ký thất bại. Vui lòng thử lại.');
    });
  });

  // ==================== KHỞI ĐỘNG: Auto-fill dữ liệu ====================
  await fetchProfile();
  await fetchPeriods();
  autofillRegistrationPeriod();
  autofillCurrentStudent();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', registerTopicInit); else registerTopicInit();

