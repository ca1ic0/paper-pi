var ui = window.PaperPiUI;
let pollTimer = null;
let statusMachine = null;
let previewMachine = null;
let previewHideTimer = null;

function navigateTo(url) {
    if (window.PaperPiRouter && typeof window.PaperPiRouter.navigate === 'function') {
        window.PaperPiRouter.navigate(url);
        return;
    }
    window.location.href = url;
}

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
    initPreviewMachine();
    initBackLink();
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
    if (previewMachine && typeof previewMachine.destroy === 'function') {
        previewMachine.destroy();
    }
    if (previewHideTimer) {
        clearTimeout(previewHideTimer);
        previewHideTimer = null;
    }
}

function initStatusMachine() {
    const status = document.getElementById('detail-status');
    const tickMs = ui.motionMsVar ? ui.motionMsVar('--pp-processing-ticker-ms', 420) : 420;
    statusMachine = ui.createWaitStateMachine({
        tickMs,
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

function initPreviewMachine() {
    const preview = document.querySelector('.detail-preview');
    if (!preview) {
        return;
    }

    const overlay = ensureDetailPreviewOverlay(preview);
    const textEl = overlay.querySelector('.detail-preview-text');
    const metaEl = overlay.querySelector('.detail-preview-meta');
    const barEl = overlay.querySelector('.detail-preview-bar > i');

    const tickMs = ui.motionMsVar ? ui.motionMsVar('--pp-processing-ticker-ms', 420) : 420;
    const loadingBase = ui.motionNumberVar ? ui.motionNumberVar('--pp-processing-detail-loading-base', 18) : 18;
    const loadingStep = ui.motionNumberVar ? ui.motionNumberVar('--pp-processing-detail-loading-step', 8) : 8;
    const loadingCap = ui.motionNumberVar ? ui.motionNumberVar('--pp-processing-detail-loading-cap', 55) : 55;
    const processingBase = ui.motionNumberVar ? ui.motionNumberVar('--pp-processing-detail-base', 24) : 24;
    const processingStep = ui.motionNumberVar ? ui.motionNumberVar('--pp-processing-detail-step', 4) : 4;
    const processingCap = ui.motionNumberVar ? ui.motionNumberVar('--pp-processing-detail-cap', 92) : 92;
    const successHoldMs = ui.motionMsVar ? ui.motionMsVar('--pp-processing-success-hold-ms', 850) : 850;

    previewMachine = ui.createWaitStateMachine({
        tickMs,
        onUpdate: ({ state, text, meta, elapsed }) => {
            preview.classList.remove('is-loading', 'is-processing', 'is-ready', 'is-error');

            if (state === 'idle') {
                overlay.style.opacity = '0';
                if (barEl) {
                    barEl.style.width = '0%';
                }
                return;
            }

            overlay.style.opacity = '1';
            if (state === 'loading') {
                preview.classList.add('is-loading');
                if (barEl) {
                    barEl.style.width = `${Math.min(loadingCap, loadingBase + elapsed * loadingStep)}%`;
                }
            } else if (state === 'processing') {
                preview.classList.add('is-processing');
                if (barEl) {
                    barEl.style.width = `${Math.min(processingCap, processingBase + elapsed * processingStep)}%`;
                }
            } else if (state === 'success') {
                preview.classList.add('is-ready');
                if (barEl) {
                    barEl.style.width = '100%';
                }
                if (previewHideTimer) {
                    clearTimeout(previewHideTimer);
                }
                previewHideTimer = window.setTimeout(() => {
                    overlay.style.opacity = '0';
                    preview.classList.remove('is-ready');
                    previewHideTimer = null;
                }, successHoldMs);
            } else if (state === 'error') {
                preview.classList.add('is-error');
                if (barEl) {
                    barEl.style.width = '100%';
                }
            }

            if (textEl) {
                textEl.textContent = text || '';
            }
            if (metaEl) {
                metaEl.textContent = meta || '';
            }
        }
    });
}

function initBackLink() {
    const backLink = document.querySelector('.library-actions a[href="/library"]');
    if (!backLink) {
        return;
    }
    backLink.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
            return;
        }
        e.preventDefault();
        navigateTo('/library');
    });
}

