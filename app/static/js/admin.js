// 后台管理页面JavaScript

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', function() {
    initAdminPage();
});

function initAdminPage() {
    // 初始化模态框
    initModals();
    
    // 加载播放列表
    loadPlaylists();
}

// 全局变量，用于存储当前选中的播放列表ID
let currentPlaylistId = null;

// 初始化模态框
function initModals() {
    // 添加播放列表模态框
    const addPlaylistModal = document.getElementById('add-playlist-modal');
    const addPlaylistBtn = document.getElementById('add-playlist-btn');
    const closePlaylistBtn = addPlaylistModal.querySelector('.close-btn');
    const cancelPlaylistBtn = document.getElementById('cancel-playlist-btn');
    const savePlaylistBtn = document.getElementById('save-playlist-btn');
    
    // 添加播放列表按钮点击事件
    addPlaylistBtn.addEventListener('click', function() {
        addPlaylistModal.classList.add('active');
    });
    
    // 关闭模态框
    function closePlaylistModal() {
        addPlaylistModal.classList.remove('active');
        document.getElementById('add-playlist-form').reset();
    }
    
    closePlaylistBtn.addEventListener('click', closePlaylistModal);
    cancelPlaylistBtn.addEventListener('click', closePlaylistModal);
    
    // 保存播放列表
    savePlaylistBtn.addEventListener('click', function() {
        const form = document.getElementById('add-playlist-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // 发送API请求
        fetch('/api/playlists', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            console.log('Playlist created:', result);
            closePlaylistModal();
            loadPlaylists();
        })
        .catch(error => {
            console.error('Error creating playlist:', error);
            alert('创建播放列表失败');
        });
    });
    
    // 添加显示单元模态框
    const addDuModal = document.getElementById('add-du-modal');
    const closeDuBtn = addDuModal.querySelector('.close-btn');
    const cancelDuBtn = document.getElementById('cancel-du-btn');
    const saveDuBtn = document.getElementById('save-du-btn');
    
    // 显示单元类型切换
    const duTypeSelect = document.getElementById('du-type');
    const imagePathGroup = document.getElementById('image-path-group');
    const userPromptGroup = document.getElementById('user-prompt-group');
    
    duTypeSelect.addEventListener('change', function() {
        const type = this.value;
        imagePathGroup.style.display = type === 'ImageDisplayUnit' ? 'block' : 'none';
        userPromptGroup.style.display = type === 'TextToImageDisplayUnit' ? 'block' : 'none';
    });
    
    // 关闭模态框
    function closeDuModal() {
        addDuModal.classList.remove('active');
        document.getElementById('add-du-form').reset();
        imagePathGroup.style.display = 'none';
        userPromptGroup.style.display = 'none';
    }
    
    closeDuBtn.addEventListener('click', closeDuModal);
    cancelDuBtn.addEventListener('click', closeDuModal);
    
    // 保存显示单元
    saveDuBtn.addEventListener('click', function() {
        const form = document.getElementById('add-du-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // 转换类型
        data.display_time = parseInt(data.display_time);
        
        // 发送API请求
        fetch('/api/display-units', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            console.log('Display unit created:', result);
            closeDuModal();
            
            // 如果有选中的播放列表，将新创建的显示单元添加到播放列表中
            if (currentPlaylistId) {
                addToPlaylist(currentPlaylistId, result.id);
            }
        })
        .catch(error => {
            console.error('Error creating display unit:', error);
            alert('创建显示单元失败');
        });
    });
}

// 加载播放列表
function loadPlaylists() {
    const playlistList = document.getElementById('playlist-list');
    
    fetch('/api/playlists')
    .then(response => response.json())
    .then(playlists => {
        console.log('Playlists:', playlists);
        
        // 清空列表
        playlistList.innerHTML = '';
        
        // 添加播放列表项
        playlists.forEach(playlist => {
            const playlistItem = createPlaylistItem(playlist);
            playlistList.appendChild(playlistItem);
        });
    })
    .catch(error => {
        console.error('Error loading playlists:', error);
        playlistList.innerHTML = '<p class="error-message">加载播放列表失败</p>';
    });
}

