// 后台管理页面JavaScript

// 页面加载完成后初始化
function initAdminPage() {
    document.body.classList.add('is-loaded');

    // 初始化模态框
    initModals();
    initEditorPanel();

    initPlaylistDelegation();
    activePlaylistId = normalizePlaylistId(localStorage.getItem('activePlaylistId'));
    autoPinPlayingEnabled = localStorage.getItem(AUTO_PIN_STORAGE_KEY) === '1';
    initAutoPinToggle();
    loadPlaylists();
}

// 全局变量，用于存储当前选中的播放列表ID
let currentPlaylistId = null;
// 全局显示单元缓存（id -> display unit）
let displayUnitsById = {};
let currentEditingDuId = null;
let activePlaylistId = null;
let editorPreviewRequestToken = 0;
let cachedPlaylists = [];
let autoPinPlayingEnabled = false;
const AUTO_PIN_STORAGE_KEY = 'autoPinPlayingPlaylistEnabled';

function normalizePlaylistId(id) {
    if (id === null || id === undefined || id === '') {
        return null;
    }
    return String(id);
}

// 初始化模态框
function initModals() {
    const addPlaylistBtn = document.getElementById('add-playlist-btn');
    // 添加播放列表按钮点击事件（非阻塞弹层输入）
    if (addPlaylistBtn) {
        addPlaylistBtn.addEventListener('click', async function() {
            const name = await askPlaylistName({
                title: '新增播放列表',
                message: '名称规则：至少 2 个字符；不能包含 \\\\/:*?"<>|；不能与其他播放列表重名。',
                initialValue: '',
                editingId: null
            });
            if (!name) {
                return;
            }
            await createPlaylistByName(name);
        });
    }
    
    // 添加显示单元模态框
    const addDuModal = document.getElementById('add-du-modal');
    const closeDuBtn = addDuModal.querySelector('.close-btn');
    const cancelDuBtn = document.getElementById('cancel-du-btn');
    const saveDuBtn = document.getElementById('save-du-btn');
    
    // 显示单元类型切换
    const duTypeSelect = document.getElementById('du-type');
    const duTypeCards = document.querySelectorAll('#du-type-cards .type-card');
    const imageLibraryGroup = document.getElementById('image-library-group');
    const userPromptGroup = document.getElementById('user-prompt-group');
    const weatherGroup = document.getElementById('weather-location-group');
    const poetryGroup = document.getElementById('poetry-mood-group');
    const imageIdInput = document.getElementById('du-image-id');
    const imageGrid = document.getElementById('du-image-grid');
    const diffusionToggle = document.getElementById('du-color-diffusion');
    const addPreview = document.getElementById('du-image-preview');
    const addPreviewImg = document.getElementById('du-image-preview-img');
    
    duTypeCards.forEach(card => {
        card.addEventListener('click', () => {
            duTypeCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const type = card.dataset.value;
            duTypeSelect.value = type;
            imageLibraryGroup.style.display = type === 'ImageDisplayUnit' ? 'block' : 'none';
            userPromptGroup.style.display = type === 'TextToImageDisplayUnit' ? 'block' : 'none';
            weatherGroup.style.display = type === 'WeatherDisplayUnit' ? 'block' : 'none';
            poetryGroup.style.display = type === 'PoetryDisplayUnit' ? 'block' : 'none';

            if (type === 'ImageDisplayUnit') {
                loadImageLibraryForSelect(imageGrid, imageIdInput);
            }
        });
    });

    if (diffusionToggle) {
        diffusionToggle.addEventListener('change', () => {
            updateAddPreview(imageIdInput, diffusionToggle, addPreview, addPreviewImg);
        });
    }
    
    // 关闭模态框
    function closeDuModal() {
        addDuModal.classList.remove('active');
        document.getElementById('add-du-form').reset();
        imageLibraryGroup.style.display = 'none';
        userPromptGroup.style.display = 'none';
        weatherGroup.style.display = 'none';
        poetryGroup.style.display = 'none';
        if (imageIdInput) {
            imageIdInput.value = '';
        }
        if (imageGrid) {
            imageGrid.innerHTML = '';
        }
        if (diffusionToggle) {
            diffusionToggle.checked = false;
        }
        if (addPreview) {
            addPreview.style.display = 'none';
            addPreviewImg.src = '';
        }
        duTypeCards.forEach(c => c.classList.remove('selected'));
        if (duTypeCards[0]) {
            duTypeCards[0].classList.add('selected');
            duTypeSelect.value = duTypeCards[0].dataset.value;
        }
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
        if (!data.image_id) {
            delete data.image_id;
        }
        if (data.type === 'ImageDisplayUnit' && !data.image_id) {
            window.PaperPiUI.toast('请选择图片库中的图片', 'warn');
            return;
        }
        if (data.type === 'ImageDisplayUnit') {
            data.enable_color_diffusion = !!diffusionToggle && diffusionToggle.checked;
        } else {
            delete data.enable_color_diffusion;
        }
        if (data.type === 'WeatherDisplayUnit') {
            const locationInput = document.getElementById('du-weather-location');
            data.location = locationInput ? locationInput.value.trim() : '';
            if (!data.location) {
                window.PaperPiUI.toast('请输入地理位置代码', 'warn');
                return;
            }
        } else {
            delete data.location;
        }
        if (data.type === 'PoetryDisplayUnit') {
            const moodInput = document.getElementById('du-poetry-mood');
            data.mood_prompt = moodInput ? moodInput.value.trim() : '';
        } else {
            delete data.mood_prompt;
        }
        
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

            // 更新本地缓存，便于展示名称
            if (result && result.id) {
                displayUnitsById[result.id] = result;
            }
            
            // 如果有选中的播放列表，将新创建的显示单元添加到播放列表中
            if (currentPlaylistId) {
                addToPlaylist(currentPlaylistId, result.id);
            }
        })
        .catch(error => {
            console.error('Error creating display unit:', error);
            window.PaperPiUI.toast('创建显示单元失败', 'error');
        });
    });
}

