/* 询价表单提交（2026-10-07）。
 *
 * 契约（与 POST /api/v2/site/inquiries 对应）:
 *   · 字段名与端点 pydantic 模型一致；product_type 用闭集值
 *   · 端点回 201 + {id, reply_within}; 422 字段错误; 413 体积过大;
 *     503 = **存储不可用** —— 此时必须**回退到邮件**，不能让访客以为已送达
 *
 * ⚠️ 无 JS 时表单仍可用: `<form action="mailto:...">` 是原生回退路径。
 *    本脚本只是把它升级为"直接落库"。
 *
 * ⚠️ 时限文案只允许"三个工作日"（站上一致口径）。响应里的 reply_within
 *    由服务端给出，前端不另写一份 —— 避免两处口径漂移。
 */
(function () {
  var form = document.querySelector('form.quote');
  if (!form) return;
  var state = form.querySelector('.quote__state');
  var btn = form.querySelector('button[type="submit"]');
  var ENDPOINT = 'https://dapperpack.com/api/v2/site/inquiries';

  function say(msg, kind) {
    if (!state) return;
    state.textContent = msg;
    if (kind) state.setAttribute('data-state', kind);
    else state.removeAttribute('data-state');
  }

  function payload() {
    var fd = new FormData(form);
    return {
      name: (fd.get('name') || '').trim(),
      company: (fd.get('company') || '').trim(),
      email: (fd.get('email') || '').trim(),
      country: (fd.get('country') || '').trim(),
      product_type: (fd.get('product_type') || '').trim(),
      quantity: (fd.get('quantity') || '').trim(),
      details: (fd.get('details') || '').trim(),
      source_path: location.pathname,
      source_tag: new URLSearchParams(location.search).get('from') || '',
      hp: (fd.get('hp') || '').trim()
    };
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (btn) btn.disabled = true;
    say('Sending\u2026');
    var body = payload();
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (r.status === 201) {
        return r.json().then(function (j) {
          say('Thank you \u2014 we have your enquiry. We reply within ' +
              (j.reply_within || 'three working days') + '.', 'ok');
          form.reset();
        });
      }
      if (r.status === 422) throw new Error('missing');
      if (r.status === 413) throw new Error('too-long');
      throw new Error('server');
    }).catch(function (e) {
      var msg = e && e.message === 'missing'
        ? 'Please fill in name, company, email, product type and project details.'
        : e && e.message === 'too-long'
          ? 'That is too long to send \u2014 please shorten the project details.'
          : 'We could not send it just now. Please email scott@dapperpack.com directly.';
      say(msg, 'err');
      if (btn) btn.disabled = false;
    });
  });
})();