// 打开添加显示单元模态框
function openAddDuModal(playlistId) {
    currentPlaylistId = playlistId;
    document.getElementById('add-du-modal').classList.add('active');
}

// 创建播放列表项
function createPlaylistItem(playlist) {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    
    item.innerHTML = `
        <div class="playlist-header">
            <h4 class="playlist-title">${playlist.name}</h4>
            <div class="playlist-actions">
                <button class="btn btn-secondary" onclick="editPlaylist('${playlist.id}')">编辑</button>
                <button class="btn btn-primary" onclick="deletePlaylist('${playlist.id}')">删除</button>
            </div>
        </div>
        <div class="playlist-body">
            <div class="playlist-du-list">
                ${playlist.display_units.length > 0 ? 
                    `
                        <div class="playlist-du-items">
                            ${playlist.display_units.map(duId => `
                                <div class="playlist-du-item">
                                    <span>单元 ${duId}</span>
                                    <button class="btn btn-secondary remove-btn" onclick="removeDuFromPlaylist('${playlist.id}', '${duId}')">×</button>
                                </div>
                            `).join('')}
                            <div class="playlist-du-item add-item" onclick="openAddDuModal('${playlist.id}')">
                                <span>+</span>
                                <span>添加单元</span>
                            </div>
                        </div>
                    ` : 
                    `
                        <div class="playlist-du-items">
                            <div class="playlist-du-item add-item" onclick="openAddDuModal('${playlist.id}')">
                                <span>+</span>
                                <span>添加单元</span>
                            </div>
                        </div>
                    `
                }
            </div>
        </div>
    `;
    
    return item;
}

// 编辑播放列表
function editPlaylist(playlistId) {
    // 这里可以实现编辑功能
    console.log('Edit playlist:', playlistId);
    alert('编辑功能待实现');
}

// 删除播放列表
function deletePlaylist(playlistId) {
    if (confirm('确定要删除这个播放列表吗？')) {
        fetch(`/api/playlists/${playlistId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(result => {
            console.log('Playlist deleted:', result);
            loadPlaylists();
        })
        .catch(error => {
            console.error('Error deleting playlist:', error);
            alert('删除播放列表失败');
        });
    }
}

// 从播放列表中移除显示单元
function removeDuFromPlaylist(playlistId, duId) {
    console.log('Remove display unit from playlist:', playlistId, duId);
    
    // 获取播放列表数据
    fetch(`/api/playlists/${playlistId}`)
    .then(response => response.json())
    .then(playlist => {
        // 移除显示单元
        const updatedDisplayUnits = playlist.display_units.filter(id => id !== duId);
        
        // 更新播放列表
        return fetch(`/api/playlists/${playlistId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ display_units: updatedDisplayUnits })
        });
    })
    .then(response => response.json())
    .then(result => {
        console.log('Display unit removed from playlist:', result);
        loadPlaylists();
    })
    .catch(error => {
        console.error('Error removing display unit from playlist:', error);
        alert('从播放列表中移除显示单元失败');
    });
}

// 将显示单元添加到播放列表
function addToPlaylist(playlistId, duId) {
    console.log('Add display unit to playlist:', playlistId, duId);
    
    // 获取播放列表数据
    fetch(`/api/playlists/${playlistId}`)
    .then(response => response.json())
    .then(playlist => {
        // 检查显示单元是否已经在播放列表中
        if (playlist.display_units.includes(duId)) {
            alert('显示单元已经在播放列表中');
            return Promise.reject('Display unit already in playlist');
        }
        
        // 添加显示单元
        const updatedDisplayUnits = [...playlist.display_units, duId];
        
        // 更新播放列表
        return fetch(`/api/playlists/${playlistId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ display_units: updatedDisplayUnits })
        });
    })
    .then(response => response.json())
    .then(result => {
        console.log('Display unit added to playlist:', result);
        currentPlaylistId = null;
        loadPlaylists();
    })
    .catch(error => {
        console.error('Error adding display unit to playlist:', error);
        currentPlaylistId = null;
        if (error !== 'Display unit already in playlist') {
            alert('添加显示单元到播放列表失败');
        }
    });
}