function ensureDetailPreviewOverlay(preview) {
    let overlay = preview.querySelector('.detail-preview-overlay');
    if (overlay) {
        return overlay;
    }

    overlay = document.createElement('div');
    overlay.className = 'detail-preview-overlay';
    overlay.innerHTML = `
        <span class="detail-preview-chip">AI 生成中</span>
        <span class="detail-preview-spinner" aria-hidden="true"></span>
        <p class="detail-preview-text"></p>
        <p class="detail-preview-meta"></p>
        <span class="detail-preview-bar"><i style="width: 0%"></i></span>
    `;
    preview.appendChild(overlay);
    return overlay;
}

async function loadDetail() {
    const imageId = getImageIdFromPath();
    if (!imageId) {
        statusMachine.setError('图片 ID 无效', '请返回图片库重试');
        if (previewMachine) {
            previewMachine.setError('无效图片', '请返回图片库重试');
        }
        return;
    }

    try {
        if (previewMachine) {
            previewMachine.setLoading('正在加载缩略图', '初始化预览资源');
        }
        const data = await ui.requestJSON(`/api/image-library/${imageId}`);
        if (data.error) {
            throw new Error(data.error);
        }

        const img = document.getElementById('detail-image');
        img.onload = () => {
            if (!previewMachine) {
                return;
            }
            if (data.status === 'processing') {
                return;
            }
            previewMachine.setSuccess('缩略图加载完成', '可直接查看与操作');
        };
        img.onerror = () => {
            if (previewMachine) {
                previewMachine.setError('缩略图加载失败', '请稍后刷新重试');
            }
        };
        img.src = data.file_url;

        document.getElementById('detail-name').textContent = data.original_name || '-';
        document.getElementById('detail-path').textContent = data.file_path || '-';
        document.getElementById('detail-date').textContent = data.created_at || '-';
        document.getElementById('detail-status-text').textContent = data.status || 'ready';

        if (data.status === 'processing') {
            statusMachine.setProcessing('图片处理中，正在自动刷新状态', '预计耗时 5-30 秒');
            if (previewMachine) {
                previewMachine.setProcessing('AI 正在绘制预览图', '生成完成后将自动刷新');
            }
            startPolling(imageId);
        }
    } catch (err) {
        console.error(err);
        statusMachine.setError(`加载失败：${err.message || ''}`, '请稍后刷新重试');
        if (previewMachine) {
            previewMachine.setError('图片加载失败', '请检查网络或稍后重试');
        }
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
    if (previewMachine) {
        previewMachine.setLoading('AI 风格化处理中', '请保持页面开启');
    }
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
        if (previewMachine) {
            previewMachine.setSuccess('新任务已创建', '即将跳转');
        }
        ui.toast('风格化任务已提交', 'success');
        const routeDelayMs = ui.motionMsVar ? ui.motionMsVar('--pp-route-delay-ms', 500) : 500;
        window.setTimeout(() => {
            navigateTo(`/library/${data.id}`);
        }, routeDelayMs);
    } catch (err) {
        console.error(err);
        statusMachine.setError(`风格化失败：${err.message || ''}`, '请稍后重试');
        if (previewMachine) {
            previewMachine.setError('风格化失败', '请稍后重试');
        }
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
                if (previewMachine) {
                    previewMachine.setSuccess('预览图生成完成', '展示已自动更新');
                }
                clearInterval(pollTimer);
                pollTimer = null;
            } else if (data.status === 'failed') {
                statusMachine.setError(`生成失败：${data.error || ''}`, '可重新发起风格化');
                if (previewMachine) {
                    previewMachine.setError('预览图生成失败', '可重新发起风格化');
                }
                clearInterval(pollTimer);
                pollTimer = null;
            }
        } catch (err) {
            statusMachine.setError('轮询失败，请稍后刷新页面。', '网络波动或服务繁忙');
            if (previewMachine) {
                previewMachine.setError('状态更新失败', '请刷新页面重试');
            }
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
