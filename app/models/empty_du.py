from app.models.display_unit import DisplayUnit, register_display_unit
from app.config import SCREEN_WIDTH, SCREEN_HEIGHT
from PIL import Image

@register_display_unit
class EmptyDisplayUnit(DisplayUnit):
    """空显示单元，用于刷新墨水屏幕的白色图片"""
    
    def __init__(self, name="Empty DU", display_time=600):
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

    @classmethod
    def from_dict(cls, data):
        return cls(
            data.get("name", "Empty DU"),
            data.get("display_time", 600),
        )
    
    def to_dict(self):
        """
        转换为字典格式
        :return: 包含显示单元信息的字典
        """
        base_dict = super().to_dict()
        return base_dict
