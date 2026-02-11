(function () {
    function ensureToastHost() {
        let host = document.getElementById('pp-toast-host');
        if (!host) {
            host = document.createElement('div');
            host.id = 'pp-toast-host';
            host.className = 'pp-toast-host';
            document.body.appendChild(host);
        }
        return host;
    }

    function toast(message, type = 'info', duration = 2600) {
        if (!message) {
            return;
        }
        const host = ensureToastHost();
        const item = document.createElement('div');
        item.className = `pp-toast ${type}`;
        item.textContent = message;
        host.appendChild(item);

        requestAnimationFrame(() => item.classList.add('show'));

        window.setTimeout(() => {
            item.classList.remove('show');
            window.setTimeout(() => item.remove(), 220);
        }, duration);
    }

    function setButtonBusy(button, busy, busyText) {
        if (!button) {
            return;
        }
        if (busy) {
            if (!button.dataset.originalText) {
                button.dataset.originalText = button.textContent;
            }
            if (busyText) {
                button.textContent = busyText;
            }
            button.disabled = true;
            button.classList.add('is-busy');
            return;
        }

        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
        button.disabled = false;
        button.classList.remove('is-busy');
    }

    function renderSkeleton(container, count = 8) {
        if (!container) {
            return;
        }
        const parts = [];
        for (let i = 0; i < count; i += 1) {
            parts.push('<div class="library-item skeleton-card"><div class="skeleton-thumb"></div><div class="skeleton-line"></div></div>');
        }
        container.innerHTML = parts.join('');
    }

    async function requestJSON(url, options) {
        const response = await fetch(url, options);
        const text = await response.text();
        let data = {};
        try {
            data = text ? JSON.parse(text) : {};
        } catch (err) {
            throw new Error('服务响应格式错误');
        }

        if (!response.ok) {
            const message = data.error || `请求失败（${response.status}）`;
            throw new Error(message);
        }

        return data;
    }

    function createWaitStateMachine(options) {
        const cfg = options || {};
        const onUpdate = typeof cfg.onUpdate === 'function' ? cfg.onUpdate : function () {};
        const tickMs = typeof cfg.tickMs === 'number' ? cfg.tickMs : 420;
        const frames = Array.isArray(cfg.frames) && cfg.frames.length > 0
            ? cfg.frames
            : ['', '.', '..', '...'];
        const defaultMeta = cfg.defaultMeta || '预计耗时 2-10 秒';

        let timer = null;
        let startedAt = 0;
        let frameIdx = 0;
        let current = {
            state: 'idle',
            text: '',
            meta: '',
            elapsed: 0,
            dots: ''
        };

        function emit() {
            onUpdate({
                state: current.state,
                text: current.text,
                meta: current.meta,
                elapsed: current.elapsed,
                dots: current.dots
            });
        }

        function stopTick() {
            if (timer) {
                window.clearInterval(timer);
                timer = null;
            }
        }

        function startTick(baseText, metaText) {
            stopTick();
            startedAt = Date.now();
            frameIdx = 0;
            timer = window.setInterval(() => {
                current.elapsed = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
                current.dots = frames[frameIdx % frames.length];
                current.text = `${baseText}${current.dots}`;
                current.meta = `${metaText} · 已等待 ${current.elapsed} 秒`;
                frameIdx += 1;
                emit();
            }, tickMs);
        }

        function setLoading(text, meta) {
            current.state = 'loading';
            current.elapsed = 0;
            current.dots = '';
            current.text = text || '处理中';
            current.meta = meta || defaultMeta;
            emit();
            startTick(current.text, current.meta);
        }

        function setProcessing(text, meta) {
            current.state = 'processing';
            current.elapsed = 0;
            current.dots = '';
            current.text = text || '处理中';
            current.meta = meta || defaultMeta;
            emit();
            startTick(current.text, current.meta);
        }

        function setSuccess(text, meta) {
            stopTick();
            current.state = 'success';
            current.text = text || '处理完成';
            current.meta = meta || '';
            current.dots = '';
            current.elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
            emit();
        }

        function setError(text, meta) {
            stopTick();
            current.state = 'error';
            current.text = text || '处理失败';
            current.meta = meta || '';
            current.dots = '';
            current.elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
            emit();
        }

        function reset() {
            stopTick();
            current = {
                state: 'idle',
                text: '',
                meta: '',
                elapsed: 0,
                dots: ''
            };
            emit();
        }

        function destroy() {
            stopTick();
        }

        return {
            setLoading,
            setProcessing,
            setSuccess,
            setError,
            reset,
            destroy
        };
    }

    function motionNumberVar(name, fallback) {
        if (!name || typeof window === 'undefined' || !window.getComputedStyle) {
            return fallback;
        }
        const root = document.documentElement;
        const raw = window.getComputedStyle(root).getPropertyValue(name);
        const value = Number.parseFloat(raw);
        return Number.isFinite(value) ? value : fallback;
    }

    function motionMsVar(name, fallback) {
        return motionNumberVar(name, fallback);
    }

    let dialogQueue = Promise.resolve();

    function enqueueDialog(factory) {
        const run = () => factory();
        const queued = dialogQueue.then(run, run);
        dialogQueue = queued.then(() => undefined, () => undefined);
        return queued;
    }

    function openDialog(options) {
        const cfg = options || {};
        const mode = cfg.mode || 'confirm';
        const title = cfg.title || (mode === 'prompt' ? '请输入' : '请确认');
        const message = cfg.message || '';
        const okText = cfg.okText || '确认';
        const cancelText = cfg.cancelText || '取消';
        const value = typeof cfg.value === 'string' ? cfg.value : '';
        const placeholder = typeof cfg.placeholder === 'string' ? cfg.placeholder : '';

        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'pp-dialog-backdrop';
            backdrop.innerHTML = `
                <div class="pp-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
                    <h4 class="pp-dialog-title">${escapeHtml(title)}</h4>
                    <p class="pp-dialog-message">${escapeHtml(message)}</p>
                    ${mode === 'prompt' ? `<input class="pp-dialog-input" type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">` : ''}
                    <div class="pp-dialog-actions">
                        <button type="button" class="btn btn-secondary" data-action="cancel">${escapeHtml(cancelText)}</button>
                        <button type="button" class="btn btn-primary" data-action="ok">${escapeHtml(okText)}</button>
                    </div>
                </div>
            `;

            const dialogEl = backdrop.querySelector('.pp-dialog');
            const inputEl = backdrop.querySelector('.pp-dialog-input');
            const cancelBtn = backdrop.querySelector('[data-action="cancel"]');
            const okBtn = backdrop.querySelector('[data-action="ok"]');

            let closed = false;
            function close(result) {
                if (closed) {
                    return;
                }
                closed = true;
                backdrop.classList.remove('show');
                window.setTimeout(() => {
                    backdrop.remove();
                    resolve(result);
                }, 120);
            }

            cancelBtn.addEventListener('click', () => {
                close(mode === 'prompt' ? null : false);
            });
            okBtn.addEventListener('click', () => {
                if (mode === 'prompt') {
                    close(inputEl ? inputEl.value.trim() : '');
                    return;
                }
                close(true);
            });

            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    close(mode === 'prompt' ? null : false);
                }
            });

            function onKeyDown(e) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    close(mode === 'prompt' ? null : false);
                    return;
                }
                if (e.key === 'Enter') {
                    if (mode === 'prompt' && document.activeElement === inputEl) {
                        e.preventDefault();
                        close(inputEl ? inputEl.value.trim() : '');
                        return;
                    }
                    if (document.activeElement === okBtn || document.activeElement === cancelBtn) {
                        return;
                    }
                    e.preventDefault();
                    if (mode === 'prompt') {
                        close(inputEl ? inputEl.value.trim() : '');
                    } else {
                        close(true);
                    }
                }
            }

            backdrop.addEventListener('keydown', onKeyDown);

            document.body.appendChild(backdrop);
            requestAnimationFrame(() => {
                backdrop.classList.add('show');
                if (inputEl) {
                    inputEl.focus();
                    inputEl.select();
                } else {
                    okBtn.focus();
                }
                if (dialogEl) {
                    dialogEl.scrollTop = 0;
                }
            });
        });
    }

    function confirmDialog(options) {
        return enqueueDialog(() => openDialog({ ...options, mode: 'confirm' }));
    }

    function promptDialog(options) {
        return enqueueDialog(() => openDialog({ ...options, mode: 'prompt' }));
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    window.PaperPiUI = {
        toast,
        setButtonBusy,
        renderSkeleton,
        requestJSON,
        createWaitStateMachine,
        motionNumberVar,
        motionMsVar,
        confirm: confirmDialog,
        prompt: promptDialog
    };
})();
