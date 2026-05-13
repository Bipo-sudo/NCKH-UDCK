from datetime import datetime
from flask import Blueprint, render_template, request, redirect, url_for, flash, abort, send_file, jsonify
from flask_login import login_required, current_user
from ..extensions import db
from ..models import Topic, TopicStatus, RegistrationPeriod, Report, Notification, Account, Student
from ..utils import check_auto_fail

admin_bp = Blueprint("admin", __name__)


def _serialize_period(period):
    return {
        "id": period.id,
        "ten_dot": period.ten_dot,
        "namHoc": period.nam_hoc,
        "nam_hoc": period.nam_hoc,
        "capBac": period.cap_bac or "Cấp Trường",
        "thoiGianThongBao": period.thoi_gian_thong_bao.isoformat(timespec="minutes") if period.thoi_gian_thong_bao else "",
        "thoiGianMoDangKy": period.thoi_gian_mo_dang_ky.isoformat(timespec="minutes") if period.thoi_gian_mo_dang_ky else "",
        "hanDangKy": (period.han_dang_ky or period.han_nop_de_cuong).isoformat(timespec="minutes") if (period.han_dang_ky or period.han_nop_de_cuong) else "",
        "thoiGianMoNopBaoCao": period.thoi_gian_mo_nop_bao_cao.isoformat(timespec="minutes") if period.thoi_gian_mo_nop_bao_cao else "",
        "hanNopBaoCao": period.han_nop_bao_cao.isoformat(timespec="minutes") if period.han_nop_bao_cao else "",
        "thoiGianBatDauBaoVe": period.thoi_gian_bat_dau_bao_ve.isoformat(timespec="minutes") if period.thoi_gian_bat_dau_bao_ve else "",
        "hanBaoVe": period.han_bao_ve.isoformat(timespec="minutes") if period.han_bao_ve else "",
        "trangThaiDot": period.trang_thai_dot_hien_tai,
        "chiTiet": period.mo_ta or "",
        "tepDinhKem": {"fileName": period.file_dinh_kem.rsplit("/", 1)[-1], "url": period.file_dinh_kem} if period.file_dinh_kem else None,
    }


def _get_current_period(periods):
    # Ưu tiên đợt đang vận hành (2 hoặc 3), nếu không có thì lấy đợt mới nhất.
    in_workflow = [period for period in periods if period.trang_thai_dot_hien_tai in (2, 3)]
    if in_workflow:
        return in_workflow[0]
    return periods[0] if periods else None


def _ensure_admin():
    if not current_user.is_authenticated or not current_user.is_admin:
        abort(403)


@admin_bp.route("/")
@login_required
def dashboard():
    _ensure_admin()
    check_auto_fail()
    total = Topic.query.count()
    completed = Topic.query.filter_by(trang_thai=TopicStatus.HOAN_THANH).count()
    failed = Topic.query.filter_by(trang_thai=TopicStatus.KHONG_THANH_CONG).count()
    in_progress = Topic.query.filter_by(trang_thai=TopicStatus.THUC_HIEN).count()
    proposed = Topic.query.filter_by(trang_thai=TopicStatus.CHO_DUYET_DE_XUAT).count()
    return render_template("admin/dashboard.html", total=total, completed=completed, failed=failed, in_progress=in_progress, proposed=proposed)


@admin_bp.route("/admin_dashboard.html")
@login_required
def dashboard_alias():
    return redirect(url_for("admin.dashboard"))


