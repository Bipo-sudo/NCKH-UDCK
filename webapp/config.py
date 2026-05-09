import os
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "change-this-key")
    # Prefer DATABASE_URL env (e.g., mysql+pymysql://user:pass@host/dbname)
    DATABASE_URL = os.getenv("DATABASE_URL")
    if DATABASE_URL:
        SQLALCHEMY_DATABASE_URI = DATABASE_URL
    else:
        SQLALCHEMY_DATABASE_URI = (
            "sqlite:///" + os.path.join(ROOT_DIR, "webdknckh.db")
        )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Upload folders
    THUYET_MINH_UPLOAD_FOLDER = os.path.join(ROOT_DIR, "uploads", "thuyet_minh")
    REPORTS_UPLOAD_FOLDER = os.path.join(ROOT_DIR, "uploads", "reports")

    # Allowed extensions
    ALLOWED_THUYET_MINH_EXTENSIONS = {"pdf", "docx"}
    ALLOWED_REPORT_EXTENSIONS = {"pdf", "docx", "zip", "rar"}
    ALLOWED_PROFILE_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png"}

    # Session lifetime
    PERMANENT_SESSION_LIFETIME = timedelta(hours=8)