function initEditorPanel() {
    const closeBtn = document.getElementById('close-editor-btn');
    const saveBtn = document.getElementById('editor-save-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const panel = document.getElementById('playlist-editor');
            panel.style.display = 'none';
            currentEditingDuId = null;
            clearEditorPreviewTicker();
        });
    }
    if (saveBtn) {
        saveBtn.addEventListener('click', saveEditorChanges);
    }
}

// 加载播放列表
function loadPlaylists() {
    const playlistList = document.getElementById('playlist-list');

    Promise.all([
        fetch('/api/display-units').then(response => response.json()),
        fetch('/api/playlists').then(response => response.json()),
        fetch('/api/playlists/status').then(response => response.json()).catch(() => ({}))
    ])
    .then(([displayUnits, playlists, status]) => {
        displayUnitsById = {};
        displayUnits.forEach(du => {
            displayUnitsById[du.id] = du;
        });
        cachedPlaylists = Array.isArray(playlists) ? playlists : [];
        if (status && Object.prototype.hasOwnProperty.call(status, 'active_playlist_id')) {
            activePlaylistId = normalizePlaylistId(status.active_playlist_id);
            if (activePlaylistId) {
                localStorage.setItem('activePlaylistId', activePlaylistId);
            } else {
                localStorage.removeItem('activePlaylistId');
            }
        }

        renderPlaylists(playlistList, playlists);
        initPlaylistDragAndDrop();
        initPlaylistHorizontalScroll();
    })
    .catch(error => {
        console.error('Error loading playlists:', error);
        playlistList.innerHTML = '<p class="error-message">加载播放列表失败</p>';
    });
}

function renderPlaylists(container, playlists) {
    const html = playlists.map((playlist, idx) => {
        const item = createPlaylistItemHTML(playlist);
        return item.replace('data-reveal-index=""', `data-reveal-index="${idx + 1}"`);
    }).join('');
    container.innerHTML = html;
    const revealItems = container.querySelectorAll('.playlist-item');
    revealItems.forEach(item => {
        item.classList.add('reveal');
        item.style.setProperty('--i', item.dataset.revealIndex || 1);
    });
    attachImageLoadingHandlers(container);
}

