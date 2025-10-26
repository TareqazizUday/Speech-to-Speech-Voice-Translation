"""
WSGI entry point for production deployment
Use this file with Gunicorn or uWSGI

Example usage:
    gunicorn --bind 0.0.0.0:5001 --workers 2 --timeout 300 wsgi:app
"""

from flask_app import app

if __name__ == "__main__":
    app.run()

