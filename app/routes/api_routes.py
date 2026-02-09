from flask import Blueprint, jsonify, request
from app.controllers.api_controller import APIController

api_routes = Blueprint('api', __name__)

# 初始化API控制器
api_controller = APIController()

@api_routes.route('/display-units', methods=['GET'])
def get_display_units():
    """
    获取所有display unit
    """
    display_units = api_controller.get_display_units()
    return jsonify(display_units)

@api_routes.route('/display-units', methods=['POST'])
def create_display_unit():
    """
    创建新的display unit
    """
    data = request.json
    result = api_controller.create_display_unit(data)
    if result is None:
        return jsonify({'error': 'Invalid display unit type'}), 400
    return jsonify(result), 201

@api_routes.route('/display-units/<du_id>', methods=['PUT'])
def update_display_unit(du_id):
    """
    更新display unit
    """
    data = request.json
    result = api_controller.update_display_unit(du_id, data)
    if result is None:
        return jsonify({'error': 'Display unit not found'}), 404
    return jsonify(result)

@api_routes.route('/display-units/<du_id>', methods=['DELETE'])
def delete_display_unit(du_id):
    """
    删除display unit
    """
    success = api_controller.delete_display_unit(du_id)
    if not success:
        return jsonify({'error': 'Display unit not found'}), 404
    return jsonify({'message': 'Display unit deleted successfully'})

@api_routes.route('/display-units/<du_id>/preview', methods=['GET'])
def preview_display_unit(du_id):
    """
    预览display unit
    """
    result = api_controller.preview_display_unit(du_id)
    if result is None:
        return jsonify({'error': 'Display unit not found'}), 404
    return jsonify(result)

@api_routes.route('/text2image', methods=['POST'])
def text2image():
    """
    文生图功能
    """
    from app.services.image_gen_service import ImageGenService
    
    data = request.json
    prompt = data.get('prompt', '')
    
    if not prompt:
        return jsonify({'error': '请输入图片描述'}), 400
    
    try:
        image_gen_service = ImageGenService()
        image, save_path = image_gen_service.generate_image_to_bmp(prompt)
        
        # 将图片转换为base64编码的URL
        import base64
        from io import BytesIO
        buffer = BytesIO()
        image.save(buffer, format='PNG')
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode('utf-8')
        image_url = f"data:image/png;base64,{image_base64}"
        
        return jsonify({'image_url': image_url, 'save_path': save_path})
    except Exception as e:
        print(f"Error generating image: {e}")
        return jsonify({'error': '生成图片失败，请稍后重试'}), 500

@api_routes.route('/playlists', methods=['GET'])
def get_playlists():
    """
    获取所有playlist
    """
    playlists = api_controller.get_playlists()
    return jsonify(playlists)

@api_routes.route('/playlists', methods=['POST'])
def create_playlist():
    """
    创建新的playlist
    """
    data = request.json
    result = api_controller.create_playlist(data)
    return jsonify(result), 201

@api_routes.route('/playlists/<playlist_id>', methods=['PUT'])
def update_playlist(playlist_id):
    """
    更新playlist
    """
    data = request.json
    result = api_controller.update_playlist(playlist_id, data)
    if result is None:
        return jsonify({'error': 'Playlist not found'}), 404
    return jsonify(result)

@api_routes.route('/playlists/<playlist_id>', methods=['DELETE'])
def delete_playlist(playlist_id):
    """
    删除playlist
    """
    success = api_controller.delete_playlist(playlist_id)
    if not success:
        return jsonify({'error': 'Playlist not found'}), 404
    return jsonify({'message': 'Playlist deleted successfully'})
