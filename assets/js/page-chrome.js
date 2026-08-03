/* <page-chrome title="..." back-href="..." back-text="..."></page-chrome>
 *
 * Self-replacing custom element that injects the standard subpage chrome
 * (centered <header> with H1, then a .back-link). Defaults send the user
 * to /index.html with text "← 返回首页"; pass back-href / back-text to
 * point elsewhere (e.g. an intermediate index page).
 *
 * Loaded synchronously from <head> so the element upgrades before the
 * browser paints the body — avoids a flash of missing chrome.
 */
(function () {
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    class PageChrome extends HTMLElement {
        connectedCallback() {
            const title = this.getAttribute('title') || '';
            const backHref = this.getAttribute('back-href') || '/index.html';
            const backText = this.getAttribute('back-text') || '← 返回首页';
            this.outerHTML =
                '<header><h1 id="project_title">' + escapeHtml(title) + '</h1></header>\n' +
                '<a href="' + escapeHtml(backHref) + '" class="back-link">' + escapeHtml(backText) + '</a>';
        }
    }

    customElements.define('page-chrome', PageChrome);
})();
