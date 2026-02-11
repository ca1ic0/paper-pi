(function () {
    const scriptByPage = {
        home: '/static/js/main.js',
        admin: '/static/js/admin.js',
        library: '/static/js/library.js',
        libraryDetail: '/static/js/library_detail.js',
        text2image: '/static/js/text2image.js'
    };

    const loadedScripts = new Set(
        Array.from(document.querySelectorAll('script[src]')).map((s) => new URL(s.getAttribute('src'), window.location.origin).href)
    );

    let currentPageKey = detectPageKey(window.location.pathname);

    function detectPageKey(pathname) {
        if (pathname === '/') {
            return 'home';
        }
        if (pathname === '/admin') {
            return 'admin';
        }
        if (pathname === '/library') {
            return 'library';
        }
        if (pathname.startsWith('/library/')) {
            return 'libraryDetail';
        }
        if (pathname === '/text2image') {
            return 'text2image';
        }
        return null;
    }

    function setActiveNav(pathname) {
        const navLinks = document.querySelectorAll('.nav .nav-link');
        navLinks.forEach((link) => {
            const href = link.getAttribute('href');
            const isActive = href === pathname || (href === '/library' && pathname.startsWith('/library/'));
            link.classList.toggle('active', !!isActive);
        });
    }

    function updateChrome(doc, pathname) {
        document.title = doc.title;

        const nextSubtitle = doc.querySelector('.logo .subtitle');
        const currentSubtitle = document.querySelector('.logo .subtitle');
        if (nextSubtitle && currentSubtitle) {
            currentSubtitle.textContent = nextSubtitle.textContent;
        }

        document.body.className = doc.body.className || '';
        setActiveNav(pathname);
    }

    function loadScriptForPage(pageKey) {
        const src = scriptByPage[pageKey];
        if (!src) {
            return Promise.resolve();
        }

        const abs = new URL(src, window.location.origin).href;
        if (loadedScripts.has(abs)) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => {
                loadedScripts.add(abs);
                resolve();
            };
            s.onerror = () => reject(new Error(`load script failed: ${src}`));
            document.body.appendChild(s);
        });
    }

    function runDestroy(pageKey) {
        if (!window.PaperPiPages || !pageKey) {
            return;
        }
        const page = window.PaperPiPages[pageKey];
        if (page && typeof page.destroy === 'function') {
            page.destroy();
        }
    }

    function runInit(pageKey) {
        if (!window.PaperPiPages || !pageKey) {
            return;
        }
        const page = window.PaperPiPages[pageKey];
        if (page && typeof page.init === 'function') {
            page.init();
        }
    }

    async function navigate(url, pushState) {
        const nextUrl = new URL(url, window.location.origin);
        const pathname = nextUrl.pathname;
        const nextPageKey = detectPageKey(pathname);

        if (!nextPageKey) {
            window.location.href = nextUrl.href;
            return;
        }

        runDestroy(currentPageKey);
        document.body.classList.add('is-route-loading');

        try {
            const response = await fetch(nextUrl.href, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const incoming = doc.querySelector('#page-content');
            const current = document.querySelector('#page-content');
            if (!incoming || !current) {
                throw new Error('page-content not found');
            }

            current.innerHTML = incoming.innerHTML;
            updateChrome(doc, pathname);

            if (pushState) {
                window.history.pushState({ path: pathname }, '', nextUrl.href);
            }

            await loadScriptForPage(nextPageKey);
            runInit(nextPageKey);
            currentPageKey = nextPageKey;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            console.error('router navigate failed:', err);
            window.location.href = nextUrl.href;
        } finally {
            document.body.classList.remove('is-route-loading');
        }
    }

    function onNavClick(e) {
        const link = e.target.closest('.nav .nav-link');
        if (!link) {
            return;
        }
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
            return;
        }

        const href = link.getAttribute('href');
        if (!href || !href.startsWith('/')) {
            return;
        }

        e.preventDefault();
        navigate(href, true);
    }

    function initRouter() {
        Array.from(document.querySelectorAll('script[src]')).forEach((s) => {
            const abs = new URL(s.getAttribute('src'), window.location.origin).href;
            loadedScripts.add(abs);
        });
        setActiveNav(window.location.pathname);
        window.PaperPiRouter = {
            navigate: (url) => navigate(url, true)
        };
        document.addEventListener('click', onNavClick);
        window.addEventListener('popstate', () => {
            navigate(window.location.href, false);
        });
    }

    window.addEventListener('DOMContentLoaded', initRouter);
})();