function createPlaylistItemHTML(playlist) {
    const durations = playlist.display_units.map(duId => {
        const du = displayUnitsById[duId];
        const duration = du && du.display_time ? du.display_time : 1;
        return Math.max(1, duration);
    });
    const totalDuration = durations.reduce((sum, val) => sum + val, 0) || 1;
    const maxBlockWidth = 220;
    const displayItems = playlist.display_units.map((duId, index) => {
        const du = displayUnitsById[duId];
        const name = du ? du.name : `单元 ${duId}`;
        let metaHtml = '';
        const duration = durations[index];
        const widthPx = Math.min(maxBlockWidth, Math.max(64, Math.round((duration / totalDuration) * 1000)));

        if (du && du.type === 'ImageDisplayUnit') {
            const imageId = du.image_id;
            if (imageId) {
                metaHtml = `
                    <div class="playlist-du-meta">
                        <img class="playlist-du-thumb" loading="lazy" src="/api/image-library/${imageId}/file?t=${Date.now()}" alt="${name}">
                    </div>
                `;
            }
        } else if (du && du.type === 'TextToImageDisplayUnit') {
            const prompt = du.user_prompt || '';
            metaHtml = `
                <div class="playlist-du-meta">
                    <span class="playlist-du-prompt">${prompt}</span>
                </div>
            `;
        }

        return `
            <div class="playlist-du-item" draggable="true" data-du-id="${duId}" style="flex: 0 0 ${widthPx}px;" title="时长：${duration}s">
                <div class="playlist-du-main">
                    <span class="playlist-du-name">${name}</span>
                    ${metaHtml}
                </div>
                <button class="btn btn-secondary remove-btn" data-action="remove-du" data-du-id="${duId}" data-playlist-id="${playlist.id}">×</button>
            </div>
        `;
    }).join('');

    const isPlaying = normalizePlaylistId(activePlaylistId) === normalizePlaylistId(playlist.id);

    return `
        <div class="playlist-item ${isPlaying ? 'is-playing' : ''}" data-playlist-id="${playlist.id}" data-reveal-index="">
            <div class="playlist-header">
                <div class="playlist-title-wrap">
                    <h4 class="playlist-title">${playlist.name}</h4>
                    ${isPlaying ? '<span class="playlist-playing-tag">播放中</span>' : ''}
                    <button class="icon-btn rename-btn" data-action="rename" data-playlist-id="${playlist.id}" title="重命名" aria-label="重命名">
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 1 0-1.41 1.41l2.34 2.34c.39.39 1.02.39 1.41 0z"/>
                        </svg>
                    </button>
                </div>
                <div class="playlist-actions">
                    <button class="icon-btn play-btn" data-action="play" data-playlist-id="${playlist.id}" title="播放" aria-label="播放">
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                            ${isPlaying ? '<path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/>' : '<path fill="currentColor" d="M8 5v14l11-7z"/>'}
                        </svg>
                    </button>
                    <button class="icon-btn delete-btn" data-action="delete" data-playlist-id="${playlist.id}" title="删除" aria-label="删除">
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                            <path fill="currentColor" d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2zm-2 2h10v2H7V6z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="playlist-body">
                <div class="playlist-timeline-scale">
                    <span>0s</span>
                    <span>${Math.round(totalDuration / 2)}s</span>
                    <span>${totalDuration}s</span>
                </div>
                <div class="playlist-du-list">
                    ${playlist.display_units.length > 0 ? 
                        `
                            <div class="playlist-du-items" data-playlist-id="${playlist.id}" tabindex="0" aria-label="播放单元时间轴（可横向滚动）">
                                ${displayItems}
                                <div class="playlist-du-item add-item" data-action="add-du" data-playlist-id="${playlist.id}">
                                    <span>+</span>
                                    <span>添加单元</span>
                                </div>
                            </div>
                        ` : 
                        `
                            <div class="playlist-du-items" tabindex="0" aria-label="播放单元时间轴（可横向滚动）">
                                <div class="playlist-du-item add-item" data-action="add-du" data-playlist-id="${playlist.id}">
                                    <span>+</span>
                                    <span>添加单元</span>
                                </div>
                            </div>
                        `
                    }
                </div>
            </div>
        </div>
    `;
}

function initPlaylistDelegation() {
    const playlistList = document.getElementById('playlist-list');
    if (!playlistList) return;

    playlistList.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) {
            const item = e.target.closest('.playlist-du-item');
            if (item && !item.classList.contains('add-item')) {
                const duId = item.dataset.duId;
                showEditorForDisplayUnit(duId, item);
            }
            return;
        }

        const action = actionEl.dataset.action;
        const playlistId = actionEl.dataset.playlistId;
        const duId = actionEl.dataset.duId;

        if (action === 'add-du') {
            openAddDuModal(playlistId);
        } else if (action === 'remove-du') {
            removeDuFromPlaylist(playlistId, duId);
        } else if (action === 'rename') {
            editPlaylist(playlistId);
        } else if (action === 'delete') {
            deletePlaylist(playlistId);
        } else if (action === 'play') {
            togglePlaylistPlayback(playlistId);
        }
    });
}
function initPlaylistItemSelection() {}

