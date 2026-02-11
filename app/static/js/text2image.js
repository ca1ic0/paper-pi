var ui = window.PaperPiUI;

function initText2ImagePage() {
    document.body.classList.add('is-loaded');

    const form = document.getElementById('text2image-form');
    const resultContainer = document.getElementById('result-container');
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const resultContent = document.getElementById('result-content');
    const resultImage = document.getElementById('result-image');
    const resultPath = document.getElementById('result-path');
    const resultTime = document.getElementById('result-time');
    const resultLibrary = document.getElementById('result-library');
    const previewBtn = document.getElementById('preview-on-epaper');
    const previewStatus = document.getElementById('preview-status');
    const previewMachine = ui.createWaitStateMachine({
        onUpdate: ({ state, text, meta }) => {
            if (state === 'idle') {
                previewStatus.style.display = 'none';
                previewStatus.innerHTML = '';
                return;
            }

            previewStatus.style.display = 'block';
            if (state === 'loading' || state === 'processing') {
                previewStatus.innerHTML = `
                    <div class="status-note processing">
                        <span class="status-inline-spinner" aria-hidden="true"></span>
                        <span>${text || ''}</span>
                        <small>${meta || ''}</small>
                    </div>
                `;
                return;
            }

            if (state === 'success') {
                previewStatus.innerHTML = `<div class="status-note success">${text || ''}</div>`;
                return;
            }

            if (state === 'error') {
                previewStatus.innerHTML = `<div class="status-note error">${text || ''}<small>${meta || ''}</small></div>`;
            }
        }
    });

    let currentImageData = null;

    if (!form) {
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const promptInput = document.getElementById('prompt');
        const submitBtn = form.querySelector('button[type="submit"]');
        const prompt = promptInput ? promptInput.value.trim() : '';

        if (!prompt) {
            ui.toast('请输入图片描述', 'warn');
            return;
        }

        resultContainer.style.display = 'block';
        loading.style.display = 'block';
        error.style.display = 'none';
        resultContent.style.display = 'none';
        previewMachine.reset();
        ui.setButtonBusy(submitBtn, true, '生成中...');

        try {
            const data = await ui.requestJSON('/api/text2image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt })
            });

            if (data.error) {
                throw new Error(data.error);
            }

            if (!data.image_url || !data.save_path) {
                throw new Error('生成结果不完整，请稍后重试');
            }

            resultImage.src = data.image_url;
            resultPath.textContent = `保存路径：${data.save_path}`;
            resultLibrary.textContent = data.image_id
                ? `图片库：已保存（ID: ${data.image_id}）`
                : '图片库：未保存';
            resultTime.textContent = `生成时间：${new Date().toLocaleString()}`;
            resultContent.style.display = 'block';
            ui.toast('图片生成完成', 'success');

            currentImageData = {
                save_path: data.save_path,
                image_id: data.image_id || null
            };
        } catch (err) {
            console.error('Error:', err);
            error.textContent = err.message || '生成图片失败，请稍后重试';
            error.style.display = 'block';
            ui.toast(error.textContent, 'error');
        } finally {
            loading.style.display = 'none';
            ui.setButtonBusy(submitBtn, false);
        }
    });

    if (previewBtn) {
        previewBtn.addEventListener('click', async () => {
            if (!currentImageData) {
                ui.toast('请先生成图片', 'warn');
                return;
            }

            previewMachine.setLoading('正在发送预览命令', '预计耗时 1-5 秒');
            ui.setButtonBusy(previewBtn, true, '预览中...');

            try {
                const data = await ui.requestJSON('/api/test-display', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'ImageDisplayUnit',
                        image_id: currentImageData.image_id,
                        image_path: currentImageData.save_path
                    })
                });

                if (data.error) {
                    throw new Error(data.error);
                }

                previewMachine.setSuccess(data.message || '预览请求已发送', '设备端开始执行预览');
                ui.toast('已发送到墨水屏预览', 'success');
            } catch (err) {
                console.error('Error:', err);
                previewMachine.setError(`预览失败：${err.message || '请稍后重试'}`, '请检查设备连接后重试');
                ui.toast('预览失败', 'error');
            } finally {
                ui.setButtonBusy(previewBtn, false);
            }
        });
    }
}

window.PaperPiPages = window.PaperPiPages || {};
window.PaperPiPages.text2image = {
    init: initText2ImagePage
};

window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('text2image-form')) {
        initText2ImagePage();
    }
});
