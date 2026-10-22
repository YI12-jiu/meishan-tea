window.VIEWS.doctor = {
  title: "AI 茶博士",
  render: function (el) {
    var esc = TeaUI.esc,
      alive = true,
      active = null,
      modelId = null;
    var state =
      APP.teaChat ||
      (APP.teaChat = {
        turns: [],
        draft: "",
        conversationId: TeaCloud.newConversationId(),
      });
    if (APP.pendingQuestion) {
      state.draft = APP.pendingQuestion;
      APP.pendingQuestion = null;
    }
    el.innerHTML =
      '<div class="section-head"><div><h1 class="section-title">问茶博士</h1><p class="section-sub">选购、冲泡、存放与文化都能问。回答基于平台内置知识，也可能有偏差；切换页面后，本次会话仍会保留。</p></div></div>' +
      '<div id="docNotice" role="status" class="notice">正在检查 AI 服务…</div><div class="chat-shell"><div class="chat-head"><div class="who"><span class="av">茶</span><div><strong>茶博士</strong><div id="docStatus" class="form-note" style="margin:0">等待连接</div></div></div><div style="display:flex;gap:8px;align-items:center"><select id="docModel" aria-label="选择 AI 模型" disabled><option>连接中…</option></select><button class="btn btn-sm btn-ghost" id="docReset">新对话</button></div></div>' +
      '<div class="chat-log" id="docLog" role="log" aria-label="茶博士对话"></div><div class="chat-input"><textarea id="docInput" aria-label="向茶博士提问" maxlength="2000" rows="2" placeholder="想了解哪款茶，或遇到了什么问题？"></textarea><button class="btn btn-primary" id="docSend" disabled>发送</button><button class="btn" id="docStop" hidden>停止</button></div></div>' +
      '<div class="chat-help"><span>Enter 发送 · Shift + Enter 换行</span><span>会话仅在当前页面会话中保留，刷新后清空</span></div><div class="quick" id="docQuick"></div>' +
      '<section class="section" style="margin-top:30px"><h2 class="section-title" style="font-size:23px">没连上云端时，可以先看这些</h2><div class="knowledge-links"><a href="#/archive">茶品与风味 ↗<small>三尖、三砖、一卷的完整档案</small></a><a href="#/craft">千两茶工艺 ↗<small>按步骤认识传统手艺</small></a><a href="#/flower">金花与霉变 ↗<small>形态差异与辨识的局限</small></a></div><details class="knowledge-excerpt"><summary>展开内置知识：冲泡、存储与选购</summary><p class="form-note">以下是平台整理的资料原文，不是 AI 生成的回答，也不是实时检索结果。</p>' +
      TEA_DATA.KB.split("\n")
        .filter(function (s) {
          return /^【(冲泡参数|存储方法|选购建议)】/.test(s);
        })
        .map(function (s) {
          return "<p>" + esc(s) + "</p>";
        })
        .join("") +
      "</details></section>";
    var log = el.querySelector("#docLog"),
      input = el.querySelector("#docInput"),
      send = el.querySelector("#docSend"),
      stop = el.querySelector("#docStop"),
      models = el.querySelector("#docModel");
    input.value = state.draft;
    function bubble(role, text) {
      var wrap = document.createElement("div");
      wrap.className = "msg " + (role === "user" ? "me" : "ai");
      wrap.innerHTML =
        '<span class="av">' +
        (role === "user" ? "我" : "茶") +
        '</span><div class="bub"></div>';
      wrap.querySelector(".bub").textContent = text;
      log.appendChild(wrap);
      return wrap.querySelector(".bub");
    }
    function turnText(t) {
      return (
        t.a +
        (t.status === "stopped"
          ? "\n\n（已停止生成）"
          : t.status === "error"
            ? "\n\n" + t.error
            : "")
      );
    }
    function paintLog() {
      log.innerHTML = "";
      if (!state.turns.length)
        bubble(
          "assistant",
          "你好，我是茶博士。\n\n想分清茶的品类，想问冲泡和存放，都可以直接问。\n\n没连上云端时，可以往下翻内置的资料。",
        );
      state.turns.forEach(function (t) {
        bubble("user", t.q);
        bubble("assistant", turnText(t));
      });
      log.scrollTop = log.scrollHeight;
    }
    paintLog();
    el.querySelector("#docQuick").innerHTML = TEA_DATA.QUICK_QUESTIONS.slice(
      0,
      4,
    )
      .map(function (q) {
        return '<button type="button">' + esc(q) + "</button>";
      })
      .join("");
    el.querySelectorAll("#docQuick button").forEach(function (b) {
      b.onclick = function () {
        if (active) return;
        state.draft = input.value = b.textContent;
        input.focus();
      };
    });
    function busy() {
      send.disabled = !!active || !modelId;
      stop.hidden = !active;
      input.disabled = !!active;
      models.disabled = !!active || !modelId;
      el.querySelector("#docStatus").textContent = active
        ? "正在整理回答…"
        : modelId
          ? "已连接 · 基于内置知识"
          : "AI 暂未连接";
    }
    function unavailable(message) {
      if (!alive) return;
      modelId = null;
      models.innerHTML = "<option>AI 暂未连接</option>";
      el.querySelector("#docNotice").textContent =
        message + " 可先查阅下方知识资料。";
      busy();
    }
    TeaCloud.ready()
      .then(function (ok) {
        if (!alive) return;
        if (!ok) {
          unavailable("当前为本机体验，尚未连接在线模型。");
          return;
        }
        return TeaCloud.listModels().then(function (list) {
          if (!alive) return;
          var usable = list.filter(function (m) {
            return m && m.id && m.enabled !== false && m.disabled !== true;
          });
          if (!usable.length) {
            unavailable("当前没有可用的 AI 模型。");
            return;
          }
          models.innerHTML = usable
            .map(function (m) {
              return (
                '<option value="' +
                esc(m.id) +
                '">' +
                esc(m.name || m.id) +
                "</option>"
              );
            })
            .join("");
          var preferred = usable.find(function (m) {
            return m.isDefault === true;
          });
          modelId = (preferred || usable[0]).id;
          models.value = modelId;
          el.querySelector("#docNotice").textContent =
            "云端已连接。AI 回答仅作茶文化学习参考，不用于判定茶品安全或疾病诊疗。";
          busy();
        });
      })
      .catch(function () {
        unavailable("模型目录暂时读取失败。");
      });
    models.onchange = function () {
      modelId = models.value;
    };
    input.oninput = function () {
      state.draft = input.value;
    };
    input.onkeydown = function (e) {
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.isComposing &&
        e.keyCode !== 229
      ) {
        e.preventDefault();
        ask();
      }
    };
    function cancel() {
      if (!active) return;
      var req = active;
      active = null;
      clearTimeout(req.timer);
      req.controller.abort();
      req.turn.status = "stopped";
      req.out.textContent = turnText(req.turn);
      busy();
    }
    stop.onclick = cancel;
    el.querySelector("#docReset").onclick = function () {
      cancel();
      state.turns = [];
      state.draft = "";
      input.value = "";
      state.conversationId = TeaCloud.newConversationId();
      paintLog();
      busy();
      TeaUI.toast("已开启新对话。");
    };
    send.onclick = ask;
    async function ask() {
      var q = input.value.trim();
      if (!q || active) return;
      if (!modelId) {
        TeaUI.toast("AI 尚未连接，请先查看内置知识。");
        return;
      }
      var messages = [{ role: "system", content: TEA_DATA.SYSTEM_PROMPT }];
      state.turns
        .filter(function (t) {
          return t.status === "complete";
        })
        .slice(-6)
        .forEach(function (t) {
          messages.push(
            { role: "user", content: t.q },
            { role: "assistant", content: t.a },
          );
        });
      messages.push({ role: "user", content: q });
      var turn = { q: q, a: "", status: "pending" },
        controller = new AbortController();
      state.turns.push(turn);
      if (state.turns.length > 30) state.turns.shift();
      state.draft = "";
      input.value = "";
      bubble("user", q);
      var out = bubble("assistant", "正在整理…");
      var req = { turn: turn, out: out, controller: controller, timer: null };
      active = req;
      busy();
      log.scrollTop = log.scrollHeight;
      var timed = new Promise(function (_, reject) {
        req.timer = setTimeout(function () {
          reject(new Error("回答等待超时，请稍后重试。"));
          controller.abort();
        }, 45000);
      });
      try {
        await Promise.race([
          timed,
          TeaCloud.streamChat({
            model: modelId,
            messages: messages,
            conversationId: state.conversationId,
            signal: controller.signal,
            temperature: 0.5,
            onDelta: function (text) {
              if (!alive || active !== req || controller.signal.aborted) return;
              var follow =
                log.scrollHeight - log.scrollTop - log.clientHeight < 120;
              turn.a += text;
              out.textContent = turn.a;
              if (follow) log.scrollTop = log.scrollHeight;
            },
          }),
        ]);
        if (!alive || active !== req) return;
        if (!turn.a) throw new Error("本次没有返回内容，请重新提问。");
        turn.status = "complete";
      } catch (e) {
        if (!alive || active !== req) return;
        turn.status = "error";
        turn.error = TeaCloud.friendlyError(e);
        out.textContent = turnText(turn);
        state.draft = input.value = q;
      } finally {
        clearTimeout(req.timer);
        if (alive && active === req) {
          active = null;
          busy();
          input.focus();
        }
      }
    }
    return function () {
      cancel();
      alive = false;
    };
  },
};
