import os
from datetime import datetime
from flask import current_app
from werkzeug.utils import secure_filename
from .extensions import db
from .models import Topic, TopicStatus, Report, RegistrationPeriod


def allowed_file(filename: str, allowed_exts: set) -> bool:
    if not filename or "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in allowed_exts


def save_uploaded(file_storage, folder_key: str, allowed_exts: set) -> str | None:
    if not file_storage:
        return None
    filename = file_storage.filename
    if not allowed_file(filename, allowed_exts):
        return None
    safe_name = secure_filename(filename)
    folder = current_app.config.get(folder_key)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, f"{datetime.utcnow().timestamp()}_{safe_name}")
    file_storage.save(path)
    return path


def get_active_registration_period() -> RegistrationPeriod | None:
    now = datetime.utcnow()
    periods = RegistrationPeriod.query.order_by(RegistrationPeriod.id.desc()).all()
    for period in periods:
        if period.thoi_gian_mo_dang_ky <= now < period.han_nop_de_cuong:
            return period
    return None


def check_auto_fail():
    # Quy tắc khóa chéo theo vòng đời Đợt NCKH:
    # 1) Khi đợt >= trạng thái 3: đề tài đã duyệt (4) nhưng chưa ký xác nhận -> KHONG_DAT (7)
    # 2) Khi đợt >= trạng thái 4: đề tài đang triển khai (4) chưa nộp báo cáo tổng kết -> KHONG_DAT (7)
    now = datetime.utcnow()
    changed = False
    periods = RegistrationPeriod.query.all()

    for period in periods:
        current_period_state = period.compute_trang_thai_dot(now)
        if period.trang_thai_dot != current_period_state:
            period.trang_thai_dot = current_period_state
            changed = True

        if current_period_state >= 3:
            unsigned_topics = (
                Topic.query
                .filter_by(dot_dang_ky_id=period.id)
                .filter(Topic.trang_thai == TopicStatus.DANG_THUC_HIEN)
                .filter(Topic.da_ky_hop_dong.is_(False))
                .all()
            )
            for topic in unsigned_topics:
                topic.trang_thai = TopicStatus.KHONG_DAT
                topic.ly_do = "Tự động loại do quá hạn đăng ký nhưng chưa ký xác nhận tham gia đề tài."
                changed = True

        if current_period_state >= 4:
            report_deadline_topics = (
                Topic.query
                .filter_by(dot_dang_ky_id=period.id)
                .filter(Topic.trang_thai == TopicStatus.DANG_THUC_HIEN)
                .all()
            )
            for topic in report_deadline_topics:
                has_report = Report.query.filter_by(de_tai_id=topic.id, loai_bao_cao=2).count() > 0
                if not has_report:
                    topic.trang_thai = TopicStatus.KHONG_DAT
                    topic.ly_do = "Tự động loại do quá hạn nộp báo cáo tổng kết."
                    changed = True

    if changed:
        db.session.commit()
