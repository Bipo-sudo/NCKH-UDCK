from datetime import datetime
from flask import Blueprint, render_template, request, redirect, url_for, flash, send_file, abort, current_app
from flask_login import login_required, current_user
from ..extensions import db
from ..models import Student, Topic, TopicStatus, RegistrationPeriod, Report, Notification
from ..utils import get_active_registration_period, save_uploaded

student_bp = Blueprint("student", __name__)


def _serialize_period(period):
    return {
        "id": period.id,
        "ten_dot": period.ten_dot,
        "namHoc": period.nam_hoc,
        "nam_hoc": period.nam_hoc,
        "thoiGianThongBao": period.thoi_gian_thong_bao.isoformat(timespec="minutes") if period.thoi_gian_thong_bao else "",
        "thoiGianMoDangKy": period.thoi_gian_mo_dang_ky.isoformat(timespec="minutes") if period.thoi_gian_mo_dang_ky else "",
        "hanNopDeCuong": period.han_nop_de_cuong.isoformat(timespec="minutes") if period.han_nop_de_cuong else "",
        "hanNopBaoCao": period.han_nop_bao_cao.isoformat(timespec="minutes") if period.han_nop_bao_cao else "",
        "trangThaiDot": period.trang_thai_dot_hien_tai,
        "mo_ta": period.mo_ta or "",
        "file_dinh_kem": period.file_dinh_kem,
    }


def _get_current_student() -> Student | None:
    if not current_user.is_authenticated:
        return None
    return Student.query.filter_by(account_id=current_user.id).first()


@student_bp.route("/")
@login_required
def dashboard():
    stu = _get_current_student()
    if not stu:
        flash("Tài khoản không phải Sinh viên", "danger")
        return redirect(url_for("auth.login"))
    periods = RegistrationPeriod.query.order_by(RegistrationPeriod.id.desc()).all()
    periods_data = [_serialize_period(period) for period in periods]
    return render_template("student/dashboard.html", periods_data=periods_data)


@student_bp.route("/register-topic", methods=["GET", "POST"])
@login_required
def register_topic():
    stu = _get_current_student()
    if not stu:
        flash("Tài khoản không phải Sinh viên", "danger")
        return redirect(url_for("auth.login"))
    
    if request.method == "POST":
        # TODO: Handle form submission
        flash("Đề tài đã được đăng ký thành công!", "success")
        return redirect(url_for("student.dashboard"))
    
    return render_template("student/register_topic.html")


@student_bp.route("/profile")
@login_required
def profile():
    stu = _get_current_student()
    if not stu:
        flash("Tài khoản không phải Sinh viên", "danger")
        return redirect(url_for("auth.login"))
    return render_template("student/profile.html")


@student_bp.route("/my-topic")
@login_required
def my_topic():
    stu = _get_current_student()
    if not stu:
        flash("Tài khoản không phải Sinh viên", "danger")
        return redirect(url_for("auth.login"))
    topic = (
        Topic.query
        .filter_by(sinh_vien_id=stu.id)
        .order_by(Topic.id.desc())
        .first()
    )
    return render_template("student/my_topic.html", topic=topic)


@student_bp.route("/register", methods=["GET", "POST"])
@login_required
def register():
    stu = _get_current_student()
    if not stu:
        abort(403)

    period = get_active_registration_period()
    if not period:
        flash("Hiện không trong đợt đăng ký", "warning")
        return redirect(url_for("student.dashboard"))

    if request.method == "POST":
        ten = request.form.get("ten_de_tai", "").strip()
        gvhd = request.form.get("gvhd", "").strip()
        mo_ta = request.form.get("mo_ta", "").strip()
        spdk = request.form.get("spdk", "").strip()
        file = request.files.get("file_thuyet_minh")
        path = save_uploaded(file, "THUYET_MINH_UPLOAD_FOLDER", allowed_exts=current_app.config["ALLOWED_THUYET_MINH_EXTENSIONS"]) if file else None
        if not ten:
            flash("Tên đề tài là bắt buộc", "danger")
            return render_template("student/register.html", period=period)
        topic = Topic(
            ten_de_tai=ten,
            mo_ta=mo_ta,
            san_pham_du_kien=spdk,
            giang_vien_huong_dan=gvhd,
            sinh_vien_id=stu.id,
            dot_dang_ky_id=period.id,
            trang_thai=TopicStatus.CHO_XET_DUYET,
            file_thuyet_minh=path,
        )
        db.session.add(topic)
        db.session.commit()
        db.session.add(Notification(tieu_de="Đăng ký đề tài", noi_dung="Bạn đã đăng ký đề tài thành công", nguoi_nhan_id=stu.id, de_tai_id=topic.id))
        db.session.commit()
        flash("Đã gửi đăng ký", "success")
        return redirect(url_for("student.dashboard"))
    return render_template("student/register.html", period=period)