function showEditorForDisplayUnit(duId, itemEl) {
    const du = displayUnitsById[duId];
    if (!du) {
        return;
    }
    currentEditingDuId = duId;

    document.querySelectorAll('.playlist-du-item.selected').forEach(el => {
        el.classList.remove('selected');
    });
    if (itemEl) {
        itemEl.classList.add('selected');
    }

    const panel = document.getElementById('playlist-editor');
    const previewImg = document.getElementById('editor-preview-img');
    const typeInput = document.getElementById('editor-type');
    const nameInput = document.getElementById('editor-name');
    const timeInput = document.getElementById('editor-display-time');
    const promptGroup = document.getElementById('editor-prompt-group');
    const promptInput = document.getElementById('editor-prompt');
    const imageGroup = document.getElementById('editor-image-group');
    const imageIdInput = document.getElementById('editor-image-id');
    const diffusionGroup = document.getElementById('editor-diffusion-group');
    const diffusionToggle = document.getElementById('editor-color-diffusion');
    const weatherGroup = document.getElementById('edit-weather-location-group');
    const weatherInput = document.getElementById('edit-du-weather-location');
    const poetryGroup = document.getElementById('editor-poetry-mood-group');
    const poetryInput = document.getElementById('edit-du-poetry-mood');
    const status = document.getElementById('editor-status');
    const previewWrap = previewImg ? previewImg.closest('.editor-preview') : null;
    const requestToken = ++editorPreviewRequestToken;

    typeInput.value = du.type || '';
    nameInput.value = du.name || '';
    timeInput.value = du.display_time || 1;

    promptGroup.style.display = 'none';
    imageGroup.style.display = 'none';
    diffusionGroup.style.display = 'none';
    weatherGroup.style.display = 'none';
    poetryGroup.style.display = 'none';

    if (du.type === 'TextToImageDisplayUnit') {
        promptGroup.style.display = 'block';
        promptInput.value = du.user_prompt || '';
    }

    if (du.type === 'ImageDisplayUnit') {
        imageGroup.style.display = 'block';
        imageIdInput.value = du.image_id || '';
        diffusionGroup.style.display = 'block';
        diffusionToggle.checked = !!du.enable_color_diffusion;
    }
    if (du.type === 'WeatherDisplayUnit') {
        weatherGroup.style.display = 'block';
        weatherInput.value = du.location || '';
    }
    if (du.type === 'PoetryDisplayUnit') {
        poetryGroup.style.display = 'block';
        poetryInput.value = du.mood_prompt || '';
    }

    status.style.display = 'none';
    status.textContent = '';
    if (previewImg) {
        previewImg.classList.remove('img-error');
    }
    setEditorPreviewState(previewWrap, 'loading', '正在生成预览图...');

    if (du.type === 'ImageDisplayUnit' && du.image_id) {
        updateEditorPreview(du.image_id, diffusionToggle, previewImg, requestToken, '正在渲染预览图...');
        if (diffusionToggle) {
            diffusionToggle.onchange = () => {
                updateEditorPreview(du.image_id, diffusionToggle, previewImg, requestToken, '正在应用颜色扩散...');
            };
        }
    } else {
        if (diffusionToggle) {
            diffusionToggle.onchange = null;
        }
        fetch(`/api/display-units/${duId}/preview`)
        .then(response => response.json())
        .then(data => {
            if (requestToken !== editorPreviewRequestToken) {
                return;
            }
            if (data.image_url) {
                previewImg.addEventListener('load', () => {
                    if (requestToken !== editorPreviewRequestToken) {
                        return;
                    }
                    setEditorPreviewState(previewWrap, 'ready', '预览生成完成');
                }, { once: true });
                previewImg.addEventListener('error', () => {
                    if (requestToken !== editorPreviewRequestToken) {
                        return;
                    }
                    setEditorPreviewState(previewWrap, 'error', '预览加载失败，请稍后重试');
                }, { once: true });
                previewImg.src = data.image_url;
                return;
            }
            if (data.error) {
                setEditorPreviewState(previewWrap, 'error', `预览失败：${data.error}`);
            } else {
                setEditorPreviewState(previewWrap, 'error', '预览生成失败');
            }
        })
        .catch(() => {
            if (requestToken !== editorPreviewRequestToken) {
                return;
            }
            setEditorPreviewState(previewWrap, 'error', '预览请求失败，请稍后重试');
        });
    }

    panel.style.display = 'block';
}

