from flask import Flask, request, jsonify
from flask_cors import CORS
from app.routes.main_routes import main_routes
from app.routes.api_routes import api_routes
from app.services.display_service import DisplayService
from app.models.empty_du import EmptyDisplayUnit
from app.models.image_du import ImageDisplayUnit
from app.models.text_to_image_du import TextToImageDisplayUnit
from dotenv import load_dotenv
import os

# 加载.env文件
load_dotenv()

# 创建Flask应用实例，指定模板和静态文件目录
app = Flask(__name__,
            template_folder=os.path.join(os.path.dirname(__file__), 'app', 'templates'),
            static_folder=os.path.join(os.path.dirname(__file__), 'app', 'static'))

# 从环境变量加载配置
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['DEBUG'] = os.getenv('DEBUG', 'True').lower() == 'true'
CORS(app)

# 初始化显示服务
display_service = DisplayService()

# 注册蓝图
app.register_blueprint(main_routes)
app.register_blueprint(api_routes, url_prefix='/api')

# 添加测试显示的API端点
@app.route('/api/test-display', methods=['POST'])
def test_display():
    """
    测试显示功能
    """
    data = request.json
    du_type = data.get('type', 'EmptyDisplayUnit')
    
    try:
        # 创建相应类型的display unit
        if du_type == 'EmptyDisplayUnit':
            du = EmptyDisplayUnit("Test Empty DU")
        elif du_type == 'ImageDisplayUnit':
            image_path = data.get('image_path', '')
            du = ImageDisplayUnit("Test Image DU", image_path)
        elif du_type == 'TextToImageDisplayUnit':
            user_prompt = data.get('user_prompt', 'A beautiful landscape')
            du = TextToImageDisplayUnit("Test Text-to-Image DU", user_prompt)
        else:
            return jsonify({'error': 'Invalid display unit type'}), 400
        
        # 获取图像
        image = du.get_image()
        
        # 显示图像
        display_service.display_image(image)
        
        return jsonify({'message': f'Image displayed successfully in {display_service.get_run_mode()} mode'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print(f"Running in {os.getenv('RUN_MODE', 'debug')} mode")
    app.run(debug=True)
