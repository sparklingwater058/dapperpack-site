/* Dapper Pack — site scripts.
   渐进增强：所有内容在禁用 JS 时依然完整可用。
   1) 移动端导航折叠（<html class="js"> 才折叠，无 JS 时导航始终可见）
   2) 页脚年份
   3) 「复制报价模板」按钮
   没有第三方脚本、没有跟踪、没有外部请求。 */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  /* ── 1. 移动端导航 ───────────────────────────────────────────────── */
  var toggle = document.querySelector('.nav__toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.getAttribute('data-open') === 'true';
      nav.setAttribute('data-open', open ? 'false' : 'true');
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    // 点击导航项后收起；Esc 关闭
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.setAttribute('data-open', 'false');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.getAttribute('data-open') === 'true') {
        nav.setAttribute('data-open', 'false');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ── 2. 页脚年份（静态回退值写在 HTML 里） ────────────────────────── */
  var year = document.querySelector('[data-year]');
  if (year) { year.textContent = String(new Date().getFullYear()); }

  /* ── 3. 打印按钮（fact-sheet.html 的一页纸） ─────────────────────── */
  document.querySelectorAll('[data-print]').forEach(function (btn) {
    btn.addEventListener('click', function () { window.print(); });
  });

  /* ── 4. 复制按钮 ─────────────────────────────────────────────────── */
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.getAttribute('data-copy'));
      if (!target) { return; }
      var text = target.innerText;
      var done = function () {
        var old = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = old; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
      } else {
        fallback(text, done);
      }
    });
  });

  function fallback(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (err) { /* 用户可手动选中复制 */ }
    document.body.removeChild(ta);
  }
})();
