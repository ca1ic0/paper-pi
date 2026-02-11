var ui = window.PaperPiUI;
let processingTicker = null;

function navigateTo(url) {
    if (window.PaperPiRouter && typeof window.PaperPiRouter.navigate === 'function') {
        window.PaperPiRouter.navigate(url);
        return;
    }
    window.location.href = url;
}

function initLibraryPage() {
    document.body.classList.add('is-loaded');
    initUploadControls();
    initBatchControls();
    initRefreshControl();
    loadImageLibrary({ showSkeleton: true });
}

function destroyLibraryPage() {
    if (processingTicker) {
        window.clearInterval(processingTicker);
        processingTicker = null;
    }
}

function initUploadControls() {
    const uploadBtn = document.getElementById('library-upload-btn');
    const uploadInput = document.getElementById('library-upload-input');
    const dropzone = document.getElementById('library-dropzone');

    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', () => uploadInput.click());
        uploadInput.addEventListener('change', () => {
            if (!uploadInput.files || uploadInput.files.length === 0) {
                return;
            }
            uploadFile(uploadInput.files[0]);
            uploadInput.value = '';
        });
    }

    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                uploadFile(e.dataTransfer.files[0]);
            }
        });
    }
}

async function uploadFile(file) {
    const uploadBtn = document.getElementById('library-upload-btn');
    const formData = new FormData();
    formData.append('file', file);

    ui.setButtonBusy(uploadBtn, true, '上传中...');

    try {
        const result = await ui.requestJSON('/api/image-library/upload', {
            method: 'POST',
            body: formData
        });

        if (result.error) {
            throw new Error(result.error);
        }

        ui.toast('上传成功，正在刷新列表', 'success');
        await loadImageLibrary();
    } catch (error) {
        console.error('Error uploading image:', error);
        ui.toast(`上传失败：${error.message || '请稍后重试'}`, 'error');
    } finally {
        ui.setButtonBusy(uploadBtn, false);
    }
}

async function loadImageLibrary({ showSkeleton = false } = {}) {
    const grid = document.getElementById('library-grid');
    const refreshBtn = document.getElementById('library-refresh-btn');
    if (!grid) {
        return;
    }

    if (showSkeleton) {
        ui.renderSkeleton(grid, 8);
    }

    if (refreshBtn) {
        refreshBtn.classList.add('is-spinning');
    }

    try {
        const images = await ui.requestJSON('/api/image-library');
        renderLibraryGrid(images);
    } catch (error) {
        console.error('Error loading image library:', error);
        grid.innerHTML = '<p class="error-message">加载图片库失败，请稍后重试。</p>';
        ui.toast(error.message || '加载失败', 'error');
    } finally {
        if (refreshBtn) {
            refreshBtn.classList.remove('is-spinning');
        }
    }
}

function renderLibraryGrid(images) {
    const grid = document.getElementById('library-grid');
    if (!grid) {
        return;
    }
    grid.innerHTML = '';

    if (!images || images.length === 0) {
        grid.innerHTML = '<p class="error-message">图片库为空，先上传一张图片开始。</p>';
        return;
    }

    const batchMode = grid.classList.contains('batch-mode');
    images.forEach((item, idx) => {
        const status = item.status || 'ready';
        const div = document.createElement('div');
        div.className = `library-item reveal ${status === 'processing' ? 'is-processing' : ''} ${status === 'failed' ? 'is-failed' : ''}`;
        div.style.setProperty('--i', idx + 1);
        div.dataset.imageId = item.id;
        const statusBadge = status === 'processing'
            ? ''
            : `<span class="library-status ${status}">${statusLabel(status)}</span>`;
        div.innerHTML = `
            <div class="library-thumb">
                <img class="img-loading" loading="lazy" src="/api/image-library/${item.id}/file?t=${Date.now()}" alt="${escapeHtml(item.original_name)}">
                <div class="library-processing-mask" aria-hidden="true">
                    <span class="library-processing-chip">AI 生成中</span>
                    <span class="library-processing-spinner"></span>
                    <span class="library-processing-text">已等待 0 秒</span>
                    <span class="library-processing-bar"><i style="width: 18%"></i></span>
                </div>
                ${statusBadge}
                <label class="library-check">
                    <input type="checkbox" ${batchMode ? '' : 'disabled'}>
                    <span></span>
                </label>
            </div>
            <div class="library-name">${escapeHtml(item.original_name)}</div>
        `;
        div.addEventListener('click', (e) => {
            const checkbox = div.querySelector('input[type="checkbox"]');
            const isCheckbox = e.target.tagName === 'INPUT' || e.target.closest('label');
            if (grid.classList.contains('batch-mode')) {
                if (!isCheckbox) {
                    checkbox.checked = !checkbox.checked;
                }
                div.classList.toggle('selected', checkbox.checked);
                updateDeleteButton();
            } else {
                navigateTo(`/library/${item.id}`);
            }
        });
        grid.appendChild(div);
    });
    attachImageLoadingHandlers(grid);
    startProcessingTicker(grid);
}

