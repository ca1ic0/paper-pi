from app.models.display_unit import DisplayUnit, register_display_unit
from app.services.llm_service import LLMServices
from app.services.image_gen_service import ImageGenService
from app.services.image_library_service import ImageLibraryService
from app.services.weather_cache_service import WeatherCacheService
from app.config import SCREEN_WIDTH, SCREEN_HEIGHT
from PIL import Image
from datetime import datetime

@register_display_unit
class TextToImageDisplayUnit(DisplayUnit):
    """文生图显示单元，使用LLM优化prompt并生成图片"""
    
    def __init__(self, name, user_prompt, display_time=120):
        """
        初始化文生图显示单元
        :param name: 显示单元名称
        :param user_prompt: 用户原始prompt
        :param display_time: 显示时间（秒），默认30秒
        """
        super().__init__(name, display_time)
        self.user_prompt = user_prompt
        self.llm_service = LLMServices()
        self.image_gen_service = ImageGenService()
        self.generated_image = None
        self.cache_service = WeatherCacheService()
        self.image_library_service = ImageLibraryService()
        self.last_prompt = user_prompt
    
    def get_image(self):
        """
        获取生成的图片
        :return: PIL.Image对象
        """
        today = datetime.now().strftime("%Y-%m-%d")
        cache_key = f"text2image:{self.name}:{self.user_prompt}"
        cached = self.cache_service.get(today, cache_key)

        # 如果提示词变更，立刻失效缓存
        if self.user_prompt != self.last_prompt:
            cached = None
            self.last_prompt = self.user_prompt

        if cached and cached.get("image_id"):
            image_path = self.image_library_service.get_image_path(cached["image_id"])
            if image_path:
                return Image.open(image_path).convert("RGB")

        # 优化prompt
        optimized_prompt = self.llm_service.optimize_prompt(self.user_prompt)
        print(f"Optimized prompt: {optimized_prompt}")

        # 生成图片，使用配置文件中定义的尺寸
        image = self.image_gen_service.generate_image(optimized_prompt, display_size=(SCREEN_WIDTH, SCREEN_HEIGHT))
        item = self.image_library_service.add_pil_image(image, original_name=f"text2image_{today}")
        self.cache_service.set(today, cache_key, {"image_id": item["id"]})
        return image
    
    def to_dict(self):
        """
        转换为字典格式
        :return: 包含显示单元信息的字典
        """
        base_dict = super().to_dict()
        base_dict['user_prompt'] = self.user_prompt
        return base_dict

    @classmethod
    def from_dict(cls, data):
        return cls(
            data.get("name", "每日一图"),
            data.get("user_prompt", ""),
            data.get("display_time", 120),
        )
