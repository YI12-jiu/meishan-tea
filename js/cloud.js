window.TeaCloud = (function () {
  var client = null,
    initErr = "",
    readyPromise = null,
    modelCache = null;
  function permitted() {
    var cfg = window.CLOUD_CONFIG;
    return (
      cfg.mode === "enabled" ||
      (cfg.mode !== "disabled" &&
        location.origin === new URL(cfg.endpoint).origin)
    );
  }
  function init() {
    if (client) return client;
    if (!permitted()) {
      initErr =
        "本机体验模式：文化内容和本机茶仓可用，云端登录与 AI 需要在已授权域名使用。";
      return null;
    }
    if (!window.WorkBuddyCloud) return null;
    try {
      client = window.WorkBuddyCloud.createWorkBuddyCloud({
        endpoint: CLOUD_CONFIG.endpoint,
        publishableKey: CLOUD_CONFIG.publishableKey,
      });
      initErr = "";
    } catch (e) {
      initErr = "云服务初始化失败，请稍后重试。";
    }
    return client;
  }
  function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise(function (resolve) {
      if (!permitted() || init()) {
        resolve(!!client);
        return;
      }
      var script = document.createElement("script");
      var settled = false;
      var timer = setTimeout(function () {
        finish(false);
      }, 8000);
      function finish(ok) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!ok)
          initErr = "云服务暂未连接。你仍可浏览全部文化内容和使用本机茶仓。";
        resolve(ok);
      }
      script.src = CLOUD_CONFIG.sdkUrl;
      script.async = true;
      script.onload = function () {
        finish(!!init());
      };
      script.onerror = function () {
        finish(false);
      };
      document.head.appendChild(script);
    });
    return readyPromise;
  }
  function timeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        var e = new Error("请求超时，请稍后重试。");
        e.code = "timeout";
        reject(e);
      }, ms || 12000);
      Promise.resolve(promise).then(
        function (r) {
          clearTimeout(timer);
          resolve(r);
        },
        function (e) {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }
  async function auth(method, args) {
    try {
      await ready();
      if (!client) return { error: { message: initErr } };
      return await timeout(client.auth[method].apply(client.auth, args || []));
    } catch (e) {
      return { error: e };
    }
  }
  function from(table) {
    var c = init();
    if (!c) throw new Error(initErr || "云服务尚未连接");
    return c.database.from(table);
  }
  function query(build, isWrite) {
    return timeout(Promise.resolve().then(build)).catch(function (e) {
      if (isWrite && e.code === "timeout")
        e.message = "尚未确认保存结果，请先刷新清单核对，避免重复提交。";
      throw e;
    });
  }
  async function listModels() {
    await ready();
    if (!client) return [];
    if (modelCache) return modelCache;
    var models = await timeout(client.llm.models.list());
    modelCache = Array.isArray(models) ? models : [];
    return modelCache;
  }
  async function streamChat(o) {
    if (!init()) throw new Error(initErr || "AI 服务尚未连接");
    var payload = {
      model: o.model,
      messages: o.messages,
      stream: true,
      stream_options: { include_usage: true },
      conversationId: o.conversationId,
      signal: o.signal,
      temperature: o.temperature,
    };
    for await (var chunk of client.llm.chat.completions.create(payload)) {
      if (o.signal && o.signal.aborted)
        throw new DOMException("已停止", "AbortError");
      var delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
      if (delta && delta.content && o.onDelta) o.onDelta(delta.content);
      if (chunk.usage && o.onUsage) o.onUsage(chunk.usage);
    }
  }
  function friendlyError(err) {
    var code = (err && ((err.error && err.error.code) || err.code)) || "";
    var msg =
      (err && ((err.error && err.error.message) || err.message)) ||
      "操作未完成，请稍后重试。";
    if (/^quota_/.test(code))
      return "AI 调用额度不足或请求过于频繁，请稍后再试。";
    if (/origin|cors/i.test(code + " " + msg))
      return "云端未授权当前访问域名，请使用原应用发布地址。";
    if (code === "invalid_grant" || code === "auth_invalid_credentials")
      return "登录凭据无效，请检查邮箱、密码或验证码后重试。";
    if (code === "gateway_stream_interrupted")
      return "回答中途断开，已保留收到的内容；请重新提问。";
    if ((err && err.kind === "rate-limited") || code === "rate_limit_exceeded")
      return "请求过于频繁，请稍后再试。";
    if ((err && err.kind === "network") || /network|fetch/i.test(msg))
      return "网络连接失败，请检查网络后重试。";
    return String(msg);
  }
  return {
    init: init,
    ready: ready,
    available: function () {
      return !!init();
    },
    initError: function () {
      return initErr;
    },
    timeout: timeout,
    query: query,
    from: from,
    getSession: function () {
      return auth("getSession");
    },
    signInWithPassword: function (email, password) {
      return auth("signInWithPassword", [{ email: email, password: password }]);
    },
    sendOtp: function (email) {
      return auth("sendOtp", [{ email: email }]);
    },
    verifyOtp: function (p) {
      return auth("verifyOtp", [p]);
    },
    resetPasswordForEmail: function (email) {
      return auth("resetPasswordForEmail", [email]);
    },
    signOut: function () {
      return auth("signOut");
    },
    onAuthStateChange: function (cb) {
      if (client && client.auth.onAuthStateChange)
        return client.auth.onAuthStateChange(cb);
    },
    listModels: listModels,
    streamChat: streamChat,
    friendlyError: friendlyError,
    newConversationId: function () {
      return (
        "tea-" +
        Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2, 10)
      );
    },
  };
})();