@student_bp.route("/topic/<int:topic_id>/edit", methods=["GET", "POST"])
@login_required
def edit_topic(topic_id):
    stu = _get_current_student()
    topic = Topic.query.get_or_404(topic_id)
    if topic.sinh_vien_id != stu.id:
        abort(403)
    if topic.trang_thai not in (TopicStatus.CHO_XET_DUYET, TopicStatus.YEU_CAU_CHINH_SUA):
        flash("Không thể chỉnh sửa ở trạng thái hiện tại", "warning")
        return redirect(url_for("student.dashboard"))

    if request.method == "POST":
        topic.ten_de_tai = request.form.get("ten_de_tai", topic.ten_de_tai).strip()
        topic.mo_ta = request.form.get("mo_ta", topic.mo_ta).strip()
        topic.san_pham_du_kien = request.form.get("spdk", topic.san_pham_du_kien).strip()
        topic.giang_vien_huong_dan = request.form.get("gvhd", topic.giang_vien_huong_dan).strip()
        file = request.files.get("file_thuyet_minh")
        if file:
            from flask import current_app
            path = save_uploaded(file, "THUYET_MINH_UPLOAD_FOLDER", allowed_exts=current_app.config["ALLOWED_THUYET_MINH_EXTENSIONS"]) 
            if path:
                topic.file_thuyet_minh = path
        topic.trang_thai = TopicStatus.CHO_XET_DUYET
        topic.ly_do = None
        db.session.commit()
        db.session.add(Notification(tieu_de="Cập nhật đề tài", noi_dung="Bạn đã chỉnh sửa đề tài", nguoi_nhan_id=stu.id, de_tai_id=topic.id))
        db.session.commit()
        flash("Đã cập nhật", "success")
        return redirect(url_for("student.dashboard"))
    return render_template("student/edit_topic.html", topic=topic)


@student_bp.route("/topic/<int:topic_id>/sign", methods=["POST"]) 
@login_required
def sign_contract(topic_id):
    """Lược bỏ luồng ký hợp đồng cũ: không còn sử dụng."""
    abort(404)


@student_bp.route("/topic/<int:topic_id>/upload", methods=["GET", "POST"]) 
@login_required
def upload_report(topic_id):
    from flask import current_app
    stu = _get_current_student()
    topic = Topic.query.get_or_404(topic_id)
    if topic.sinh_vien_id != stu.id:
        abort(403)
    period = RegistrationPeriod.query.get(topic.dot_dang_ky_id)
    disabled = datetime.utcnow() > period.han_nop_bao_cao

    if request.method == "POST":
        if disabled:
            flash("Đã quá hạn nộp báo cáo", "warning")
            return redirect(url_for("student.upload_report", topic_id=topic_id))
        # Trong luồng mới, chỉ dùng để nộp báo cáo tổng kết (loai_bao_cao = 2)
        file = request.files.get("file")
        path = save_uploaded(
            file,
            "REPORTS_UPLOAD_FOLDER",
            allowed_exts=current_app.config["ALLOWED_REPORT_EXTENSIONS"],
        ) if file else None
        if not path:
            flash("File không hợp lệ", "danger")
            return redirect(url_for("student.upload_report", topic_id=topic_id))
        report = Report(de_tai_id=topic.id, loai_bao_cao=2, file_path=path)
        db.session.add(report)
        # Sau khi SV nộp báo cáo tổng kết, chuyển sang CHO_NGHIEM_THU
        topic.trang_thai = TopicStatus.CHO_NGHIEM_THU
        topic.ly_do = None
        db.session.commit()
        db.session.add(Notification(
            tieu_de="Nộp báo cáo tổng kết",
            noi_dung="Bạn đã nộp báo cáo tổng kết, chờ hội đồng nghiệm thu.",
            nguoi_nhan_id=stu.id,
            de_tai_id=topic.id,
        ))
        db.session.commit()
        flash("Đã tải lên báo cáo tổng kết", "success")
        return redirect(url_for("student.upload_report", topic_id=topic_id))

    reports = Report.query.filter_by(de_tai_id=topic.id, loai_bao_cao=2).order_by(Report.ngay_nop.desc()).all()
    return render_template("student/upload_report.html", topic=topic, reports=reports, disabled=disabled, deadline=period.han_nop_bao_cao)