@admin_bp.route("/periods", methods=["GET", "POST"])
@login_required
def periods():
    _ensure_admin()
    if request.method == "POST":
        # Lấy dữ liệu dạng JSON từ Fetch API
        data = request.get_json() 
        
        ten_dot = data.get("ten_dot")
        nam_hoc = data.get("nam_hoc")
        cap_bac = data.get("cap_bac") or "Cấp Trường"
        
        # Lấy 7 mốc thời gian từ JSON
        t_thong_bao = data.get("thoi_gian_thong_bao")
        t_mo_dk = data.get("thoi_gian_mo_dang_ky")
        t_han_dk = data.get("han_dang_ky")
        t_mo_nop_bc = data.get("thoi_gian_mo_nop_bao_cao")
        t_han_nop_bc = data.get("han_nop_bao_cao")
        t_bat_dau_bv = data.get("thoi_gian_bat_dau_bao_ve")
        t_han_bv = data.get("han_bao_ve")

        # Kiểm tra bắt buộc các trường chính
        if not (ten_dot and nam_hoc and t_thong_bao and t_mo_dk and t_han_nop_bc):
            return jsonify({"status": "error", "message": "Thiếu thông tin bắt buộc"}), 400

        try:
            # Chuyển đổi toàn bộ sang datetime
            dt_thong_bao = datetime.fromisoformat(t_thong_bao)
            dt_mo_dk = datetime.fromisoformat(t_mo_dk)
            dt_han_dk = datetime.fromisoformat(t_han_dk) if t_han_dk else None
            dt_mo_nop_bc = datetime.fromisoformat(t_mo_nop_bc) if t_mo_nop_bc else None
            dt_han_nop_bc = datetime.fromisoformat(t_han_nop_bc)
            dt_bat_dau_bv = datetime.fromisoformat(t_bat_dau_bv) if t_bat_dau_bv else None
            dt_han_bv = datetime.fromisoformat(t_han_bv) if t_han_bv else None

            # Kiểm tra thứ tự thời gian (Logic tăng dần)
            if not (dt_thong_bao <= dt_mo_dk <= dt_han_dk <= dt_han_nop_bc):
                return jsonify({"status": "error", "message": "Thứ tự thời gian không hợp lệ"}), 400

            p = RegistrationPeriod(
                ten_dot=ten_dot,
                nam_hoc=nam_hoc,
                cap_bac=cap_bac,
                thoi_gian_thong_bao=dt_thong_bao,
                thoi_gian_mo_dang_ky=dt_mo_dk,
                han_dang_ky=dt_han_dk,
                thoi_gian_mo_nop_bao_cao=dt_mo_nop_bc,
                han_nop_bao_cao=dt_han_nop_bc,
                thoi_gian_bat_dau_bao_ve=dt_bat_dau_bv,
                han_bao_ve=dt_han_bv,
                trang_thai_dot=1,
            )
            
            db.session.add(p)
            db.session.commit()
            return jsonify({"status": "success", "message": "Đã tạo đợt NCKH mới thành công"}), 201

        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    # Đối với phương thức GET
    periods = RegistrationPeriod.query.order_by(RegistrationPeriod.id.desc()).all()
    periods_data = [_serialize_period(period) for period in periods]
    return render_template("admin/periods.html", periods=periods, periods_data=periods_data)


@admin_bp.route("/periods.html")
@login_required
def periods_alias():
    return redirect(url_for("admin.periods"))


@admin_bp.route("/topics_proposed.html")
@login_required
def topics_proposed():
    _ensure_admin()
    topics = (
        Topic.query
        .filter(Topic.trang_thai.in_([TopicStatus.CHO_DUYET_DE_XUAT, TopicStatus.SUA_DE_XUAT]))
        .order_by(Topic.id.desc())
        .all()
    )
    return render_template("admin/topics_proposed.html", topics=topics)


@admin_bp.route("/topic/<int:topic_id>/approve", methods=["POST"]) 
@login_required
def approve_topic(topic_id):
    """Giai đoạn 2 - Duyệt đề tài: CHO_XET_DUYET / YEU_CAU_CHINH_SUA -> DANG_THUC_HIEN."""
    _ensure_admin()
    topic = Topic.query.get_or_404(topic_id)
    if topic.trang_thai not in (TopicStatus.CHO_DUYET_DE_XUAT, TopicStatus.SUA_DE_XUAT):
        flash("Trạng thái hiện tại không cho phép duyệt.", "warning")
        return redirect(request.referrer or url_for("admin.topics_proposed"))
    topic.trang_thai = TopicStatus.THUC_HIEN
    topic.ly_do = None
    db.session.commit()
    db.session.add(Notification(
        tieu_de="Đề tài được duyệt",
        noi_dung="Đề tài của bạn đã được duyệt và chuyển sang trạng thái Đang thực hiện.",
        nguoi_nhan_id=topic.sinh_vien_id,
        de_tai_id=topic.id,
    ))
    db.session.commit()
    flash("Đã duyệt đề tài", "success")
    return redirect(request.referrer or url_for("admin.topics_proposed"))