function saveEditorChanges() {
    if (!currentEditingDuId) {
        return;
    }
    const nameInput = document.getElementById('editor-name');
    const timeInput = document.getElementById('editor-display-time');
    const promptInput = document.getElementById('editor-prompt');
    const diffusionToggle = document.getElementById('editor-color-diffusion');
    const weatherInput = document.getElementById('edit-du-weather-location');
    const poetryInput = document.getElementById('edit-du-poetry-mood');
    const status = document.getElementById('editor-status');
    const typeValue = document.getElementById('editor-type').value;

    const payload = {
        name: nameInput.value.trim(),
        display_time: parseInt(timeInput.value, 10) || 1
    };

    if (promptInput && promptInput.value && document.getElementById('editor-prompt-group').style.display !== 'none') {
        payload.user_prompt = promptInput.value.trim();
    }
    if (typeValue === 'ImageDisplayUnit' && diffusionToggle) {
        payload.enable_color_diffusion = diffusionToggle.checked;
    }
    if (typeValue === 'WeatherDisplayUnit' && weatherInput) {
        const loc = weatherInput.value.trim();
        if (!loc) {
            status.style.display = 'block';
            status.textContent = '请填写地理位置代码';
            status.className = 'editor-status error';
            return;
        }
        payload.location = loc;
    }
    if (typeValue === 'PoetryDisplayUnit' && poetryInput) {
        payload.mood_prompt = poetryInput.value.trim();
    }

    fetch(`/api/display-units/${currentEditingDuId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(result => {
        if (result.error) {
            status.style.display = 'block';
            status.textContent = `保存失败：${result.error}`;
            status.className = 'editor-status error';
            return;
        }
        status.style.display = 'block';
        status.textContent = '保存成功';
        status.className = 'editor-status success';
        loadPlaylists();
    })
    .catch(() => {
        status.style.display = 'block';
        status.textContent = '保存失败';
        status.className = 'editor-status error';
    });
}

function updateEditorPreview(imageId, diffusionToggle, previewImg, requestToken, loadingText = '正在渲染预览图...') {
    if (!imageId || !previewImg) {
        return;
    }
    const previewWrap = previewImg.closest('.editor-preview');
    setEditorPreviewState(previewWrap, 'loading', loadingText);

    previewImg.addEventListener('load', () => {
        if (requestToken !== editorPreviewRequestToken) {
            return;
        }
        previewImg.classList.remove('img-loading');
        previewImg.classList.remove('img-error');
        setEditorPreviewState(previewWrap, 'ready', '预览生成完成');
    }, { once: true });
    previewImg.addEventListener('error', () => {
        if (requestToken !== editorPreviewRequestToken) {
            return;
        }
        previewImg.classList.remove('img-loading');
        previewImg.classList.add('img-error');
        setEditorPreviewState(previewWrap, 'error', '预览加载失败，请稍后重试');
    }, { once: true });

    previewImg.classList.add('img-loading');
    const diffusion = diffusionToggle ? diffusionToggle.checked : false;
    // fast path: show original immediately
    previewImg.src = `/api/image-preview/file?image_id=${encodeURIComponent(imageId)}&enable_color_diffusion=false&async=true&t=${Date.now()}`;
    if (diffusion) {
        window.setTimeout(() => {
            if (requestToken !== editorPreviewRequestToken) {
                return;
            }
            previewImg.classList.add('img-loading');
            previewImg.src = `/api/image-preview/file?image_id=${encodeURIComponent(imageId)}&enable_color_diffusion=true&async=false&t=${Date.now()}`;
        }, 200);
    }
}

function setEditorPreviewState(previewWrap, state, text) {
    if (!previewWrap) {
        return;
    }
    const machine = getEditorPreviewMachine(previewWrap);
    if (state === 'loading') {
        machine.setLoading(text || '正在生成预览图', '预计耗时 2-10 秒');
        return;
    }
    if (state === 'ready') {
        machine.setSuccess(text || '预览生成完成', '可继续编辑当前单元');
        const holdMs = window.PaperPiUI.motionMsVar ? window.PaperPiUI.motionMsVar('--pp-processing-success-hold-ms', 850) : 850;
        window.setTimeout(() => {
            previewWrap.classList.remove('is-ready');
        }, holdMs);
        return;
    }
    if (state === 'error') {
        machine.setError(text || '预览失败', '请检查图片资源或稍后重试');
    }
}

function clearEditorPreviewTicker() {
    document.querySelectorAll('.editor-preview').forEach((wrap) => {
        if (wrap.__waitMachine) {
            wrap.__waitMachine.destroy();
            delete wrap.__waitMachine;
        }
    });
}

function ensureEditorPreviewOverlay(previewWrap) {
    let overlay = previewWrap.querySelector('.editor-preview-overlay');
    if (overlay) {
        return overlay;
    }

    overlay = document.createElement('div');
    overlay.className = 'editor-preview-overlay';
    overlay.innerHTML = `
        <div class="editor-preview-visual" aria-hidden="true">
            <div class="editor-preview-canvas">
                <span class="editor-preview-line line-1"></span>
                <span class="editor-preview-line line-2"></span>
                <span class="editor-preview-line line-3"></span>
            </div>
            <span class="editor-preview-spinner"></span>
        </div>
        <p class="editor-preview-text"></p>
        <p class="editor-preview-meta"></p>
    `;
    previewWrap.appendChild(overlay);
    return overlay;
}

function getEditorPreviewMachine(previewWrap) {
    if (previewWrap.__waitMachine) {
        return previewWrap.__waitMachine;
    }

    const overlay = ensureEditorPreviewOverlay(previewWrap);
    const textEl = overlay.querySelector('.editor-preview-text');
    const metaEl = overlay.querySelector('.editor-preview-meta');

    previewWrap.__waitMachine = window.PaperPiUI.createWaitStateMachine({
        tickMs: window.PaperPiUI.motionMsVar ? window.PaperPiUI.motionMsVar('--pp-processing-ticker-ms', 420) : 420,
        onUpdate: ({ state, text, meta }) => {
            previewWrap.classList.remove('is-loading', 'is-ready', 'is-error');

            if (state === 'loading' || state === 'processing') {
                previewWrap.classList.add('is-loading');
            } else if (state === 'success') {
                previewWrap.classList.add('is-ready');
            } else if (state === 'error') {
                previewWrap.classList.add('is-error');
            }

            if (textEl) {
                textEl.textContent = text || '';
            }
            if (metaEl) {
                metaEl.textContent = meta || '';
            }
        }
    });

    return previewWrap.__waitMachine;
}

function initPlaylistDragAndDrop() {
    const containers = document.querySelectorAll('.playlist-du-items');
    containers.forEach(container => {
        let dragged = null;

        container.querySelectorAll('.playlist-du-item').forEach(item => {
            if (item.classList.contains('add-item')) {
                return;
            }

            item.addEventListener('dragstart', (e) => {
                dragged = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                if (dragged) {
                    dragged.classList.remove('dragging');
                }
                dragged = null;
            });
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(container, e.clientX);
            const dragging = container.querySelector('.dragging');
            if (!dragging) {
                return;
            }
            if (afterElement == null) {
                const addItem = container.querySelector('.add-item');
                container.insertBefore(dragging, addItem);
            } else {
                container.insertBefore(dragging, afterElement);
            }
        });

        container.addEventListener('drop', () => {
            const playlistId = container.dataset.playlistId;
            const newOrder = Array.from(container.querySelectorAll('.playlist-du-item'))
                .filter(el => !el.classList.contains('add-item'))
                .map(el => el.dataset.duId);

            fetch(`/api/playlists/${playlistId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ display_units: newOrder })
            })
            .then(response => response.json())
            .then(result => {
                if (result.error) {
                    window.PaperPiUI.toast(`更新排序失败：${result.error}`, 'error');
                    return;
                }
                loadPlaylists();
            })
            .catch(error => {
                console.error('Error updating playlist order:', error);
                window.PaperPiUI.toast('更新播放顺序失败', 'error');
            });
        });
    });
}

