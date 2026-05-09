let currentTopics = [];
let filteredTopics = [];
let currentPeriods = [];
let currentPeriodId = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, function (char) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char] || char;
  });
}

function toNumberStatus(topic) {
  return Number(topic?.trang_thai ?? topic?.status ?? 0);
}

function getSchoolYear(topic) {
  return String(topic?.nam_hoc ?? topic?.namHoc ?? topic?.dot?.nam_hoc ?? topic?.dot?.namHoc ?? '').trim();
}

function getTopicCode(topic) {
  return topic?.code || topic?.ma || ('DT-' + topic.id);
}

function getTopicTitle(topic) {
  return topic?.ten_de_tai || topic?.title || '';
}

function getTopicOwner(topic) {
  if (topic?.chu_nhiem) {
    return topic.chu_nhiem.ho_ten || topic.chu_nhiem.name || topic.chu_nhiem.mssv || '';
  }
  if (topic?.tac_gia) {
    return topic.tac_gia.ho_ten || topic.tac_gia.name || topic.tac_gia.mssv || '';
  }
  if (Array.isArray(topic?.authors) && topic.authors.length > 0) {
    const first = topic.authors[0];
    return first.ho_ten || first.name || first.mssv || '';
  }
  return '';
}

function getTopicUpdatedAt(topic) {
  return topic?.updated_at || topic?.updatedAt || topic?.ngay_cap_nhat || topic?.ngayCapNhat || topic?.created_at || topic?.createdAt || null;
}

function getTopicReason(topic) {
  return topic?.ly_do || topic?.lyDo || '';
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
  return badges[Number(status)] || '<span class="badge bg-secondary">Không xác định</span>';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN');
}

function actionButtonsForActive(topic) {
  const topicId = Number(topic.id);
  const status = toNumberStatus(topic);

  if (status === 5) {
    return `
      <div class="action-buttons">
        <button class="btn-action view" title="Xem chi tiết" onclick="showTopicDetail(${topicId})"><i class="fas fa-eye"></i></button>
        <button class="btn-action approve" title="Nghiệm thu Đạt" onclick="openAdminActionPrompt('stage4','accept', ${topicId})"><i class="fas fa-check"></i></button>
        <button class="btn-action edit" title="Yêu cầu sửa BC" onclick="openAdminActionPrompt('stage4','revision', ${topicId})"><i class="fas fa-pen"></i></button>
        <button class="btn-action reject" title="Không đạt" onclick="openAdminActionPrompt('stage4','reject', ${topicId})"><i class="fas fa-times"></i></button>
      </div>
    `;
  }

  if (status === 6) {
    return `
      <div class="action-buttons">
        <button class="btn-action view" title="Xem chi tiết" onclick="showTopicDetail(${topicId})"><i class="fas fa-eye"></i></button>
        <button class="btn-action approve" title="Nghiệm thu Đạt" onclick="openAdminActionPrompt('stage4','accept', ${topicId})"><i class="fas fa-check"></i></button>
        <button class="btn-action edit" title="Yêu cầu sửa BC" onclick="openAdminActionPrompt('stage4','revision', ${topicId})"><i class="fas fa-pen"></i></button>
        <button class="btn-action reject" title="Không đạt" onclick="openAdminActionPrompt('stage4','reject', ${topicId})"><i class="fas fa-times"></i></button>
      </div>
    `;
  }

  if (status === 4) {
    return `
      <div class="action-buttons">
        <button class="btn-action view" title="Xem chi tiết" onclick="showTopicDetail(${topicId})"><i class="fas fa-eye"></i></button>
      </div>
    `;
  }

  return `
    <div class="action-buttons">
      <button class="btn-action view" title="Xem chi tiết" onclick="showTopicDetail(${topicId})"><i class="fas fa-eye"></i></button>
    </div>
  `;
}

function actionButtonsForArchived(topic) {
  return `
    <div class="action-buttons">
      <button class="btn-action view" title="Xem chi tiết" onclick="showTopicDetail(${Number(topic.id)})"><i class="fas fa-eye"></i></button>
    </div>
  `;
}

