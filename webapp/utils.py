import os
from datetime import datetime
from flask import current_app
from .extensions import db
from .models import Topic, TopicStatus, Report, RegistrationPeriod


def allowed_file(filename: str, allowed_exts: set) -> bool:
    if not filename or "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in allowed_exts


def get_active_registration_period() -> RegistrationPeriod | None:
    now = datetime.utcnow()
    period = (
        RegistrationPeriod.query
        .filter(RegistrationPeriod.ngay_mo <= now)
        .filter(RegistrationPeriod.ngay_dong >= now)
        .order_by(RegistrationPeriod.id.desc())
        .first()
    )
    return period


def check_auto_fail():
    # Auto-fail tương tự backend/app/utils.py với bộ trạng thái mới
    now = datetime.utcnow()
    periods = RegistrationPeriod.query.filter(RegistrationPeriod.han_nop_bao_cao < now).all()
    for p in periods:
        topics = (
            Topic.query
            .filter_by(dot_dang_ky_id=p.id)
            .filter(Topic.trang_thai.notin_([
                TopicStatus.KHONG_DAT,
                TopicStatus.DA_HOAN_THANH,
                TopicStatus.BI_TU_CHOI,
            ]))
            .all()
        )
        for t in topics:
            has_report = Report.query.filter_by(de_tai_id=t.id, loai_bao_cao=2).count() > 0
            if not has_report:
                t.trang_thai = TopicStatus.KHONG_DAT
    db.session.commit()


def ensure_dirs():
    os.makedirs(current_app.config.get("THUYET_MINH_UPLOAD_FOLDER"), exist_ok=True)
    os.makedirs(current_app.config.get("REPORTS_UPLOAD_FOLDER"), exist_ok=True)
