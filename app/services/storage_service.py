import json
import os
from app.config import BASE_DIR

class StorageService:
    """存储服务类，用于持久化存储display units和playlists"""
    
    def __init__(self):
        """
        初始化存储服务
        """
        self.storage_dir = os.path.join(BASE_DIR, "storage")
        self.du_file = os.path.join(self.storage_dir, 'display_units.json')
        self.playlist_file = os.path.join(self.storage_dir, 'playlists.json')
        
        # 创建存储目录
        if not os.path.exists(self.storage_dir):
            os.makedirs(self.storage_dir)
        
        # 初始化文件
        if not os.path.exists(self.du_file):
            with open(self.du_file, 'w') as f:
                json.dump({}, f)
        
        if not os.path.exists(self.playlist_file):
            with open(self.playlist_file, 'w') as f:
                json.dump({}, f)
    
    def save_display_units(self, display_units):
        """
        保存display units到文件
        :param display_units: display units字典
        """
        # 转换为可序列化的格式
        serializable_du = {}
        for du_id, du in display_units.items():
            serializable_du[du_id] = du.to_dict()
        
        with open(self.du_file, 'w') as f:
            json.dump(serializable_du, f, indent=2)
    
    def load_display_units(self):
        """
        从文件加载display units
        :return: display units字典
        """
        with open(self.du_file, 'r') as f:
            serializable_du = json.load(f)
        
        return serializable_du
    
    def save_playlists(self, playlists):
        """
        保存playlists到文件
        :param playlists: playlists字典
        """
        # 转换为可序列化的格式
        serializable_playlists = {}
        for playlist_id, playlist in playlists.items():
            serializable_playlists[playlist_id] = playlist.to_dict()
        
        with open(self.playlist_file, 'w') as f:
            json.dump(serializable_playlists, f, indent=2)
    
    def load_playlists(self):
        """
        从文件加载playlists
        :return: playlists字典
        """
        with open(self.playlist_file, 'r') as f:
            serializable_playlists = json.load(f)
        
        return serializable_playlists
