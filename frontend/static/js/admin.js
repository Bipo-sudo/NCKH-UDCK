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
function confirmDelete(message) {
  return confirm(message || 'Bạn có chắc chắn muốn xóa?');
}

// Confirm action
function confirmAction(message) {
  return confirm(message || 'Bạn có chắc chắn?');
}
