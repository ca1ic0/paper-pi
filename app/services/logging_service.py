import logging
import os

from app.config import BASE_DIR


def get_api_logger():
    log_dir = os.path.join(BASE_DIR, "LOG")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "api.log")

    logger = logging.getLogger("external_api")
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)
    handler = logging.FileHandler(log_file)
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(message)s"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger
