from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy import case

from .extensions import db


class TopicStatus:
    CHO_DUYET_DE_CUONG = 1
    SUA_DE_CUONG = 2
    BI_TU_CHOI = 3
    DANG_TRIEN_KHAI = 4
    CHO_BAO_VE = 5
    SUA_SAU_BAO_VE = 6
    KHONG_DAT = 7
    NGHIEM_THU_THANH_CONG = 8

    CHO_DUYET_DE_XUAT = CHO_DUYET_DE_CUONG
    SUA_DE_XUAT = SUA_DE_CUONG
    DANG_THUC_HIEN = DANG_TRIEN_KHAI
    CHO_NGHIEM_THU = CHO_BAO_VE
    SUA_BAO_CAO = SUA_SAU_BAO_VE
    HOAN_THANH = NGHIEM_THU_THANH_CONG

    CHO_XET_DUYET = CHO_DUYET_DE_CUONG
    YEU_CAU_CHINH_SUA = SUA_DE_CUONG
    DA_HOAN_THANH = NGHIEM_THU_THANH_CONG


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


class Period(db.Model):
    __tablename__ = "dot_nckh"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nam_hoc = db.Column(db.String(50), nullable=False, unique=True)
    mo_ta = db.Column(db.Text, nullable=True)
    thoi_gian_thong_bao = db.Column(db.DateTime, nullable=False)
    thoi_gian_mo_dang_ky = db.Column(db.DateTime, nullable=False)
    han_nop_de_cuong = db.Column(db.DateTime, nullable=False)
    han_nop_bao_cao = db.Column(db.DateTime, nullable=False)
    cap_bac = db.Column(db.String(20), nullable=True)
    trang_thai_dot = db.Column(db.Integer, nullable=True)
    file_dinh_kem = db.Column(db.String(500), nullable=True)

    de_tai = db.relationship("Topic", back_populates="dot", lazy=True, cascade="all, delete-orphan")

    def compute_trang_thai_dot(self, now: datetime | None = None) -> int:
        now = now or datetime.utcnow()
        if now < self.thoi_gian_mo_dang_ky:
            return 1
        if now < self.han_nop_de_cuong:
            return 2
        if now < self.han_nop_bao_cao:
            return 3
        return 4

    def sync_trang_thai_dot(self, now: datetime | None = None) -> int:
        self.trang_thai_dot = self.compute_trang_thai_dot(now)
        return self.trang_thai_dot

    @property
    def trang_thai_dot_hien_tai(self) -> int:
        return self.compute_trang_thai_dot()

    @property
    def thoi_gian_trien_khai(self) -> str:
        return f"{self.han_nop_de_cuong:%d/%m/%Y %H:%M} - {self.han_nop_bao_cao:%d/%m/%Y %H:%M}"

    @hybrid_property
    def ten_dot(self):
        return self.nam_hoc

    @ten_dot.setter
    def ten_dot(self, value):
        self.nam_hoc = value

    @hybrid_property
    def han_nop_de_xuat(self):
        return self.han_nop_de_cuong

    @han_nop_de_xuat.setter
    def han_nop_de_xuat(self, value):
        self.han_nop_de_cuong = value

    @hybrid_property
    def han_dang_ky(self):
        return self.thoi_gian_mo_dang_ky

    @han_dang_ky.setter
    def han_dang_ky(self, value):
        self.thoi_gian_mo_dang_ky = value

    @hybrid_property
    def han_bao_ve(self):
        return self.han_nop_bao_cao

    @han_bao_ve.setter
    def han_bao_ve(self, value):
        self.han_nop_bao_cao = value

    @property
    def ten_trang_thai_dot(self) -> str:
        mapping = {
            1: "Chưa mở đăng ký",
            2: "Đang mở đăng ký",
            3: "Đang nộp báo cáo",
            4: "Đã đóng đăng ký",
        }
        return mapping.get(self.trang_thai_dot_hien_tai, "Không xác định")


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
    da_ky_hop_dong = db.Column(db.Boolean, nullable=False, default=False)

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

    @hybrid_property
    def sinh_vien_id(self) -> int:
        return self.chu_nhiem_id

    @sinh_vien_id.setter
    def sinh_vien_id(self, value: int) -> None:
        self.chu_nhiem_id = value

    @sinh_vien_id.expression
    def sinh_vien_id(cls):
        return cls.chu_nhiem_id

    @hybrid_property
    def dot_dang_ky_id(self) -> int:
        return self.dot_id

    @dot_dang_ky_id.setter
    def dot_dang_ky_id(self, value: int) -> None:
        self.dot_id = value

    @dot_dang_ky_id.expression
    def dot_dang_ky_id(cls):
        return cls.dot_id

    @hybrid_property
    def giang_vien_huong_dan(self):
        return self.giang_vien_hd

    @giang_vien_huong_dan.setter
    def giang_vien_huong_dan(self, value):
        self.giang_vien_hd = value

    @hybrid_property
    def mo_ta(self):
        return self.muc_tieu

    @mo_ta.setter
    def mo_ta(self, value):
        self.muc_tieu = value


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
