import os
from datetime import datetime
import time
import jwt
import requests

from app.config import (
    WEATHER_API_HOST,
    WEATHER_API_TOKEN,
    WEATHER_PEM_KEY,
    WEATHER_SUB_ID,
    WEATHER_KID_ID,
)
from app.services.logging_service import get_api_logger


class WeatherService:
    """天气服务：获取今日天气"""

    def __init__(self):
        if not WEATHER_API_HOST:
            raise ValueError("WEATHER_API_HOST not configured")

        if not WEATHER_API_TOKEN and not (WEATHER_PEM_KEY and WEATHER_SUB_ID and WEATHER_KID_ID):
            raise ValueError("WEATHER_API_TOKEN or WEATHER_PEM_KEY/WEATHER_SUB_ID/WEATHER_KID_ID not configured")

    def _build_jwt(self):
        key = WEATHER_PEM_KEY
        sub_id = WEATHER_SUB_ID
        kid_id = WEATHER_KID_ID
        if not key or not sub_id or not kid_id:
            return None
        key = key.replace("\\n", "\n")
        payload = {
            "iat": int(time.time()) - 30,
            "exp": int(time.time()) + 900,
            "sub": sub_id,
        }
        headers = {
            "kid": kid_id,
        }
        return jwt.encode(payload, key, algorithm="EdDSA", headers=headers)

    def get_today_weather(self, location):
        host = WEATHER_API_HOST.rstrip('/')
        if not host.startswith("http://") and not host.startswith("https://"):
            host = "https://" + host
        url = f"{host}/v7/weather/now"
        logger = get_api_logger()
        headers = {
            "Authorization": f"Bearer {self._build_jwt() or WEATHER_API_TOKEN}",
        }
        params = {
            "location": location,
        }
        logger.info(f"WEATHER_REQUEST url={url} location={location}")
        response = requests.get(url, headers=headers, params=params, timeout=20)
        logger.info(f"WEATHER_RESPONSE status={response.status_code} url={response.url}")
        response.raise_for_status()
        data = response.json()
        if data.get("code") != "200":
            logger.error(f"WEATHER_API_ERROR code={data.get('code')} url={response.url}")
            raise ValueError(f"Weather API error: {data.get('code')}")
        return data

    @staticmethod
    def today_key():
        return datetime.now().strftime("%Y-%m-%d")
