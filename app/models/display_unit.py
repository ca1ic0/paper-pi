from abc import ABC, abstractmethod
from PIL import Image

class DisplayUnit(ABC):
    """显示单元抽象基类"""
    
    def __init__(self, name, display_time):
        """
        初始化显示单元
        :param name: 显示单元名称
        :param display_time: 显示时间（秒）
        """
        self.name = name
        self.display_time = display_time
    
    @abstractmethod
    def get_image(self):
        """
        获取要显示的图片
        :return: PIL.Image对象
        """
        pass
    
    def to_dict(self):
        """
        转换为字典格式，用于序列化
        :return: 包含显示单元信息的字典
        """
        return {
            'name': self.name,
            'display_time': self.display_time,
            'type': self.__class__.__name__
        }


DISPLAY_UNIT_REGISTRY = {}


def register_display_unit(cls):
    DISPLAY_UNIT_REGISTRY[cls.__name__] = cls
    return cls


def create_display_unit_from_dict(data):
    du_type = data.get("type")
    cls = DISPLAY_UNIT_REGISTRY.get(du_type)
    if cls is None:
        return None
    return cls.from_dict(data)
