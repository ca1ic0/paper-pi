// 图片详情页脚本

window.addEventListener('DOMContentLoaded', function() {
    document.body.classList.add('is-loaded');
    loadDetail();
    initStyleButtons();
});

function loadDetail() {
    fetch(`/api/image-library/${IMAGE_ID}`)
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showStatus(`加载失败：${data.error}`, true);
            return;
        }
        const img = document.getElementById('detail-image');
        img.src = data.file_url;
        document.getElementById('detail-name').textContent = data.original_name || '-';
        document.getElementById('detail-path').textContent = data.file_path || '-';
        document.getElementById('detail-date').textContent = data.created_at || '-';
        document.getElementById('detail-status-text').textContent = data.status || 'ready';

        if (data.status === 'processing') {
            startPolling();
        }
    })
    .catch(err => {
        console.error(err);
        showStatus('加载失败', true);
    });
}

function initStyleButtons() {
    const buttons = document.querySelectorAll('.detail-actions button');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const style = btn.getAttribute('data-style');
            stylizeImage(style);
        });
    });
}

function stylizeImage(style) {
    showStatus('风格化处理中...', false);
    fetch(`/api/image-library/${IMAGE_ID}/stylize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showStatus(`风格化失败：${data.error}`, true);
            return;
        }
        showStatus('风格化任务已提交，生成中...', false);
        setTimeout(() => {
            window.location.href = `/library/${data.id}`;
        }, 600);
    })
    .catch(err => {
        console.error(err);
        showStatus('风格化失败', true);
    });
}

function showStatus(text, isError) {
    const status = document.getElementById('detail-status');
    status.style.display = 'block';
    status.textContent = text;
    status.className = 'detail-status' + (isError ? ' error' : ' success');
}

let pollTimer = null;

function startPolling() {
    if (pollTimer) {
        return;
    }
    pollTimer = setInterval(() => {
        fetch(`/api/image-library/${IMAGE_ID}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showStatus(`加载失败：${data.error}`, true);
                return;
            }
            document.getElementById('detail-status-text').textContent = data.status || 'ready';
            if (data.status === 'ready') {
                const img = document.getElementById('detail-image');
                img.src = data.file_url + `?t=${Date.now()}`;
                showStatus('生成完成', false);
                clearInterval(pollTimer);
                pollTimer = null;
            } else if (data.status === 'failed') {
                showStatus(`生成失败：${data.error || ''}`, true);
                clearInterval(pollTimer);
                pollTimer = null;
            }
        })
        .catch(() => {
            showStatus('轮询失败', true);
        });
    }, 3000);
}
