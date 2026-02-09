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
