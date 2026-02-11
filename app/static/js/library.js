// 图片库页面脚本

window.addEventListener('DOMContentLoaded', function() {
    initLibraryPage();
});

function initLibraryPage() {
    document.body.classList.add('is-loaded');
    initUploadControls();
    initBatchControls();
    initRefreshControl();
    loadImageLibrary();
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

function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/image-library/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(result => {
        if (result.error) {
            alert(`上传失败：${result.error}`);
            return;
        }
        loadImageLibrary();
    })
    .catch(error => {
        console.error('Error uploading image:', error);
        alert('上传图片失败');
    });
}

function loadImageLibrary() {
    fetch('/api/image-library')
    .then(response => response.json())
    .then(images => {
        renderLibraryGrid(images);
    })
    .catch(error => {
        console.error('Error loading image library:', error);
    });
}

function renderLibraryGrid(images) {
    const grid = document.getElementById('library-grid');
    if (!grid) {
        return;
    }
    grid.innerHTML = '';

    if (!images || images.length === 0) {
        grid.innerHTML = '<p class="error-message">图片库为空</p>';
        return;
    }

    const batchMode = grid.classList.contains('batch-mode');
    images.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'library-item reveal';
        div.style.setProperty('--i', idx + 1);
        div.dataset.imageId = item.id;
        div.innerHTML = `
            <div class="library-thumb">
                <img class="img-loading" loading="lazy" src="/api/image-library/${item.id}/file?t=${Date.now()}" alt="${item.original_name}">
                <span class="library-status ${item.status || 'ready'}">${statusLabel(item.status)}</span>
                <label class="library-check">
                    <input type="checkbox" ${batchMode ? '' : 'disabled'}>
                    <span></span>
                </label>
            </div>
            <div class="library-name">${item.original_name}</div>
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
                window.location.href = `/library/${item.id}`;
            }
        });
        grid.appendChild(div);
    });
    attachImageLoadingHandlers(grid);
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

function statusLabel(status) {
    if (status === 'processing') {
        return '生成中';
    }
    if (status === 'failed') {
        return '失败';
    }
    return '';
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

    deleteBtn.addEventListener('click', () => {
        const selected = Array.from(grid.querySelectorAll('.library-item.selected'))
            .map(el => el.dataset.imageId);
        if (selected.length === 0) {
            return;
        }
        if (!confirm(`确定删除 ${selected.length} 张图片吗？`)) {
            return;
        }
        fetch('/api/image-library/batch-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_ids: selected })
        })
        .then(response => response.json())
        .then(result => {
            if (result.error) {
                alert(`删除失败：${result.error}`);
                return;
            }
            loadImageLibrary();
            deleteBtn.disabled = true;
        })
        .catch(error => {
            console.error('Error deleting images:', error);
            alert('删除失败');
        });
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
    items.forEach(item => {
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
