import os
import requests
from PIL import Image
from io import BytesIO
import dashscope
from dashscope import MultiModalConversation
from app.config import DASHSCOPE_API_KEY, DASHSCOPE_HTTP_BASE_URL
from app.services.logging_service import get_api_logger
from app.services.image_gen_queue_service import get_image_gen_queue

class ImageGenService:
    """图片生成服务类，用于调用图片生成API"""
    
    def __init__(self):
        """
        初始化图片生成服务
        """
        self.api_key = DASHSCOPE_API_KEY
        # 设置API URL
        dashscope.base_http_api_url = DASHSCOPE_HTTP_BASE_URL
    
    def generate_image(self, prompt, size="1664*928", display_size=(800, 480)):
        task = get_image_gen_queue().submit(
            self._generate_image_sync,
            prompt,
            size=size,
            display_size=display_size,
        )
        return task.wait()

    def _generate_image_sync(self, prompt, size="1664*928", display_size=(800, 480)):
        """
        根据prompt生成图片
        :param prompt: 图片描述
        :param size: 图片大小
        :param display_size: 显示尺寸
        :return: PIL.Image对象
        """
        try:
            # 确保LOG文件夹存在
            os.makedirs('LOG', exist_ok=True)
            
            # 构建消息
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"text": prompt}
                    ]
                }
            ]
            
            # 调用API
            response = MultiModalConversation.call(
                api_key=self.api_key,
                model="qwen-image-max",
                messages=messages,
                result_format='message',
                stream=False,
                watermark=False,
                prompt_extend=True,
                negative_prompt="低分辨率，低画质，肢体畸形，手指畸形，画面过饱和，蜡像感，人脸无细节，过度光滑，画面具有AI感。构图混乱。文字模糊，扭曲。",
                size=size
            )
            
            # 检查响应状态
            logger = get_api_logger()
            logger.info(f"DASHSCOPE_IMAGE_GEN status={response.status_code} model=qwen-image-max")
            if response.status_code == 200:
                # 解析响应
                image_url = response.output.choices[0].message.content[0]['image']
                
                # 下载图片
                logger.info(f"DASHSCOPE_IMAGE_URL url={image_url}")
                image_response = requests.get(image_url)
                image_response.raise_for_status()
                
                # 转换为PIL.Image对象
                image = Image.open(BytesIO(image_response.content))
                
                # 生成唯一文件名
                import hashlib
                import time
                timestamp = time.strftime("%Y%m%d_%H%M%S")
                prompt_hash = hashlib.md5(prompt.encode()).hexdigest()[:8]
                filename = f"LOG/{timestamp}_{prompt_hash}.png"
                
                # 保存原始图片
                image.save(filename)
                print(f"Image saved to: {filename}")
                
                # 调整图片大小以适应屏幕
                resized_image = image.resize(display_size, Image.LANCZOS)
                
                # 保存调整大小后的图片
                resized_filename = f"LOG/{timestamp}_{prompt_hash}_resized.png"
                resized_image.save(resized_filename)
                print(f"Resized image saved to: {resized_filename}")
                
                return resized_image
            else:
                logger.error(f"DASHSCOPE_IMAGE_GEN_ERROR code={response.code} message={response.message}")
                print(f"HTTP返回码：{response.status_code}")
                print(f"错误码：{response.code}")
                print(f"错误信息：{response.message}")
                # 出错时返回白色图片
                return Image.new('RGB', display_size, color='white')
        except Exception as e:
            print(f"Error generating image: {e}")
            # 出错时返回白色图片
            return Image.new('RGB', display_size, color='white')
    
    def generate_image_to_bmp(self, prompt, size="1664*928", display_size=(800, 480)):
        task = get_image_gen_queue().submit(
            self._generate_image_to_bmp_sync,
            prompt,
            size=size,
            display_size=display_size,
        )
        return task.wait()

    def _generate_image_to_bmp_sync(self, prompt, size="1664*928", display_size=(800, 480)):
        """
        根据prompt生成图片并保存为bmp格式到pic文件夹
        :param prompt: 图片描述
        :param size: 图片大小
        :param display_size: 显示尺寸
        :return: PIL.Image对象和保存路径
        """
        try:
            # 确保pic文件夹存在
            os.makedirs('pic', exist_ok=True)
            
            # 构建消息
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"text": prompt}
                    ]
                }
            ]
            
            # 调用API
            response = MultiModalConversation.call(
                api_key=self.api_key,
                model="qwen-image-max",
                messages=messages,
                result_format='message',
                stream=False,
                watermark=False,
                prompt_extend=True,
                negative_prompt="低分辨率，低画质，肢体畸形，手指畸形，画面过饱和，蜡像感，人脸无细节，过度光滑，画面具有AI感。构图混乱。文字模糊，扭曲。",
                size=size
            )
            
            # 检查响应状态
            logger = get_api_logger()
            logger.info(f"DASHSCOPE_IMAGE_GEN status={response.status_code} model=qwen-image-max")
            if response.status_code == 200:
                # 解析响应
                image_url = response.output.choices[0].message.content[0]['image']
                
                # 下载图片
                logger.info(f"DASHSCOPE_IMAGE_URL url={image_url}")
                image_response = requests.get(image_url)
                image_response.raise_for_status()
                
                # 转换为PIL.Image对象
                image = Image.open(BytesIO(image_response.content))
                
                # 调整图片大小以适应屏幕
                resized_image = image.resize(display_size, Image.LANCZOS)
                
                # 生成唯一文件名
                import hashlib
                import time
                timestamp = time.strftime("%Y%m%d_%H%M%S")
                prompt_hash = hashlib.md5(prompt.encode()).hexdigest()[:8]
                bmp_filename = f"pic/{timestamp}_{prompt_hash}.bmp"
                
                # 保存为bmp格式
                resized_image.save(bmp_filename, format='BMP')
                print(f"BMP image saved to: {bmp_filename}")
                
                return resized_image, bmp_filename
            else:
                logger.error(f"DASHSCOPE_IMAGE_GEN_ERROR code={response.code} message={response.message}")
                print(f"HTTP返回码：{response.status_code}")
                print(f"错误码：{response.code}")
                print(f"错误信息：{response.message}")
                # 出错时返回白色图片
                white_image = Image.new('RGB', display_size, color='white')
                return white_image, None
        except Exception as e:
            print(f"Error generating image: {e}")
            # 出错时返回白色图片
            white_image = Image.new('RGB', display_size, color='white')
            return white_image, None
