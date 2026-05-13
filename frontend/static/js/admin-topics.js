function adminTopicsAltInit() {
  let currentTopics = [];
  let filteredTopics = [];
  const ui = window.AdminUi;

  const tableBody = document.getElementById('topicsTableBody');
  const hasTopicsTable = !!tableBody;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char] || char));
  }

  function getStatusBadge(status) {
  const badges = {
    1: '<span class="badge bg-secondary">Chờ duyệt đề xuất</span>',
    2: '<span class="badge bg-warning text-dark">Yêu cầu sửa đề xuất</span>',
    3: '<span class="badge bg-primary">Đã duyệt</span>',
    4: '<span class="badge bg-dark">Không duyệt</span>',
    5: '<span class="badge bg-primary">Đang thực hiện</span>',
    6: '<span class="badge bg-secondary">Chưa nộp báo cáo</span>',
    7: '<span class="badge bg-info text-dark">Đã nộp báo cáo</span>',
    8: '<span class="badge bg-warning text-dark">Yêu cầu sửa báo cáo</span>',
    9: '<span class="badge bg-info">Chờ bảo vệ</span>',
    10: '<span class="badge bg-success">Hoàn thành</span>',
    11: '<span class="badge bg-danger">Không thành công</span>',
    12: '<span class="badge bg-danger">Bị hủy</span>',
  };
  return badges[Number(status)] || '<span class="badge bg-secondary">Không xác định</span>';
}

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
  }

  function statusMessage(message) {
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">${message}</td></tr>`;
  }

  function getTopicPeriodPhase(topic) {
    return Number(
      topic?.dot?.trang_thai_dot
      ?? topic?.dot?.trangThaiDot
      ?? topic?.period?.trang_thai_dot
      ?? topic?.period?.trangThaiDot
      ?? topic?.trang_thai_dot
      ?? topic?.trangThaiDot
      ?? 0
    );
  }

  async function fetchTopics() {
    try {
      const resp = await fetch('/api/topics');
      if (!resp.ok) {
        statusMessage('Đang kết nối cơ sở dữ liệu...');
        return [];
      }
      const data = await resp.json();
      currentTopics = Array.isArray(data) ? data : [];
      filteredTopics = [...currentTopics];
      return currentTopics;
    } catch (err) {
      statusMessage('Đang kết nối cơ sở dữ liệu...');
      return [];
    }
  }

  function renderTopicsTable() {
    if (!tableBody) return;

    const yearFilterEl = document.getElementById('filterTopicYear');
    const statusFilterEl = document.getElementById('filterTopicStatus');
    const yearFilter = yearFilterEl?.value || '';
    const statusFilter = statusFilterEl?.value || '';

    filteredTopics = currentTopics.filter((topic) => {
      if (getTopicPeriodPhase(topic) === 5 && Number(topic.status || topic.trang_thai || 0) !== 9) {
        return false;
      }
      const matchYear = !yearFilter || String(topic.year || topic.nam_hoc || '').includes(yearFilter);
      const matchStatus = !statusFilter || String(topic.status || topic.trang_thai || '') === String(statusFilter);
      return matchYear && matchStatus;
    });

    if (!filteredTopics.length) {
      statusMessage('Không có dữ liệu thực');
      return;
    }

    tableBody.innerHTML = filteredTopics.map((topic) => `
      <tr>
        <td>
          <strong>${escapeHtml(topic.code || `DT-${topic.id}`)}</strong><br>
          <small class="text-muted">${escapeHtml(topic.tac_gia?.mssv || topic.authors?.[0]?.mssv || '')}</small>
        </td>
        <td>
          <strong>${escapeHtml(topic.title || topic.ten_de_tai || '')}</strong><br>
          <small class="text-muted">${escapeHtml(topic.tac_gia?.name || topic.tac_gia?.ho_ten || topic.authors?.[0]?.name || '')}</small>
        </td>
        <td>${escapeHtml(topic.year || topic.nam_hoc || '')}</td>
        <td>${getStatusBadge(topic.status || topic.trang_thai)}</td>
        <td>${formatDate(topic.created_at || topic.updated_at)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-action view" title="Xem chi tiết hồ sơ" onclick="showTopicDetailById(${topic.id})" data-bs-toggle="offcanvas" data-bs-target="#topicDetailOffcanvas"><i class="fas fa-eye"></i></button>
            ${(topic.status === 1 || topic.status === 2 || topic.trang_thai === 1 || topic.trang_thai === 2) ? `
                  <button class="btn-action approve" title="Duyệt đề tài" onclick="applyAdminAction('stage2','approve', ${topic.id})"><i class="fas fa-check"></i></button>
              <button class="btn-action edit" title="Yêu cầu sửa" onclick="openAdminActionPrompt('stage2','revision', ${topic.id})"><i class="fas fa-edit"></i></button>
              <button class="btn-action reject" title="Từ chối" onclick="openAdminActionPrompt('stage2','reject', ${topic.id})"><i class="fas fa-times"></i></button>
                ` : ''}
            ${(topic.status === 7 || topic.trang_thai === 7 || topic.status === 8 || topic.trang_thai === 8) ? `
                  <button class="btn-action approve" title="Duyệt báo cáo" onclick="applyAdminAction('stage4','approve_report', ${topic.id})"><i class="fas fa-check"></i></button>
              <button class="btn-action edit" title="Yêu cầu sửa BC" onclick="openAdminActionPrompt('stage4','require_report_revision', ${topic.id})"><i class="fas fa-pen"></i></button>
                ` : ''}
            ${(topic.status === 9 || topic.trang_thai === 9) ? `
                  <button class="btn-action approve" title="Chấm điểm/Hoàn thành" onclick="openGradingModal(${topic.id})"><i class="fas fa-trophy"></i></button>
              <button class="btn-action reject" title="Không thành công" onclick="openAdminActionPrompt('stage5','fail_defense', ${topic.id})"><i class="fas fa-times"></i></button>
                ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  function showTopicDetailById(topicId) {
    const topic = currentTopics.find((item) => Number(item.id) === Number(topicId));
    if (!topic) return;

    const titleEl = document.getElementById('topicDetailTitle');
    const contentEl = document.getElementById('topicDetailContent');
    if (!titleEl || !contentEl) return;

    titleEl.textContent = `Chi tiết hồ sơ - ${topic.code || topic.ten_de_tai || topic.id}`;
    const authors = Array.isArray(topic.authors) ? topic.authors : [];
    const authorsHtml = authors.map((author) => `
      <div class="card mb-3">
        <div class="card-body">
          <p class="mb-1"><strong>Họ tên:</strong> ${escapeHtml(author.name || author.ho_ten || '')}</p>
          <p class="mb-1"><strong>MSSV:</strong> ${escapeHtml(author.mssv || '')}</p>
          <p class="mb-1"><strong>Lớp:</strong> ${escapeHtml(author.className || author.lop || '')}</p>
          <p class="mb-1"><strong>SĐT:</strong> ${escapeHtml(author.phone || '')}</p>
          <p class="mb-1"><strong>Email:</strong> ${escapeHtml(author.email || '')}</p>
        </div>
      </div>
    `).join('');

    contentEl.innerHTML = `
      <section class="mb-4">
        <h5 class="fw-bold mb-2">${escapeHtml(topic.title || topic.ten_de_tai || '')}</h5>
        <p class="mb-1"><strong>Đợt đăng ký:</strong> ${escapeHtml(topic.period || topic.nam_hoc || '')}</p>
        <p class="mb-1"><strong>Lĩnh vực:</strong> ${escapeHtml(topic.field || topic.linh_vuc || '')}</p>
        <p class="mb-0"><strong>Mục tiêu nghiên cứu:</strong> ${escapeHtml(topic.objective || topic.muc_tieu || '')}</p>
      </section>
      <hr>
      <section class="mb-4">
        <h5 class="fw-bold">Nhóm tác giả</h5>
        ${authorsHtml || '<div class="text-muted">Chưa có dữ liệu tác giả.</div>'}
      </section>
      <hr>
      <section>
        <h5 class="fw-bold mb-3">Tài liệu đính kèm</h5>
        <div class="text-muted">Dữ liệu file sẽ hiển thị khi backend trả về trường tương ứng.</div>
      </section>
      <hr>
      <section><div id="detailActionButtons" class="d-flex justify-content-end gap-2"></div></section>
    `;

    renderDetailActionButtons(topic.status || topic.trang_thai, topic.id);
  }

  function renderDetailActionButtons(status, topicId) {
    const container = document.getElementById('detailActionButtons');
    if (!container) return;

    if (status === 1 || status === 2) {
      container.innerHTML = `
        <button class="btn btn-success" onclick="openAdminActionPrompt('stage2','approve', ${topicId})">Duyệt đề tài</button>
        <button class="btn btn-warning" onclick="openAdminActionPrompt('stage2','revision', ${topicId})">Yêu cầu sửa</button>
        <button class="btn btn-danger" onclick="openAdminActionPrompt('stage2','reject', ${topicId})">Từ chối</button>
        <button class="btn btn-secondary" data-bs-dismiss="offcanvas">Đóng</button>
      `;
      return;
    }

    if (status === 5 || status === 6) {
      container.innerHTML = `
        <button class="btn btn-success" onclick="openAdminActionPrompt('stage4','accept', ${topicId})">Nghiệm thu Đạt</button>
        <button class="btn btn-warning" onclick="openAdminActionPrompt('stage4','revision', ${topicId})">Đạt nhưng cần sửa</button>
        <button class="btn btn-danger" onclick="openAdminActionPrompt('stage4','reject', ${topicId})">Không Đạt</button>
        <button class="btn btn-secondary" data-bs-dismiss="offcanvas">Đóng</button>
      `;
      return;
    }

    container.innerHTML = '<button class="btn btn-secondary" data-bs-dismiss="offcanvas">Đóng</button>';
  }

  async function openAdminActionPrompt(stage, action, topicId) {
    let title = 'Xác nhận thao tác';
    let message = '';
    let requireReason = false;
    let confirmText = 'Xác nhận';
    let confirmVariant = 'primary';
    if (stage === 'stage2') {
      if (action === 'approve') {
        title = 'Duyệt đề tài';
        message = 'Xác nhận duyệt đề tài này?';
        confirmText = 'Duyệt';
        confirmVariant = 'success';
      } else if (action === 'revision') {
        title = 'Yêu cầu sửa đề tài';
        message = 'Nhập lý do yêu cầu chỉnh sửa đề xuất:';
        requireReason = true;
      } else if (action === 'reject') {
        title = 'Từ chối đề tài';
        message = 'Nhập lý do từ chối đề tài:';
        requireReason = true;
        confirmText = 'Từ chối';
        confirmVariant = 'danger';
      }
    } else if (stage === 'stage4') {
      if (action === 'accept') {
        title = 'Nghiệm thu đề tài';
        message = 'Xác nhận nghiệm thu Đạt đề tài này?';
        confirmText = 'Đạt';
        confirmVariant = 'success';
      } else if (action === 'revision') {
        title = 'Yêu cầu sửa báo cáo';
        message = 'Nhập lý do Đạt nhưng cần sửa báo cáo:';
        requireReason = true;
      } else if (action === 'reject') {
        title = 'Không đạt';
        message = 'Nhập lý do Không Đạt:';
        requireReason = true;
        confirmText = 'Không đạt';
        confirmVariant = 'danger';
      }
    }

    const result = ui && ui.confirmDialog
      ? await ui.confirmDialog({
          title,
          message,
          confirmText,
          confirmVariant,
          requireReason,
          reasonPlaceholder: message,
        })
      : { confirmed: true, reason: '' };

    if (!result.confirmed) return;
    await applyAdminAction(stage, action, topicId, result.reason || '');
  }

  async function applyAdminAction(stage, action, topicId, reason) {
    // Use the provided action string directly (it will be passed to the API)
    const actionName = action;
    try {
      const resp = await fetch(`/api/topics/${topicId}/${actionName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || '' })
      });
      if (!resp.ok) {
        if (ui && ui.showToast) ui.showToast({ title: 'Lỗi', message: 'Lỗi khi thực hiện thao tác.', variant: 'danger' });
        else alert('Lỗi khi thực hiện thao tác.');
        return;
      }
      await fetchTopics();
      renderTopicsTable();
      if (ui && ui.showToast) ui.showToast({ title: 'Thành công', message: 'Đã cập nhật đề tài thành công.' });
    } catch (err) {
      if (ui && ui.showToast) ui.showToast({ title: 'Lỗi', message: 'Không thể kết nối server.', variant: 'danger' });
      else alert('Không thể kết nối server.');
    }
  }

  function setupListeners() {
    const yearFilter = document.getElementById('filterTopicYear');
    const statusFilter = document.getElementById('filterTopicStatus');
    if (yearFilter) yearFilter.addEventListener('change', renderTopicsTable);
    if (statusFilter) statusFilter.addEventListener('change', renderTopicsTable);
  }

  function actionButtonsForActive(topic) {
    const topicId = Number(topic.id);
    const status = Number(topic.status || topic.trang_thai || 0);

    // Proposal stage (1,2): Duyệt / Yêu cầu sửa / Từ chối
    if (status === 1 || status === 2) {
      return `
        <div class="action-buttons">
          <button class="btn-action view" title="Xem chi tiết" onclick="showTopicDetailById(${topicId})"><i class="fas fa-eye"></i></button>
          <button class="btn-action approve" title="Duyệt đề tài" onclick="applyAdminAction('stage2','approve', ${topicId})"><i class="fas fa-check"></i></button>
          <button class="btn-action edit" title="Yêu cầu sửa" onclick="openAdminActionPrompt('stage2','revision', ${topicId})"><i class="fas fa-edit"></i></button>
          <button class="btn-action reject" title="Từ chối" onclick="openAdminActionPrompt('stage2','reject', ${topicId})"><i class="fas fa-times"></i></button>
        </div>
      `;
    }

    // Report submitted or report revision (7,8): Duyệt báo cáo / Yêu cầu sửa
    if (status === 7 || status === 8) {
      return `
        <div class="action-buttons">
          <button class="btn-action view" title="Xem chi tiết" onclick="showTopicDetailById(${topicId})"><i class="fas fa-eye"></i></button>
          <button class="btn-action approve" title="Duyệt báo cáo" onclick="applyAdminAction('stage4','approve_report', ${topicId})"><i class="fas fa-check"></i></button>
          <button class="btn-action edit" title="Yêu cầu sửa BC" onclick="openAdminActionPrompt('stage4','revision', ${topicId})"><i class="fas fa-pen"></i></button>
        </div>
      `;
    }

    // Waiting for defense (9): Grade / Fail
    if (status === 9) {
      return `
        <div class="action-buttons">
          <button class="btn-action view" title="Xem chi tiết" onclick="showTopicDetailById(${topicId})"><i class="fas fa-eye"></i></button>
          <button class="btn-action approve" title="Chấm điểm/Hoàn thành" onclick="openGradingModal(${topicId})"><i class="fas fa-trophy"></i></button>
          <button class="btn-action reject" title="Không thành công" onclick="openAdminActionPrompt('stage5','fail_defense', ${topicId})"><i class="fas fa-times"></i></button>
        </div>
      `;
    }

    // Default: only view
    return `
      <div class="action-buttons">
        <button class="btn-action view" title="Xem chi tiết" onclick="showTopicDetailById(${topicId})"><i class="fas fa-eye"></i></button>
      </div>
    `;
}

  window.openGradingModal = function(topicId) {
    // Ràng buộc cấp bậc tự động từ dữ liệu đợt
    const topic = currentTopics.find(t => Number(t.id) === Number(topicId));
    const capBacDot = topic && topic.dot ? topic.dot.cap_bac : '';
    const levelInput = document.getElementById('awardLevelInput');
    
    if (levelInput && capBacDot) {
        levelInput.value = capBacDot;
        levelInput.disabled = true; // Khóa lại không cho chọn sai
    } else if (levelInput) {
        levelInput.disabled = false;
    }

    // Gắn sự kiện cho nút Lưu
    const btnSave = document.getElementById('btnSaveAward');
    if (btnSave) {
        btnSave.onclick = function() { submitGrading(topicId); };
    }

    // Hiển thị modal đã có sẵn trong HTML
    const modalEl = document.getElementById('awardModal');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

window.submitGrading = async function(topicId) {
    const capGiai = document.getElementById('awardLevelInput').value;
    const xepLoai = document.getElementById('awardRankInput').value;

    try {
        const resp = await fetch(`/api/topics/${topicId}/grade`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cap_giai: capGiai, xep_loai: xepLoai })
        });

        if (!resp.ok) throw new Error('Không thể lưu kết quả');
        
        if (ui && ui.showToast) ui.showToast({ title: 'Thành công', message: 'Đã ghi nhận điểm và giải thưởng thành công!' });
        else alert('Đã ghi nhận điểm và giải thưởng thành công!');
        bootstrap.Modal.getInstance(document.getElementById('awardModal')).hide();
        
        // Tải lại danh sách
        await fetchTopics(currentPeriodId);
    } catch (err) {
        if (ui && ui.showToast) ui.showToast({ title: 'Lỗi', message: err.message, variant: 'danger' });
        else alert(err.message);
    }
};

  window.showTopicDetailById = showTopicDetailById;
  window.openGradingModal = openGradingModal;
  window.submitGrading = submitGrading;
  window.openAdminActionPrompt = openAdminActionPrompt;
  window.applyAdminAction = applyAdminAction;

  (async function init() {
    if (hasTopicsTable) {
      await fetchTopics();
      if (!currentTopics.length) {
        statusMessage('Không có dữ liệu thực');
        return;
      }
      setupListeners();
      renderTopicsTable();
    }
  })();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', adminTopicsAltInit); else adminTopicsAltInit();
