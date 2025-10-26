import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    UPLOAD_FOLDER = 'uploads'
    OUTPUT_FOLDER = 'outputs'
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024
    ALLOWED_EXTENSIONS = {'wav', 'mp3'}
    SAMPLING_RATE = 16000
    MODEL_NAME = "facebook/seamless-m4t-v2-large"
    TRUST_REMOTE_CODE = True
    LOCAL_FILES_ONLY = False
    SUPPORTED_LANGUAGES = {
        "Bengali": "ben",
        "English": "eng",
        "Chinese": "cmn",
        "Spanish": "spa",
        "German": "deu",
        "Arabic": "arb",
        "Japanese": "jpn",
        "Korean": "kor",
        "Portuguese": "por",
        "French": "fra",
        "Italian": "ita",
        "Russian": "rus",
    }

class DevelopmentConfig(Config):
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.environ.get('SECRET_KEY')
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    WTF_CSRF_ENABLED = False

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