function initPlaylistHorizontalScroll() {
    const containers = document.querySelectorAll('.playlist-du-items');
    containers.forEach((container) => {
        if (container.dataset.wheelBound === '1') {
            return;
        }
        container.dataset.wheelBound = '1';
        container.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) {
                return;
            }
            if (container.scrollWidth <= container.clientWidth) {
                return;
            }
            e.preventDefault();
            container.scrollLeft += e.deltaY;
        }, { passive: false });
    });
}

function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.playlist-du-item:not(.dragging):not(.add-item)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset, element: child };
        }
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}


function loadImageLibraryForSelect(grid, input) {
    if (!grid || !input) {
        return;
    }

    fetch('/api/image-library')
    .then(response => response.json())
    .then(images => {
        renderImageSelectGrid(images, grid, input);
    })
    .catch(error => {
        console.error('Error loading image library:', error);
        grid.innerHTML = '<p class="error-message">加载图片库失败</p>';
    });
}

function renderImageSelectGrid(images, grid, input) {
    grid.innerHTML = '';

    if (!images || images.length === 0) {
        grid.innerHTML = '<p class="error-message">图片库为空</p>';
        return;
    }

    images.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'image-select-item reveal';
        div.style.setProperty('--i', idx + 1);
        div.dataset.imageId = item.id;
        div.innerHTML = `
            <img class="img-loading" loading="lazy" src="/api/image-library/${item.id}/file?t=${Date.now()}" alt="${item.original_name}">
            <div class="image-select-name">${item.original_name}</div>
        `;
        div.addEventListener('click', () => {
            const prevSelected = grid.querySelector('.image-select-item.selected');
            if (prevSelected) {
                prevSelected.classList.remove('selected');
            }
            div.classList.add('selected');
            input.value = item.id;
            const diffusionToggle = document.getElementById('du-color-diffusion');
            const addPreview = document.getElementById('du-image-preview');
            const addPreviewImg = document.getElementById('du-image-preview-img');
            updateAddPreview(input, diffusionToggle, addPreview, addPreviewImg);
        });
        grid.appendChild(div);
    });
    attachImageLoadingHandlers(grid);
}

