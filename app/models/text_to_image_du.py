from app.models.display_unit import DisplayUnit
from app.services.llm_service import LLMServices
from app.services.image_gen_service import ImageGenService
import os
from dotenv import load_dotenv

load_dotenv()

# 从配置中获取屏幕尺寸
SCREEN_WIDTH = int(os.getenv('SCREEN_WIDTH', '800'))
SCREEN_HEIGHT = int(os.getenv('SCREEN_HEIGHT', '480'))

class TextToImageDisplayUnit(DisplayUnit):
    """文生图显示单元，使用LLM优化prompt并生成图片"""
    
    def __init__(self, name, user_prompt, display_time=30):
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
    
    def get_image(self):
        """
        获取生成的图片
        :return: PIL.Image对象
        """
        if self.generated_image is None:
            # 优化prompt
            optimized_prompt = self.llm_service.optimize_prompt(self.user_prompt)
            print(f"Optimized prompt: {optimized_prompt}")
            
            # 生成图片，使用配置文件中定义的尺寸
            self.generated_image = self.image_gen_service.generate_image(optimized_prompt, display_size=(SCREEN_WIDTH, SCREEN_HEIGHT))
        
        return self.generated_image
    
    def to_dict(self):
        """
        转换为字典格式
        :return: 包含显示单元信息的字典
        """
        base_dict = super().to_dict()
        base_dict['user_prompt'] = self.user_prompt
        return base_dict
