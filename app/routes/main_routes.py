from flask import Blueprint, render_template

main_routes = Blueprint('main', __name__)

@main_routes.route('/')
def index():
    """
    首页路由
    """
    return render_template('index.html')

@main_routes.route('/admin')
def admin():
    """
    后台管理页面路由
    """
    return render_template('admin.html')

@main_routes.route('/text2image')
def text2image_page():
    """
    文生图功能页面路由
    """
    return render_template('text2image.html')


@main_routes.route('/library')
def library_page():
    """
    图片库页面路由
    """
    return render_template('library.html')


@main_routes.route('/library/<image_id>')
def library_detail_page(image_id):
    """
    图片详情页路由
    """
    return render_template('library_detail.html', image_id=image_id)
