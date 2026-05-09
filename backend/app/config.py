import os
from datetime import timedelta

# Xác định các thư mục gốc
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# ROOT_DIR trỏ ra thư mục ngoài cùng (nơi chứa run.py và ca.pem)
ROOT_DIR = os.path.dirname(os.path.dirname(BASE_DIR))

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "change-this-key")
    
    # 1. Đọc URI từ biến môi trường
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    
    # 2. Cấu hình SSL chính xác cho Aiven MySQL
    # Đường dẫn tuyệt đối tới file ca.pem ở thư mục gốc
    CA_CERT_PATH = os.path.join(ROOT_DIR, "ca.pem")

    if SQLALCHEMY_DATABASE_URI and "mysql+pymysql" in SQLALCHEMY_DATABASE_URI:
        SQLALCHEMY_ENGINE_OPTIONS = {
            'connect_args': {
                'ssl': {
                    'ca': CA_CERT_PATH
                }
            },
            # Giúp duy trì kết nối ổn định trên server
            'pool_recycle': 280,
            'pool_pre_ping': True
        }

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Upload folders (Sử dụng ROOT_DIR để lưu vào thư mục /uploads ở gốc dự án)
    THUYET_MINH_UPLOAD_FOLDER = os.path.join(ROOT_DIR, "uploads", "thuyet_minh")
    REPORTS_UPLOAD_FOLDER = os.path.join(ROOT_DIR, "uploads", "reports")

    # Allowed extensions
    ALLOWED_THUYET_MINH_EXTENSIONS = {"pdf", "docx"}
    ALLOWED_REPORT_EXTENSIONS = {"pdf", "docx", "zip", "rar"}
    ALLOWED_PROFILE_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png"}

    # Session lifetime
    PERMANENT_SESSION_LIFETIME = timedelta(hours=8)
