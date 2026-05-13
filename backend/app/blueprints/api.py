from __future__ import annotations
from flask import jsonify, request
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models import (
    Account,
    Period,
    Report,
    Student,
    Topic,
    TopicMember,
    TopicStatus,
)
from ..utils import save_uploaded

api_bp = Blueprint("api", __name__)


def _json_error(message: str, status_code: int = 400):
    return jsonify({"error": message}), status_code


def _json_success(message: str, data=None, status_code: int = 200):
    payload = {"status": "success", "message": message}
    if data is not None:
        payload["data"] = data
    return jsonify(payload), status_code


def _require_authenticated_json():
    if not current_user.is_authenticated:
        return _json_error("Authentication required", 401)
    return None


def _require_admin_json():
    auth_error = _require_authenticated_json()
    if auth_error:
        return auth_error
    if not current_user.is_admin:
        return _json_error("Admin only", 403)
    return None


def _current_student():
    if not current_user.is_authenticated:
        return None
    return Student.query.filter_by(account_id=current_user.id).first()


def _get_json_payload():
    if request.is_json:
        return request.get_json(silent=True) or {}
    return request.form.to_dict(flat=True)


def _parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def _normalize_account_role(value: str | None) -> str:
    role = (value or "student").strip().lower()
    return role if role in {"admin", "student"} else "student"


def _apply_topic_action(topic: Topic, action: str, reason: str | None = None):
    # Normalize common synonyms
    key = (action or "").strip().lower()
    if key in {"approve", "approve_proposal"}:
        topic.trang_thai = TopicStatus.DA_DUYET
        topic.ly_do = None
        return

    if key in {"reject", "reject_proposal"}:
        topic.trang_thai = TopicStatus.KHONG_DUYET
        topic.ly_do = reason or "Đề tài bị từ chối"
        return

    if key in {"revision", "require_revision", "require-revision"}:
        topic.trang_thai = TopicStatus.SUA_DE_XUAT
        topic.ly_do = reason or "Yêu cầu chỉnh sửa"
        return

    if key in {"accept", "start", "start_work"}:
        topic.trang_thai = TopicStatus.THUC_HIEN
        topic.ly_do = None
        return

    if key in {"submit_report", "submit-report", "report_submitted"}:
        topic.trang_thai = TopicStatus.DA_NOP_BAO_CAO
        topic.ly_do = None
        return

    if key in {"require_report_revision", "require-report-revision", "require-report"}:
        topic.trang_thai = TopicStatus.SUA_BAO_CAO
        topic.ly_do = reason or "Yêu cầu chỉnh sửa báo cáo"
        return

    if key in {"approve_report", "approve-report", "report_approved"}:
        topic.trang_thai = TopicStatus.CHO_BAO_VE
        topic.ly_do = None
        return

    if key in {"grade", "grade_topic", "grade-topic", "mark_pass"}:
        topic.trang_thai = TopicStatus.HOAN_THANH
        topic.ly_do = None
        return

    if key in {"fail_defense", "fail", "fail-defense", "mark_fail"}:
        topic.trang_thai = TopicStatus.KHONG_THANH_CONG
        topic.ly_do = reason or "Không đạt sau bảo vệ"
        return

    if key in {"cancel", "bi_huy", "huy", "abort"}:
        topic.trang_thai = TopicStatus.BI_HUY
        topic.ly_do = reason or "Đề tài bị hủy"
        return

    raise ValueError("Unsupported action")


@api_bp.get("/me")
def api_me():
    auth_error = _require_authenticated_json()
    if auth_error:
        return auth_error
    student = _current_student()
    if not student:
        return _json_error("Student profile not found", 404)
    return jsonify(student.to_dict())


@api_bp.get("/periods")
def api_periods():
    auth_error = _require_authenticated_json()
    if auth_error:
        return auth_error
    periods = Period.query.order_by(Period.id.desc()).all()
    return jsonify([period.to_dict() for period in periods])


