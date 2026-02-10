from flask import Blueprint, jsonify, request, current_app, send_file
from io import BytesIO
from app.controllers.api_controller import APIController
from app.models.empty_du import EmptyDisplayUnit
from app.models.image_du import ImageDisplayUnit
from app.models.text_to_image_du import TextToImageDisplayUnit
from app.services.image_library_service import ImageLibraryService
from app.services.playback_service import PlaybackService
from app.services.image_processing_service import apply_color_diffusion

api_routes = Blueprint('api', __name__)

# 初始化API控制器
api_controller = APIController()
playback_service = PlaybackService(api_controller, None)

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

        library_service = ImageLibraryService()
        library_item = None
        if save_path:
            library_item = library_service.add_existing_file(save_path, original_name="generated")
        
        # 将图片转换为base64编码的URL
        import base64
        from io import BytesIO
        buffer = BytesIO()
        image.save(buffer, format='PNG')
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode('utf-8')
        image_url = f"data:image/png;base64,{image_base64}"
        
        response = {'image_url': image_url, 'save_path': save_path}
        if library_item:
            response['image_id'] = library_item['id']
        return jsonify(response)
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

@api_routes.route('/playlists/<playlist_id>', methods=['GET'])
def get_playlist(playlist_id):
    """
    获取单个playlist
    """
    playlist = api_controller.get_playlist(playlist_id)
    if playlist is None:
        return jsonify({'error': 'Playlist not found'}), 404
    return jsonify(playlist)


@api_routes.route('/playlists/<playlist_id>/play', methods=['POST'])
def play_playlist(playlist_id):
    """
    播放playlist
    """
    display_service = current_app.extensions.get("display_service")
    if display_service is None:
        return jsonify({'error': 'Display service not initialized'}), 500
    playback_service.display_service = display_service
    playlist = api_controller.get_playlist(playlist_id)
    if playlist is None:
        return jsonify({'error': 'Playlist not found'}), 404
    playback_service.play(playlist_id)
    return jsonify({'message': 'Playlist started', 'playlist_id': playlist_id})


@api_routes.route('/playlists/pause', methods=['POST'])
def pause_playlist():
    """
    暂停播放
    """
    playback_service.pause()
    return jsonify({'message': 'Playback paused'})


@api_routes.route('/playlists/stop', methods=['POST'])
def stop_playlist():
    """
    停止播放
    """
    playback_service.stop()
    return jsonify({'message': 'Playback stopped'})


@api_routes.route('/playlists/status', methods=['GET'])
def playback_status():
    """
    播放状态
    """
    return jsonify(playback_service.status())

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


@api_routes.route('/image-library', methods=['GET'])
def list_image_library():
    """
    获取图片库列表
    """
    service = ImageLibraryService()
    items = service.list_images()
    for item in items:
        if "status" not in item:
            item["status"] = "ready"
    return jsonify(items)


@api_routes.route('/image-library/<image_id>', methods=['GET'])
def get_image_library_item(image_id):
    """
    获取图片库详情
    """
    service = ImageLibraryService()
    item = service.get_image(image_id)
    if not item:
        return jsonify({'error': 'Image not found'}), 404
    item = dict(item)
    if "status" not in item:
        item["status"] = "ready"
    item['file_path'] = service.get_image_path(image_id)
    item['file_url'] = f"/api/image-library/{image_id}/file"
    return jsonify(item)


