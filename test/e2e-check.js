/**
 * 梅山茶脉 · 线上端到端验证脚本
 *
 * 在真实浏览器中打开已发布的站点，通过 CDP 直接调用页面内的云服务封装层，
 * 验证数据库读取、大模型调用、登录接口连通性与行级安全策略是否生效。
 *
 * 用法见同目录 README.md。
 */

const CDP_PORT = process.env.CDP_PORT || '9444';
const SITE = process.env.SITE_URL;
if (!SITE || process.env.ALLOW_MUTATION_TESTS !== 'true') {
  console.error('此历史脚本会调用模型并尝试写入。必须显式指定隔离测试环境 SITE_URL 和 ALLOW_MUTATION_TESTS=true。日常请运行 npm test。');
  process.exit(2);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 安全护栏：显式创建属于本次测试的空白标签，并只操作它，绝不触碰其他标签 */
async function pickTarget() {
  const base = `http://127.0.0.1:${CDP_PORT}`;
  const created = await (await fetch(`${base}/json/new?about:blank`, { method: 'PUT' })).json();
  if (!created || !created.webSocketDebuggerUrl) {
    throw new Error('无法创建测试标签页，请确认调试端口正确且浏览器已就绪');
  }
  if (!/^about:/.test(created.url)) {
    throw new Error(`新建标签页地址异常（${created.url}），已中止`);
  }
  return created;
}

async function connect() {
  const target = await pickTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).res(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise(res => {
    const mid = ++id;
    pending.set(mid, { res });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable');
  await send('Page.navigate', { url: SITE });
  await sleep(Number(process.env.BOOT_WAIT_MS || 9000));
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    const res = r.result || {};
    if (res.exceptionDetails) {
      return { __exception: res.exceptionDetails.text || '表达式执行异常' };
    }
    return res.result ? res.result.value : null;
  };
  return { ws, evaluate };
}

const CHECKS = {
  /* 基础环境 */
  runtime: `(async () => {
    const sdkLoaded = typeof window.WorkBuddyCloud === 'object';
    const cloudAvailable = typeof window.TeaCloud === 'object' && window.TeaCloud.available();
    return {
      passed: sdkLoaded && cloudAvailable,
      title: document.title,
      route: location.hash,
      sdkLoaded: sdkLoaded,
      cloudAvailable: !!cloudAvailable
    };
  })()`,

  /* 遮挡检查：页面顶层不应被任何遮罩容器覆盖
     典型事故：modal / toast 容器在基础样式里写了 display:flex，
     压过了浏览器默认的 [hidden]{display:none}，导致遮罩常驻、吞掉全部点击 */
  overlayFree: `(() => {
    const pts = [[100, 40], [300, 220], [700, 500], [1180, 300]];
    const blockers = [];
    for (const [x, y] of pts) {
      const el = document.elementFromPoint(x, y);
      if (!el) continue;
      const hit = el.closest ? el.closest('#modalHost, #toastHost') : null;
      if (hit) blockers.push({ x, y, id: hit.id, display: getComputedStyle(hit).display });
    }
    return { passed: blockers.length === 0, blockedPoints: blockers.length, detail: blockers.slice(0, 3) };
  })()`,

  /* 真实点击导航：验证点击不被拦截、路由确实切换 */
  navClick: `(async () => {
    const links = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
    const target = links.filter(a => a.getAttribute('href') === '#/archive')[0];
    if (!target) return { passed: false, err: '未找到导航链接' };
    const r = target.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const reachable = !!top && (top === target || target.contains(top));
    target.click();
    await new Promise(done => setTimeout(done, 1000));
    return { passed: reachable && location.hash === '#/archive', reachable: reachable, hash: location.hash };
  })()`,

  /* 公开表读取 —— 验证数据平面连通与 Origin 校验 */
  publicRead: `(async () => {
    try {
      const r = await window.TeaCloud.from('tea_archives').select('*').order('sort_order', { ascending: true });
      if (r.error) return { passed:false, err: r.error.message || JSON.stringify(r.error) };
      return { passed: r.data.length > 0, rows: r.data.length, first: r.data[0].name, last: r.data[r.data.length-1].name };
    } catch (e) { return { passed:false, err: String(e && e.message || e) }; }
  })()`,

  /* 大模型目录 */
  modelList: `(async () => {
    try {
      const ms = await window.TeaCloud.listModels();
      return { passed: ms.filter(m => m.disabled !== true).length > 0,
               total: ms.length, sample: ms.map(m => m.id).slice(0,5) };
    } catch (e) { return { passed:false, err: String(e && e.message || e) }; }
  })()`,

  /* 大模型真实流式调用 */
  llmCall: `(async () => {
    try {
      const ms = (await window.TeaCloud.listModels()).filter(m => m.disabled !== true);
      if (!ms.length) return { passed:false, err:'无可用模型' };
      let text = '', usage = null;
      await window.TeaCloud.streamChat({
        model: ms[0].id,
        messages: [
          { role:'system', content:'你是测试助手，只回答问题本身。' },
          { role:'user', content:'用四个字回答：安化黑茶' }
        ],
        conversationId: window.TeaCloud.newConversationId(),
        onDelta: t => { text += t; },
        onUsage: u => { usage = u; }
      });
      return { passed: text.length > 0, model: ms[0].id, reply: text.slice(0,60),
               totalTokens: usage && usage.total_tokens };
    } catch (e) {
      return { passed:false, code: e && e.error && e.error.code, err: String(e && e.message || e) };
    }
  })()`,

  /* 认证接口连通性：用不存在的账号发起登录，期望返回凭据错误而非网络/Origin 错误 */
  authReachable: `(async () => {
    try {
      const r = await window.TeaCloud.signInWithPassword('nonexistent-probe@example.com', 'WrongPass123');
      if (r.error) return { passed:/invalid|credential|wrong.password/i.test(r.error.message || '') && !/origin|network|fetch/i.test(r.error.message || ''), kind: r.error.kind || null,
                            msg: String(r.error.message || '').slice(0,80) };
      return { passed:false, unexpectedSession:true };
    } catch (e) { return { passed:false, err: String(e && e.message || e) }; }
  })()`,

  /* 未登录写入必须被拒绝（行级安全策略） */
  anonWriteBlocked: `(async () => {
    try {
      const r = await window.TeaCloud.from('tea_notes')
        .insert({ tea_name:'【权限自检】不应写入', tea_type:'测试', rating:1, note:'若此行落库说明权限失效' })
        .select();
      if (r.error) return { passed:r.error.code === '42501', blocked:r.error.code === '42501', code: r.error.code || null };
      const rows = Array.isArray(r.data) ? r.data : [];
      return { passed: rows.length === 0, blocked: rows.length === 0, leaked: rows.length };
    } catch (e) { return { passed:false, blocked:false, via:'throw', err:String(e && e.message || e) }; }
  })()`,

  /* 未登录读取私有表必须读不到数据 */
  anonPrivateReadEmpty: `(async () => {
    try {
      const r = await window.TeaCloud.from('tea_cellar').select('*');
      if (r.error) return { passed:r.error.code === '42501', isolated:r.error.code === '42501', via:'error' };
      return { passed: (r.data || []).length === 0, isolated: (r.data || []).length === 0, rows: (r.data || []).length };
    } catch (e) { return { passed:false, isolated:false, via:'throw', err:String(e && e.message || e) }; }
  })()`,

  /* 清理自检数据并确认未残留 */
  cleanup: `(async () => {
    const r = await window.TeaCloud.from('tea_notes').select('*').ilike('tea_name','%权限自检%');
    return { passed: !r.error && (r.data || []).length === 0, leftover: (r.data || []).length };
  })()`
};

(async () => {
  const { ws, evaluate } = await connect();
  const results = {};
  let failed = 0;

  for (const [name, expr] of Object.entries(CHECKS)) {
    let value;
    try {
      value = await evaluate(expr);
    } catch (e) {
      value = { passed: false, err: String(e && e.message || e) };
    }
    results[name] = value;
    if (!value || value.passed !== true) failed++;
  }

  console.log(JSON.stringify(results, null, 2));
  console.log('\n' + (failed === 0 ? '✅ 全部通过' : `❌ 有 ${failed} 项未通过`));
  ws.close();
  // 用 exitCode 而非 process.exit()，避免 stdout 未刷完就被截断
  process.exitCode = failed === 0 ? 0 : 1;
})().catch(e => {
  console.error('验证脚本执行失败:', e.message);
  process.exitCode = 1;
});
