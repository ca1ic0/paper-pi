import os
import signal
import sys
from app import create_app
from app.models.empty_du import EmptyDisplayUnit

app = create_app()

def _handle_shutdown(signum, frame):
    try:
        display_service = app.extensions.get("display_service")
        if display_service:
            white = EmptyDisplayUnit("Shutdown White").get_image()
            display_service.display_image(white)
    finally:
        sys.exit(0)

signal.signal(signal.SIGINT, _handle_shutdown)
signal.signal(signal.SIGTERM, _handle_shutdown)

if __name__ == '__main__':
    print(f"Running in {os.getenv('RUN_MODE', 'debug')} mode")
    app.run(debug=app.config.get("DEBUG", True))