@api_bp.post("/periods")
def api_create_period():
    auth_error = _require_admin_json()
    if auth_error:
        return auth_error

    payload = _get_json_payload()
    ten_dot = (payload.get("ten_dot") or payload.get("tenDot") or "").strip()
    nam_hoc = (payload.get("nam_hoc") or payload.get("namHoc") or "").strip()
    cap_bac = (payload.get("cap_bac") or payload.get("capBac") or "Cấp Trường").strip() or "Cấp Trường"
    thoi_gian_thong_bao = _parse_dt(payload.get("thoi_gian_thong_bao") or payload.get("thoiGianThongBao"))
    thoi_gian_mo_dang_ky = _parse_dt(payload.get("thoi_gian_mo_dang_ky") or payload.get("thoiGianMoDangKy"))
    # Accept both legacy and new field names for period boundaries
    han_dang_ky = _parse_dt(payload.get("han_dang_ky") or payload.get("hanDangKy") or payload.get("han_nop_de_cuong") or payload.get("hanNopDeCuong"))
    thoi_gian_mo_nop_bao_cao = _parse_dt(payload.get("thoi_gian_mo_nop_bao_cao") or payload.get("thoiGianMoNopBaoCao"))
    han_nop_bao_cao = _parse_dt(payload.get("han_nop_bao_cao") or payload.get("hanNopBaoCao"))
    thoi_gian_bat_dau_bao_ve = _parse_dt(payload.get("thoi_gian_bat_dau_bao_ve") or payload.get("thoiGianBatDauBaoVe"))
    han_bao_ve = _parse_dt(payload.get("han_bao_ve") or payload.get("hanBaoVe"))
    mo_ta = (payload.get("mo_ta") or payload.get("chiTiet") or "").strip() or None
    file_dinh_kem = (payload.get("file_dinh_kem") or payload.get("fileDinhKem") or "").strip() or None

    # Require core fields; additional timeline fields are optional for now
    if not all([ten_dot, nam_hoc, thoi_gian_thong_bao, thoi_gian_mo_dang_ky, han_nop_bao_cao]):
        return _json_error("Missing required fields", 400)

    try:
        period = Period(
            ten_dot=ten_dot,
            nam_hoc=nam_hoc,
            mo_ta=mo_ta,
            thoi_gian_thong_bao=thoi_gian_thong_bao,
            thoi_gian_mo_dang_ky=thoi_gian_mo_dang_ky,
            han_dang_ky=han_dang_ky,
            thoi_gian_mo_nop_bao_cao=thoi_gian_mo_nop_bao_cao,
            han_nop_bao_cao=han_nop_bao_cao,
            thoi_gian_bat_dau_bao_ve=thoi_gian_bat_dau_bao_ve,
            han_bao_ve=han_bao_ve,
            cap_bac=cap_bac,
            file_dinh_kem=file_dinh_kem,
        )
        period.sync_trang_thai_dot()
        db.session.add(period)
        db.session.commit()
        return jsonify(period.to_dict()), 201
    except IntegrityError:
        db.session.rollback()
        return _json_error("Dữ liệu đợt không hợp lệ hoặc bị trùng. Vui lòng kiểm tra lại.", 400)
    except Exception as e:
        db.session.rollback()
        print(f"❌ LỖI CRITICAL KHI TẠO ĐỢT: {str(e)}")
        return _json_error(f"Lỗi hệ thống: {str(e)}", 500)


@api_bp.put("/periods/<int:period_id>")
def api_update_period(period_id):
    auth_error = _require_admin_json()
    if auth_error:
        return auth_error
    period = Period.query.get_or_404(period_id)
    payload = _get_json_payload()
    
    try:
        for field, attr in [
            ("ten_dot", "ten_dot"),
            ("tenDot", "ten_dot"),
            ("nam_hoc", "nam_hoc"),
            ("namHoc", "nam_hoc"),
            ("cap_bac", "cap_bac"),
            ("capBac", "cap_bac"),
            ("mo_ta", "mo_ta"),
            ("chiTiet", "mo_ta"),
            ("file_dinh_kem", "file_dinh_kem"),
            ("fileDinhKem", "file_dinh_kem"),
        ]:
            if field in payload and payload[field] is not None:
                setattr(period, attr, payload[field])

        for key, attr in [
            ("thoi_gian_thong_bao", "thoi_gian_thong_bao"),
            ("thoiGianThongBao", "thoi_gian_thong_bao"),
            ("thoi_gian_mo_dang_ky", "thoi_gian_mo_dang_ky"),
            ("thoiGianMoDangKy", "thoi_gian_mo_dang_ky"),
            ("han_dang_ky", "han_dang_ky"),
            ("hanDangKy", "han_dang_ky"),
            ("han_nop_de_cuong", "han_dang_ky"),
            ("hanNopDeCuong", "han_dang_ky"),
            ("thoi_gian_mo_nop_bao_cao", "thoi_gian_mo_nop_bao_cao"),
            ("thoiGianMoNopBaoCao", "thoi_gian_mo_nop_bao_cao"),
            ("han_nop_bao_cao", "han_nop_bao_cao"),
            ("hanNopBaoCao", "han_nop_bao_cao"),
            ("thoi_gian_bat_dau_bao_ve", "thoi_gian_bat_dau_bao_ve"),
            ("thoiGianBatDauBaoVe", "thoi_gian_bat_dau_bao_ve"),
            ("han_bao_ve", "han_bao_ve"),
            ("hanBaoVe", "han_bao_ve"),
        ]:
            if key in payload and payload[key]:
                parsed = _parse_dt(payload[key])
                if parsed:
                    setattr(period, attr, parsed)

        period.sync_trang_thai_dot()
        db.session.commit()
        return jsonify(period.to_dict())
    except IntegrityError:
        db.session.rollback()
        return _json_error("Dữ liệu đợt không hợp lệ hoặc bị trùng. Vui lòng kiểm tra lại.", 400)
    except Exception as e:
        db.session.rollback()
        print(f"❌ LỖI CRITICAL KHI CẬP NHẬT ĐỢT: {str(e)}")
        return _json_error(f"Lỗi hệ thống: {str(e)}", 500)


