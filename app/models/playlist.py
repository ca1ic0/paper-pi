class Playlist:
    """播放列表类，用于管理多个display unit"""
    
    def __init__(self, id, name):
        """
        初始化播放列表
        :param id: 播放列表ID
        :param name: 播放列表名称
        """
        self.id = id
        self.name = name
        self.display_units = []  # 存储display unit的ID列表
    
    def add_display_unit(self, du_id):
        """
        添加display unit到播放列表
        :param du_id: display unit ID
        """
        if du_id not in self.display_units:
            self.display_units.append(du_id)
    
    def remove_display_unit(self, du_id):
        """
        从播放列表中移除display unit
        :param du_id: display unit ID
        """
        if du_id in self.display_units:
            self.display_units.remove(du_id)
    
    def to_dict(self):
        """
        转换为字典格式
        :return: 包含播放列表信息的字典
        """
        return {
            'id': self.id,
            'name': self.name,
            'display_units': self.display_units
        }
