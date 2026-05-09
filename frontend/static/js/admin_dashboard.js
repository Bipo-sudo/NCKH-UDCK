function adminDashboardInit() {
  const yearSelect = document.getElementById('dashboardFilterYear');
  const periodSelect = document.getElementById('dashboardFilterPeriod');
  const facultySelect = document.getElementById('dashboardFilterFaculty');
  const exportButton = document.getElementById('btnExportDashboardReport');

  if (!yearSelect || !periodSelect || !facultySelect) return;

  let pieChartInstance = null;
  let barChartInstance = null;

  const statusMeta = {
    1: 'Chờ duyệt đề xuất',
    2: 'Yêu cầu sửa đề xuất',
    3: 'Bị từ chối',
    4: 'Đang thực hiện',
    5: 'Chờ nghiệm thu',
    6: 'Sửa báo cáo',
    7: 'Không đạt',
    8: 'Đã hoàn thành'
  };

  // Fetch topics from backend; no frontend mock data
  let currentTopics = [];
  async function fetchTopics() {
    try {
      const resp = await fetch('/api/topics');
      if (!resp.ok) {
        alert('Đang kết nối cơ sở dữ liệu...');
        return [];
      }
      const data = await resp.json();
      currentTopics = Array.isArray(data) ? data : [];
      return currentTopics;
    } catch (err) {
      alert('Đang kết nối cơ sở dữ liệu...');
      return [];
    }
  }

  function fillSelectOptions(selectElement, values, defaultText) {
    if (!selectElement) return;
    selectElement.innerHTML = `<option value="all">${defaultText}</option>` + values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  }

  function initFilterOptions(topics) {
    const years = [...new Set(topics.map(topic => topic.year))].sort((a, b) => b.localeCompare(a));
    const periods = [...new Set(topics.map(topic => topic.period))].sort((a, b) => a.localeCompare(b, 'vi'));
    const faculties = [...new Set(topics.map(topic => topic.faculty))].sort((a, b) => a.localeCompare(b, 'vi'));

    fillSelectOptions(yearSelect, years, 'Tất cả năm học');
    fillSelectOptions(periodSelect, periods, 'Tất cả đợt');
    fillSelectOptions(facultySelect, faculties, 'Tất cả khoa');
  }

  function getFilteredTopics(topics) {
    const year = yearSelect.value;
    const period = periodSelect.value;
    const faculty = facultySelect.value;

    return topics.filter((topic) => {
      const matchYear = year === 'all' || topic.year === year;
      const matchPeriod = period === 'all' || topic.period === period;
      const matchFaculty = faculty === 'all' || topic.faculty === faculty;
      return matchYear && matchPeriod && matchFaculty;
    });
  }

  function buildSummary(topics) {
    const total = topics.length;
    const inProgress = topics.filter(topic => [4, 5, 6].includes(topic.status)).length;
    const completed = topics.filter(topic => topic.status === 8).length;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

    return { total, inProgress, completed, completionRate };
  }

  function renderSummary(summary) {
    const totalEl = document.getElementById('summaryTotalTopics');
    const inProgressEl = document.getElementById('summaryInProgress');
    const completedEl = document.getElementById('summaryCompleted');
    const completionRateEl = document.getElementById('summaryCompletionRate');

    if (totalEl) totalEl.textContent = summary.total;
    if (inProgressEl) inProgressEl.textContent = summary.inProgress;
    if (completedEl) completedEl.textContent = summary.completed;
    if (completionRateEl) completionRateEl.textContent = `${summary.completionRate}%`;
  }

  function buildStatusChartData(topics) {
    const grouped = topics.reduce((acc, topic) => {
      const key = statusMeta[topic.status] || 'Không xác định';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      labels: Object.keys(grouped),
      values: Object.values(grouped)
    };
  }

  function buildFacultyChartData(topics) {
    const grouped = topics.reduce((acc, topic) => {
      acc[topic.faculty] = (acc[topic.faculty] || 0) + 1;
      return acc;
    }, {});

    return {
      labels: Object.keys(grouped),
      values: Object.values(grouped)
    };
  }

  function renderCharts(filteredTopics) {
    const pieCanvas = document.getElementById('topicsStatusPieChart');
    const barCanvas = document.getElementById('topicsByFacultyBarChart');
    if (!pieCanvas || !barCanvas || typeof Chart === 'undefined') return;

    const statusData = buildStatusChartData(filteredTopics);
    const facultyData = buildFacultyChartData(filteredTopics);

    if (pieChartInstance) pieChartInstance.destroy();
    if (barChartInstance) barChartInstance.destroy();

    pieChartInstance = new Chart(pieCanvas, {
      type: 'pie',
      data: {
        labels: statusData.labels,
        datasets: [{
          data: statusData.values,
          backgroundColor: ['#6c757d', '#ffc107', '#343a40', '#0d6efd', '#0dcaf0', '#fd7e14', '#dc3545', '#198754']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });

    barChartInstance = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels: facultyData.labels,
        datasets: [{
          label: 'Số lượng đề tài',
          data: facultyData.values,
          backgroundColor: '#0d6efd'
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        }
      }
    });
  }

  function updateDashboardStats() {
    const allTopics = currentTopics;
    const filteredTopics = getFilteredTopics(allTopics);
    const summary = buildSummary(filteredTopics);

    renderSummary(summary);
    renderCharts(filteredTopics);
  }

  function getSelectedLabel(selectElement, allText) {
    if (!selectElement) return allText;
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const value = selectElement.value;
    if (!selectedOption || value === 'all') return allText;
    return selectedOption.textContent;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char] || char));
  }

  (async function initDashboard() {
    const topicsSeed = await fetchTopics();
    if (!topicsSeed.length) {
      alert('Không có dữ liệu thực');
      return;
    }
    initFilterOptions(topicsSeed);
    updateDashboardStats();
  })();

  [yearSelect, periodSelect, facultySelect].forEach((select) => {
    select.addEventListener('change', updateDashboardStats);
  });

  if (exportButton) {
    exportButton.addEventListener('click', function () {
      const selectedYear = getSelectedLabel(yearSelect, 'Tất cả năm học');
      const selectedPeriod = getSelectedLabel(periodSelect, 'Tất cả đợt');
      alert(`Tính năng xuất file đang được giả lập. Hệ thống sẽ tải xuống file Excel báo cáo của ${selectedYear} / ${selectedPeriod} đang chọn.`);
    });
  }

  // updateDashboardStats will be called after initial fetch in initDashboard
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', adminDashboardInit); else adminDashboardInit();