@api_bp.delete("/periods/<int:period_id>")
def api_delete_period(period_id):
    auth_error = _require_admin_json()
    if auth_error:
        return auth_error

    period = Period.query.get_or_404(period_id)

    # Đồng bộ trạng thái hiện tại trước khi kiểm tra điều kiện xóa.
    current_status = period.sync_trang_thai_dot()
    if current_status > 1:
        return _json_error("Không thể xóa đợt đã bắt đầu hoạt động", 403)

    try:
        db.session.delete(period)
        db.session.commit()
        return jsonify({"message": "Xóa đợt thành công"})
    except IntegrityError:
        db.session.rollback()
        return _json_error("Không thể xóa đợt do ràng buộc dữ liệu liên quan", 400)
    except Exception as e:
        db.session.rollback()
        print(f"❌ LỖI CRITICAL KHI XÓA ĐỢT: {str(e)}")
        return _json_error(f"Lỗi hệ thống: {str(e)}", 500)


@api_bp.get("/topics")
def api_topics():
    auth_error = _require_authenticated_json()
    if auth_error:
        return auth_error

    query = (
        Topic.query.options(
            joinedload(Topic.dot),
            joinedload(Topic.chu_nhiem).joinedload(Student.account),
            joinedload(Topic.member_links).joinedload(TopicMember.sinh_vien).joinedload(Student.account),
            joinedload(Topic.member_links),
        )
    )

    dot_id = request.args.get("dot_id", type=int)
    status = request.args.get("status", type=int)
    
    # Nếu không có dot_id, tự động tìm Đợt đang hoạt động
    if not dot_id:
        # Ưu tiên: lấy đợt chưa kết thúc (trang_thai_dot != 4)
        # Nếu không có, lấy đợt có hạn nộp báo cáo muộn nhất
        active_period = Period.query.filter(Period.trang_thai_dot != 4).order_by(
            Period.han_nop_bao_cao.desc()
        ).first()
        
        if not active_period:
            # Nếu không có đợt nào đang hoạt động, trả về danh sách rỗng
            return jsonify([])
        
        dot_id = active_period.id
    
    query = query.filter(Topic.dot_id == dot_id)
    if status:
        query = query.filter(Topic.trang_thai == status)

    topics = query.order_by(Topic.id.desc()).all()
    return jsonify([topic.to_dict() for topic in topics])


