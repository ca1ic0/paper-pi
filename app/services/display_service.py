import matplotlib.pyplot as plt
from PIL import Image
from app.config import RUN_MODE

class DisplayService:
    """显示服务类，根据运行模式决定如何显示图像"""
    
    def __init__(self):
        """
        初始化显示服务
        """
        self.run_mode = RUN_MODE
        self.epd = None
        
        # 仅在生产模式下导入墨水屏驱动
        if self.run_mode == 'production':
            from lib.waveshare_epd.epd7in3e import EPD
            self.epd = EPD()
            self.epd.init()
    
    def display_image(self, image):
        """
        显示图像
        :param image: PIL.Image对象
        """
        if self.run_mode == 'debug':
            # 在debug模式下使用plt显示
            self._display_with_plt(image)
        else:
            # 在production模式下使用墨水屏驱动
            self._display_with_epd(image)
    
    def _display_with_plt(self, image):
        """
        使用plt显示图像
        :param image: PIL.Image对象
        """
        print("Displaying image with matplotlib...")
        plt.figure(figsize=(10, 6))
        plt.imshow(image)
        plt.axis('off')
        plt.title('Debug Mode - Image Preview')
        plt.tight_layout()
        plt.show()
    
    def _display_with_epd(self, image):
        """
        使用墨水屏驱动显示图像
        :param image: PIL.Image对象
        """
        if self.epd is None:
            raise RuntimeError("EPD not initialized in production mode")

        try:
            print("Displaying image on e-paper...")
            # 转换图像为墨水屏驱动需要的格式
            buffer = self.epd.getbuffer(image)
            # 显示图像
            self.epd.display(buffer)
            # 休眠以节省电量
            self.epd.sleep()
        except Exception as e:
            raise RuntimeError(f"Error displaying image on EPD: {e}")
    
    def clear_display(self):
        """
        清除显示
        """
        if self.run_mode == 'debug':
            print("Debug mode: Clear display")
        else:
            if self.epd is not None:
                try:
                    print("Clearing e-paper display...")
                    self.epd.Clear()
                    self.epd.sleep()
                except Exception as e:
                    print(f"Error clearing EPD: {e}")
    
    def get_run_mode(self):
        """
        获取当前运行模式
        :return: 运行模式
        """
        return self.run_mode
