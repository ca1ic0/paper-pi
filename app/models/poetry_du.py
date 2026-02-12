from app.models.display_unit import DisplayUnit, register_display_unit
from app.services.llm_service import LLMServices
from app.config import SCREEN_WIDTH, SCREEN_HEIGHT
from PIL import Image, ImageDraw, ImageFont
import os


@register_display_unit
class PoetryDisplayUnit(DisplayUnit):
    """唐诗绝句单元：每次播放生成一首绝句并绘制"""

    def __init__(self, name="唐诗绝句", display_time=120, mood_prompt=None):
        super().__init__(name, display_time)
        self.llm_service = LLMServices()
        self.mood_prompt = mood_prompt

    def _generate_poem(self):
        base = "请生成一首四句七言绝句，不要标题，不要作者，只输出四句诗。"
        if self.mood_prompt:
            prompt = f"{base} 情绪/主题：{self.mood_prompt}"
        else:
            prompt = base
        return self.llm_service.optimize_prompt(prompt)

    def _load_font(self, size):
        candidates = [
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
        for path in candidates:
            if os.path.exists(path):
                try:
                    return ImageFont.truetype(path, size=size)
                except Exception:
                    continue
        return ImageFont.load_default()

    def get_image(self):
        poem = self._generate_poem()
        lines = [line.strip() for line in poem.splitlines() if line.strip()]
        # 只取前四行
        lines = lines[:4] if len(lines) >= 4 else lines

        image = Image.new("RGB", (SCREEN_WIDTH, SCREEN_HEIGHT), color="white")
        draw = ImageDraw.Draw(image)

        font = self._load_font(40)
        line_spacing = 16
        line_heights = []
        line_widths = []
        for line in lines:
            box = draw.textbbox((0, 0), line, font=font)
            line_widths.append(box[2] - box[0])
            line_heights.append(box[3] - box[1])

        total_h = sum(line_heights) + line_spacing * (len(lines) - 1) if lines else 0
        y = (SCREEN_HEIGHT - total_h) / 2
        for line, w, h in zip(lines, line_widths, line_heights):
            x = (SCREEN_WIDTH - w) / 2
            draw.text((x, y), line, fill=(0, 0, 0), font=font)
            y += h + line_spacing

        return image

    @classmethod
    def from_dict(cls, data):
        return cls(
            data.get("name", "唐诗绝句"),
            data.get("display_time", 120),
            data.get("mood_prompt"),
        )

    def to_dict(self):
        base = super().to_dict()
        base["mood_prompt"] = self.mood_prompt
        return base