@api_bp.post("/topics")
def api_create_topic():
    auth_error = _require_authenticated_json()
    if auth_error:
        return auth_error

    student = _current_student()
    if not student:
        return _json_error("Student profile not found", 404)

    payload = _get_json_payload()
    ten_de_tai = (payload.get("ten_de_tai") or payload.get("title") or "").strip()
    muc_tieu = (payload.get("muc_tieu") or payload.get("objective") or "").strip()
    dot_id = payload.get("dot_id") or payload.get("dot_dang_ky_id")
    if not dot_id:
        active_period = Period.query.order_by(Period.id.desc()).first()
        dot_id = active_period.id if active_period else None

    if not ten_de_tai or not muc_tieu or not dot_id:
        return _json_error("Missing required fields", 400)

    topic = Topic(
        dot_id=int(dot_id),
        chu_nhiem_id=student.id,
        ten_de_tai=ten_de_tai,
        muc_tieu=muc_tieu,
        san_pham_du_kien=(payload.get("san_pham_du_kien") or "").strip() or None,
        linh_vuc=(payload.get("linh_vuc") or "").strip() or None,
        khoa_thuc_hien=(payload.get("khoa_thuc_hien") or student.khoa or "").strip() or None,
        giang_vien_hd=(payload.get("giang_vien_hd") or payload.get("advisor") or "").strip() or None,
        trang_thai=TopicStatus.CHO_DUYET_DE_XUAT,
        file_thuyet_minh=(payload.get("file_thuyet_minh") or None),
    )
    db.session.add(topic)
    db.session.flush()

    raw_members = payload.get("members") or []
    if isinstance(raw_members, list):
        for member_item in raw_members:
            member_id = member_item.get("student_id") or member_item.get("sinh_vien_id") if isinstance(member_item, dict) else None
            if not member_id:
                continue
            member = Student.query.get(int(member_id))
            if member and member.id != student.id:
                db.session.add(TopicMember(de_tai_id=topic.id, sinh_vien_id=member.id, vai_tro=member_item.get("vai_tro", "Thành viên")))

    db.session.commit()
    return jsonify(topic.to_dict()), 201


@api_bp.put("/topics/<int:topic_id>/<string:action>")
def api_topic_action(topic_id, action):
    auth_error = _require_admin_json()
    if auth_error:
        return auth_error

    topic = Topic.query.options(
        joinedload(Topic.dot),
        joinedload(Topic.chu_nhiem).joinedload(Student.account),
        joinedload(Topic.member_links).joinedload(TopicMember.sinh_vien).joinedload(Student.account),
    ).get_or_404(topic_id)
    payload = _get_json_payload()
    reason = (payload.get("reason") or payload.get("ly_do") or "").strip() or None

    try:
        _apply_topic_action(topic, action, reason)
    except ValueError:
        return _json_error("Unsupported action", 404)

    db.session.commit()
    return jsonify(topic.to_dict())


@api_bp.put("/topics/<int:topic_id>/approve")
def api_topic_approve(topic_id):
    auth_error = _require_admin_json()
    if auth_error:
        return auth_error
    topic = Topic.query.get_or_404(topic_id)
    _apply_topic_action(topic, "approve")
    db.session.commit()
    return jsonify(topic.to_dict())


@api_bp.put("/topics/<int:topic_id>/reject")
def api_topic_reject(topic_id):
    auth_error = _require_admin_json()
    if auth_error:
        return auth_error
    topic = Topic.query.get_or_404(topic_id)
    payload = _get_json_payload()
    reason = (payload.get("reason") or payload.get("ly_do") or "").strip() or None
    _apply_topic_action(topic, "reject", reason)
    db.session.commit()
    return jsonify(topic.to_dict())


@api_bp.put("/topics/<int:topic_id>/revision")
def api_topic_revision(topic_id):
    auth_error = _require_admin_json()
    if auth_error:
        return auth_error
    topic = Topic.query.get_or_404(topic_id)
    payload = _get_json_payload()
    reason = (payload.get("reason") or payload.get("ly_do") or "").strip() or None
    _apply_topic_action(topic, "revision", reason)
    db.session.commit()
    return jsonify(topic.to_dict())


@api_bp.put("/topics/<int:topic_id>/accept")
def api_topic_accept(topic_id):
    auth_error = _require_admin_json()
    if auth_error:
        return auth_error
    topic = Topic.query.get_or_404(topic_id)
    _apply_topic_action(topic, "accept")
    db.session.commit()
    return jsonify(topic.to_dict())


@api_bp.post("/topics/<int:topic_id>/submit-report")
def api_submit_report(topic_id):
    auth_error = _require_authenticated_json()
    if auth_error:
        return auth_error

    student = _current_student()
    topic = Topic.query.get_or_404(topic_id)
    if not student or topic.chu_nhiem_id != student.id:
        return _json_error("Forbidden", 403)

    file_storage = request.files.get("file") or request.files.get("file_bao_cao")
    if not file_storage:
        payload = _get_json_payload()
        file_path = payload.get("file_path") or payload.get("filePath")
        if not file_path:
            return _json_error("Missing report file", 400)
    else:
        file_path = save_uploaded(file_storage, "REPORTS_UPLOAD_FOLDER", allowed_exts=current_app.config["ALLOWED_REPORT_EXTENSIONS"])
        if not file_path:
            return _json_error("Invalid file", 400)

    report = Report(de_tai_id=topic.id, loai_bao_cao=2, file_path=file_path, trang_thai=0)
    db.session.add(report)
    topic.trang_thai = TopicStatus.DA_NOP_BAO_CAO
    topic.ly_do = None
    db.session.commit()
    return jsonify({"ok": True, "report_id": report.id, "topic": topic.to_dict()})