function getPeriodByTopic(topic) {
  const dotId = Number(topic?.dot_id ?? topic?.dotDangKyId ?? topic?.dot_dang_ky_id ?? 0);
  if (!dotId) return null;
  return currentPeriods.find(function (period) {
    return Number(period.id) === dotId;
  }) || null;
}

function isArchivedTopic(topic, now) {
  const status = toNumberStatus(topic);
  if (status === 3) {
    return true;
  }

  if (status !== 1 && status !== 2) {
    return false;
  }

  const period = getPeriodByTopic(topic);
  const deCuongDeadlineRaw = topic?.dot?.han_nop_de_cuong
    ?? topic?.dot?.hanNopDeCuong
    ?? period?.han_nop_de_cuong
    ?? period?.hanNopDeCuong;

  if (!deCuongDeadlineRaw) {
    return false;
  }

  const deCuongDeadline = new Date(deCuongDeadlineRaw);
  if (Number.isNaN(deCuongDeadline.getTime())) {
    return false;
  }

  return now > deCuongDeadline;
}

function applyFilters(topics) {
  const keywordEl = document.getElementById('filterKeyword');
  const yearEl = document.getElementById('filterYear');
  const statusEl = document.getElementById('filterStatus');

  const keyword = String(keywordEl?.value || '').trim().toLowerCase();
  const year = String(yearEl?.value || '').trim();
  const status = String(statusEl?.value || '').trim();

  return topics.filter(function (topic) {
    const statusValue = String(toNumberStatus(topic));
    const schoolYear = getSchoolYear(topic);
    const searchable = [getTopicCode(topic), getTopicTitle(topic), getTopicOwner(topic), topic?.chu_nhiem?.mssv || '']
      .join(' ')
      .toLowerCase();

    const matchKeyword = !keyword || searchable.includes(keyword);
    const matchYear = !year || schoolYear === year;
    const matchStatus = !status || statusValue === status;
    return matchKeyword && matchYear && matchStatus;
  });
}

function renderTopics(topics) {
  const activeBody = document.getElementById('activeTopicsTableBody') || document.getElementById('topicsTableBody');
  const archiveBody = document.getElementById('archiveTopicsTableBody');
  if (!activeBody) return;

  const now = new Date();
  const activeTopics = [];
  const archivedTopics = [];

  topics.forEach(function (topic) {
    if (isArchivedTopic(topic, now)) {
      archivedTopics.push(topic);
    } else {
      activeTopics.push(topic);
    }
  });

  const filteredActive = applyFilters(activeTopics);
  const filteredArchived = applyFilters(archivedTopics);
  filteredTopics = filteredActive;

  if (!filteredActive.length) {
    activeBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Không có đề tài trong danh sách chính.</td></tr>';
  } else {
    activeBody.innerHTML = filteredActive.map(function (topic) {
      return `
        <tr>
          <td>
            <strong>${escapeHtml(getTopicCode(topic))}</strong><br>
            <small class="text-muted">${escapeHtml(topic?.chu_nhiem?.mssv || topic?.tac_gia?.mssv || '')}</small>
          </td>
          <td>
            <strong>${escapeHtml(getTopicTitle(topic))}</strong><br>
            <small class="text-muted">GVHD: ${escapeHtml(topic?.giang_vien_hd || topic?.giang_vien_huong_dan || '-')}</small>
          </td>
          <td>${escapeHtml(getTopicOwner(topic) || '-')}</td>
          <td>${escapeHtml(getSchoolYear(topic) || '-')}</td>
          <td>${getStatusBadge(toNumberStatus(topic))}</td>
          <td>${escapeHtml(topic?.cap_giai_thuong || topic?.capGiaiThuong || '-')}</td>
          <td>${escapeHtml(formatDate(getTopicUpdatedAt(topic)))}</td>
          <td>${actionButtonsForActive(topic)}</td>
        </tr>
      `;
    }).join('');
  }

  if (archiveBody) {
    if (!filteredArchived.length) {
      archiveBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Không có đề tài quá hạn hoặc bị hủy.</td></tr>';
    } else {
      archiveBody.innerHTML = filteredArchived.map(function (topic) {
        return `
          <tr>
            <td><strong>${escapeHtml(getTopicCode(topic))}</strong></td>
            <td>${escapeHtml(getTopicTitle(topic))}</td>
            <td>${escapeHtml(getTopicOwner(topic) || '-')}</td>
            <td>${getStatusBadge(toNumberStatus(topic))}</td>
            <td>${escapeHtml(getTopicReason(topic) || 'Quá hạn qua mốc đề cương')}</td>
            <td>${escapeHtml(formatDate(getTopicUpdatedAt(topic)))}</td>
            <td>${actionButtonsForArchived(topic)}</td>
          </tr>
        `;
      }).join('');
    }
  }
}

