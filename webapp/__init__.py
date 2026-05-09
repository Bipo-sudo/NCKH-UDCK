import os
from flask import Flask
from .config import Config
from .extensions import db, migrate, login_manager
from .blueprints.auth import auth_bp
from .blueprints.student import student_bp
from .blueprints.admin import admin_bp


def create_app():
    app = Flask(__name__)
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

    return app
