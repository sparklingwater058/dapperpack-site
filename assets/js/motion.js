/* ============================================================
   Dapper Pack — motion layer（原生实现，无第三方库）
   加载顺序：**本文件** → site.js

   ── 为什么不用 GSAP（2026-10-04 实测决策） ────────────────────────────
   GSAP + ScrollTrigger = **112.9KB**。首屏预算 100KB，不含它们时首屏 74.8KB
   （余量 25.2KB）；放静态 <script> 会到 187.7KB，改为 load 后注入仍被重量闸门
   计入（190.1KB）—— 两条路都超预算 87～90KB。
   而本层实际用到的语汇**只有 opacity 与 clip-path 两种**（位移会破坏 CLS，
   见下），这两种用原生 `IntersectionObserver` + CSS transition 即可，
   **效果一致、体积 0**。若将来要做鼠标视差 / 3D 翻转 / scrub 视差 / 速度跑马灯，
   那些**必须**靠 GSAP，届时再评估是否吃下这 113KB。

   ── 三条硬约束（改这个文件时不要破坏） ───────────────────────────────
   1. **没 JS 时内容必须可见**。初始态（`.is-in` 缺失时的 opacity）由本文件在运行时
      用 `classList.add("motion-on")` 打开，**不写在基础 CSS 里**；
      没有 JS → 不会加 `motion-on` → 内容天然可见。原型站的 `motion.js` 是相反做法
      （`.w-mask .w{opacity:0}` 无条件生效、靠 JS 恢复），因此有过
      "19 个标题在 JS 跑起来前完全不可见"的回归 —— 这里不重复。
   2. `prefers-reduced-motion: reduce` 时**什么都不做**（不加类、不建 observer）。
   3. 打印不参与：`site.css` 的 `@media print` 有 `.motion-ready *` 兜底规则。

   ── 为什么不做"位移（y / scale / rotate）" ───────────────────────────
   加位移后 `index.html` 的 CLS 从 0.054 飙到 **0.896**（判据 <0.1）。
   LayoutShift `sources` 取证：最大一次位移 **0.5687** 落在
   `section.section--paper`（"How we work" 整段）—— 机制是**位移改变了页面滚动总高度**，
   动画结束时下方内容整体重排。试过并无效：① `autoAlpha`→`opacity`（0.896→0.896）；
   ② 保留内联位移不清除（仍触发）。
   ⇒ 只动**不改变几何**的属性：`opacity` 与 `clip-path`。
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;                                             // 约束 2
  if (typeof window.IntersectionObserver === "undefined") return;  // 老引擎直接不启用

  var root = document.documentElement;
  root.classList.add("motion-ready");        // 打印兜底与可测性用的状态钩子
  root.classList.add("motion-on");           // 约束 1：只有跑到这里，CSS 才会写初始态

  var START = "0px 0px -14% 0px";            // ≈ 元素进入视口下缘 14% 时触发

  var groups = [
    // 选择器,                          交错步长(s), 每组上限(s), 擦除方向
    [".hero .eyebrow, .hero h1, .hero .lede, .hero .muted, .hero .assertion, " +
     ".hero .btn-row, .hero .hero__figure", 0.09, 0.5, null],
    [".grid > *, .three > *",              0.08, 0.4, null],
    [".facts > li, .steps > li, ol.steps > li, .checklist > li", 0.07, 0.5, null],
    ["dl.spec > div",                      0.05, 0.4, null],
    [".section__head > *",                 0.08, 0.3, null],
    [".hero__figure",                      0.00, 0.0, "wipe"],   // 图纸"被画出来"
    [".table-wrap",                        0.00, 0.0, "wipe"]
  ];

  function applyDelay(el, i, step, cap) {
    var d = Math.min(i * step, cap);
    if (d > 0) el.style.setProperty("--m-delay", d.toFixed(2) + "s");
  }

  function watch(selector, step, cap, mode) {
    var nodes = Array.prototype.slice.call(document.querySelectorAll(selector));
    // 同一元素可能被多条选择器命中（例如 .steps > li 与 ol.steps > li）：去重
    nodes = nodes.filter(function (el, i) { return nodes.indexOf(el) === i && !el.__mseen; });
    if (!nodes.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        io.unobserve(el);
        el.classList.add("is-in");
        // 动画结束后移除内联延迟与类，避免留下影响打印/后续布局的样式
        var kill = function () {
          el.style.removeProperty("--m-delay");
          el.removeEventListener("transitionend", kill);
        };
        el.addEventListener("transitionend", kill);
      });
    }, { rootMargin: START, threshold: 0 });

    nodes.forEach(function (el, i) {
      el.__mseen = true;
      el.classList.add(mode === "wipe" ? "m-wipe" : "m-fade");
      applyDelay(el, i, step, cap);
      io.observe(el);
    });
  }

  groups.forEach(function (g) { watch(g[0], g[1], g[2], g[3]); });

  /* ---------- 数字 count-up ----------
     只对显式标了 `data-count-to` 的元素生效 —— **不做正则猜数字**。
     这一站正文里全是真实数字（500 units / 3 working days / 10,000 units / 11,000 m²），
     自动识别会把它们全部变成计数器，既不安全（"3 working days" 数到 3 毫无意义）
     也读不通。

     无障碍：动画期间文本每秒变几十次，对屏幕阅读器是噪音 → 临时 aria-hidden，
     结束后**把原文写回**（含千分位与后缀），避免 "11,000 → 11,001" 这类本地化差异。 */
  var counters = document.querySelectorAll("[data-count-to]");
  if (counters.length) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        cio.unobserve(el);
        var raw = el.textContent.trim();
        var target = parseFloat(el.getAttribute("data-count-to"));
        if (!isFinite(target)) return;
        var suffix = el.getAttribute("data-count-suffix") || "";
        var decimals = (el.getAttribute("data-count-decimals") || "0") | 0;
        var t0 = null, DUR = 1500;
        el.setAttribute("aria-hidden", "true");
        var stepFn = function (ts) {
          if (t0 === null) t0 = ts;
          var p = Math.min((ts - t0) / DUR, 1);
          var eased = 1 - Math.pow(1 - p, 3);                    // power2.out 近似
          var v = target * eased;
          el.textContent = (decimals ? v.toFixed(decimals)
                                     : Math.round(v).toLocaleString("en-US")) + suffix;
          if (p < 1) { requestAnimationFrame(stepFn); }
          else {
            el.textContent = raw;                                // 写回原文
            el.removeAttribute("aria-hidden");
          }
        };
        requestAnimationFrame(stepFn);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });
    Array.prototype.forEach.call(counters, function (el) { cio.observe(el); });
  }
})();
