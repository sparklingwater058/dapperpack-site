/* Dapper Pack — site scripts.
   渐进增强：所有内容在禁用 JS 时依然完整可用。
   1) 移动端导航折叠（<html class="js"> 才折叠，无 JS 时导航始终可见）
   2) 页脚年份
   3) 「复制报价模板」按钮
   4) 无 cookie 页面计数（仅正式域名，幂等，失败静默）
   没有第三方脚本、没有跟踪 cookie、没有访客标识。 */
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

  /* ── 5. 无 cookie 页面计数 ───────────────────────────────────────────
     设计约束（docs/SITE_DESIGN_PLAN_20260918.md §六「测量」+ §八 Q4）：
       · 无 cookie、无 localStorage、无指纹、无访客标识；
       · 只上报 { 路径, 引荐域名, ?from= 标记, 事件类型 } 四项；
       · **计数失败绝不影响访客**：整段包在 try 里，失败静默；
       · 不做重试（重试会把一次浏览放大成多次，且失败原因通常是网络，
         重试只会更慢）；
       · 只在正式域名上跑——本地预览与闸门探针不该污染真实访客数据。
     端点实现见 printx/api/router.py 的 site_hit；表见 migrations/043。 */
  var HIT_ENDPOINT = 'https://laptop-rp8mb72g.tailf027d9.ts.net/api/v2/site/hit';
  var HIT_HOSTS = ['dapperpack.com', 'www.dapperpack.com'];

  /* 唯一的发送实现——真站埋点与闸门自测都走这里（避免两条路径各自漂移）。 */
  function postHit(payload) {
    if (navigator.sendBeacon) {
      /* text/plain 是 CORS 简单请求 → 不触发预检（省一次公网往返）。
         后端按 JSON 解析而非按 Content-Type 解析，故类型不影响落库。 */
      if (navigator.sendBeacon(HIT_ENDPOINT, new Blob([payload], { type: 'text/plain' }))) {
        return true;
      }
    }
    if (window.fetch) {
      fetch(HIT_ENDPOINT, {
        method: 'POST', body: payload, keepalive: true, mode: 'cors', credentials: 'omit'
      }).catch(function () { /* 纯计数，失败不需让访客知道 */ });
      return true;
    }
    return false;
  }

  function hitPayload(from, ref) {
    return JSON.stringify({
      p: window.location.pathname,   // 站点侧就已去掉查询串（不把参数送进库里）
      r: String(ref || '').slice(0, 200),
      f: String(from || '').slice(0, 64),
      e: 'pageview'
    });
  }

  function hostnameOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch (err) { return ''; }       // 畸形 URL —— 当作没有来源
  }

  function sendHit() {
    try {
      if (HIT_HOSTS.indexOf(window.location.hostname) === -1) { return; }
      var from = '';
      try {
        from = new URLSearchParams(window.location.search).get('from') || '';
      } catch (err) { /* 老引擎没有 URLSearchParams —— 就当作没有来源标记 */ }
      postHit(hitPayload(from, hostnameOf(document.referrer)));
    } catch (err) { /* 计数是尽力而为：任何异常都不得冒泡到页面 */ }
  }

  /* 等 load 之后再发：不占首屏资源、不推迟 LCP（本站首屏预算是硬指标）。 */
  if (document.readyState === 'complete') {
    sendHit();
  } else {
    window.addEventListener('load', sendHit);
  }

  /* ── 6. 闸门自测挂钩（仅用于本地/CI 验收，**不在真站生效**）──────────
     为什么需要它：埋点在正式域名之外一律不发（上一节），而验收脚本又不能把
     本站真的部署出去才知道能不能用。于是留一个只在非正式域名上存在的入口，
     让 `.dsh/shots/audit_beacon.py` 在真实浏览器（真实 HTTPS 源）里驱动
     **同一段**发送代码——走的是同一个 postHit，不是复制一份逻辑。
     安全性：正式域名上这段整体不挂载 → 真站上不存在这个全局函数。 */
  if (HIT_HOSTS.indexOf(window.location.hostname) === -1) {
    window.__dapperpackBeaconTest = function (origin, nonce) {
      try {
        return postHit(hitPayload(nonce, hostnameOf(origin)));
      } catch (err) {
        return false;                 // 闸门自测：脚本侧据返回值判红
      }
    };
  }
})();
