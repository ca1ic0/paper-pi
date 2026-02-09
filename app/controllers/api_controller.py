from app.models.empty_du import EmptyDisplayUnit
from app.models.image_du import ImageDisplayUnit
from app.models.text_to_image_du import TextToImageDisplayUnit
from app.models.playlist import Playlist
from app.services.storage_service import StorageService
import base64
import io

class APIController:
    """API控制器，处理业务逻辑"""
    
    def __init__(self):
        """
        初始化API控制器
        """
        self.storage_service = StorageService()
        self.display_units = {}
        self.du_counter = 1
        self.playlists = {}
        self.playlist_counter = 1
        self.load_data()
    
    def load_data(self):
        """
        从存储加载数据
        """
        # 加载display units
        serializable_du = self.storage_service.load_display_units()
        self.display_units = {}
        max_du_id = 0
        
        for du_id, du_data in serializable_du.items():
            # 重建display unit对象
            if du_data['type'] == 'EmptyDisplayUnit':
                du = EmptyDisplayUnit(du_data['name'], du_data['display_time'])
            elif du_data['type'] == 'ImageDisplayUnit':
                du = ImageDisplayUnit(du_data['name'], du_data['image_path'], du_data['display_time'])
            elif du_data['type'] == 'TextToImageDisplayUnit':
                du = TextToImageDisplayUnit(du_data['name'], du_data['user_prompt'], du_data['display_time'])
            else:
                continue
            
            self.display_units[du_id] = du
            max_du_id = max(max_du_id, int(du_id))
        
        self.du_counter = max_du_id + 1
        
        # 加载playlists
        serializable_playlists = self.storage_service.load_playlists()
        self.playlists = {}
        max_playlist_id = 0
        
        for playlist_id, playlist_data in serializable_playlists.items():
            playlist = Playlist(playlist_id, playlist_data['name'])
            playlist.display_units = playlist_data['display_units']
            self.playlists[playlist_id] = playlist
            max_playlist_id = max(max_playlist_id, int(playlist_id))
        
        self.playlist_counter = max_playlist_id + 1
    
    def save_data(self):
        """
        保存数据到存储
        """
        self.storage_service.save_display_units(self.display_units)
        self.storage_service.save_playlists(self.playlists)
    
    # Display Unit 相关方法
    def get_display_units(self):
        """
        获取所有display unit
        :return: display units列表
        """
        result = []
        for du_id, du in self.display_units.items():
            du_dict = du.to_dict()
            du_dict['id'] = du_id
            result.append(du_dict)
        return result
    
    def create_display_unit(self, data):
        """
        创建新的display unit
        :param data: display unit数据
        :return: 创建的display unit
        """
        if data['type'] == 'EmptyDisplayUnit':
            du = EmptyDisplayUnit(data['name'], data.get('display_time', 1))
        elif data['type'] == 'ImageDisplayUnit':
            du = ImageDisplayUnit(data['name'], data['image_path'], data.get('display_time', 10))
        elif data['type'] == 'TextToImageDisplayUnit':
            du = TextToImageDisplayUnit(data['name'], data['user_prompt'], data.get('display_time', 30))
        else:
            return None
        
        du_id = str(self.du_counter)
        self.display_units[du_id] = du
        self.du_counter += 1
        
        # 保存数据
        self.save_data()
        
        result = du.to_dict()
        result['id'] = du_id
        return result
    
    def update_display_unit(self, du_id, data):
        """
        更新display unit
        :param du_id: display unit ID
        :param data: 更新数据
        :return: 更新后的display unit
        """
        if du_id not in self.display_units:
            return None
        
        du = self.display_units[du_id]
        
        # 更新属性
        if 'name' in data:
            du.name = data['name']
        if 'display_time' in data:
            du.display_time = data['display_time']
        
        # 更新特定类型的属性
        if isinstance(du, ImageDisplayUnit) and 'image_path' in data:
            du.image_path = data['image_path']
        elif isinstance(du, TextToImageDisplayUnit) and 'user_prompt' in data:
            du.user_prompt = data['user_prompt']
            du.generated_image = None  # 重置生成的图片
        
        # 保存数据
        self.save_data()
        
        result = du.to_dict()
        result['id'] = du_id
        return result
    
    def delete_display_unit(self, du_id):
        """
        删除display unit
        :param du_id: display unit ID
        :return: 是否删除成功
        """
        if du_id not in self.display_units:
            return False
        
        del self.display_units[du_id]
        
        # 保存数据
        self.save_data()
        
        return True
    
    def preview_display_unit(self, du_id):
        """
        预览display unit
        :param du_id: display unit ID
        :return: 包含预览信息的字典
        """
        if du_id not in self.display_units:
            return None
        
        du = self.display_units[du_id]
        
        # 获取显示单元的字典表示
        du_dict = du.to_dict()
        du_dict['id'] = du_id
        
        try:
            # 获取预览图片
            image = du.get_image()
            
            # 将图片转换为base64编码的URL
            buffer = io.BytesIO()
            image.save(buffer, format='PNG')
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.read()).decode('utf-8')
            image_url = f"data:image/png;base64,{image_base64}"
            
            # 添加图片URL到响应
            du_dict['image_url'] = image_url
        except Exception as e:
            print(f"Error generating preview: {e}")
            # 如果生成预览失败，返回基本信息
            # 添加错误信息到响应
            du_dict['error'] = str(e)
        
        return du_dict
    
    # Playlist 相关方法
    def get_playlists(self):
        """
        获取所有playlist
        :return: playlists列表
        """
        return [playlist.to_dict() for playlist in self.playlists.values()]
    
    def create_playlist(self, data):
        """
        创建新的playlist
        :param data: playlist数据
        :return: 创建的playlist
        """
        playlist = Playlist(str(self.playlist_counter), data['name'])
        self.playlists[str(self.playlist_counter)] = playlist
        self.playlist_counter += 1
        
        # 保存数据
        self.save_data()
        
        return playlist.to_dict()
    
    def update_playlist(self, playlist_id, data):
        """
        更新playlist
        :param playlist_id: playlist ID
        :param data: 更新数据
        :return: 更新后的playlist
        """
        if playlist_id not in self.playlists:
            return None
        
        playlist = self.playlists[playlist_id]
        
        if 'name' in data:
            playlist.name = data['name']
        if 'display_units' in data:
            playlist.display_units = data['display_units']
        
        # 保存数据
        self.save_data()
        
        return playlist.to_dict()
    
    def delete_playlist(self, playlist_id):
        """
        删除playlist
        :param playlist_id: playlist ID
        :return: 是否删除成功
        """
        if playlist_id not in self.playlists:
            return False
        
        del self.playlists[playlist_id]
        
        # 保存数据
        self.save_data()
        
        return True
