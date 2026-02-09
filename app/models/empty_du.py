from app.models.display_unit import DisplayUnit
from PIL import Image
import os
from dotenv import load_dotenv

load_dotenv()

# 从配置中获取屏幕尺寸
SCREEN_WIDTH = int(os.getenv('SCREEN_WIDTH', '800'))
SCREEN_HEIGHT = int(os.getenv('SCREEN_HEIGHT', '480'))

class EmptyDisplayUnit(DisplayUnit):
    """空显示单元，用于刷新墨水屏幕的白色图片"""
    
    def __init__(self, name="Empty DU", display_time=1):
        """
        初始化空显示单元
        :param name: 显示单元名称
        :param display_time: 显示时间（秒）
        """
        super().__init__(name, display_time)
    
    def get_image(self):
        """
        获取白色图片
        :return: PIL.Image对象（白色图片）
        """
        # 使用配置文件中定义的尺寸生成白色图片
        image = Image.new('RGB', (SCREEN_WIDTH, SCREEN_HEIGHT), color='white')
        return image
    
    def to_dict(self):
        """
        转换为字典格式
        :return: 包含显示单元信息的字典
        """
        base_dict = super().to_dict()
        return base_dict