async function fetchTopics(periodId) {
  try {
    let url = '/api/topics';
    if (periodId) {
      url += '?dot_id=' + periodId;
    }

    const response = await fetch(url);
    if (!response.ok) {
      currentTopics = [];
      renderTopics([]);
      return [];
    }

    const topics = await response.json();
    currentTopics = Array.isArray(topics) ? topics : [];
    renderTopics(currentTopics);
    return currentTopics;
  } catch (error) {
    currentTopics = [];
    renderTopics([]);
    return [];
  }
}

function updateCurrentPeriodContext(period) {
  const nameEl = document.getElementById('currentPeriodName');
  const stateTextEl = document.getElementById('currentPeriodStateText');
  const stateBadgeEl = document.getElementById('currentPeriodStateBadge');
  const capBacBadgeEl = document.getElementById('currentPeriodCapBacBadge');

  const status = Number(period?.trang_thai_dot ?? period?.trangThaiDot ?? 0);
  const statusMap = {
    1: { text: 'Chưa mở đăng ký', badge: 'bg-secondary' },
    2: { text: 'Đang mở đăng ký', badge: 'bg-success' },
    3: { text: 'Đang nộp báo cáo', badge: 'bg-warning text-dark' },
    4: { text: 'Đã kết thúc', badge: 'bg-dark' }
  };
  const state = statusMap[status] || { text: 'Không xác định', badge: 'bg-secondary' };

  if (nameEl) {
    nameEl.textContent = period?.ten_dot || period?.tenDot || '-';
  }
  if (stateTextEl) {
    stateTextEl.textContent = state.text;
  }
  if (stateBadgeEl) {
    stateBadgeEl.className = 'badge ' + state.badge;
    stateBadgeEl.textContent = state.text;
  }
  if (capBacBadgeEl) {
    capBacBadgeEl.textContent = period?.cap_bac || period?.capBac || '-';
  }
}

async function fetchPeriods() {
  try {
    const response = await fetch('/api/periods');
    if (!response.ok) {
      currentPeriods = [];
      currentPeriodId = null;
      updateCurrentPeriodContext(null);
      await fetchTopics(null);
      return;
    }

    const periods = await response.json();
    currentPeriods = Array.isArray(periods) ? periods : [];

    const activePeriod = currentPeriods.find(function (period) {
      return Number(period.trang_thai_dot ?? period.trangThaiDot ?? 0) !== 4;
    }) || currentPeriods[0] || null;

    currentPeriodId = activePeriod ? activePeriod.id : null;
    updateCurrentPeriodContext(activePeriod);

    await fetchTopics(currentPeriodId);
  } catch (error) {
    currentPeriods = [];
    currentPeriodId = null;
    updateCurrentPeriodContext(null);
    await fetchTopics(null);
  }
}

