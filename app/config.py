import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

SECRET_KEY = os.getenv("SECRET_KEY")
DEBUG = os.getenv("DEBUG", "True").lower() == "true"
RUN_MODE = os.getenv("RUN_MODE", "debug")

SCREEN_WIDTH = int(os.getenv("SCREEN_WIDTH", "800"))
SCREEN_HEIGHT = int(os.getenv("SCREEN_HEIGHT", "480"))

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
DASHSCOPE_COMPAT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DASHSCOPE_HTTP_BASE_URL = "https://dashscope.aliyuncs.com/api/v1"

WEATHER_API_HOST = os.getenv("WEATHER_API_HOST")
WEATHER_API_TOKEN = os.getenv("WEATHER_API_TOKEN")
WEATHER_PEM_KEY = os.getenv("WEATHER_PEM_KEY")
WEATHER_SUB_ID = os.getenv("WEATHER_SUB_ID")
WEATHER_KID_ID = os.getenv("WEATHER_KID_ID")
WEATHER_FONT_PATH = os.getenv("WEATHER_FONT_PATH")
