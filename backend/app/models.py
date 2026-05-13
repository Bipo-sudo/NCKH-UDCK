from datetime import datetime
import json
from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy import case

from .extensions import db


def _dt_to_iso(value):
    if not value:
        return ""
    return value.isoformat(timespec="minutes") if hasattr(value, "isoformat") else str(value)


def _safe_json_list(value):
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else [parsed]
        except Exception:
            return [value]
    return [value]


class TopicStatus:
    CHO_DUYET_DE_XUAT = 1
    SUA_DE_XUAT = 2
    DA_DUYET = 3
    KHONG_DUYET = 4
    THUC_HIEN = 5
    CHUA_NOP_BAO_CAO = 6
    DA_NOP_BAO_CAO = 7
    SUA_BAO_CAO = 8
    CHO_BAO_VE = 9
    HOAN_THANH = 10
    KHONG_THANH_CONG = 11
    BI_HUY = 12


class Account(UserMixin, db.Model):
    __tablename__ = "tai_khoan"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    role = db.Column(db.String(20), nullable=False, default="student")
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    student = db.relationship(
        "Student",
        back_populates="account",
        uselist=False,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        db.CheckConstraint("role IN ('admin', 'student')", name="ck_tai_khoan_role"),
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        student = self.student
        payload = {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "phone": self.phone,
            "role": self.role,
            "isActive": self.is_active,
            "is_active": self.is_active,
        }
        if student:
            student_payload = student.to_dict()
            student_payload.pop("id", None)
            student_payload.pop("account_id", None)
            payload.update(student_payload)
        return payload

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @hybrid_property
    def role_id(self) -> int:
        return 1 if self.role == "admin" else 2

    @role_id.setter
    def role_id(self, value: int) -> None:
        self.role = "admin" if value == 1 else "student"

    @role_id.expression
    def role_id(cls):
        return case((cls.role == "admin", 1), else_=2)


class Student(db.Model):
    __tablename__ = "sinh_vien"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    account_id = db.Column(db.Integer, db.ForeignKey("tai_khoan.id"), nullable=False, unique=True)
    mssv = db.Column(db.String(50), unique=True, nullable=False)
    ho_ten = db.Column(db.String(255), nullable=True)
    ngay_sinh = db.Column(db.Date, nullable=True)
    so_dien_thoai = db.Column(db.String(20), nullable=True)
    lop = db.Column(db.String(50), nullable=True)
    khoa = db.Column(db.String(150), nullable=True)
    khoa_hoc = db.Column(db.String(20), nullable=True)

    account = db.relationship("Account", back_populates="student")

    de_tai_chu_nhiem = db.relationship(
        "Topic",
        back_populates="chu_nhiem",
        lazy=True,
        foreign_keys="Topic.chu_nhiem_id",
    )

    topic_memberships = db.relationship(
        "TopicMember",
        back_populates="sinh_vien",
        cascade="all, delete-orphan",
        lazy=True,
    )

    de_tai_tham_gia = db.relationship(
        "Topic",
        secondary="thanh_vien_de_tai",
        primaryjoin="Student.id == TopicMember.sinh_vien_id",
        secondaryjoin="Topic.id == TopicMember.de_tai_id",
        viewonly=True,
        lazy=True,
    )

    def to_dict(self):
        account = self.account
        return {
            "id": self.id,
            "account_id": self.account_id,
            "username": account.username if account else None,
            "email": account.email if account else None,
            "name": self.ho_ten or "",
            "ho_ten": self.ho_ten or "",
            "mssv": self.mssv,
            "class": self.lop or "",
            "lop": self.lop or "",
            "khoa": self.khoa or "",
            "faculty": self.khoa or "",
            "khoa_hoc": self.khoa_hoc or "",
            "dob": self.ngay_sinh.isoformat() if self.ngay_sinh else "",
            "ngay_sinh": self.ngay_sinh.isoformat() if self.ngay_sinh else None,
            "phone": self.so_dien_thoai or "",
            "so_dien_thoai": self.so_dien_thoai or "",
        }


class Period(db.Model):
    __tablename__ = "dot_nckh"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ten_dot = db.Column(db.String(255), nullable=False)
    nam_hoc = db.Column(db.String(50), nullable=False)
    mo_ta = db.Column(db.Text, nullable=True)
    thoi_gian_thong_bao = db.Column(db.DateTime, nullable=False)
    thoi_gian_mo_dang_ky = db.Column(db.DateTime, nullable=False)
    # renamed: end of registration window
    han_dang_ky = db.Column(db.DateTime, nullable=True)
    # new timeline fields for unified 6-phase lifecycle
    thoi_gian_mo_nop_bao_cao = db.Column(db.DateTime, nullable=True)
    thoi_gian_bat_dau_bao_ve = db.Column(db.DateTime, nullable=True)
    han_bao_ve = db.Column(db.DateTime, nullable=True)
    han_nop_bao_cao = db.Column(db.DateTime, nullable=False)
    cap_bac = db.Column(db.String(20), nullable=False, default="Cấp Trường")
    trang_thai_dot = db.Column(db.Integer, nullable=True)
    file_dinh_kem = db.Column(db.String(500), nullable=True)

    de_tai = db.relationship("Topic", back_populates="dot", lazy=True, cascade="all, delete-orphan")

    def compute_trang_thai_dot(self, now: datetime | None = None) -> int:
        now = now or datetime.utcnow()
        # Phases (1..6):
        # 1: Đăng ký (thoi_gian_mo_dang_ky -> han_dang_ky)
        # 2: Đang thực hiện (han_dang_ky -> thoi_gian_mo_nop_bao_cao)
        # 3: Nghiệm thu (thoi_gian_mo_nop_bao_cao -> han_nop_bao_cao)
        # 4: Kết thúc (han_nop_bao_cao -> thoi_gian_bat_dau_bao_ve)
        # 5: Bảo vệ (thoi_gian_bat_dau_bao_ve -> han_bao_ve)
        # 6: Hoàn thành (> han_bao_ve)

        # If any critical boundary is missing, fall back to best-effort ordering.
        open_reg = self.thoi_gian_mo_dang_ky
        end_reg = getattr(self, 'han_dang_ky', None)
        open_report = getattr(self, 'thoi_gian_mo_nop_bao_cao', None)
        end_report = self.han_nop_bao_cao
        start_defense = getattr(self, 'thoi_gian_bat_dau_bao_ve', None)
        end_defense = getattr(self, 'han_bao_ve', None)

        # Phase 1: registration window
        if open_reg and end_reg and now >= open_reg and now < end_reg:
            return 1

        # Phase 2: between end of registration and report submission opening
        if end_reg and open_report and now >= end_reg and now < open_report:
            return 2

        # Phase 3: report submission window
        if open_report and end_report and now >= open_report and now < end_report:
            return 3

        # Phase 4: between report deadline and defense start (admin review)
        if end_report and start_defense and now >= end_report and now < start_defense:
            return 4

        # Phase 5: defense window
        if start_defense and end_defense and now >= start_defense and now < end_defense:
            return 5

        # Phase 6: after defense end
        if end_defense and now >= end_defense:
            return 6

        # Best-effort fallbacks (if some dates are missing)
        if open_reg and now < open_reg:
            return 1
        if end_reg and now < end_reg:
            return 1
        if open_report and now < open_report:
            return 2
        if end_report and now < end_report:
            return 3

        return 6

    def sync_trang_thai_dot(self, now: datetime | None = None) -> int:
        self.trang_thai_dot = self.compute_trang_thai_dot(now)
        return self.trang_thai_dot

    @property
    def trang_thai_dot_hien_tai(self) -> int:
        return self.compute_trang_thai_dot()

    @property
    def thoi_gian_trien_khai(self) -> str:
        try:
            start = self.thoi_gian_mo_dang_ky
            end = self.han_bao_ve
            return f"{start:%d/%m/%Y %H:%M} - {end:%d/%m/%Y %H:%M}"
        except Exception:
            return ""


    @property
    def ten_trang_thai_dot(self) -> str:
        mapping = {
            1: "Chưa mở đăng ký",
            2: "Đang mở đăng ký",
            3: "Đang nộp báo cáo",
            4: "Đã đóng đăng ký",
        }
        return mapping.get(self.trang_thai_dot_hien_tai, "Không xác định")

    def to_dict(self):
        status = self.trang_thai_dot_hien_tai
        return {
            "id": self.id,
            "ten_dot": self.ten_dot,
            "tenDot": self.ten_dot,
            "nam_hoc": self.nam_hoc,
            "namHoc": self.nam_hoc,
            "mo_ta": self.mo_ta or "",
            "chiTiet": self.mo_ta or "",
            "cap_bac": self.cap_bac or "Cấp Trường",
            "capBac": self.cap_bac or "Cấp Trường",
            "thoiGianThongBao": _dt_to_iso(self.thoi_gian_thong_bao),
            "thoiGianMoDangKy": _dt_to_iso(self.thoi_gian_mo_dang_ky),
            "hanDangKy": _dt_to_iso(self.han_dang_ky),
            "thoiGianMoNopBaoCao": _dt_to_iso(getattr(self, 'thoi_gian_mo_nop_bao_cao', None)),
            "hanNopBaoCao": _dt_to_iso(self.han_nop_bao_cao),
            "thoiGianBatDauBaoVe": _dt_to_iso(getattr(self, 'thoi_gian_bat_dau_bao_ve', None)),
            "hanBaoVe": _dt_to_iso(getattr(self, 'han_bao_ve', None)),
            "trangThaiDot": status,
            "trang_thai_dot": status,
            "file_dinh_kem": self.file_dinh_kem,
            "tepDinhKem": {
                "fileName": self.file_dinh_kem.rsplit("/", 1)[-1] if self.file_dinh_kem else "",
                "url": self.file_dinh_kem,
            } if self.file_dinh_kem else None,
        }


class Topic(db.Model):
    __tablename__ = "de_tai"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    dot_id = db.Column(db.Integer, db.ForeignKey("dot_nckh.id"), nullable=False)
    chu_nhiem_id = db.Column(db.Integer, db.ForeignKey("sinh_vien.id"), nullable=False)

    ten_de_tai = db.Column(db.String(500), nullable=False)
    muc_tieu = db.Column(db.Text, nullable=False)
    san_pham_du_kien = db.Column(db.Text, nullable=True)
    linh_vuc = db.Column(db.String(150), nullable=True)
    khoa_thuc_hien = db.Column(db.String(150), nullable=True)
    giang_vien_hd = db.Column(db.String(255), nullable=True)

    trang_thai = db.Column(db.Integer, nullable=False, default=TopicStatus.CHO_DUYET_DE_XUAT)
    ly_do = db.Column(db.Text, nullable=True)

    lien_ket_ngoai = db.Column(db.String(1000), nullable=True)
    file_de_xuat = db.Column(db.Text, nullable=True)
    file_bao_cao = db.Column(db.Text, nullable=True)
    file_thuyet_minh = db.Column(db.Text, nullable=True)
    cap_giai_thuong = db.Column(db.String(50), nullable=True)
    xep_loai_giai = db.Column(db.String(30), nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    dot = db.relationship("Period", back_populates="de_tai")
    chu_nhiem = db.relationship("Student", back_populates="de_tai_chu_nhiem", foreign_keys=[chu_nhiem_id])

    member_links = db.relationship(
        "TopicMember",
        back_populates="de_tai",
        cascade="all, delete-orphan",
        lazy=True,
    )

    thanh_vien = db.relationship(
        "Student",
        secondary="thanh_vien_de_tai",
        primaryjoin="Topic.id == TopicMember.de_tai_id",
        secondaryjoin="Student.id == TopicMember.sinh_vien_id",
        viewonly=True,
        lazy=True,
    )

    def to_dict(self, include_related: bool = True):
        period = self.dot
        student = self.chu_nhiem
        main_author = student.to_dict() if student else None

        authors = []
        if student:
            authors.append({
                "name": student.ho_ten or "",
                "ho_ten": student.ho_ten or "",
                "mssv": student.mssv,
                "className": student.lop or "",
                "lop": student.lop or "",
                "khoa": student.khoa or "",
                "faculty": student.khoa or "",
                "khoa_hoc": student.khoa_hoc or "",
                "phone": student.so_dien_thoai or "",
                "email": student.account.email if student.account else "",
                "address": "",
                "role": "Chủ nhiệm đề tài",
            })

        if include_related:
            for link in self.member_links:
                member = link.sinh_vien
                if not member:
                    continue
                authors.append({
                    "name": member.ho_ten or "",
                    "ho_ten": member.ho_ten or "",
                    "mssv": member.mssv,
                    "className": member.lop or "",
                    "lop": member.lop or "",
                    "khoa": member.khoa or "",
                    "faculty": member.khoa or "",
                    "khoa_hoc": member.khoa_hoc or "",
                    "phone": member.so_dien_thoai or "",
                    "email": member.account.email if member.account else "",
                    "address": "",
                    "role": link.vai_tro or "Thành viên",
                })

        history = []
        if include_related:
            for note in sorted(getattr(self, "thong_bao", []) or [], key=lambda item: item.ngay_gui or datetime.utcnow()):
                history.append({
                    "time": _dt_to_iso(note.ngay_gui),
                    "author": "Admin",
                    "content": note.noi_dung,
                })

        period_name = period.nam_hoc if period else ""
        status = self.trang_thai
        return {
            "id": self.id,
            "dot_id": self.dot_id,
            "dot_dang_ky_id": self.dot_id,
            "chu_nhiem_id": self.chu_nhiem_id,
            "sinh_vien_id": self.chu_nhiem_id,
            "ten_de_tai": self.ten_de_tai,
            "title": self.ten_de_tai,
            "muc_tieu": self.muc_tieu,
            "objective": self.muc_tieu,
            "san_pham_du_kien": self.san_pham_du_kien,
            "linh_vuc": self.linh_vuc or "",
            "khoa_thuc_hien": self.khoa_thuc_hien or "",
            "giang_vien_hd": self.giang_vien_hd or "",
            "giang_vien_huong_dan": self.giang_vien_hd or "",
            "trang_thai": status,
            "status": status,
            "ly_do": self.ly_do,
            "reason": self.ly_do,
            "lien_ket_ngoai": self.lien_ket_ngoai,
            "file_de_xuat": _safe_json_list(self.file_de_xuat),
            "file_bao_cao": _safe_json_list(self.file_bao_cao),
            "file_thuyet_minh": _safe_json_list(self.file_thuyet_minh),
            "cap_giai_thuong": self.cap_giai_thuong,
            "xep_loai_giai": self.xep_loai_giai,
            "created_at": _dt_to_iso(self.created_at),
            "updated_at": _dt_to_iso(self.updated_at),
            "year": period_name,
            "nam_hoc": period_name,
            "period": period.ten_dot if period else "",
            "ngay_ket_thuc_dot": _dt_to_iso(period.han_nop_bao_cao) if period else "",
            "advisor": {
                "name": self.giang_vien_hd or "",
                "email": "",
                "phone": "",
            },
            "tac_gia": main_author,
            "authors": authors,
            "registrationDraft": {
                "dot_dang_ky": period.ten_dot if period else "",
                "de_tai_ten": self.ten_de_tai,
                "linh_vuc": self.linh_vuc or "",
                "muc_tieu_nghien_cuu": self.muc_tieu,
                "teachers": [self.giang_vien_hd] if self.giang_vien_hd else [],
                "students": authors,
            },
            "history": history,
        }


class Report(db.Model):
    __tablename__ = "bao_cao"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    de_tai_id = db.Column(db.Integer, db.ForeignKey("de_tai.id"), nullable=False)
    loai_bao_cao = db.Column(db.Integer, nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    ngay_nop = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    trang_thai = db.Column(db.Integer, nullable=False, default=0)

    de_tai = db.relationship("Topic", backref=db.backref("reports", lazy=True))


class Notification(db.Model):
    __tablename__ = "thong_bao"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    tieu_de = db.Column(db.String(200), nullable=False)
    noi_dung = db.Column(db.Text, nullable=False)
    nguoi_nhan_id = db.Column(db.Integer, db.ForeignKey("sinh_vien.id"), nullable=True)
    de_tai_id = db.Column(db.Integer, db.ForeignKey("de_tai.id"), nullable=True)
    ngay_gui = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    da_xem = db.Column(db.Boolean, nullable=False, default=False)

    sinh_vien = db.relationship("Student", backref=db.backref("thong_bao", lazy=True))
    de_tai = db.relationship("Topic", backref=db.backref("thong_bao", lazy=True))


class TopicMember(db.Model):
    __tablename__ = "thanh_vien_de_tai"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    de_tai_id = db.Column(db.Integer, db.ForeignKey("de_tai.id"), nullable=False)
    sinh_vien_id = db.Column(db.Integer, db.ForeignKey("sinh_vien.id"), nullable=False)
    vai_tro = db.Column(db.String(50), nullable=False, default="Thành viên")

    de_tai = db.relationship("Topic", back_populates="member_links")
    sinh_vien = db.relationship("Student", back_populates="topic_memberships")

    __table_args__ = (
        db.UniqueConstraint("de_tai_id", "sinh_vien_id", name="uq_topic_member_unique"),
    )


RegistrationPeriod = Period
