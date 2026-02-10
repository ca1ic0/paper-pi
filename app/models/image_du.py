from app.models.display_unit import DisplayUnit, register_display_unit
from app.services.image_library_service import ImageLibraryService
from app.services.image_processing_service import apply_color_diffusion
from app.config import SCREEN_WIDTH, SCREEN_HEIGHT
from PIL import Image
import os

@register_display_unit
class ImageDisplayUnit(DisplayUnit):
    """图片显示单元，用于显示静态图片"""
    
    def __init__(self, name, image_path=None, display_time=10, image_id=None, enable_color_diffusion=False):
        """
        初始化图片显示单元
        :param name: 显示单元名称
        :param image_path: 图片路径
        :param display_time: 显示时间（秒），默认10秒
        :param image_id: 图片库ID
        """
        super().__init__(name, display_time)
        self.image_path = image_path
        self.image_id = image_id
        self.enable_color_diffusion = enable_color_diffusion
    
    def get_image(self):
        """
        获取要显示的图片
        :return: PIL.Image对象
        """
        image_path = self.image_path
        if self.image_id:
            library_service = ImageLibraryService()
            image_path = library_service.get_image_path(self.image_id)

        if not image_path or not os.path.exists(image_path):
            # 如果图片不存在，返回白色图片
            return Image.new('RGB', (SCREEN_WIDTH, SCREEN_HEIGHT), color='white')
        
        try:
            # 打开并返回图片
            image = Image.open(image_path)
            # 调整图片大小以适应屏幕
            image = image.resize((SCREEN_WIDTH, SCREEN_HEIGHT), Image.LANCZOS)
            if self.enable_color_diffusion:
                image = apply_color_diffusion(image)
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
        base_dict['image_id'] = self.image_id
        base_dict['enable_color_diffusion'] = self.enable_color_diffusion
        return base_dict

    @classmethod
    def from_dict(cls, data):
        return cls(
            data.get("name", "Image DU"),
            data.get("image_path"),
            data.get("display_time", 10),
            data.get("image_id"),
            data.get("enable_color_diffusion", False),
        )
