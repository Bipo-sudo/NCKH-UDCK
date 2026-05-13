from datetime import datetime

from .extensions import db
from .models import Account, Period, Student, Topic, TopicMember, TopicStatus, Report, Notification


def seed_initial_data():
    # --- Wipe demo/mock data (safe for wiping seeded/demo records) ---
    try:
        # delete child tables first to satisfy FK constraints
        TopicMember.query.delete()
        Report.query.delete()
        Notification.query.delete()
        Topic.query.delete()
        Period.query.delete()
        Student.query.delete()
        Account.query.delete()
        db.session.commit()
    except Exception:
        db.session.rollback()

    # Default accounts
    admin_acc = Account.query.filter_by(username="admin").first()
    if not admin_acc:
        admin_acc = Account(
            username="admin",
            email="admin@udn.vn",
            role="admin",
            is_active=True,
        )
        db.session.add(admin_acc)
    admin_acc.email = "admin@udn.vn"
    admin_acc.role = "admin"
    admin_acc.is_active = True
    admin_acc.set_password("admin123")

    student_acc = Account.query.filter_by(username="K23TT0001").first()
    if not student_acc:
        student_acc = Account(
            username="K23TT0001",
            email="K23TT0001@udn.vn",
            role="student",
            is_active=True,
        )
        db.session.add(student_acc)
    student_acc.email = "K23TT0001@udn.vn"
    student_acc.role = "student"
    student_acc.is_active = True
    student_acc.set_password("123456")

    second_student_acc = Account.query.filter_by(username="K23TT0002").first()
    if not second_student_acc:
        second_student_acc = Account(
            username="K23TT0002",
            email="K23TT0002@udn.vn",
            role="student",
            is_active=True,
        )
        db.session.add(second_student_acc)
    second_student_acc.email = "K23TT0002@udn.vn"
    second_student_acc.role = "student"
    second_student_acc.is_active = True
    second_student_acc.set_password("123456")

    # Ensure periods have persistent IDs before creating topics that reference them
    db.session.flush()
    db.session.commit()

    # Students
    demo_student = Student.query.filter_by(account_id=student_acc.id).first()
    if not demo_student:
        demo_student = Student(
            account_id=student_acc.id,
            mssv="SV2026001",
            ho_ten="Nguyễn Văn A",
            ngay_sinh=datetime(2004, 6, 12).date(),
            so_dien_thoai="0900000001",
            lop="K46A",
            khoa="Công nghệ thông tin",
            khoa_hoc="K46",
        )
        db.session.add(demo_student)

    demo_member = Student.query.filter_by(account_id=second_student_acc.id).first()
    if not demo_member:
        demo_member = Student(
            account_id=second_student_acc.id,
            mssv="SV2026002",
            ho_ten="Trần Văn B",
            ngay_sinh=datetime(2004, 9, 20).date(),
            so_dien_thoai="0900000002",
            lop="K46A",
            khoa="Công nghệ thông tin",
            khoa_hoc="K46",
        )
        db.session.add(demo_member)

    db.session.flush()

    for period in Period.query.all():
        if period.nam_hoc and period.nam_hoc.startswith("Năm học "):
            period.nam_hoc = period.nam_hoc.replace("Năm học ", "", 1).strip()

        if not period.ten_dot and period.nam_hoc:
            period.ten_dot = f"Đợt NCKH Sinh viên Cấp Trường - {period.nam_hoc}"
        if not period.cap_bac:
            period.cap_bac = "Cấp Trường"

    # Academic years (one record per year)
    school_year_2025 = Period.query.filter_by(nam_hoc="2025-2026").first()
    if not school_year_2025:
        school_year_2025 = Period(
            ten_dot="Đợt NCKH Sinh viên Cấp Trường - 2025-2026",
            nam_hoc="2025-2026",
            mo_ta="Lộ trình NCKH theo năm học được cấu hình động bằng 4 mốc thời gian.",
            thoi_gian_thong_bao=datetime(2025, 9, 15, 8, 0, 0),
            thoi_gian_mo_dang_ky=datetime(2025, 10, 1, 8, 0, 0),
            han_dang_ky=datetime(2025, 12, 31, 23, 59, 59),
            thoi_gian_mo_nop_bao_cao=datetime(2026, 1, 1, 8, 0, 0),
            han_nop_bao_cao=datetime(2026, 6, 30, 23, 59, 59),
            thoi_gian_bat_dau_bao_ve=datetime(2026, 7, 1, 8, 0, 0),
            han_bao_ve=datetime(2026, 7, 7, 23, 59, 59),
            cap_bac="Cấp Trường",
            trang_thai_dot=2,
            file_dinh_kem="/uploads/thong_bao/nam_hoc_2025_2026_nckh.pdf",
        )
        school_year_2025.sync_trang_thai_dot(datetime(2025, 10, 15, 12, 0, 0))
        db.session.add(school_year_2025)

    school_year_2024 = Period.query.filter_by(nam_hoc="2024-2025").first()
    if not school_year_2024:
        school_year_2024 = Period(
            ten_dot="Đợt NCKH Sinh viên Cấp Trường - 2024-2025",
            nam_hoc="2024-2025",
            mo_ta="Năm học trước dùng cho dữ liệu thống kê và đối chiếu.",
            thoi_gian_thong_bao=datetime(2024, 9, 15, 8, 0, 0),
            thoi_gian_mo_dang_ky=datetime(2024, 10, 1, 8, 0, 0),
            han_dang_ky=datetime(2024, 12, 31, 23, 59, 59),
            thoi_gian_mo_nop_bao_cao=datetime(2025, 1, 1, 8, 0, 0),
            han_nop_bao_cao=datetime(2025, 6, 30, 23, 59, 59),
            thoi_gian_bat_dau_bao_ve=datetime(2025, 7, 1, 8, 0, 0),
            han_bao_ve=datetime(2025, 7, 7, 23, 59, 59),
            cap_bac="Cấp Trường",
            trang_thai_dot=4,
            file_dinh_kem="/uploads/thong_bao/nam_hoc_2024_2025_nckh.pdf",
        )
        school_year_2024.sync_trang_thai_dot(datetime(2025, 7, 1, 0, 0, 0))
        db.session.add(school_year_2024)

    db.session.flush()

    # Topics
    topic = Topic.query.filter_by(chu_nhiem_id=demo_student.id, ten_de_tai="Demo đề tài nghiên cứu").first()
    if not topic:
        topic = Topic(
            dot_id=school_year_2025.id,
            chu_nhiem_id=demo_student.id,
            ten_de_tai="Demo đề tài nghiên cứu",
            muc_tieu="Mục tiêu: demo giao diện và kiểm tra luồng nghiệp vụ.",
            linh_vuc="Công nghệ thông tin",
            khoa_thuc_hien="Công nghệ thông tin",
            giang_vien_hd="GV Demo",
            trang_thai=TopicStatus.CHO_DUYET_DE_CUONG,
            ly_do=None,
            lien_ket_ngoai="https://github.com/demo/demo-topic",
            file_de_xuat='["/uploads/reports/thuyet_minh/demo_de_xuat_01.pdf"]',
            file_bao_cao=None,
            cap_giai_thuong=None,
            xep_loai_giai=None,
        )
        db.session.add(topic)

    db.session.flush()

    if topic.id and not TopicMember.query.filter_by(de_tai_id=topic.id, sinh_vien_id=demo_member.id).first():
        db.session.add(
            TopicMember(
                de_tai=topic,
                sinh_vien=demo_member,
                vai_tro="Thành viên",
            )
        )

    demo_topics = [
        # ==========================================
        # NHÓM 1: ĐANG HOẠT ĐỘNG (ACTIVE) - ĐỢT 2025-2026
        # ==========================================
        
        # 1. Đang làm báo cáo bình thường (Trạng thái 4)
        {
            "dot_id": school_year_2025.id,
            "chu_nhiem_id": demo_member.id,
            "ten_de_tai": "Nghiên cứu mô hình ngôn ngữ lớn (LLM) trong giáo dục",
            "muc_tieu": "Tích hợp AI vào hệ thống LMS để hỗ trợ sinh viên tự học.",
            "san_pham_du_kien": "01 Prototype Chatbot, 01 Bài báo khoa học",
            "linh_vuc": "Trí tuệ nhân tạo",
            "khoa_thuc_hien": "Công nghệ thông tin",
            "giang_vien_hd": "TS. Nguyễn A",
            "trang_thai": 4, # Đang triển khai
            "ly_do": None,
            "lien_ket_ngoai": "https://github.com/demo/llm-education",
            "file_de_xuat": '["/uploads/llm_de_xuat.pdf"]',
            "file_bao_cao": None,
            "cap_giai_thuong": None,
            "xep_loai_giai": None,
            # legacy field `da_ky_hop_dong` removed
        },
        
        # 2. Đã nộp báo cáo sớm, chờ nghiệm thu (Trạng thái 5)
        {
            "dot_id": school_year_2025.id,
            "chu_nhiem_id": demo_student.id,
            "ten_de_tai": "Phát triển ứng dụng di động hỗ trợ người khuyết tật",
            "muc_tieu": "Xây dựng ứng dụng chuyển đổi giọng nói thành văn bản và ngược lại.",
            "san_pham_du_kien": "01 Ứng dụng Android/iOS, Mã nguồn",
            "linh_vuc": "Phần mềm",
            "khoa_thuc_hien": "Công nghệ thông tin",
            "giang_vien_hd": "ThS. Trần B",
            "trang_thai": 5, # Chờ nghiệm thu
            "ly_do": None,
            "lien_ket_ngoai": "https://github.com/demo/accessibility-app",
            "file_de_xuat": '["/uploads/app_dexuat.pdf"]',
            "file_bao_cao": '["/uploads/app_baocao_final.pdf"]',
            "cap_giai_thuong": None,
            "xep_loai_giai": None,
            # legacy field `da_ky_hop_dong` removed
        },
        
        # 3. Nộp báo cáo sớm nhưng bị yêu cầu sửa lại (Trạng thái 6)
        {
            "dot_id": school_year_2025.id,
            "chu_nhiem_id": demo_member.id,
            "ten_de_tai": "Hệ thống IoT quan trắc môi trường nước",
            "muc_tieu": "Thu thập dữ liệu pH, nhiệt độ nước qua cảm biến và hiển thị lên web.",
            "san_pham_du_kien": "01 Mô hình phần cứng, 01 Website quản lý",
            "linh_vuc": "AIoT",
            "khoa_thuc_hien": "Công nghệ thông tin",
            "giang_vien_hd": "PGS. TS Lê C",
            "trang_thai": 6, # Yêu cầu sửa báo cáo
            "ly_do": "Báo cáo sai format trang bìa, thiếu phần đánh giá độ trễ của sensor. Yêu cầu nộp lại bản sửa trước 30/6.",
            "lien_ket_ngoai": "https://github.com/demo/iot-water-monitor",
            "file_de_xuat": '["/uploads/iot_dexuat.pdf"]',
            "file_bao_cao": '["/uploads/iot_baocao_v1.pdf"]',
            "cap_giai_thuong": None,
            "xep_loai_giai": None,
            # legacy field `da_ky_hop_dong` removed
        },

        # ==========================================
        # NHÓM 2: LƯU TRỮ / ĐÃ CHẾT (ARCHIVED) - ĐỢT 2025-2026
        # ==========================================
        
        # 4. Quá hạn: Kẹt ở bước Chờ duyệt đề xuất do qua ngày 31/12/2025 (Trạng thái 1)
        {
            "dot_id": school_year_2025.id,
            "chu_nhiem_id": demo_student.id,
            "ten_de_tai": "Nghiên cứu ứng dụng Blockchain trong ngân hàng",
            "muc_tieu": "Tìm hiểu lý thuyết về Smart Contract trong giao dịch tài chính.",
            "san_pham_du_kien": "01 Báo cáo lý thuyết",
            "linh_vuc": "Hệ thống thông tin",
            "khoa_thuc_hien": "Công nghệ thông tin",
            "giang_vien_hd": "ThS. Hoàng D",
            "trang_thai": 1, # Chờ duyệt đề xuất
            "ly_do": None,
            "lien_ket_ngoai": None,
            "file_de_xuat": '["/uploads/bc_dexuat.pdf"]',
            "file_bao_cao": None,
            "cap_giai_thuong": None,
            "xep_loai_giai": None,
            # legacy field `da_ky_hop_dong` removed
        },
        
        # 5. Quá hạn: Bị yêu cầu sửa đề cương từ T11/2025 nhưng bỏ ngang (Trạng thái 2)
        {
            "dot_id": school_year_2025.id,
            "chu_nhiem_id": demo_member.id,
            "ten_de_tai": "Website thương mại điện tử bán đồ cũ",
            "muc_tieu": "Tạo website bán hàng bằng ReactJS và NodeJS.",
            "san_pham_du_kien": "01 Website",
            "linh_vuc": "Phần mềm",
            "khoa_thuc_hien": "Công nghệ thông tin",
            "giang_vien_hd": "TS. Phạm E",
            "trang_thai": 2, # Yêu cầu sửa đề cương
            "ly_do": "Mục tiêu quá đơn giản, giống đồ án môn học, không mang tính nghiên cứu khoa học. Cần bổ sung thuật toán gợi ý sản phẩm.",
            "lien_ket_ngoai": "https://github.com/demo/ecommerce-basic",
            "file_de_xuat": '["/uploads/web_dexuat.pdf"]',
            "file_bao_cao": None,
            "cap_giai_thuong": None,
            "xep_loai_giai": None,
            # legacy field `da_ky_hop_dong` removed
        },
        
        # 6. Đã chết: Bị từ chối duyệt đề cương thẳng tay (Trạng thái 3)
        {
            "dot_id": school_year_2025.id,
            "chu_nhiem_id": demo_student.id,
            "ten_de_tai": "Công cụ tấn công mạng tự động (Auto Exploit)",
            "muc_tieu": "Xây dựng tool tự động quét và khai thác lỗ hổng mạng nội bộ.",
            "san_pham_du_kien": "01 Tool Python",
            "linh_vuc": "An toàn thông tin",
            "khoa_thuc_hien": "Công nghệ thông tin",
            "giang_vien_hd": "Không có",
            "trang_thai": 3, # Bị từ chối
            "ly_do": "Đề tài vi phạm nghiêm trọng chính sách và đạo đức nghiên cứu. Không được phép thực hiện.",
            "lien_ket_ngoai": None,
            "file_de_xuat": '["/uploads/hack_dexuat.pdf"]',
            "file_bao_cao": None,
            "cap_giai_thuong": None,
            "xep_loai_giai": None,
            # legacy field `da_ky_hop_dong` removed
        }
    ]

    for topic_payload in demo_topics:
        exists = Topic.query.filter_by(
            chu_nhiem_id=topic_payload["chu_nhiem_id"],
            ten_de_tai=topic_payload["ten_de_tai"],
        ).first()
        if not exists:
            db.session.add(Topic(**topic_payload))

    db.session.commit()
