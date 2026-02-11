var ui = window.PaperPiUI;
let pollTimer = null;
let statusMachine = null;

function getImageIdFromPath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] === 'library') {
        return decodeURIComponent(parts[1]);
    }
    return '';
}

function initLibraryDetailPage() {
    document.body.classList.add('is-loaded');
    initStatusMachine();
    loadDetail();
    initStyleButtons();
}

function destroyLibraryDetailPage() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    if (statusMachine && typeof statusMachine.destroy === 'function') {
        statusMachine.destroy();
    }
}

function initStatusMachine() {
    const status = document.getElementById('detail-status');
    statusMachine = ui.createWaitStateMachine({
        onUpdate: ({ state, text, meta }) => {
            if (!status) {
                return;
            }

            if (state === 'idle') {
                status.style.display = 'none';
                status.textContent = '';
                status.className = 'detail-status';
                return;
            }

            status.style.display = 'block';
            status.className = `detail-status ${state === 'error' ? 'error' : state === 'processing' || state === 'loading' ? 'processing' : 'success'}`;
            status.innerHTML = `${text || ''}${meta ? `<small>${meta}</small>` : ''}`;
        }
    });
}

async function loadDetail() {
    const imageId = getImageIdFromPath();
    if (!imageId) {
        statusMachine.setError('图片 ID 无效', '请返回图片库重试');
        return;
    }

    try {
        const data = await ui.requestJSON(`/api/image-library/${imageId}`);
        if (data.error) {
            throw new Error(data.error);
        }

        const img = document.getElementById('detail-image');
        img.src = data.file_url;
        document.getElementById('detail-name').textContent = data.original_name || '-';
        document.getElementById('detail-path').textContent = data.file_path || '-';
        document.getElementById('detail-date').textContent = data.created_at || '-';
        document.getElementById('detail-status-text').textContent = data.status || 'ready';

        if (data.status === 'processing') {
            statusMachine.setProcessing('图片处理中，正在自动刷新状态', '预计耗时 5-30 秒');
            startPolling(imageId);
        }
    } catch (err) {
        console.error(err);
        statusMachine.setError(`加载失败：${err.message || ''}`, '请稍后刷新重试');
        ui.toast('加载图片详情失败', 'error');
    }
}

function initStyleButtons() {
    const buttons = document.querySelectorAll('.detail-actions button');
    buttons.forEach((btn) => {
        btn.addEventListener('click', async () => {
            const style = btn.getAttribute('data-style');
            await stylizeImage(style, btn);
        });
    });
}

async function stylizeImage(style, button) {
    const imageId = getImageIdFromPath();
    statusMachine.setLoading('风格化处理中', '预计耗时 8-40 秒');
    ui.setButtonBusy(button, true, '处理中...');

    try {
        const data = await ui.requestJSON(`/api/image-library/${imageId}/stylize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ style })
        });

        if (data.error) {
            throw new Error(data.error);
        }

        statusMachine.setSuccess('风格化任务已提交，跳转至新任务...', '即将自动跳转');
        ui.toast('风格化任务已提交', 'success');
        window.setTimeout(() => {
            window.location.href = `/library/${data.id}`;
        }, 500);
    } catch (err) {
        console.error(err);
        statusMachine.setError(`风格化失败：${err.message || ''}`, '请稍后重试');
        ui.toast('风格化失败', 'error');
    } finally {
        ui.setButtonBusy(button, false);
    }
}

function startPolling(imageId) {
    if (pollTimer) {
        return;
    }

    pollTimer = setInterval(async () => {
        try {
            const data = await ui.requestJSON(`/api/image-library/${imageId}`);
            if (data.error) {
                throw new Error(data.error);
            }

            document.getElementById('detail-status-text').textContent = data.status || 'ready';

            if (data.status === 'ready') {
                const img = document.getElementById('detail-image');
                img.src = `${data.file_url}?t=${Date.now()}`;
                statusMachine.setSuccess('生成完成', '图片已更新');
                clearInterval(pollTimer);
                pollTimer = null;
            } else if (data.status === 'failed') {
                statusMachine.setError(`生成失败：${data.error || ''}`, '可重新发起风格化');
                clearInterval(pollTimer);
                pollTimer = null;
            }
        } catch (err) {
            statusMachine.setError('轮询失败，请稍后刷新页面。', '网络波动或服务繁忙');
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }, 3000);
}

window.PaperPiPages = window.PaperPiPages || {};
window.PaperPiPages.libraryDetail = {
    init: initLibraryDetailPage,
    destroy: destroyLibraryDetailPage
};

window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('detail-image')) {
        initLibraryDetailPage();
    }
});
