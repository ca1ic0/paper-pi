from openai import OpenAI
from app.config import DASHSCOPE_API_KEY, DASHSCOPE_COMPAT_BASE_URL

class LLMServices:
    """LLM服务类，用于优化用户prompt"""
    
    def __init__(self):
        """
        初始化LLM服务
        """
        self.api_key = DASHSCOPE_API_KEY
        self.base_url = DASHSCOPE_COMPAT_BASE_URL
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
        )
    
    def optimize_prompt(self, user_prompt):
        """
        优化用户prompt
        :param user_prompt: 用户原始prompt
        :return: 优化后的prompt
        """
        try:
            # 构建系统提示
            system_prompt = "你是一个专业的提示词优化专家，擅长将用户的简单描述转化为详细、具体、适合AI图像生成的提示词。请根据用户的输入，生成一个详细的、包含场景、风格、构图等要素的图像生成提示词。"
            
            # 调用模型
            completion = self.client.chat.completions.create(
                model="qwen-plus",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=200
            )
            
            # 解析响应
            optimized_prompt = completion.choices[0].message.content.strip()
            
            return optimized_prompt
        except Exception as e:
            print(f"Error optimizing prompt: {e}")
            # 出错时返回原始prompt
            return user_prompt
