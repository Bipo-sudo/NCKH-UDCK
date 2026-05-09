let currentTopicId = null;

function studentModuleInit() {
  const REGISTRATION_DRAFT_KEY = 'studentTopicRegistrationDraft';

  // No frontend mock data. Fetch student profile, periods and my-topics from backend.
  let currentStudent = null;
  let currentPeriods = [];
  let currentMyTopics = [];

  async function fetchProfile() {
    try {
      const resp = await fetch('/api/me');
      if (!resp.ok) {
        alert('Đang kết nối cơ sở dữ liệu...');
        return null;
      }
      const data = await resp.json();
      currentStudent = data || null;
      return currentStudent;
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

    // initialize UI from backend
    currentTopicId = null;
    let filteredTopicCache = [];

    let allPeriods = [];

    (async function initStudentModule() {
      // show minimal loading hints
      try {
        allPeriods = await fetchPeriods();
        currentMyTopics = await fetchMyTopics();
        const profile = await fetchProfile();
        currentTopicId = currentMyTopics[0]?.id || null;
        filteredTopicCache = [...currentMyTopics];

        if (window.StudentMyTopicCrossLock?.applyMockAutoFail) {
          window.StudentMyTopicCrossLock.applyMockAutoFail(currentMyTopics, allPeriods);
          filteredTopicCache = [...currentMyTopics];
        }

        // render if elements exist
        if (document.getElementById('periodsList')) renderPeriods();
        if (document.getElementById('topicListView') || document.getElementById('topicDetailView')) {
          bindTopicFilterControls();
          renderTopicListView();
          bindTopicNavigation();
          renderSelectedTopicDetail(currentTopicId);
          initTopicStatusTester();
        }

        if (document.getElementById('registerTopicForm')) {
          setTimeout(prefillRegisterTopicFormFromDraft, 0);
        }
      } catch (err) {
        console.error('Error initializing student module', err);
      }
    })();

  function getTopicStatusMeta(status) {
    const map = {
      1: { text: 'Chờ duyệt đề cương', badge: 'secondary' },
      2: { text: 'Yêu cầu sửa đề cương', badge: 'warning text-dark' },
      3: { text: 'Bị từ chối', badge: 'dark' },
      4: { text: 'Đang triển khai', badge: 'primary' },
      5: { text: 'Chờ duyệt báo cáo', badge: 'info text-dark' },
      6: { text: 'Yêu cầu sửa báo cáo', badge: 'warning text-dark' },
      7: { text: 'Chờ/Đang bảo vệ', badge: 'primary' },
      8: { text: 'Không đạt/Hủy', badge: 'danger' },
      9: { text: 'Hoàn thành', badge: 'success' },
    };
    return map[status] || { text: 'Không xác định', badge: 'secondary' };
  }

  function getRoleBadge(role) {
    return role === 'Chủ nhiệm'
      ? '<span class="badge bg-success">Chủ nhiệm</span>'
      : '<span class="badge bg-info text-dark">Thành viên</span>';
  }

  function calculateRemainingDays(deadline) {
    if (!deadline) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime())) return null;

    const normalizedDeadline = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
    const diffMs = normalizedDeadline - today;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  function getRemainingDaysBadge(topic) {
    if (topic.status !== 4) return '';
    const remainingDays = calculateRemainingDays(topic.ngay_ket_thuc_dot);
    if (remainingDays === null) return '';

    if (remainingDays < 0) {
      return `<span class="badge bg-danger">Quá hạn ${Math.abs(remainingDays)} ngày</span>`;
    }
    if (remainingDays < 3) {
      return `<span class="badge bg-danger">Còn ${remainingDays} ngày để nộp báo cáo</span>`;
    }
    if (remainingDays <= 10) {
      return `<span class="badge bg-warning text-dark">Còn ${remainingDays} ngày để nộp báo cáo</span>`;
    }
    return `<span class="badge bg-success">Còn ${remainingDays} ngày để nộp báo cáo</span>`;
  }

  function getTopicById(topicId) {
    return (currentMyTopics || []).find(topic => topic.id === topicId) || null;
  }

  function getDeadlineValue(topic) {
    const deadline = topic.ngay_ket_thuc_dot || '';
    const parsed = new Date(deadline);
    return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
  }

  function applyFilters() {
    const periodFilter = document.getElementById('filterPeriodSelect')?.value || 'all';
    const statusFilter = document.getElementById('filterStatusSelect')?.value || 'all';
    const sortMode = document.getElementById('sortDeadlineSelect')?.value || 'nearest';

    let result = [...currentMyTopics];

    if (periodFilter !== 'all') {
      result = result.filter(topic => topic.period === periodFilter);
    }

    if (statusFilter !== 'all') {
      const statusNumber = Number(statusFilter);
      result = result.filter(topic => topic.status === statusNumber);
    }

    result.sort((a, b) => {
      const diff = getDeadlineValue(a) - getDeadlineValue(b);
      return sortMode === 'nearest' ? diff : -diff;
    });

    filteredTopicCache = result;
    renderMyTopics(result);
  }

  function renderMyTopics(data) {
    const listContainer = document.getElementById('myTopicListContainer');
    const listView = document.getElementById('topicListView');
    const detailView = document.getElementById('topicDetailView');
    const counter = document.getElementById('topicListCounter');

    if (!listContainer) return;

    if (counter) {
      counter.textContent = `${data.length} đề tài`;
    }

    listContainer.innerHTML = data.map((topic) => {
      const statusMeta = getTopicStatusMeta(topic.status);
      const countdownBadge = topic.status === 4 ? `<div class="mt-2">${getRemainingDaysBadge(topic)}</div>` : '';

      return `
        <div class="col-12">
          <div class="card topic-card-horizontal h-100">
            <div class="card-body">
              <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
                <div class="flex-grow-1">
                  <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <h5 class="mb-0">${topic.title}</h5>
                    <span class="badge bg-${statusMeta.badge}">${statusMeta.text}</span>
                  </div>
                  <div class="text-muted small mb-2">Năm học: <strong>${topic.period}</strong> · Vai trò: <strong>${topic.role}</strong></div>
                  <div class="text-muted small">Lĩnh vực: ${topic.field}</div>
                  ${topic.status === 9 && topic.capGiaiThuong && topic.xepLoaiGiai ? `<div class="mt-2"><span class="badge bg-warning text-dark"><i class="fas fa-medal me-1"></i>Đạt giải ${topic.xepLoaiGiai} - ${topic.capGiaiThuong}</span></div><div class="small text-success mt-1">Điểm số: <strong>${topic.diemSo ?? '-'}</strong></div>` : ''}
                  ${countdownBadge}
                </div>
                <div class="text-lg-end">
                  <button type="button" class="btn btn-outline-primary btn-view-topic" data-topic-id="${topic.id}">
                    <i class="fas fa-eye me-2"></i>Xem chi tiết
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (listView) listView.classList.toggle('d-none', false);
    if (detailView) detailView.classList.toggle('d-none', true);
  }

  function bindTopicFilterControls() {
    const periodFilter = document.getElementById('filterPeriodSelect');
    const statusFilter = document.getElementById('filterStatusSelect');
    const sortFilter = document.getElementById('sortDeadlineSelect');

    [periodFilter, statusFilter, sortFilter].forEach((el) => {
      if (el) {
        el.addEventListener('change', function () {
          applyFilters();
        });
      }
    });
  }

  function buildHistoryHtml(topic) {
    const history = Array.isArray(topic.history) ? topic.history : [];
    if (!history.length) {
      return '<div class="text-muted">Chưa có lịch sử phản hồi.</div>';
    }

    return `
      <div class="list-group list-group-flush">
        ${history.map((item, index) => `
          <div class="list-group-item border-0 px-0 ${index < history.length - 1 ? 'pb-3 mb-3 border-bottom' : ''}">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong>${item.time}</strong>
              <span class="badge bg-secondary">${item.author || 'Admin'}</span>
            </div>
            <div class="text-muted small">${item.content}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderTopicListView() {
    renderMyTopics(filteredTopicCache);
  }

  function showTopicDetail(topicId) {
    currentTopicId = topicId;
    const topic = getTopicById(topicId);
    if (!topic) return;

    const listView = document.getElementById('topicListView');
    const detailView = document.getElementById('topicDetailView');

    if (listView) listView.classList.toggle('d-none', true);
    if (detailView) detailView.classList.toggle('d-none', false);

    renderSelectedTopicDetail(topicId);
    initTopicStatusTester(topicId);
  }

  function renderSelectedTopicDetail(topicId) {
    const topic = getTopicById(topicId);
    if (!topic) return;

    const statusMeta = getTopicStatusMeta(topic.status);
    const generalCard = document.getElementById('topicGeneralCard');
    const authorsCard = document.getElementById('topicAuthorsCard');
    const advisorCard = document.getElementById('topicAdvisorCard');
    const statusCard = document.getElementById('topicStatusCard');
    const historyCard = document.getElementById('topicHistoryCard');

    if (generalCard) {
      generalCard.innerHTML = `
        <div class="card-header bg-light"><h5 class="mb-0"><i class="fas fa-info-circle me-2"></i>Thông tin chung</h5></div>
        <div class="card-body">
          <p class="mb-2"><strong>Tên đề tài:</strong> ${topic.title}</p>
          <p class="mb-2"><strong>Mã đề tài:</strong> ${topic.code}</p>
          <p class="mb-2"><strong>Năm học:</strong> ${topic.period}</p>
          <p class="mb-2"><strong>Vai trò:</strong> ${topic.role}</p>
          <p class="mb-2"><strong>Lĩnh vực:</strong> ${topic.field}</p>
          <p class="mb-0"><strong>Mục tiêu:</strong> ${topic.objective}</p>
        </div>
      `;
    }

    if (authorsCard) {
      authorsCard.innerHTML = `
        <div class="card-header bg-light"><h5 class="mb-0"><i class="fas fa-users me-2"></i>Nhóm tác giả</h5></div>
        <div class="card-body">
          ${topic.authors.map((author) => `
            <div class="border rounded p-2 mb-2">
              <div class="d-flex justify-content-between align-items-center gap-2">
                <div><strong>${author.name}</strong> <span class="text-muted">(${author.role})</span></div>
                ${author.role === 'Chủ nhiệm đề tài' ? '<span class="badge bg-success">Chủ nhiệm</span>' : '<span class="badge bg-secondary">Thành viên</span>'}
              </div>
              <small class="text-muted d-block">${author.mssv} - ${author.className}</small>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (advisorCard) {
      advisorCard.innerHTML = `
        <div class="card-header bg-light"><h5 class="mb-0"><i class="fas fa-chalkboard-teacher me-2"></i>Giảng viên hướng dẫn</h5></div>
        <div class="card-body">
          <p class="mb-2"><strong>${topic.advisor.name}</strong></p>
          <p class="mb-2"><i class="fas fa-envelope me-2 text-muted"></i>${topic.advisor.email}</p>
          <p class="mb-0"><i class="fas fa-phone me-2 text-muted"></i>${topic.advisor.phone}</p>
        </div>
      `;
    }

    if (statusCard) {
      const canEditRegistration = [1, 2].includes(topic.status);
      const awardBadge = topic.status === 9 && topic.capGiaiThuong && topic.xepLoaiGiai
        ? `<div class="alert alert-warning border-warning fw-semibold mb-3"><i class="fas fa-medal me-2"></i>Đạt giải ${topic.xepLoaiGiai} - ${topic.capGiaiThuong}<br><span class="small">Điểm số: ${topic.diemSo ?? '-'}</span></div>`
        : '';
      statusCard.innerHTML = `
        <div class="card-header bg-light"><h5 class="mb-0"><i class="fas fa-check-circle me-2"></i>Trạng thái hiện tại</h5></div>
        <div class="card-body">
          ${awardBadge}
          <div class="status-badges-wrap mb-3">
            <span class="badge bg-${statusMeta.badge}">${statusMeta.text}</span>
            ${getRemainingDaysBadge(topic)}
          </div>
          ${canEditRegistration ? '<a href="/student/register-topic" id="btnEditRegistrationInfo" class="btn btn-warning btn-sm"><i class="fas fa-pen-to-square me-2"></i>Chỉnh sửa thông tin đăng ký</a>' : ''}
        </div>
      `;

      const editBtn = document.getElementById('btnEditRegistrationInfo');
      if (editBtn) {
        editBtn.addEventListener('click', function (event) {
          event.preventDefault();
          localStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify(topic.registrationDraft || {}));
          window.location.href = '/student/register-topic';
        });
      }
    }

    if (historyCard) {
      historyCard.innerHTML = `
        <div class="card-header bg-light">
          <h5 class="mb-0"><i class="fas fa-timeline me-2"></i>Lịch sử phản hồi từ Ban quản lý</h5>
        </div>
        <div class="card-body">
          ${buildHistoryHtml(topic)}
        </div>
      `;
    }

    const stageFill = document.getElementById('topicStageFill');
    const stageLabel = document.getElementById('topicCurrentStageLabel');
    if (stageFill) stageFill.style.width = `${getStageProgress(topic.status)}%`;
    if (stageLabel) stageLabel.textContent = statusMeta.text;
    activateStageLabels(topic.status);

    renderSubmissionArea(topic);
  }

  function bindTopicNavigation() {
    document.addEventListener('click', function (event) {
      const viewButton = event.target.closest('.btn-view-topic');
      if (viewButton) {
        const topicId = Number(viewButton.getAttribute('data-topic-id'));
        showTopicDetail(topicId);
        return;
      }

      const backButton = event.target.closest('#btnBackToTopicList');
      if (backButton) {
        renderTopicListView();
        renderSelectedTopicDetail(currentTopicId);
        return;
      }
    });
  }

  function getCountdownBadgeHtml(topic) {
    if (topic.status !== 4) return '';

    const remainingDays = calculateRemainingDays(topic.ngay_ket_thuc_dot);
    if (remainingDays === null) return '';

    if (remainingDays < 0) {
      return `<span class="badge bg-danger">Quá hạn ${Math.abs(remainingDays)} ngày</span>`;
    }
    if (remainingDays < 3) {
      return `<span class="badge bg-danger">Còn ${remainingDays} ngày để nộp báo cáo</span>`;
    }
    if (remainingDays <= 10) {
      return `<span class="badge bg-warning text-dark">Còn ${remainingDays} ngày để nộp báo cáo</span>`;
    }
    return `<span class="badge bg-success">Còn ${remainingDays} ngày để nộp báo cáo</span>`;
  }

  function getStageProgress(status) {
    if (status <= 1) return 12;
    if (status === 2) return 24;
    if (status === 3) return 36;
    if (status === 4) return 48;
    if (status === 5) return 60;
    if (status === 6) return 72;
    if (status === 7) return 84;
    if (status === 8) return 92;
    return 100;
  }

  function activateStageLabels(status) {
    const s1 = document.getElementById('stage-label-1');
    const s2 = document.getElementById('stage-label-2');
    const s3 = document.getElementById('stage-label-3');
    const s4 = document.getElementById('stage-label-4');
    const s5 = document.getElementById('stage-label-5');
    const s6 = document.getElementById('stage-label-6');
    const s7 = document.getElementById('stage-label-7');
    const s8 = document.getElementById('stage-label-8');
    const s9 = document.getElementById('stage-label-9');
    const labels = [s1, s2, s3, s4, s5, s6, s7, s8, s9];
    labels.forEach((el) => el && el.classList.remove('active'));

    labels.forEach((el, index) => {
      if (!el) return;
      if ((index + 1) <= status) {
        el.classList.add('active');
      }
    });
  }

  function renderSubmissionArea(topic) {
    const card = document.getElementById('topicSubmissionCard');
    if (!card) return;

    let body = '';
    if (topic.status === 1) {
      body = `<p class="text-muted mb-0">Đang chờ hội đồng xét duyệt.</p>`;
    } else if (topic.status === 2) {
      body = `
        <div class="alert alert-danger small">
          <strong>Lý do yêu cầu sửa đề cương:</strong><br>${topic.reason || 'Thiếu thông tin đề cương chi tiết.'}
        </div>
        <div class="mb-3">
          <label class="form-label">Chọn các tệp đính kèm Đề cương chi tiết</label>
          <input type="file" class="form-control" accept=".pdf,.doc,.docx" multiple>
        </div>
        <button class="btn btn-primary btn-sm"><i class="fas fa-upload me-2"></i>Nộp lại</button>
      `;
    } else if (topic.status === 3) {
      body = `
        <div class="alert alert-dark small mb-0">
          <strong>Đề tài bị từ chối:</strong><br>${topic.reason || 'Không đạt yêu cầu đề cương.'}
        </div>
      `;
    } else if (topic.status === 4) {
      const lockResult = window.StudentMyTopicCrossLock?.evaluateSubmissionLock
        ? window.StudentMyTopicCrossLock.evaluateSubmissionLock(topic, allPeriods)
        : { allowSubmit: true, locked: false, message: '' };

      if (lockResult.locked && lockResult.message) {
        body = `
          <div class="alert alert-warning small mb-3">
            <strong>Khóa nộp bài theo trạng thái đợt:</strong><br>${lockResult.message}
          </div>
          <button class="btn btn-secondary btn-sm" disabled><i class="fas fa-lock me-2"></i>Nộp báo cáo</button>
        `;
      } else if (lockResult.allowSubmit) {
        body = `
          <div class="mb-3">
            <label class="form-label">Chọn các tệp đính kèm Báo cáo tổng kết</label>
            <input type="file" class="form-control" accept=".pdf,.doc,.docx,.zip,.rar" multiple>
          </div>
          <div class="mb-3">
            <label class="form-label">Liên kết ngoài (Drive/GitHub)</label>
            <input type="url" class="form-control" placeholder="Nhập liên kết ngoài (nếu có)">
          </div>
          <button class="btn btn-success btn-sm"><i class="fas fa-upload me-2"></i>Nộp báo cáo</button>
        `;
      } else {
        body = `
          <div class="alert alert-secondary small mb-3">Đợt hiện tại không cho phép nộp báo cáo.</div>
          <button class="btn btn-secondary btn-sm" disabled><i class="fas fa-lock me-2"></i>Nộp báo cáo</button>
        `;
      }
    } else if (topic.status === 5) {
      body = `<p class="text-muted mb-0">Báo cáo đã nộp, đang chờ Admin duyệt điều kiện bảo vệ.</p>`;
    } else if (topic.status === 6) {
      body = `
        <div class="alert alert-warning small">
          <strong>Yêu cầu sửa báo cáo:</strong><br>${topic.reason || 'Vui lòng cập nhật lại báo cáo theo góp ý.'}
        </div>
        <div class="mb-3">
          <label class="form-label">Chọn các tệp đính kèm Báo cáo tiến độ / tổng kết</label>
          <input type="file" class="form-control" accept=".pdf,.doc,.docx,.zip,.rar" multiple>
        </div>
        <div class="mb-3">
          <label class="form-label">Liên kết ngoài (Drive/GitHub)</label>
          <input type="url" class="form-control" placeholder="Nhập liên kết ngoài (nếu có)">
        </div>
        <button class="btn btn-warning btn-sm"><i class="fas fa-upload me-2"></i>Nộp lại báo cáo</button>
      `;
    } else if (topic.status === 7) {
      body = `
        <div class="alert alert-info small mb-0">
          <strong>Đang chờ bảo vệ:</strong><br>Admin đã duyệt báo cáo đạt. Vui lòng chuẩn bị hồ sơ và lịch bảo vệ hội đồng.
        </div>
      `;
    } else if (topic.status === 8) {
      body = `
        <div class="alert alert-danger small mb-0">
          <strong>Kết quả:</strong> Đề tài không đạt hoặc đã hủy. ${topic.reason || ''}
        </div>
      `;
    } else if (topic.status === 9) {
      const rewardHtml = topic.capGiaiThuong && topic.xepLoaiGiai
        ? `<div class="alert alert-warning border-warning fw-semibold mb-2"><i class="fas fa-medal me-2"></i>Đạt giải ${topic.xepLoaiGiai} - ${topic.capGiaiThuong}<br><span class="small">Điểm số: ${topic.diemSo ?? '-'}</span></div>`
        : `<div class="alert alert-success small mb-2">Đã bảo vệ thành công. Điểm số: <strong>${topic.diemSo ?? '-'}</strong></div>`;
      body = `${rewardHtml}<p class="text-success mb-0">Đề tài đã hoàn thành. Không còn yêu cầu nộp bài.</p>`;
    }

    card.innerHTML = `
      <div class="card-header bg-light"><h5 class="mb-0"><i class="fas fa-cloud-upload-alt me-2"></i>Khu vực nộp bài</h5></div>
      <div class="card-body">${body}</div>
    `;
  }

  function initTopicStatusTester(topicId) {
    const box = document.getElementById('topicUiTestBox');
    const select = document.getElementById('topicStatusTestSelect');
    if (!box || !select) return;

    box.style.display = 'block';
    const topic = getTopicById(topicId || currentTopicId);
    if (!topic) return;

    select.value = String(topic.status);
    select.onchange = function () {
      const currentTopic = getTopicById(currentTopicId);
      if (!currentTopic) return;

      const newStatus = select.value;
      currentTopic.status = parseInt(newStatus, 10);
      currentTopic.Trang_Thai = currentTopic.status;
      if (currentTopic.status === 2) {
        currentTopic.reason = 'Đề cương cần bổ sung mục tiêu định lượng và phạm vi dữ liệu.';
      } else if (currentTopic.status === 6) {
        currentTopic.reason = 'Hội đồng yêu cầu chỉnh sửa báo cáo sau bảo vệ.';
      } else if (currentTopic.status === 7) {
        currentTopic.reason = '';
      } else if (currentTopic.status === 8) {
        currentTopic.reason = 'Bao ve that bai hoac cham tien do.';
      } else if (currentTopic.status === 9) {
        currentTopic.capGiaiThuong = currentTopic.capGiaiThuong || 'Cấp Trường';
        currentTopic.xepLoaiGiai = currentTopic.xepLoaiGiai || 'Khuyến khích';
        currentTopic.diemSo = currentTopic.diemSo || 8.8;
        currentTopic.reason = '';
      } else {
        currentTopic.reason = '';
      }
      showTopicDetail(currentTopicId);
    };
  }

  function prefillRegisterTopicFormFromDraft() {
    const fallbackDraft = getTopicById(currentTopicId)?.registrationDraft || (currentMyTopics[0]?.registrationDraft);
    let savedDraft = null;

    try {
      const raw = localStorage.getItem(REGISTRATION_DRAFT_KEY);
      if (raw) savedDraft = JSON.parse(raw);
    } catch (error) {
      savedDraft = null;
    }

    const draft = savedDraft || fallbackDraft;
    if (!draft) return;

    const dotDangKy = document.getElementById('dotDangKy');
    const topicName = document.getElementById('topicName');
    const researchField = document.getElementById('researchField');
    const researchGoal = document.getElementById('researchGoal');

    if (dotDangKy && draft.dot_dang_ky) dotDangKy.value = draft.dot_dang_ky;
    if (topicName && draft.de_tai_ten) topicName.value = draft.de_tai_ten;
    if (researchField && draft.linh_vuc) researchField.value = draft.linh_vuc;
    if (researchGoal && draft.muc_tieu_nghien_cuu) researchGoal.value = draft.muc_tieu_nghien_cuu;

    const teacherContainer = document.getElementById('teacherContainer');
    const btnAddTeacher = document.getElementById('btnAddTeacher');
    if (teacherContainer && btnAddTeacher && Array.isArray(draft.teachers) && draft.teachers.length > 0) {
      while (teacherContainer.querySelectorAll('.teacher-row').length < draft.teachers.length) {
        btnAddTeacher.click();
      }

      const teacherInputs = teacherContainer.querySelectorAll('input[name="gvhd_ten[]"]');
      draft.teachers.forEach((teacherName, index) => {
        if (teacherInputs[index]) teacherInputs[index].value = teacherName || '';
      });
    }

    const studentContainer = document.getElementById('studentContainer');
    const btnAddStudent = document.getElementById('btnAddStudent');
    if (studentContainer && btnAddStudent && Array.isArray(draft.students) && draft.students.length > 0) {
      while (studentContainer.querySelectorAll('.student-row').length < draft.students.length) {
        btnAddStudent.click();
      }

      const rows = studentContainer.querySelectorAll('.student-row');
      draft.students.forEach((student, index) => {
        const row = rows[index];
        if (!row) return;

        const setValue = (selector, value) => {
          const input = row.querySelector(selector);
          if (input && value !== undefined && value !== null) {
            input.value = value;
          }
        };

        setValue('.student-name', student.name);
        setValue('.student-mssv', student.mssv);
        setValue('.student-class', student.className);
        setValue('.student-khoa', student.khoa);
        setValue('.student-faculty', student.faculty);
        setValue('.student-dob', student.dob);
        setValue('.student-phone', student.phone);
        setValue('.student-email', student.email);
        setValue('.student-address', student.address);
      });
    }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', studentModuleInit); else studentModuleInit();
