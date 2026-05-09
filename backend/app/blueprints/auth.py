from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_user, logout_user, current_user
from ..extensions import db, login_manager
from ..models import Account


auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/")
def root():
    return login()


@login_manager.user_loader
def load_user(user_id):
    return Account.query.get(int(user_id))


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("student.dashboard") if not current_user.is_admin else url_for("admin.dashboard"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        account = Account.query.filter_by(username=username).first()
        if account and account.check_password(password) and account.is_active:
            login_user(account)
            flash("Đăng nhập thành công", "success")
            return redirect(url_for("student.dashboard") if not account.is_admin else url_for("admin.dashboard"))
        flash("Sai thông tin đăng nhập hoặc tài khoản bị khóa", "danger")
    return render_template("auth/login.html")


@auth_bp.route("/logout")
def logout():
    logout_user()
    flash("Đã đăng xuất", "info")
    return redirect(url_for("auth.login"))
