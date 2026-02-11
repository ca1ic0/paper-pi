// 主页面JavaScript
console.log('Paper Pi - 墨水屏应用');

function initMainPage() {
    document.body.classList.add('is-loaded');

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

window.PaperPiPages = window.PaperPiPages || {};
window.PaperPiPages.home = {
    init: initMainPage
};

window.addEventListener('DOMContentLoaded', () => {
    initMainPage();
});
