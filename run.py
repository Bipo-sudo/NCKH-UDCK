import pymysql
pymysql.install_as_MySQLdb()

import os
from dotenv import load_dotenv

# Lấy đường dẫn file .env
basedir = os.path.abspath(os.path.dirname(__file__))
env_file = os.path.join(basedir, '.env')

# Chỉ nạp load_dotenv nếu file .env tồn tại (chủ yếu cho máy local)
if os.path.exists(env_file):
    load_dotenv(env_file, override=True)
    print("Đã nạp biến môi trường từ file .env")
else:
    print("Không tìm thấy file .env, sử dụng biến môi trường hệ thống (Render)")

# Kiểm tra xem có DATABASE_URL chưa
db_url = os.environ.get('DATABASE_URL')
print(f"DATABASE_URL hiện tại: {db_url}")

from backend.app import create_app

app = create_app()

if __name__ == '__main__':
    # Khi deploy, Render sẽ tự quản lý port, local thì dùng 5000
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
