window.addEventListener('DOMContentLoaded', () => {
    initText2ImagePage();
});

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

    let currentImageData = null;

    if (!form) {
        return;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const promptInput = document.getElementById('prompt');
        const prompt = promptInput ? promptInput.value.trim() : '';
        if (!prompt) {
            alert('请输入图片描述');
            return;
        }

        resultContainer.style.display = 'block';
        loading.style.display = 'block';
        error.style.display = 'none';
        resultContent.style.display = 'none';
        previewStatus.style.display = 'none';

        fetch('/api/text2image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        })
        .then((response) => response.json())
        .then((data) => {
            loading.style.display = 'none';

            if (data.error) {
                error.textContent = data.error;
                error.style.display = 'block';
                return;
            }

            if (!data.image_url || !data.save_path) {
                error.textContent = '生成结果不完整，请稍后重试';
                error.style.display = 'block';
                return;
            }

            resultImage.src = data.image_url;
            resultPath.textContent = `保存路径：${data.save_path}`;
            resultLibrary.textContent = data.image_id
                ? `图片库：已保存（ID: ${data.image_id}）`
                : '图片库：未保存';
            resultTime.textContent = `生成时间：${new Date().toLocaleString()}`;
            resultContent.style.display = 'block';

            currentImageData = {
                save_path: data.save_path,
                image_id: data.image_id || null
            };
        })
        .catch((err) => {
            console.error('Error:', err);
            loading.style.display = 'none';
            error.textContent = '生成图片失败，请稍后重试';
            error.style.display = 'block';
        });
    });

    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            if (!currentImageData) {
                alert('请先生成图片');
                return;
            }

            previewStatus.style.display = 'block';
            previewStatus.innerHTML = '<div class="loading"></div>';

            fetch('/api/test-display', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'ImageDisplayUnit',
                    image_id: currentImageData.image_id,
                    image_path: currentImageData.save_path
                })
            })
            .then((response) => response.json())
            .then((data) => {
                if (data.error) {
                    previewStatus.innerHTML = `<div class="error">预览失败：${data.error}</div>`;
                    return;
                }
                previewStatus.innerHTML = `<div class="status-note success">${data.message}</div>`;
            })
            .catch((err) => {
                console.error('Error:', err);
                previewStatus.innerHTML = '<div class="error">预览失败，请稍后重试</div>';
            });
        });
    }
}
