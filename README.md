# UDCK NCKH Website

Backend/Frontend separated Flask app per project requirements.

## Structure

- backend/
  - app/ (Flask application, models, blueprints)
  - requirements.txt
- frontend/
  - templates/ (Jinja templates)
  - static/ (css, js, images)
- uploads/
  - thuyet_minh/
  - reports/
- run.py (entrypoint)

## Setup

1. Create virtual env and install dependencies:

```
python -m venv .venv
.\.venv\Scripts\activate
pip install -r backend/requirements.txt
```

2. Configure database (default SQLite). To use MySQL, set `DATABASE_URL`:

```
set DATABASE_URL=mysql+pymysql://user:pass@host/dbname
```

3. Initialize database and run:

```
python run.py
```

Default admin: `admin` / `admin123`.

Demo student: `K23TT0001` / `123456`.

Demo data:
- Active registration period seeded (open now, closes in ~30 days).
- One demo proposed topic seeded for quick admin approval testing.

## Notes

- File uploads are protected via download endpoints that require login.
- Student can register only during active registration period.
- Admin can create periods, approve/require revision/reject topics, manage progress, score and publish results.
