(function () {
  function normalizePeriodName(value) {
    return (value || '').replace('Năm học', 'Đợt NCKH').trim();
  }

  function computePeriodState(period) {
    if (!period) return 4;
    if (period.trangThaiDot) return Number(period.trangThaiDot);

    const now = new Date();
    const openAt = new Date(period.thoiGianMoDangKy);
    const proposalDeadline = new Date(period.hanNopDeCuong);
    const reportDeadline = new Date(period.hanNopBaoCao);

    if (Number.isNaN(openAt.getTime()) || Number.isNaN(proposalDeadline.getTime()) || Number.isNaN(reportDeadline.getTime())) {
      return 4;
    }

    if (now < openAt) return 1;
    if (now < proposalDeadline) return 2;
    if (now < reportDeadline) return 3;
    return 4;
  }

  function getPeriodStateForTopic(topic, periods) {
    if (!topic || !Array.isArray(periods) || !periods.length) {
      return 4;
    }

    const normalizedTopicPeriod = normalizePeriodName(topic.period);
    const matched = periods.find((period) => normalizePeriodName(period.namHoc) === normalizedTopicPeriod);
    return computePeriodState(matched || periods[0]);
  }

  function applyMockAutoFail(topics, periods) {
    if (!Array.isArray(topics)) return;

    topics.forEach(function (topic) {
      const periodState = getPeriodStateForTopic(topic, periods);

      if (periodState >= 3 && topic.status === 4 && topic.daKyXacNhan === false) {
        topic.status = 8;
        topic.reason = 'Tự động rớt do hết hạn đăng ký nhưng chưa ký xác nhận.';
      }

      if (periodState >= 4 && topic.status === 4 && topic.daNopBaoCao !== true) {
        topic.status = 8;
        topic.reason = 'Tự động rớt do hết hạn báo cáo mà chưa nộp báo cáo tổng kết.';
      }
    });
  }

  function evaluateSubmissionLock(topic, periods) {
    if (!topic || topic.status !== 4) {
      return {
        locked: false,
        periodState: null,
        message: '',
        allowSubmit: topic && topic.status === 4,
      };
    }

    const periodState = getPeriodStateForTopic(topic, periods);

    if (periodState === 2) {
      return {
        locked: true,
        allowSubmit: false,
        periodState,
        message: 'Chưa đến thời gian nộp báo cáo. Vui lòng chờ đến giai đoạn Triển khai.',
      };
    }

    if (periodState === 3) {
      return {
        locked: false,
        allowSubmit: true,
        periodState,
        message: '',
      };
    }

    return {
      locked: true,
      allowSubmit: false,
      periodState,
      message: 'Đợt NCKH hiện tại đã đóng nộp báo cáo.',
    };
  }

  window.StudentMyTopicCrossLock = {
    applyMockAutoFail,
    evaluateSubmissionLock,
    getPeriodStateForTopic,
  };
})();
