import json
import os

from app.config import BASE_DIR


class WeatherCacheService:
    """天气图片缓存"""

    def __init__(self):
        self.storage_dir = os.path.join(BASE_DIR, "storage")
        self.cache_file = os.path.join(self.storage_dir, "weather_cache.json")
        os.makedirs(self.storage_dir, exist_ok=True)
        if not os.path.exists(self.cache_file):
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump({}, f)

    def _load(self):
        with open(self.cache_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save(self, data):
        with open(self.cache_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def get(self, date_key, location):
        data = self._load()
        return data.get(date_key, {}).get(location)

    def set(self, date_key, location, value):
        data = self._load()
        day = data.get(date_key, {})
        day[location] = value
        data[date_key] = day
        self._save(data)
