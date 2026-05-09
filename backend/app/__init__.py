import os
import sqlite3
from flask import Flask
from .config import Config, ROOT_DIR
from .extensions import db, migrate, login_manager
from .blueprints.auth import auth_bp
from .blueprints.student import student_bp
from .blueprints.admin import admin_bp
from .blueprints.api import api_bp
from .seed import seed_initial_data


def _sqlite_db_path(app: Flask) -> str | None:
    uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if not uri.startswith("sqlite:///"):
        return None
    return uri.replace("sqlite:///", "", 1)


def _reset_sqlite_db_if_schema_mismatch(app: Flask) -> None:
    db_path = _sqlite_db_path(app)
    if not db_path or not os.path.exists(db_path):
        return

    required_columns = {
        "tai_khoan": {"id", "username", "email", "password_hash", "phone", "role", "is_active"},
        "sinh_vien": {"id", "account_id", "mssv", "ho_ten", "ngay_sinh", "so_dien_thoai", "lop", "khoa", "khoa_hoc"},
        "dot_nckh": {"id", "ten_dot", "nam_hoc", "mo_ta", "thoi_gian_thong_bao", "thoi_gian_mo_dang_ky", "han_nop_de_cuong", "han_nop_bao_cao", "cap_bac", "trang_thai_dot", "file_dinh_kem"},
        "de_tai": {"id", "dot_id", "chu_nhiem_id", "ten_de_tai", "muc_tieu", "san_pham_du_kien", "linh_vuc", "khoa_thuc_hien", "giang_vien_hd", "trang_thai", "ly_do", "lien_ket_ngoai", "file_de_xuat", "file_bao_cao", "file_thuyet_minh", "cap_giai_thuong", "xep_loai_giai", "da_ky_hop_dong", "created_at", "updated_at"},
        "thanh_vien_de_tai": {"id", "de_tai_id", "sinh_vien_id", "vai_tro"},
        "bao_cao": {"id", "de_tai_id", "loai_bao_cao", "file_path", "ngay_nop", "trang_thai"},
        "thong_bao": {"id", "tieu_de", "noi_dung", "nguoi_nhan_id", "de_tai_id", "ngay_gui", "da_xem"},
    }

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        existing_tables = {
            row[0]
            for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }

        if not existing_tables:
            conn.close()
            return

        mismatch = False
        for table_name, expected_cols in required_columns.items():
            if table_name not in existing_tables:
                mismatch = True
                break
            actual_cols = {row[1] for row in cursor.execute(f"PRAGMA table_info({table_name})").fetchall()}
            if not expected_cols.issubset(actual_cols):
                mismatch = True
                break

        conn.close()
        if mismatch:
            os.remove(db_path)
    except Exception:
        try:
            conn.close()
        except Exception:
            pass
        # If schema inspection fails, keep the current DB rather than risk deleting a valid one.
        return


def create_app():
    template_folder = os.path.join(ROOT_DIR, "frontend", "templates")
    static_folder = os.path.join(ROOT_DIR, "frontend", "static")
    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
    app.config.from_object(Config)

    # Ensure upload directories exist
    os.makedirs(app.config.get("THUYET_MINH_UPLOAD_FOLDER"), exist_ok=True)
    os.makedirs(app.config.get("REPORTS_UPLOAD_FOLDER"), exist_ok=True)

    # Init extensions
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(student_bp, url_prefix="/student")
    app.register_blueprint(admin_bp, url_prefix="/admin")
    app.register_blueprint(api_bp, url_prefix="/api")

    with app.app_context():
        _reset_sqlite_db_if_schema_mismatch(app)
        # Ensure a real DB connection (prevent accidental SQLite auto-create in production)
        db_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
        has_mysql_env = bool(os.getenv('SQLALCHEMY_DATABASE_URI') or (os.getenv('DATABASE_URL') and 'mysql' in os.getenv('DATABASE_URL')) or os.getenv('MYSQL_DB'))
        if not has_mysql_env and db_uri.startswith('sqlite'):
            raise RuntimeError("MySQL DATABASE not configured. Aborting startup instead of using SQLite fallback.")

        # Auto-create tables and seed only when a DB is configured
        db.create_all()
        # seed_initial_data()

    return app