@api_bp.get("/my-topics")
def api_my_topics():
    auth_error = _require_authenticated_json()
    if auth_error:
        return auth_error
    student = _current_student()
    if not student:
        return _json_error("Student profile not found", 404)

    topics = (
        Topic.query.options(
            joinedload(Topic.dot),
            joinedload(Topic.chu_nhiem).joinedload(Student.account),
            joinedload(Topic.member_links).joinedload(TopicMember.sinh_vien).joinedload(Student.account),
        )
        .filter(
            (Topic.chu_nhiem_id == student.id) | (Topic.member_links.any(TopicMember.sinh_vien_id == student.id))
        )
        .order_by(Topic.id.desc())
        .all()
    )
    return jsonify([topic.to_dict() for topic in topics])


@api_bp.get("/accounts")
@login_required
def api_accounts():
    auth_error = _require_admin_json()
    if auth_error:
        return auth_error

    accounts = Account.query.options(joinedload(Account.student)).order_by(Account.id.desc()).all()
    return _json_success("Fetched accounts successfully", [account.to_dict() for account in accounts])


@api_bp.post("/accounts")
@login_required
def api_create_account():
    auth_error = _require_admin_json()
    if auth_error:
        return auth_error

    payload = _get_json_payload()
    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip()
    password = (payload.get("password") or "123456").strip()
    role = _normalize_account_role(payload.get("role"))

    if not username or not email:
        return _json_error("Missing username or email", 400)

    if Account.query.filter((Account.username == username) | (Account.email == email)).first():
        return _json_error("Account already exists", 409)

    try:
        account = Account(username=username, email=email, role=role, is_active=True)
        account.set_password(password)
        db.session.add(account)
        db.session.flush()

        if role == "student":
            student = Student(
                account_id=account.id,
                mssv=(payload.get("mssv") or "").strip() or username,
                ho_ten=(payload.get("ho_ten") or payload.get("name") or "").strip() or None,
                lop=(payload.get("lop") or "").strip() or None,
                khoa=(payload.get("khoa") or payload.get("faculty") or "").strip() or None,
                khoa_hoc=(payload.get("khoa_hoc") or "").strip() or None,
                so_dien_thoai=(payload.get("phone") or "").strip() or None,
                ngay_sinh=None,
            )
            db.session.add(student)

        db.session.commit()
        return _json_success("Account created successfully", account.to_dict(), 201)
    except IntegrityError:
        db.session.rollback()
        return _json_error("Tên đăng nhập hoặc email này đã tồn tại. Vui lòng sử dụng thông tin khác.", 400)
    except Exception as e:
        db.session.rollback()
        print(f"❌ LỖI CRITICAL KHI TẠO TÀI KHOẢN: {str(e)}")
        return _json_error(f"Lỗi hệ thống: {str(e)}", 500)


