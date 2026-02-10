import os
from app import create_app

app = create_app()

if __name__ == '__main__':
    print(f"Running in {os.getenv('RUN_MODE', 'debug')} mode")
    app.run(debug=app.config.get("DEBUG", True))