function updateAddPreview(imageIdInput, diffusionToggle, preview, previewImg) {
    if (!imageIdInput || !imageIdInput.value || !preview || !previewImg) {
        return;
    }
    previewImg.classList.add('img-loading');
    const diffusion = diffusionToggle ? diffusionToggle.checked : false;
    // fast path: show original immediately
    previewImg.src = `/api/image-preview/file?image_id=${encodeURIComponent(imageIdInput.value)}&enable_color_diffusion=false&async=true&t=${Date.now()}`;
    if (diffusion) {
        window.setTimeout(() => {
            previewImg.classList.add('img-loading');
            previewImg.src = `/api/image-preview/file?image_id=${encodeURIComponent(imageIdInput.value)}&enable_color_diffusion=true&async=false&t=${Date.now()}`;
        }, 200);
    }
    preview.style.display = 'block';
}

function attachImageLoadingHandlers(root) {
    const imgs = root.querySelectorAll('img.img-loading');
    imgs.forEach(img => {
        img.addEventListener('load', () => img.classList.remove('img-loading'), { once: true });
        img.addEventListener('error', () => {
            img.classList.remove('img-loading');
            img.classList.add('img-error');
        }, { once: true });
    });
}

// 打开添加显示单元模态框
function openAddDuModal(playlistId) {
    currentPlaylistId = playlistId;
    document.getElementById('add-du-modal').classList.add('active');

    const duTypeSelect = document.getElementById('du-type');
    const imageGrid = document.getElementById('du-image-grid');
    const imageIdInput = document.getElementById('du-image-id');
    if (duTypeSelect && duTypeSelect.value === 'ImageDisplayUnit') {
        loadImageLibraryForSelect(imageGrid, imageIdInput);
    }
}

// 创建播放列表项
// createPlaylistItem removed in favor of HTML render to reduce DOM churn

