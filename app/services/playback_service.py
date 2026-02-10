import json
import os
import threading
import time

from app.config import BASE_DIR


class PlaybackService:
    """服务器端播放控制：循环播放播放列表并驱动显示服务"""

    def __init__(self, api_controller, display_service):
        self.api_controller = api_controller
        self.display_service = display_service
        self._thread = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._lock = threading.Lock()
        self._current_playlist_id = None
        self._state_file = os.path.join(BASE_DIR, "storage", "playback_state.json")
        self._load_state()

    def _load_state(self):
        try:
            if os.path.exists(self._state_file):
                with open(self._state_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._current_playlist_id = data.get("active_playlist_id")
        except Exception:
            self._current_playlist_id = None

    def _save_state(self):
        os.makedirs(os.path.dirname(self._state_file), exist_ok=True)
        with open(self._state_file, "w", encoding="utf-8") as f:
            json.dump({"active_playlist_id": self._current_playlist_id}, f, indent=2)

    def status(self):
        return {
            "active_playlist_id": self._current_playlist_id,
            "is_running": self._thread is not None and self._thread.is_alive(),
            "is_paused": self._pause_event.is_set(),
        }

    def play(self, playlist_id):
        with self._lock:
            self._current_playlist_id = playlist_id
            self._save_state()
            self._pause_event.clear()
            if self._thread and self._thread.is_alive():
                return
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()

    def pause(self):
        self._pause_event.set()

    def stop(self):
        with self._lock:
            self._stop_event.set()
            self._pause_event.clear()
            self._current_playlist_id = None
            self._save_state()

    def _run(self):
        while not self._stop_event.is_set():
            playlist_id = self._current_playlist_id
            if not playlist_id:
                break
            playlist = self.api_controller.get_playlist(playlist_id)
            if not playlist:
                self._current_playlist_id = None
                self._save_state()
                break

            for du_id in playlist.get("display_units", []):
                if self._stop_event.is_set():
                    break
                while self._pause_event.is_set() and not self._stop_event.is_set():
                    time.sleep(0.2)
                du = self.api_controller.display_units.get(du_id)
                if not du:
                    continue
                try:
                    image = du.get_image()
                    self.display_service.display_image(image)
                except Exception:
                    pass
                duration = getattr(du, "display_time", 1)
                end_time = time.time() + max(1, int(duration))
                while time.time() < end_time:
                    if self._stop_event.is_set():
                        break
                    while self._pause_event.is_set() and not self._stop_event.is_set():
                        time.sleep(0.2)
                    time.sleep(0.2)