@student_bp.route("/topic/<int:topic_id>/reupload-proposal", methods=["POST"]) 
@login_required
def reupload_proposal(topic_id):
    """Sinh viên nộp lại file thuyết minh khi ở trạng thái YEU_CAU_CHINH_SUA."""
    from flask import current_app

    stu = _get_current_student()
    topic = Topic.query.get_or_404(topic_id)
    if topic.sinh_vien_id != stu.id:
        abort(403)
    if topic.trang_thai not in (TopicStatus.CHO_XET_DUYET, TopicStatus.YEU_CAU_CHINH_SUA):
        flash("Trạng thái hiện tại không cho phép nộp lại thuyết minh.", "warning")
        return redirect(url_for("student.my_topic"))

    file = request.files.get("file_thuyet_minh")
    path = save_uploaded(
        file,
        "THUYET_MINH_UPLOAD_FOLDER",
        allowed_exts=current_app.config["ALLOWED_THUYET_MINH_EXTENSIONS"],
    ) if file else None
    if not path:
        flash("File thuyết minh không hợp lệ", "danger")
        return redirect(url_for("student.my_topic"))

    topic.file_thuyet_minh = path
    topic.trang_thai = TopicStatus.CHO_XET_DUYET
    topic.ly_do = None
    db.session.commit()
    db.session.add(Notification(
        tieu_de="Nộp lại thuyết minh",
        noi_dung="Bạn đã nộp lại file thuyết minh. Đề tài chuyển sang trạng thái Chờ xét duyệt.",
        nguoi_nhan_id=stu.id,
        de_tai_id=topic.id,
    ))
    db.session.commit()
    flash("Đã nộp lại thuyết minh", "success")
    return redirect(url_for("student.my_topic"))


@student_bp.route("/topic/<int:topic_id>/submit-final", methods=["POST"]) 
@login_required
def submit_final(topic_id):
    """Sinh viên nộp hoặc nộp lại báo cáo tổng kết khi DANG_THUC_HIEN hoặc SUA_BAO_CAO."""
    from flask import current_app

    stu = _get_current_student()
    topic = Topic.query.get_or_404(topic_id)
    if topic.sinh_vien_id != stu.id:
        abort(403)

    if topic.trang_thai not in (TopicStatus.DANG_THUC_HIEN, TopicStatus.SUA_BAO_CAO):
        flash("Trạng thái hiện tại không cho phép nộp báo cáo tổng kết.", "warning")
        return redirect(url_for("student.my_topic"))

    file = request.files.get("file_bao_cao")
    path = save_uploaded(
        file,
        "REPORTS_UPLOAD_FOLDER",
        allowed_exts=current_app.config["ALLOWED_REPORT_EXTENSIONS"],
    ) if file else None
    if not path:
        flash("File báo cáo không hợp lệ", "danger")
        return redirect(url_for("student.my_topic"))

    report = Report(de_tai_id=topic.id, loai_bao_cao=2, file_path=path)
    db.session.add(report)
    topic.trang_thai = TopicStatus.CHO_NGHIEM_THU
    topic.ly_do = None
    db.session.commit()
    db.session.add(Notification(
        tieu_de="Nộp báo cáo tổng kết",
        noi_dung="Bạn đã nộp báo cáo tổng kết, chờ hội đồng nghiệm thu.",
        nguoi_nhan_id=stu.id,
        de_tai_id=topic.id,
    ))
    db.session.commit()
    flash("Đã nộp báo cáo tổng kết", "success")
    return redirect(url_for("student.my_topic"))


@student_bp.route("/report/<int:report_id>/download")
@login_required
def download_report(report_id):
    report = Report.query.get_or_404(report_id)
    topic = Topic.query.get(report.de_tai_id)
    stu = _get_current_student()
    if not (current_user.is_admin or (stu and topic.sinh_vien_id == stu.id)):
        abort(403)
    return send_file(report.file_path, as_attachment=True)