// 编辑播放列表
async function editPlaylist(playlistId) {
    const current = cachedPlaylists.find((p) => p.id === playlistId);
    const normalized = await askPlaylistName({
        title: '重命名播放列表',
        message: '名称规则：至少 2 个字符；不能包含 \\\\/:*?"<>|；不能与其他播放列表重名。',
        initialValue: current && current.name ? current.name : '',
        editingId: playlistId
    });
    if (!normalized) {
        return;
    }

    fetch(`/api/playlists/${playlistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: normalized })
    })
    .then(response => response.json())
    .then(result => {
        if (result.error) {
            window.PaperPiUI.toast(`更新失败：${result.error}`, 'error');
            return;
        }
        window.PaperPiUI.toast('播放列表重命名成功', 'success');
        loadPlaylists();
    })
    .catch(error => {
        console.error('Error updating playlist:', error);
        window.PaperPiUI.toast('更新播放列表失败', 'error');
    });
}

function normalizePlaylistName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ');
}

async function askPlaylistName({ title, message, initialValue, editingId }) {
    let nextValue = initialValue || '';
    while (true) {
        const nameInput = await window.PaperPiUI.prompt({
            title: title || '输入播放列表名称',
            message: message || '',
            value: nextValue,
            placeholder: '例如：晨间看板',
            okText: '保存',
            cancelText: '取消'
        });
        if (nameInput === null) {
            return null;
        }

        const normalized = normalizePlaylistName(nameInput);
        const validationError = validatePlaylistName(normalized, editingId || null, cachedPlaylists);
        if (validationError) {
            window.PaperPiUI.toast(validationError, 'warn');
            nextValue = normalized;
            continue;
        }
        return normalized;
    }
}

async function createPlaylistByName(name) {
    try {
        const result = await window.PaperPiUI.requestJSON('/api/playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (result && result.error) {
            throw new Error(result.error);
        }

        window.PaperPiUI.toast('播放列表创建成功', 'success');
        if (result && result.id && result.name) {
            cachedPlaylists = [...cachedPlaylists, { id: result.id, name: result.name }];
        }
        loadPlaylists();
    } catch (error) {
        console.error('Error creating playlist:', error);
        window.PaperPiUI.toast('创建播放列表失败', 'error');
    }
}

function validatePlaylistName(name, editingId, playlists) {
    if (!name) {
        return '名称不能为空';
    }
    if (name.length < 2) {
        return '名称至少需要 2 个字符';
    }
    if (name.length > 40) {
        return '名称最多 40 个字符';
    }
    if (/[\\/:*?"<>|]/.test(name)) {
        return '名称包含非法字符：\\\\ / : * ? \" < > |';
    }
    if (/[\u0000-\u001f]/.test(name)) {
        return '名称包含不可见控制字符';
    }

    const exists = (playlists || []).some((item) => {
        if (!item || item.id === editingId) {
            return false;
        }
        return normalizePlaylistName(item.name).toLocaleLowerCase() === name.toLocaleLowerCase();
    });
    if (exists) {
        return '名称已存在，请更换一个名称';
    }
    return '';
}

// 删除播放列表
async function deletePlaylist(playlistId) {
    const confirmed = await window.PaperPiUI.confirm({
        title: '确认删除播放列表',
        message: '删除后无法恢复，确定继续吗？',
        okText: '删除',
        cancelText: '取消'
    });
    if (!confirmed) {
        return;
    }

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
        window.PaperPiUI.toast('删除播放列表失败', 'error');
    });
}

function togglePlaylistPlayback(playlistId) {
    const normalizedPlaylistId = normalizePlaylistId(playlistId);
    if (activePlaylistId === normalizedPlaylistId) {
        fetch('/api/playlists/stop', { method: 'POST' })
        .then(() => {
            activePlaylistId = null;
            localStorage.removeItem('activePlaylistId');
            loadPlaylists();
        })
        .catch(() => {});
    } else {
        fetch(`/api/playlists/${playlistId}/play`, { method: 'POST' })
        .then(response => response.json())
        .then(() => {
            activePlaylistId = normalizedPlaylistId;
            localStorage.setItem('activePlaylistId', normalizedPlaylistId);
            loadPlaylists();
        })
        .catch(() => {});
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
        window.PaperPiUI.toast('从播放列表中移除显示单元失败', 'error');
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
            window.PaperPiUI.toast('显示单元已经在播放列表中', 'warn');
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
            window.PaperPiUI.toast('添加显示单元到播放列表失败', 'error');
        }
    });
}


window.PaperPiPages = window.PaperPiPages || {};
window.PaperPiPages.admin = {
    init: initAdminPage,
    destroy: () => {
        clearEditorPreviewTicker();
    }
};

window.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('playlist-list')) {
        initAdminPage();
    }
});
