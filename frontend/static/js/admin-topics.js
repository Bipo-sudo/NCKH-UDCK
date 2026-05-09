function adminTopicsAltInit() {
  let currentTopics = [];
  let filteredTopics = [];

  const tableBody = document.getElementById('topicsTableBody');
  if (!tableBody) return;

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
      1: '<span class="badge bg-secondary">Chờ duyệt đề cương</span>',
      2: '<span class="badge bg-warning text-dark">Yêu cầu sửa đề cương</span>',
      3: '<span class="badge bg-dark">Bị từ chối</span>',
      4: '<span class="badge bg-primary">Đang triển khai</span>',
      5: '<span class="badge bg-info text-dark">Chờ duyệt báo cáo</span>',
      6: '<span class="badge bg-warning text-dark">Yêu cầu sửa báo cáo</span>',
      7: '<span class="badge bg-primary">Chờ/Đang bảo vệ</span>',
      8: '<span class="badge bg-danger">Không đạt/Hủy</span>',
      9: '<span class="badge bg-success">Hoàn thành</span>'
    };
    return badges[status] || '<span class="badge bg-secondary">Không xác định</span>';
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
  }

  function statusMessage(message) {
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">${message}</td></tr>`;
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
    const yearFilterEl = document.getElementById('filterTopicYear');
    const statusFilterEl = document.getElementById('filterTopicStatus');
    const yearFilter = yearFilterEl?.value || '';
    const statusFilter = statusFilterEl?.value || '';

    filteredTopics = currentTopics.filter((topic) => {
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
            <button class="btn-action view" title="Xem chi tiết hồ sơ" onclick="showTopicDetail(${topic.id})" data-bs-toggle="offcanvas" data-bs-target="#topicDetailOffcanvas"><i class="fas fa-eye"></i></button>
            ${(topic.status === 1 || topic.status === 2 || topic.trang_thai === 1 || topic.trang_thai === 2) ? `
              <button class="btn-action approve" title="Duyệt đề tài" onclick="openAdminActionPrompt('stage2','approve', ${topic.id})"><i class="fas fa-check"></i></button>
              <button class="btn-action edit" title="Yêu cầu sửa" onclick="openAdminActionPrompt('stage2','revision', ${topic.id})"><i class="fas fa-edit"></i></button>
              <button class="btn-action reject" title="Từ chối" onclick="openAdminActionPrompt('stage2','reject', ${topic.id})"><i class="fas fa-times"></i></button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  function showTopicDetail(topicId) {
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

  function openAdminActionPrompt(stage, action, topicId) {
    let message = '';
    if (stage === 'stage2') {
      if (action === 'approve') message = 'Xác nhận duyệt đề tài này?';
      else if (action === 'revision') message = 'Nhập lý do yêu cầu chỉnh sửa đề xuất:';
      else if (action === 'reject') message = 'Nhập lý do từ chối đề tài:';
    } else if (stage === 'stage4') {
      if (action === 'accept') message = 'Xác nhận nghiệm thu Đạt đề tài này?';
      else if (action === 'revision') message = 'Nhập lý do Đạt nhưng cần sửa báo cáo:';
      else if (action === 'reject') message = 'Nhập lý do Không Đạt:';
    }

    if (action === 'approve' || action === 'accept') {
      if (window.confirm(message)) applyAdminAction(stage, action, topicId);
      return;
    }

    const reason = window.prompt(message);
    if (reason !== null) applyAdminAction(stage, action, topicId, reason);
  }

  async function applyAdminAction(stage, action, topicId, reason) {
    const actionName = action === 'accept' ? 'accept' : action === 'revision' ? 'revision' : action === 'reject' ? 'reject' : 'approve';
    try {
      const resp = await fetch(`/api/topics/${topicId}/${actionName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || '' })
      });
      if (!resp.ok) {
        alert('Lỗi khi thực hiện thao tác.');
        return;
      }
      await fetchTopics();
      renderTopicsTable();
    } catch (err) {
      alert('Không thể kết nối server.');
    }
  }

  function setupListeners() {
    const yearFilter = document.getElementById('filterTopicYear');
    const statusFilter = document.getElementById('filterTopicStatus');
    if (yearFilter) yearFilter.addEventListener('change', renderTopicsTable);
    if (statusFilter) statusFilter.addEventListener('change', renderTopicsTable);
  }

  window.showTopicDetail = showTopicDetail;
  window.openAdminActionPrompt = openAdminActionPrompt;
  window.applyAdminAction = applyAdminAction;

  (async function init() {
    await fetchTopics();
    if (!currentTopics.length) {
      statusMessage('Không có dữ liệu thực');
      return;
    }
    setupListeners();
    renderTopicsTable();
  })();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', adminTopicsAltInit); else adminTopicsAltInit();
