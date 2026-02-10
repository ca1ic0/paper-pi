from flask import Flask
from flask_cors import CORS
import os

from app.config import BASE_DIR, SECRET_KEY, DEBUG
from app.routes.main_routes import main_routes
from app.routes.api_routes import api_routes
from app.services.display_service import DisplayService


def create_app():
    app = Flask(
        __name__,
        template_folder=os.path.join(BASE_DIR, "app", "templates"),
        static_folder=os.path.join(BASE_DIR, "app", "static"),
    )

    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["DEBUG"] = DEBUG

    CORS(app)

    app.extensions["display_service"] = DisplayService()

    app.register_blueprint(main_routes)
    app.register_blueprint(api_routes, url_prefix="/api")

    return app