@admin_bp.route("/topic/<int:topic_id>/require-revision", methods=["POST"]) 
@login_required
def require_revision(topic_id):
    """Giai đoạn 2 - Yêu cầu chỉnh sửa: CHO_XET_DUYET / YEU_CAU_CHINH_SUA -> YEU_CAU_CHINH_SUA, lưu lý do."""
    _ensure_admin()
    topic = Topic.query.get_or_404(topic_id)
    if topic.trang_thai not in (TopicStatus.CHO_DUYET_DE_XUAT, TopicStatus.SUA_DE_XUAT):
        flash("Trạng thái hiện tại không cho phép yêu cầu chỉnh sửa.", "warning")
        return redirect(request.referrer or url_for("admin.topics_proposed"))
    reason = request.form.get("reason", "Cần chỉnh sửa thuyết minh")
    topic.trang_thai = TopicStatus.SUA_DE_XUAT
    topic.ly_do = reason
    db.session.commit()
    db.session.add(Notification(
        tieu_de="Yêu cầu chỉnh sửa thuyết minh",
        noi_dung=reason,
        nguoi_nhan_id=topic.sinh_vien_id,
        de_tai_id=topic.id,
    ))
    db.session.commit()
    flash("Đã yêu cầu chỉnh sửa", "info")
    return redirect(request.referrer or url_for("admin.topics_proposed"))


@admin_bp.route("/topic/<int:topic_id>/reject", methods=["POST"]) 
@login_required
def reject_topic(topic_id):
    """Giai đoạn 2 - Từ chối: CHO_XET_DUYET / YEU_CAU_CHINH_SUA -> BI_TU_CHOI, lưu lý do."""
    _ensure_admin()
    topic = Topic.query.get_or_404(topic_id)
    if topic.trang_thai not in (TopicStatus.CHO_DUYET_DE_XUAT, TopicStatus.SUA_DE_XUAT):
        flash("Trạng thái hiện tại không cho phép từ chối.", "warning")
        return redirect(request.referrer or url_for("admin.topics_proposed"))
    reason = request.form.get("reason", "Đề tài không được phê duyệt")
    topic.trang_thai = TopicStatus.KHONG_DUYET
    topic.ly_do = reason
    db.session.commit()
    db.session.add(Notification(
        tieu_de="Đề tài bị từ chối",
        noi_dung=reason,
        nguoi_nhan_id=topic.sinh_vien_id,
        de_tai_id=topic.id,
    ))
    db.session.commit()
    flash("Đã từ chối đề tài", "warning")
    return redirect(request.referrer or url_for("admin.topics_proposed"))


@admin_bp.route("/progress")
@login_required
def progress():
    _ensure_admin()
    # Danh sách đề tài đã nộp báo cáo tổng kết, chờ nghiệm thu hoặc sửa báo cáo
    topics = Topic.query.filter(Topic.trang_thai.in_([
        TopicStatus.DA_NOP_BAO_CAO,
        TopicStatus.SUA_BAO_CAO,
    ])).order_by(Topic.id.desc()).all()
    return render_template("admin/progress.html", topics=topics)


@admin_bp.route("/report/<int:report_id>/download")
@login_required
def download_report(report_id):
    _ensure_admin()
    report = Report.query.get_or_404(report_id)
    return send_file(report.file_path, as_attachment=True)


@admin_bp.route("/report/<int:report_id>/approve", methods=["POST"]) 
@login_required
def approve_report(report_id):
    """Giữ lại phê duyệt file báo cáo (nếu dùng), không thay đổi trạng thái đề tài."""
    _ensure_admin()
    report = Report.query.get_or_404(report_id)
    report.trang_thai = 1
    db.session.commit()
    flash("Đã duyệt báo cáo", "success")
    return redirect(url_for("admin.progress"))


@admin_bp.route("/topic/<int:topic_id>/final-accept", methods=["POST"]) 
@login_required
def final_accept(topic_id):
    """Giai đoạn 4 - Nghiệm thu đạt: CHO_NGHIEM_THU / SUA_BAO_CAO -> DA_HOAN_THANH."""
    _ensure_admin()
    topic = Topic.query.get_or_404(topic_id)
    if topic.trang_thai not in (TopicStatus.DA_NOP_BAO_CAO, TopicStatus.SUA_BAO_CAO):
        flash("Trạng thái hiện tại không cho phép nghiệm thu.", "warning")
        return redirect(request.referrer or url_for("admin.progress"))
    topic.trang_thai = TopicStatus.HOAN_THANH
    topic.ly_do = None
    db.session.commit()
    db.session.add(Notification(
        tieu_de="Đề tài đã hoàn thành",
        noi_dung="Hội đồng đã nghiệm thu đạt. Đề tài được đánh dấu Đã hoàn thành.",
        nguoi_nhan_id=topic.sinh_vien_id,
        de_tai_id=topic.id,
    ))
    db.session.commit()
    flash("Đã nghiệm thu đạt", "success")
    return redirect(request.referrer or url_for("admin.progress"))


