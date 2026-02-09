from app.models.display_unit import DisplayUnit
from PIL import Image
import os
from dotenv import load_dotenv

load_dotenv()

# 从配置中获取屏幕尺寸
SCREEN_WIDTH = int(os.getenv('SCREEN_WIDTH', '800'))
SCREEN_HEIGHT = int(os.getenv('SCREEN_HEIGHT', '480'))

class ImageDisplayUnit(DisplayUnit):
    """图片显示单元，用于显示静态图片"""
    
    def __init__(self, name, image_path, display_time=10):
        """
        初始化图片显示单元
        :param name: 显示单元名称
        :param image_path: 图片路径
        :param display_time: 显示时间（秒），默认10秒
        """
        super().__init__(name, display_time)
        self.image_path = image_path
    
    def get_image(self):
        """
        获取要显示的图片
        :return: PIL.Image对象
        """
        if not os.path.exists(self.image_path):
            # 如果图片不存在，返回白色图片
            return Image.new('RGB', (SCREEN_WIDTH, SCREEN_HEIGHT), color='white')
        
        try:
            # 打开并返回图片
            image = Image.open(self.image_path)
            # 调整图片大小以适应屏幕
            image = image.resize((SCREEN_WIDTH, SCREEN_HEIGHT), Image.LANCZOS)
            return image
        except Exception as e:
            # 出错时返回白色图片
            print(f"Error loading image: {e}")
            return Image.new('RGB', (SCREEN_WIDTH, SCREEN_HEIGHT), color='white')
    
    def to_dict(self):
        """
        转换为字典格式
        :return: 包含显示单元信息的字典
        """
        base_dict = super().to_dict()
        base_dict['image_path'] = self.image_path
        return base_dict
