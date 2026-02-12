from app.models.display_unit import DisplayUnit, register_display_unit
from app.services.weather_service import WeatherService
from app.services.weather_cache_service import WeatherCacheService
from app.services.image_library_service import ImageLibraryService
from app.services.image_gen_service import ImageGenService
from app.services.ina219_service import INA219Service
from app.config import SCREEN_WIDTH, SCREEN_HEIGHT, WEATHER_FONT_PATH
from PIL import Image, ImageDraw, ImageFont, ImageStat
import os
import threading


@register_display_unit
class WeatherDisplayUnit(DisplayUnit):
    """天气显示单元：每日首次生成背景图并缓存"""

    def __init__(self, name, location, display_time=600):
        super().__init__(name, display_time)
        self.location = location
        self.weather_service = WeatherService()
        self.cache_service = WeatherCacheService()
        self.image_library_service = ImageLibraryService()
        self.image_gen_service = ImageGenService()

    def _build_prompt(self, weather_text, temp):
        return (
            f"新海诚风格的天空与城市背景，细腻光影与云层，清新通透。"
            f"今日天气：{weather_text}，气温 {temp}°C。"
        )

    def _weather_icon_kind(self, weather_text):
        text = str(weather_text or "")
        if "雷" in text:
            return "thunder"
        if "雪" in text or "冰" in text:
            return "snow"
        if "雨" in text:
            return "rain"
        if "雾" in text or "霾" in text:
            return "fog"
        if "晴" in text:
            return "sunny"
        if "云" in text or "阴" in text:
            return "cloudy"
        return "cloudy"

    def _draw_weather_icon(self, draw, kind, x, y, size):
        sun = (255, 209, 102, 235)
        cloud = (229, 238, 248, 228)
        rain = (120, 188, 255, 235)
        snow = (220, 242, 255, 240)

        if kind in ("sunny", "thunder"):
            cx = x + size * 0.34
            cy = y + size * 0.34
            r = size * 0.2
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=sun)
            for i in range(8):
                dx = (size * 0.33) * (1 if i % 2 == 0 else 0.75)
                dy = 0
                if i in (1, 2):
                    dx, dy = dx * 0.7, dx * 0.7
                elif i in (3, 4):
                    dx, dy = 0, dx
                elif i in (5, 6):
                    dx, dy = -dx * 0.7, dx * 0.7
                elif i == 7:
                    dx, dy = -dx, 0
                x1, y1 = cx + dx * 0.75, cy + dy * 0.75
                x2, y2 = cx + dx, cy + dy
                draw.line((x1, y1, x2, y2), fill=(255, 233, 165, 230), width=2)

        if kind in ("cloudy", "rain", "snow", "fog", "thunder", "sunny"):
            bx = x + size * 0.2
            by = y + size * 0.32
            draw.ellipse((bx, by + 8, bx + size * 0.28, by + size * 0.34), fill=cloud)
            draw.ellipse((bx + size * 0.16, by, bx + size * 0.48, by + size * 0.34), fill=cloud)
            draw.ellipse((bx + size * 0.36, by + 10, bx + size * 0.7, by + size * 0.35), fill=cloud)
            draw.rounded_rectangle((bx + 2, by + size * 0.2, bx + size * 0.64, by + size * 0.38), radius=10, fill=cloud)

        if kind == "rain":
            for i in range(3):
                rx = x + size * (0.28 + i * 0.16)
                ry = y + size * 0.72
                draw.line((rx, ry, rx - 4, ry + 10), fill=rain, width=3)

        if kind == "snow":
            for i in range(3):
                sx = x + size * (0.28 + i * 0.16)
                sy = y + size * 0.72
                draw.line((sx - 4, sy, sx + 4, sy), fill=snow, width=2)
                draw.line((sx, sy - 4, sx, sy + 4), fill=snow, width=2)

        if kind == "fog":
            for i in range(2):
                fy = y + size * (0.68 + i * 0.12)
                draw.line((x + size * 0.18, fy, x + size * 0.78, fy), fill=(210, 228, 242, 210), width=2)

        if kind == "thunder":
            draw.polygon(
                [
                    (x + size * 0.5, y + size * 0.58),
                    (x + size * 0.42, y + size * 0.8),
                    (x + size * 0.53, y + size * 0.8),
                    (x + size * 0.45, y + size * 0.98),
                    (x + size * 0.64, y + size * 0.7),
                    (x + size * 0.54, y + size * 0.7),
                ],
                fill=(255, 221, 120, 235),
            )

    def _draw_weather_text(self, image, date_text, weather_text, temp, humidity, wind_dir, wind_scale, vis, ups_percent=None):
        base = image.convert("RGBA")
        overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        card_w = int(SCREEN_WIDTH * 0.76)
        card_h = int(SCREEN_HEIGHT * 0.40)
        card_x = int(SCREEN_WIDTH * 0.06)
        card_y = int(SCREEN_HEIGHT * 0.12)
        radius = 18

        draw.rounded_rectangle(
            (card_x, card_y, card_x + card_w, card_y + card_h),
            radius=radius,
            fill=(7, 12, 22, 160),
            outline=(255, 255, 255, 34),
            width=1,
        )

        draw.rounded_rectangle(
            (card_x + 18, card_y + 14, card_x + 138, card_y + 18),
            radius=6,
            fill=(6, 182, 212, 220),
        )

        title_font = self._load_font(42)
        temp_font = self._load_font(50)
        value_font = self._load_font(22)
        meta_font = self._load_font(18)

        def text_size(text, font):
            box = draw.textbbox((0, 0), text, font=font)
            return box[2] - box[0], box[3] - box[1]

        def draw_text_top(x, y, text, font, fill, align="left"):
            box = draw.textbbox((0, 0), text, font=font)
            w = box[2] - box[0]
            h = box[3] - box[1]
            tx = x if align == "left" else x - w
            # Normalize font top offset to keep different fonts/glyphs aligned visually
            ty = y - box[1]
            draw.text((tx, ty), text, fill=fill, font=font)
            return w, h

        left_x = card_x + 22
        right_x = card_x + card_w - 24
        header_y = card_y + 24
        sep_y = card_y + 112

        weather_main = str(weather_text or "未知天气")
        date_main = str(date_text or self.weather_service.today_key())

        temp_value = str(temp if temp not in (None, "") else "--")
        humidity_value = str(humidity if humidity not in (None, "") else "--")
        wind_level = str(wind_scale if wind_scale not in (None, "") else "--")
        wind_direction = str(wind_dir or "--")
        vis_value = str(vis if vis not in (None, "") else "--")

        _, date_h = draw_text_top(left_x, header_y, date_main, meta_font, (210, 223, 236, 226))

        icon_size = 56
        icon_x = left_x
        icon_y = header_y + date_h + 6
        self._draw_weather_icon(draw, self._weather_icon_kind(weather_main), icon_x, icon_y, icon_size)

        weather_x = icon_x + icon_size + 12
        weather_y = icon_y + 2
        draw_text_top(weather_x, weather_y, weather_main, title_font, (255, 255, 255, 242))

        temp_text = f"{temp_value}°C"
        temp_top = header_y + 18
        _, temp_h = draw_text_top(right_x, temp_top, temp_text, temp_font, (242, 250, 255, 238), align="right")
        temp_label = "当前气温"
        draw_text_top(right_x, temp_top + temp_h + 2, temp_label, meta_font, (174, 194, 214, 222), align="right")

        draw.line(
            [(card_x + 18, sep_y), (card_x + card_w - 18, sep_y)],
            fill=(255, 255, 255, 34),
            width=1,
        )

        metrics = [
            ("湿度", f"{humidity_value}%"),
            ("风向", wind_direction),
            ("风力", f"{wind_level}级"),
            ("能见度", f"{vis_value}km"),
        ]
        ups_value = f"{ups_percent}%" if ups_percent is not None else "无电池"
        metrics.append(("UPS电量", ups_value))

        grid_top = sep_y + 14
        col_count = max(1, len(metrics))
        col_w = (card_w - 36) // col_count
        for i, (label, value) in enumerate(metrics):
            col_x = card_x + 18 + i * col_w
            if i > 0:
                draw.line(
                    [(col_x, grid_top + 2), (col_x, grid_top + 52)],
                    fill=(255, 255, 255, 24),
                    width=1,
                )
            _, metric_label_h = draw_text_top(col_x + 10, grid_top + 4, label, meta_font, (170, 190, 210, 220))
            draw_text_top(col_x + 10, grid_top + 8 + metric_label_h, value, value_font, (236, 246, 255, 236))

        composed = Image.alpha_composite(base, overlay).convert("RGB")
        image.paste(composed)

    def _load_font(self, size):
        # Try common fonts, fall back to default
        candidates = []
        if WEATHER_FONT_PATH:
            candidates.append(WEATHER_FONT_PATH)
        candidates += [
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
            "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/truetype/arphic/ukai.ttc",
            "/usr/share/fonts/truetype/arphic/uming.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        ]
        for path in candidates:
            if os.path.exists(path):
                try:
                    return ImageFont.truetype(path, size=size)
                except Exception:
                    continue
        return ImageFont.load_default()

    def _auto_text_color(self, image, pos, width, height):
        x, y = int(pos[0]), int(pos[1])
        pad = 6
        left = max(0, x - pad)
        top = max(0, y - pad)
        right = min(SCREEN_WIDTH, x + width + pad)
        bottom = min(SCREEN_HEIGHT, y + height + pad)
        region = image.crop((left, top, right, bottom)).convert("L")
        mean = ImageStat.Stat(region).mean[0]
        return (255, 255, 255) if mean < 128 else (0, 0, 0)

    def get_image(self):
        date_key = self.weather_service.today_key()
        cached = self.cache_service.get(date_key, self.location)
        if cached and cached.get("image_id"):
            image_path = self.image_library_service.get_image_path(cached["image_id"])
            if image_path:
                return Image.open(image_path).convert("RGB")

        # create placeholder and run async generation
        placeholder = self.image_library_service.add_placeholder(
            original_name=f"weather_{date_key}_{self.location}",
            source_id=self.location,
            style="weather",
        )
        self.cache_service.set(
            date_key,
            self.location,
            {"image_id": placeholder["id"], "status": "processing"},
        )

        def _generate():
            try:
                weather = self.weather_service.get_today_weather(self.location)
                now = weather.get("now", {})
                weather_text = now.get("text", "未知")
                temp = now.get("temp", "--")
                wind_dir = now.get("windDir", "")
                wind_scale = now.get("windScale", "")
                humidity = now.get("humidity", "")
                vis = now.get("vis", "")
                update_time = weather.get("updateTime", "")
                date_text = update_time.split("T")[0] if update_time else self.weather_service.today_key()

                prompt = self._build_prompt(weather_text, temp)
                background = self.image_gen_service.generate_image(
                    prompt, display_size=(SCREEN_WIDTH, SCREEN_HEIGHT)
                )
                try:
                    ups_percent = INA219Service().get_ups_percent()
                except Exception:
                    ups_percent = None

                self._draw_weather_text(
                    background,
                    date_text,
                    weather_text,
                    temp,
                    humidity,
                    wind_dir,
                    wind_scale,
                    vis,
                    ups_percent,
                )

                self.image_library_service.update_item(
                    placeholder["id"],
                    {"status": "ready", "error": None},
                    image=background,
                )
                self.cache_service.set(
                    date_key,
                    self.location,
                    {"image_id": placeholder["id"], "status": "ready"},
                )
            except Exception as e:
                self.image_library_service.update_item(
                    placeholder["id"],
                    {"status": "failed", "error": str(e)},
                )
                self.cache_service.set(
                    date_key,
                    self.location,
                    {"image_id": placeholder["id"], "status": "failed"},
                )

        threading.Thread(target=_generate, daemon=True).start()

        image_path = self.image_library_service.get_image_path(placeholder["id"])
        return Image.open(image_path).convert("RGB")

    def to_dict(self):
        base = super().to_dict()
        base["location"] = self.location
        return base

    @classmethod
    def from_dict(cls, data):
        return cls(
            data.get("name", "Weather DU"),
            data.get("location", ""),
            data.get("display_time", 600),
        )