@admin_bp.route("/topic/<int:topic_id>/final-require-revision", methods=["POST"]) 
@login_required
def final_require_revision(topic_id):
    """Giai đoạn 4 - Đạt nhưng cần sửa: CHO_NGHIEM_THU / SUA_BAO_CAO -> SUA_BAO_CAO, lưu lý do."""
    _ensure_admin()
    topic = Topic.query.get_or_404(topic_id)
    if topic.trang_thai not in (TopicStatus.DA_NOP_BAO_CAO, TopicStatus.SUA_BAO_CAO):
        flash("Trạng thái hiện tại không cho phép yêu cầu sửa báo cáo.", "warning")
        return redirect(request.referrer or url_for("admin.progress"))
    reason = request.form.get("reason", "Báo cáo tổng kết cần chỉnh sửa theo góp ý hội đồng")
    topic.trang_thai = TopicStatus.SUA_BAO_CAO
    topic.ly_do = reason
    db.session.commit()
    db.session.add(Notification(
        tieu_de="Yêu cầu chỉnh sửa báo cáo tổng kết",
        noi_dung=reason,
        nguoi_nhan_id=topic.sinh_vien_id,
        de_tai_id=topic.id,
    ))
    db.session.commit()
    flash("Đã yêu cầu chỉnh sửa báo cáo", "info")
    return redirect(request.referrer or url_for("admin.progress"))


@admin_bp.route("/topic/<int:topic_id>/final-reject", methods=["POST"]) 
@login_required
def final_reject(topic_id):
    """Giai đoạn 4 - Không đạt: CHO_NGHIEM_THU / SUA_BAO_CAO -> KHONG_DAT, lưu lý do."""
    _ensure_admin()
    topic = Topic.query.get_or_404(topic_id)
    if topic.trang_thai not in (TopicStatus.DA_NOP_BAO_CAO, TopicStatus.SUA_BAO_CAO):
        flash("Trạng thái hiện tại không cho phép đánh giá Không đạt.", "warning")
        return redirect(request.referrer or url_for("admin.progress"))
    reason = request.form.get("reason", "Hội đồng đánh giá đề tài Không đạt")
    topic.trang_thai = TopicStatus.KHONG_THANH_CONG
    topic.ly_do = reason
    db.session.commit()
    db.session.add(Notification(
        tieu_de="Kết quả nghiệm thu: Không đạt",
        noi_dung=reason,
        nguoi_nhan_id=topic.sinh_vien_id,
        de_tai_id=topic.id,
    ))
    db.session.commit()
    flash("Đã ghi nhận kết quả Không đạt", "danger")
    return redirect(request.referrer or url_for("admin.progress"))


@admin_bp.route("/accounts", methods=["GET", "POST"]) 
@login_required
def accounts():
    _ensure_admin()
    return render_template("admin/accounts.html")


@admin_bp.route("/admin_accounts.html")
@login_required
def accounts_alias():
    return redirect(url_for("admin.accounts"))


@admin_bp.route("/topics")
@login_required
def topics():
    _ensure_admin()
    check_auto_fail()
    periods = RegistrationPeriod.query.order_by(RegistrationPeriod.id.desc()).all()
    current_period = _get_current_period(periods)
    current_period_data = _serialize_period(current_period) if current_period else None
    periods_data = [_serialize_period(period) for period in periods]
    return render_template("admin/topics.html", current_period_data=current_period_data, periods_data=periods_data)


@admin_bp.route("/admin_topics.html")
@login_required
def topics_alias():
    return redirect(url_for("admin.topics"))


@admin_bp.route("/account/<int:account_id>/reset", methods=["POST"]) 
@login_required
def reset_password(account_id):
    _ensure_admin()
    acc = Account.query.get_or_404(account_id)
    acc.set_password("123456")
    db.session.commit()
    flash("Đã reset mật khẩu về mặc định", "info")
    return redirect(url_for("admin.accounts"))
