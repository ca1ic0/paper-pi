from app.models.display_unit import DisplayUnit, register_display_unit
from app.services.weather_service import WeatherService
from app.services.weather_cache_service import WeatherCacheService
from app.services.image_library_service import ImageLibraryService
from app.services.image_gen_service import ImageGenService
from app.config import SCREEN_WIDTH, SCREEN_HEIGHT, WEATHER_FONT_PATH
from PIL import Image, ImageDraw, ImageFont, ImageStat
import os
import threading


@register_display_unit
class WeatherDisplayUnit(DisplayUnit):
    """天气显示单元：每日首次生成背景图并缓存"""

    def __init__(self, name, location, display_time=30):
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

    def _draw_weather_text(self, image, date_text, weather_text, temp, humidity, wind_dir, wind_scale, vis):
        base = image.convert("RGBA")
        overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        card_w = int(SCREEN_WIDTH * 0.84)
        card_h = int(SCREEN_HEIGHT * 0.52)
        card_x = (SCREEN_WIDTH - card_w) // 2
        card_y = int(SCREEN_HEIGHT * 0.2)
        radius = 20

        draw.rounded_rectangle(
            (card_x, card_y, card_x + card_w, card_y + card_h),
            radius=radius,
            fill=(7, 12, 22, 176),
            outline=(255, 255, 255, 40),
            width=2,
        )

        draw.rounded_rectangle(
            (card_x + 24, card_y + 18, card_x + 168, card_y + 23),
            radius=6,
            fill=(6, 182, 212, 220),
        )

        title_font = self._load_font(58)
        temp_font = self._load_font(72)
        sub_font = self._load_font(27)
        meta_font = self._load_font(22)

        def text_size(text, font):
            box = draw.textbbox((0, 0), text, font=font)
            return box[2] - box[0], box[3] - box[1]

        left_pad = 30
        right_pad = 28
        top_pad = 34
        header_h = 178
        left_x = card_x + left_pad
        header_y = card_y + top_pad
        right_x = card_x + int(card_w * 0.56)

        weather_main = str(weather_text or "未知天气")
        date_main = str(date_text or self.weather_service.today_key())

        temp_value = str(temp if temp not in (None, "") else "--")
        humidity_value = str(humidity if humidity not in (None, "") else "--")
        wind_level = str(wind_scale if wind_scale not in (None, "") else "--")
        wind_direction = str(wind_dir or "--")
        vis_value = str(vis if vis not in (None, "") else "--")

        draw.text((left_x, header_y), date_main, fill=(208, 220, 235, 232), font=meta_font)

        date_w, date_h = text_size(date_main, meta_font)
        weather_y = header_y + date_h + 14
        draw.text((left_x, weather_y), weather_main, fill=(255, 255, 255, 242), font=title_font)

        temp_text = f"{temp_value}°"
        temp_w, temp_h = text_size(temp_text, temp_font)
        temp_y = header_y + 8
        draw.text((right_x + right_pad, temp_y), temp_text, fill=(246, 252, 255, 240), font=temp_font)
        draw.text((right_x + right_pad + temp_w + 8, temp_y + temp_h - 34), "C", fill=(188, 206, 226, 230), font=sub_font)
        draw.text((right_x + right_pad, temp_y + temp_h + 8), "当前气温", fill=(176, 196, 214, 228), font=meta_font)

        sep_y = card_y + header_h
        draw.line(
            [(card_x + 22, sep_y), (card_x + card_w - 22, sep_y)],
            fill=(255, 255, 255, 36),
            width=2,
        )

        grid_top = sep_y + 18
        grid_left = card_x + 24
        grid_gap = 14
        grid_w = card_w - 48
        cell_w = (grid_w - grid_gap) // 2
        cell_h = 74

        metrics = [
            ("湿度", f"{humidity_value}%"),
            ("风向", wind_direction),
            ("风力", f"{wind_level}级"),
            ("能见度", f"{vis_value}km"),
        ]

        for i, (label, value) in enumerate(metrics):
            row = i // 2
            col = i % 2
            cell_x = grid_left + col * (cell_w + grid_gap)
            cell_y = grid_top + row * (cell_h + 12)

            draw.rounded_rectangle(
                (cell_x, cell_y, cell_x + cell_w, cell_y + cell_h),
                radius=12,
                fill=(12, 22, 36, 128),
                outline=(255, 255, 255, 28),
                width=1,
            )
            draw.text((cell_x + 14, cell_y + 11), label, fill=(175, 194, 212, 226), font=meta_font)
            draw.text((cell_x + 14, cell_y + 36), value, fill=(236, 246, 255, 236), font=sub_font)

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
                self._draw_weather_text(
                    background,
                    date_text,
                    weather_text,
                    temp,
                    humidity,
                    wind_dir,
                    wind_scale,
                    vis,
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
            data.get("display_time", 30),
        )