function attachImageLoadingHandlers(root) {
    const imgs = root.querySelectorAll('img.img-loading');
    imgs.forEach((img) => {
        img.addEventListener('load', () => img.classList.remove('img-loading'), { once: true });
        img.addEventListener('error', () => {
            img.classList.remove('img-loading');
            img.classList.add('img-error');
        }, { once: true });
    });
}

function statusLabel(status) {
    if (status === 'processing') {
        return '生成中';
    }
    if (status === 'failed') {
        return '失败';
    }
    return '';
}

function startProcessingTicker(root) {
    if (processingTicker) {
        window.clearInterval(processingTicker);
        processingTicker = null;
    }

    const processingItems = Array.from(root.querySelectorAll('.library-item.is-processing'));
    if (processingItems.length === 0) {
        return;
    }

    const baseMin = ui.motionNumberVar ? ui.motionNumberVar('--pp-processing-progress-base-min', 14) : 14;
    const baseMax = ui.motionNumberVar ? ui.motionNumberVar('--pp-processing-progress-base-max', 32) : 32;
    const progressStep = ui.motionNumberVar ? ui.motionNumberVar('--pp-processing-progress-step', 4) : 4;
    const tickMs = ui.motionMsVar ? ui.motionMsVar('--pp-processing-ticker-ms', 420) : 420;

    const start = Date.now();
    processingItems.forEach((item) => {
        if (!item.dataset.progressBase) {
            const span = Math.max(1, baseMax - baseMin);
            item.dataset.progressBase = String(Math.floor(baseMin + Math.random() * span));
        }
    });
    processingTicker = window.setInterval(() => {
        const elapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));
        processingItems.forEach((item) => {
            const textEl = item.querySelector('.library-processing-text');
            const barEl = item.querySelector('.library-processing-bar > i');
            const base = Number(item.dataset.progressBase || '20');
            const progress = Math.min(95, base + elapsed * progressStep);

            if (textEl) {
                textEl.textContent = `AI 绘制中 · 已等待 ${elapsed} 秒`;
            }
            if (barEl) {
                barEl.style.width = `${progress}%`;
            }
        });
    }, tickMs);
}

function initBatchControls() {
    const toggleBtn = document.getElementById('library-select-toggle');
    const deleteBtn = document.getElementById('library-delete-btn');
    const grid = document.getElementById('library-grid');
    if (!toggleBtn || !deleteBtn || !grid) {
        return;
    }

    toggleBtn.addEventListener('click', () => {
        grid.classList.toggle('batch-mode');
        const enabled = grid.classList.contains('batch-mode');
        toggleBtn.textContent = enabled ? '退出批量' : '批量管理';
        deleteBtn.disabled = true;
        renderLibraryGridFromDom();
    });

    deleteBtn.addEventListener('click', async () => {
        const selected = Array.from(grid.querySelectorAll('.library-item.selected'))
            .map((el) => el.dataset.imageId);

        if (selected.length === 0) {
            return;
        }

        const confirmed = await ui.confirm({
            title: '确认删除图片',
            message: `确定删除 ${selected.length} 张图片吗？此操作不可撤销。`,
            okText: '删除',
            cancelText: '取消'
        });
        if (!confirmed) {
            return;
        }

        ui.setButtonBusy(deleteBtn, true, '删除中...');

        try {
            const result = await ui.requestJSON('/api/image-library/batch-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_ids: selected })
            });

            if (result.error) {
                throw new Error(result.error);
            }

            ui.toast(`已删除 ${selected.length} 张图片`, 'success');
            await loadImageLibrary();
        } catch (error) {
            console.error('Error deleting images:', error);
            ui.toast(`删除失败：${error.message || '请稍后重试'}`, 'error');
        } finally {
            ui.setButtonBusy(deleteBtn, false);
            deleteBtn.disabled = true;
        }
    });
}

function initRefreshControl() {
    const refreshBtn = document.getElementById('library-refresh-btn');
    if (!refreshBtn) {
        return;
    }
    refreshBtn.addEventListener('click', () => {
        loadImageLibrary();
    });
}

function updateDeleteButton() {
    const deleteBtn = document.getElementById('library-delete-btn');
    const grid = document.getElementById('library-grid');
    if (!deleteBtn || !grid) {
        return;
    }
    const selectedCount = grid.querySelectorAll('.library-item.selected').length;
    deleteBtn.disabled = selectedCount === 0;
}

function renderLibraryGridFromDom() {
    const grid = document.getElementById('library-grid');
    if (!grid) {
        return;
    }
    const items = Array.from(grid.querySelectorAll('.library-item'));
    const batchMode = grid.classList.contains('batch-mode');
    items.forEach((item) => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.disabled = !batchMode;
            if (!batchMode) {
                checkbox.checked = false;
                item.classList.remove('selected');
            }
        }
    });
}

function escapeHtml(text) {
    if (typeof text !== 'string') {
        return '';
    }
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

window.PaperPiPages = window.PaperPiPages || {};
window.PaperPiPages.library = {
    init: initLibraryPage,
    destroy: destroyLibraryPage
};

window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('library-grid')) {
        initLibraryPage();
    }
});