@api_bp.put("/accounts/<int:account_id>")
@login_required
def api_update_account(account_id):
    auth_error = _require_admin_json()
    if auth_error:
        return auth_error

    account = Account.query.options(joinedload(Account.student)).get_or_404(account_id)
    payload = _get_json_payload()

    # Smart duplicate validation: exclude the current account being updated
    if payload.get("email"):
        email = str(payload.get("email")).strip()
        duplicate = Account.query.filter(Account.email == email, Account.id != account_id).first()
        if duplicate:
            return _json_error("Tên đăng nhập hoặc email đã được sử dụng bởi tài khoản khác.", 400)
        account.email = email

    if payload.get("username"):
        username = str(payload.get("username")).strip()
        duplicate = Account.query.filter(Account.username == username, Account.id != account_id).first()
        if duplicate:
            return _json_error("Tên đăng nhập hoặc email đã được sử dụng bởi tài khoản khác.", 400)
        account.username = username

    if payload.get("phone") is not None:
        account.phone = str(payload.get("phone")).strip()

    if payload.get("role") is not None:
        account.role = _normalize_account_role(payload.get("role"))

    if payload.get("is_active") is not None:
        raw = payload.get("is_active")
        account.is_active = str(raw).lower() in {"1", "true", "yes", "on"} if isinstance(raw, str) else bool(raw)

    if payload.get("password"):
        account.set_password(str(payload.get("password")))

    # Handle Student record (create if doesn't exist for student role)
    student = account.student
    if account.role == "student":
        if not student:
            student = Student(
                account_id=account.id,
                mssv=(payload.get("mssv") or "").strip() or account.username,
                ho_ten=(payload.get("ho_ten") or payload.get("name") or "").strip() or None,
                lop=(payload.get("lop") or payload.get("class") or "").strip() or None,
                khoa=(payload.get("khoa") or payload.get("faculty") or "").strip() or None,
                khoa_hoc=(payload.get("khoa_hoc") or "").strip() or None,
                so_dien_thoai=(payload.get("phone") or "").strip() or None,
                ngay_sinh=None,
            )
            db.session.add(student)
        else:
            for field, attr in [
                ("mssv", "mssv"),
                ("ho_ten", "ho_ten"),
                ("name", "ho_ten"),
                ("lop", "lop"),
                ("class", "lop"),
                ("khoa", "khoa"),
                ("faculty", "khoa"),
                ("khoa_hoc", "khoa_hoc"),
                ("phone", "so_dien_thoai"),
            ]:
                if payload.get(field) is not None:
                    setattr(student, attr, str(payload.get(field)).strip())

    try:
        db.session.commit()
        return _json_success("Account updated successfully", account.to_dict())
    except IntegrityError:
        db.session.rollback()
        return _json_error("Tên đăng nhập hoặc email đã được sử dụng bởi tài khoản khác.", 400)
    except Exception as e:
        db.session.rollback()
        return _json_error(f"Lỗi hệ thống: {str(e)}", 500)


@api_bp.route("/accounts-delete", methods=["POST"])
@login_required
def api_delete_account():
    auth_error = _require_admin_json()
    if auth_error:
        return auth_error

    payload = _get_json_payload()
    account_id = payload.get("account_id")
    
    if not account_id:
        return _json_error("Missing account_id", 400)
    
    print(f"DEBUG: api_delete_account called with id={account_id}")
    
    account = Account.query.options(joinedload(Account.student)).get_or_404(account_id)
    if account.id == current_user.id:
        return _json_error("Không thể tự xóa tài khoản đang đăng nhập.", 400)
    if account.is_admin:
        return _json_error("Không thể xóa tài khoản quản trị.", 400)

    try:
        db.session.delete(account)
        db.session.commit()
        print(f"DEBUG: Account {account_id} deleted successfully")
        return _json_success("Account deleted successfully", {"id": account_id})
    except Exception as e:
        db.session.rollback()
        print(f"DEBUG: Error deleting account {account_id}: {str(e)}")
        return _json_error(f"Lỗi hệ thống: {str(e)}", 500)


@api_bp.put("/accounts/<int:account_id>/lock")
@login_required
def api_toggle_account_lock(account_id):
    auth_error = _require_admin_json()
    if auth_error:
        return auth_error
    account = Account.query.get_or_404(account_id)
    payload = _get_json_payload()
    if payload.get("is_active") is None:
        account.is_active = not account.is_active
    else:
        raw = payload.get("is_active")
        account.is_active = str(raw).lower() in {"1", "true", "yes", "on"} if isinstance(raw, str) else bool(raw)
    db.session.commit()
    return _json_success(
        "Account unlocked successfully" if account.is_active else "Account locked successfully",
        account.to_dict(),
    )


@api_bp.put("/accounts/<int:account_id>/reset-password")
@login_required
def api_reset_password(account_id):
    auth_error = _require_admin_json()
    if auth_error:
        return auth_error
    account = Account.query.get_or_404(account_id)
    payload = _get_json_payload()
    new_password = (payload.get("password") or "123456").strip()
    account.set_password(new_password)
    db.session.commit()
    return _json_success("Password reset successfully", account.to_dict())


@api_bp.put("/topics/<int:topic_id>/grade")
def api_topic_grade(topic_id):
    auth_error = _require_admin_json()
    if auth_error: return auth_error
    topic = Topic.query.get_or_404(topic_id)
    payload = _get_json_payload()
    topic.cap_giai_thuong = payload.get("cap_giai") or payload.get("cap_giai_thuong")
    topic.xep_loai_giai = payload.get("xep_loai") or payload.get("xep_loai_giai")
    topic.trang_thai = TopicStatus.HOAN_THANH

    db.session.commit()
    return jsonify(topic.to_dict())