@api_routes.route('/image-library/upload', methods=['POST'])
def upload_image_to_library():
    """
    上传图片到图片库（自动转为800x480 BMP）
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    try:
        service = ImageLibraryService()
        item = service.add_upload(file)
        return jsonify(item), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_routes.route('/image-library/batch-delete', methods=['POST'])
def batch_delete_image_library():
    """
    批量删除图片库
    """
    data = request.json or {}
    image_ids = data.get('image_ids', [])
    if not isinstance(image_ids, list) or not image_ids:
        return jsonify({'error': 'image_ids must be a non-empty list'}), 400

    service = ImageLibraryService()
    deleted = service.delete_images(image_ids)
    return jsonify({'deleted': deleted})


@api_routes.route('/image-library/<image_id>/stylize', methods=['POST'])
def stylize_image(image_id):
    """
    图片风格化并保存到图片库
    """
    data = request.json or {}
    style = data.get('style')
    if not style:
        return jsonify({'error': 'style is required'}), 400

    service = ImageLibraryService()
    item = service.get_image(image_id)
    if not item:
        return jsonify({'error': 'Image not found'}), 404

    from http import HTTPStatus
    from dashscope import ImageSynthesis
    import dashscope
    import os
    import requests
    import threading
    from PIL import Image
    from app.services.logging_service import get_api_logger

    dashscope.base_http_api_url = 'https://dashscope.aliyuncs.com/api/v1'
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        return jsonify({'error': 'DASHSCOPE_API_KEY not configured'}), 500

    style_prompts = {
        "oil_painting": "将图片转换为油画风格，厚涂质感，强调笔触与光影层次。",
        "watercolor": "将图片转换为水彩风格，透明叠色，柔和边缘与纸张纹理。",
        "miyazaki": "将图片转换为宫崎骏动画风格，温暖色调，清新手绘质感。",
    }
    prompt = style_prompts.get(style)
    if not prompt:
        return jsonify({'error': 'Unsupported style'}), 400

    # 使用本地文件方式
    image_path = service.get_image_path(image_id)
    if not image_path:
        return jsonify({'error': 'Image not found'}), 404
    image_input = "file://" + image_path

    placeholder = service.add_placeholder(
        original_name=f"{item['original_name']}_{style}",
        source_id=image_id,
        style=style,
    )

    def _run_stylize():
        try:
            response = ImageSynthesis.call(
                api_key=api_key,
                model="wan2.5-i2i-preview",
                prompt=prompt,
                images=[image_input],
                negative_prompt="",
                n=1,
                prompt_extend=True,
                watermark=False,
            )
            logger = get_api_logger()
            logger.info(f"DASHSCOPE_IMAGE_EDIT status={response.status_code} model=wan2.5-i2i-preview")

            if response.status_code != HTTPStatus.OK:
                logger.error(f"DASHSCOPE_IMAGE_EDIT_ERROR code={response.code} message={response.message}")
                service.update_item(
                    placeholder["id"],
                    {
                        "status": "failed",
                        "error": f"{response.code} - {response.message}",
                    },
                )
                return

            image_url_out = response.output.results[0].url
            logger.info(f"DASHSCOPE_IMAGE_EDIT_URL url={image_url_out}")
            image_response = requests.get(image_url_out, stream=True, timeout=300)
            image_response.raise_for_status()
            image = Image.open(BytesIO(image_response.content))
            service.update_item(
                placeholder["id"],
                {"status": "ready", "error": None},
                image=image,
            )
        except Exception as e:
            service.update_item(
                placeholder["id"],
                {"status": "failed", "error": str(e)},
            )

    threading.Thread(target=_run_stylize, daemon=True).start()
    return jsonify(placeholder), 202


@api_routes.route('/image-library/<image_id>/file', methods=['GET'])
def get_library_image_file(image_id):
    """
    获取图片库文件
    """
    service = ImageLibraryService()
    image_path = service.get_image_path(image_id)
    if not image_path:
        return jsonify({'error': 'Image not found'}), 404
    return send_file(image_path, mimetype='image/bmp')


@api_routes.route('/image-preview', methods=['POST'])
def preview_image_with_options():
    """
    预览图片（可选颜色扩散）
    """
    data = request.json or {}
    image_id = data.get('image_id')
    enable_color_diffusion = bool(data.get('enable_color_diffusion', False))
    if not image_id:
        return jsonify({'error': 'image_id is required'}), 400

    service = ImageLibraryService()
    image_path = service.get_image_path(image_id)
    if not image_path:
        return jsonify({'error': 'Image not found'}), 404

    try:
        from PIL import Image
        import base64
        from io import BytesIO

        image = Image.open(image_path).convert('RGB')
        if enable_color_diffusion:
            image = apply_color_diffusion(image)

        buffer = BytesIO()
        image.save(buffer, format='PNG')
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode('utf-8')
        image_url = f"data:image/png;base64,{image_base64}"
        return jsonify({'image_url': image_url})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_routes.route('/test-display', methods=['POST'])
def test_display():
    """
    测试显示功能
    """
    data = request.json
    du_type = data.get('type', 'EmptyDisplayUnit')

    display_service = current_app.extensions.get("display_service")
    if display_service is None:
        return jsonify({'error': 'Display service not initialized'}), 500

    try:
        if du_type == 'EmptyDisplayUnit':
            du = EmptyDisplayUnit("Test Empty DU")
        elif du_type == 'ImageDisplayUnit':
            image_path = data.get('image_path', '')
            image_id = data.get('image_id')
            du = ImageDisplayUnit("Test Image DU", image_path or None, image_id=image_id)
        elif du_type == 'TextToImageDisplayUnit':
            user_prompt = data.get('user_prompt', 'A beautiful landscape')
            du = TextToImageDisplayUnit("Test Text-to-Image DU", user_prompt)
        else:
            return jsonify({'error': 'Invalid display unit type'}), 400

        image = du.get_image()
        display_service.display_image(image)

        return jsonify({'message': f'Image displayed successfully in {display_service.get_run_mode()} mode'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