function showTopicDetail(topicId) {
  const topic = currentTopics.find(function (item) {
    return Number(item.id) === Number(topicId);
  });
  if (!topic) return;

  const contentEl = document.getElementById('topicDetailContent');
  const actionsEl = document.getElementById('detailActionButtons');
  if (!contentEl || !actionsEl) return;

  const status = toNumberStatus(topic);
  const modalEl = document.getElementById('topicDetailModal');

  contentEl.innerHTML = `
    <section class="mb-3">
      <h4 class="fw-bold mb-2">${escapeHtml(getTopicTitle(topic))}</h4>
      <p class="mb-1"><strong>Mã đề tài:</strong> ${escapeHtml(getTopicCode(topic))}</p>
      <p class="mb-1"><strong>Tác giả:</strong> ${escapeHtml(getTopicOwner(topic) || '-')}</p>
      <p class="mb-1"><strong>Đợt/Năm học:</strong> ${escapeHtml(topic?.dot?.ten_dot || topic?.dot?.tenDot || '-')} (${escapeHtml(getSchoolYear(topic) || '-')})</p>
      <p class="mb-1"><strong>Trạng thái:</strong> ${getStatusBadge(status)}</p>
      <p class="mb-0"><strong>Lý do:</strong> ${escapeHtml(getTopicReason(topic) || '-')}</p>
    </section>
  `;

  if (status === 5 || status === 6) {
    actionsEl.innerHTML = `
      <button class="btn btn-success" onclick="openAdminActionPrompt('stage4','accept', ${Number(topic.id)})">Nghiệm thu Đạt</button>
      <button class="btn btn-warning" onclick="openAdminActionPrompt('stage4','revision', ${Number(topic.id)})">Yêu cầu sửa BC</button>
      <button class="btn btn-danger" onclick="openAdminActionPrompt('stage4','reject', ${Number(topic.id)})">Không Đạt</button>
      <button class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
    `;
  } else {
    actionsEl.innerHTML = '<button class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>';
  }

  if (modalEl) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
}

function openAdminActionPrompt(stage, action, topicId) {
  let message = '';
  if (stage === 'stage4') {
    if (action === 'accept') message = 'Xác nhận nghiệm thu Đạt đề tài này?';
    if (action === 'revision') message = 'Nhập lý do yêu cầu sửa báo cáo:';
    if (action === 'reject') message = 'Nhập lý do Không Đạt:';
  }

  if (action === 'accept') {
    if (window.confirm(message)) {
      applyAdminAction(action, topicId, '');
    }
    return;
  }

  const reason = window.prompt(message);
  if (reason !== null) {
    applyAdminAction(action, topicId, reason);
  }
}

async function applyAdminAction(action, topicId, reason) {
  try {
    const resp = await fetch('/api/topics/' + Number(topicId) + '/' + action, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || '' })
    });

    if (!resp.ok) {
      let msg = 'Lỗi khi thực hiện thao tác.';
      try {
        const err = await resp.json();
        if (err?.error) msg = err.error;
      } catch (error) {
        // no-op
      }
      alert(msg);
      return;
    }

    alert('Cập nhật trạng thái thành công!');
    await fetchTopics(currentPeriodId);
  } catch (error) {
    alert('Không thể kết nối server.');
  }
}

function setupListeners() {
  const yearFilter = document.getElementById('filterYear');
  const statusFilter = document.getElementById('filterStatus');
  const keywordFilter = document.getElementById('filterKeyword');
  const resetBtn = document.getElementById('btnResetTopicFilters');

  if (yearFilter) {
    yearFilter.addEventListener('change', function () {
      renderTopics(currentTopics);
    });
  }
  if (statusFilter) {
    statusFilter.addEventListener('change', function () {
      renderTopics(currentTopics);
    });
  }
  if (keywordFilter) {
    keywordFilter.addEventListener('input', function () {
      renderTopics(currentTopics);
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (yearFilter) yearFilter.value = '';
      if (statusFilter) statusFilter.value = '';
      if (keywordFilter) keywordFilter.value = '';
      renderTopics(currentTopics);
    });
  }
}

function startApp() {
  setupListeners();
  fetchPeriods();
}

window.renderTopics = renderTopics;
window.showTopicDetail = showTopicDetail;
window.openAdminActionPrompt = openAdminActionPrompt;
window.applyAdminAction = applyAdminAction;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
