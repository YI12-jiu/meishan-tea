(function () {
  var ROUTES = [
    ["home", "首页"],
    ["archive", "茶品档案"],
    ["road", "万里茶道"],
    ["craft", "千两茶技艺"],
    ["flower", "金花鉴别"],
    ["doctor", "AI 茶博士"],
    ["cellar", "我的茶仓"],
  ];
  var dispose = null,
    lastKey = null,
    modalCleanup = null,
    modalTrigger = null;
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function icon() {
    return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M5 18C5 8 12 5 20 4c-1 9-5 15-13 14M5 21 16 9"/></svg>';
  }
  function toast(msg) {
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.getElementById("toastHost").appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 4000);
  }
  function closeModal() {
    var host = document.getElementById("modalHost");
    if (modalCleanup) {
      modalCleanup();
      modalCleanup = null;
    }
    host.hidden = true;
    host.innerHTML = "";
    host.onclick = null;
    document.removeEventListener("keydown", modalKeys);
    document.body.style.overflow = "";
    document.querySelectorAll(".topbar, #view, .footer").forEach(function (x) {
      x.inert = false;
    });
    if (modalTrigger && modalTrigger.isConnected)
      modalTrigger.focus({ preventScroll: true });
    modalTrigger = null;
  }
  function openModal(title, html) {
    var host = document.getElementById("modalHost");
    var trigger = host.hidden ? document.activeElement : modalTrigger;
    closeModal();
    modalTrigger = trigger;
    host.innerHTML =
      '<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modalTitle">' +
      '<div class="mh"><h3 id="modalTitle">' +
      esc(title) +
      '</h3><button class="close-x" type="button" data-close aria-label="关闭">×</button></div><div class="mb">' +
      html +
      "</div></div>";
    host.hidden = false;
    document.body.style.overflow = "hidden";
    document.querySelectorAll(".topbar, #view, .footer").forEach(function (x) {
      x.inert = true;
    });
    host.onclick = function (e) {
      if (e.target === host || e.target.closest("[data-close]")) closeModal();
    };
    document.addEventListener("keydown", modalKeys);
    host.querySelector("[data-close]").focus();
    return host;
  }
  function modalKeys(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key !== "Tab") return;
    var all = Array.from(
      document.querySelectorAll(
        "#modalHost button, #modalHost input, #modalHost select, #modalHost textarea, #modalHost a[href]",
      ),
    ).filter(function (n) {
      return !n.disabled && n.getClientRects().length;
    });
    if (!all.length) return;
    var first = all[0],
      last = all[all.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  function confirmAction(title, message, action) {
    var host = openModal(
      title,
      "<p>" +
        esc(message) +
        '</p><div class="dialog-actions"><button class="btn" data-close>取消</button><button class="btn btn-primary" id="confirmAction">确认删除</button></div>',
    );
    host.querySelector("#confirmAction").onclick = function () {
      closeModal();
      action();
    };
  }
  function isPublishedOrigin() {
    return location.origin === new URL(CLOUD_CONFIG.endpoint).origin;
  }
  function authNotice() {
    return TeaCloud.available()
      ? ""
      : '<div class="notice">当前尚未连接云服务。可以先使用「本机茶仓」，记录只保存在此浏览器。</div>';
  }
  function openAuth(mode) {
    mode = mode || "login";
    var alive = true,
      pending = null,
      cooldown = null;
    var label = {
      login: "登录",
      otp: "验证并登录",
      signup: "注册账号",
      reset: "重置密码并登录",
    }[mode];
    var host = openModal(
      "欢迎回到梅山茶脉",
      authNotice() +
        '<div class="auth-tabs">' +
        [
          ["login", "密码登录"],
          ["otp", "验证码登录"],
          ["signup", "注册"],
        ]
          .map(function (x) {
            return (
              '<button type="button" data-mode="' +
              x[0] +
              '" class="' +
              (mode === x[0] ? "active" : "") +
              '">' +
              x[1] +
              "</button>"
            );
          })
          .join("") +
        "</div>" +
        '<form id="authForm"><div id="authErr" class="form-err" role="alert" hidden></div>' +
        '<div class="field"><label for="authEmail">邮箱</label><input id="authEmail" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"></div>' +
        (mode !== "login"
          ? '<div class="field"><label for="authCode">邮箱验证码</label><div class="code-row"><input id="authCode" inputmode="numeric" autocomplete="one-time-code" required maxlength="12"><button class="btn" id="authSend" type="button">获取验证码</button></div></div>'
          : "") +
        '<div class="field" id="passwordField"' +
        (mode === "otp" ? " hidden" : "") +
        '><label for="authPassword">' +
        (mode === "login" ? "密码" : "设置新密码") +
        '</label><input id="authPassword" type="password" minlength="6" autocomplete="' +
        (mode === "login" ? "current-password" : "new-password") +
        '"' +
        (mode !== "otp" ? " required" : "") +
        "></div>" +
        '<p id="authHint" class="form-note">' +
        (mode === "reset"
          ? "获取重置验证码后设置新密码。"
          : "云端茶仓需要登录；本机茶仓无需账号。") +
        "</p>" +
        '<div class="dialog-actions"><button class="btn btn-primary" type="submit" id="authSubmit">' +
        label +
        "</button>" +
        (mode === "login"
          ? '<button class="btn btn-ghost" type="button" id="forgotPassword">忘记密码</button>'
          : "") +
        "</div></form>",
    );
    modalCleanup = function () {
      alive = false;
      clearInterval(cooldown);
      pending = null;
    };
    host.querySelectorAll("[data-mode]").forEach(function (b) {
      b.onclick = function () {
        openAuth(b.dataset.mode);
      };
    });
    if (mode === "login")
      host.querySelector("#forgotPassword").onclick = function () {
        openAuth("reset");
      };
    var form = host.querySelector("form"),
      email = host.querySelector("#authEmail"),
      pwd = host.querySelector("#authPassword"),
      send = host.querySelector("#authSend");
    function error(msg) {
      if (!alive) return;
      var n = host.querySelector("#authErr");
      n.hidden = false;
      n.textContent = msg;
    }
    function clearError() {
      host.querySelector("#authErr").hidden = true;
    }
    if (send)
      send.onclick = async function () {
        if (!email.reportValidity()) return;
        clearError();
        send.disabled = true;
        var address = email.value.trim();
        var r =
          mode === "reset"
            ? await TeaCloud.resetPasswordForEmail(address)
            : await TeaCloud.sendOtp(address);
        if (!alive) return;
        if (r.error || !r.data) {
          send.disabled = false;
          return error(TeaCloud.friendlyError(r.error));
        }
        pending = { email: address, data: r.data };
        if (mode === "otp") {
          var fresh = r.data.isExistingUser === false;
          host.querySelector("#passwordField").hidden = !fresh;
          pwd.required = fresh;
        }
        host.querySelector("#authHint").textContent =
          "验证码已发送，请查收邮箱。";
        var left = 60;
        send.textContent = left + " 秒后重发";
        cooldown = setInterval(function () {
          left--;
          send.textContent = left + " 秒后重发";
          if (!left) {
            clearInterval(cooldown);
            send.disabled = false;
            send.textContent = "重新获取";
          }
        }, 1000);
      };
    form.onsubmit = async function (e) {
      e.preventDefault();
      clearError();
      if (
        mode !== "login" &&
        (!pending || pending.email !== email.value.trim())
      )
        return error("请先为当前邮箱获取验证码。");
      if (mode === "signup" && pending.data.isExistingUser)
        return error("此邮箱已注册，请切换到登录。");
      var b = host.querySelector("#authSubmit");
      b.disabled = true;
      b.textContent = "正在处理…";
      try {
        var r;
        if (mode === "login")
          r = await TeaCloud.signInWithPassword(email.value.trim(), pwd.value);
        else if (mode === "reset")
          r = await TeaCloud.timeout(
            pending.data.updateUser({
              nonce: host.querySelector("#authCode").value.trim(),
              password: pwd.value,
            }),
          );
        else
          r = await TeaCloud.verifyOtp({
            email: pending.email,
            verificationId: pending.data.verificationId,
            isExistingUser: pending.data.isExistingUser,
            token: host.querySelector("#authCode").value.trim(),
            password: pending.data.isExistingUser ? undefined : pwd.value,
          });
        if (!alive) return;
        if (r.error) return error(TeaCloud.friendlyError(r.error));
        if (mode === "reset") await refreshSession();
        else applySession(r.data);
        if (!alive) return;
        closeModal();
        toast(mode === "reset" ? "密码已更新。" : "登录成功。");
        render();
      } catch (err) {
        error(TeaCloud.friendlyError(err));
      } finally {
        if (alive) {
          b.disabled = false;
          b.textContent = label;
        }
      }
    };
  }
  function userId() {
    var u = APP.user;
    return (u && (u.id || u.userId || u.uid || u.sub)) || null;
  }
  function applySession(s) {
    APP.session = s || null;
    APP.user = (s && s.user) || null;
    APP.authReady = true;
    renderUserArea();
  }
  async function refreshSession() {
    var r = await TeaCloud.getSession();
    applySession(r && !r.error ? r.data : null);
    return APP.user;
  }
  function renderUserArea() {
    var host = document.getElementById("userarea");
    var u = APP.user;
    host.innerHTML = u
      ? '<span class="user-chip">' +
        esc(u.email || u.name || "茶友") +
        '</span><button class="btn btn-sm" id="signOutBtn">退出</button>'
      : '<button class="btn btn-ghost btn-sm" id="loginBtn">登录 / 注册</button>';
    if (!u)
      host.querySelector("button").onclick = function () {
        openAuth("login");
      };
    else
      host.querySelector("button").onclick = async function () {
        this.disabled = true;
        var r = await TeaCloud.signOut();
        if (r.error) {
          this.disabled = false;
          toast(TeaCloud.friendlyError(r.error));
          return;
        }
        applySession(null);
        toast("已退出登录。");
        render();
      };
  }
  function currentKey() {
    var key = (location.hash || "#/home").slice(2);
    return ROUTES.some(function (r) {
      return r[0] === key;
    })
      ? key
      : "home";
  }
  function render() {
    if (dispose) {
      dispose();
      dispose = null;
    }
    closeModal();
    var key = currentKey(),
      view = VIEWS[key],
      el = document.getElementById("view");
    document.getElementById("nav").innerHTML = ROUTES.map(function (r) {
      return (
        '<a href="#/' +
        r[0] +
        '"' +
        (r[0] === key ? ' class="active" aria-current="page"' : "") +
        ">" +
        r[1] +
        "</a>"
      );
    }).join("");
    document.getElementById("nav").classList.remove("open");
    document
      .getElementById("menuToggle")
      .setAttribute("aria-expanded", "false");
    document.title = view.title + " · 梅山茶脉";
    el.dataset.page = key;
    try {
      el.innerHTML = "";
      var cleanup = view.render(el);
      if (typeof cleanup === "function") dispose = cleanup;
    } catch (e) {
      el.innerHTML =
        '<div class="empty"><b>页面暂未展开</b><p>请刷新后重试。</p></div>';
      console.error(e);
    }
    el.classList.remove("fade");
    void el.offsetWidth;
    el.classList.add("fade");
    if (lastKey !== key) {
      window.scrollTo({ top: 0, behavior: "instant" });
      if (lastKey) el.focus({ preventScroll: true });
    }
    lastKey = key;
  }
  function go(key) {
    if (
      ROUTES.some(function (r) {
        return r[0] === key;
      })
    ) {
      if (currentKey() === key) render();
      else location.hash = "#/" + key;
    }
  }
  function download(name, contents, type) {
    var url = URL.createObjectURL(
      new Blob([contents], { type: type || "application/json;charset=utf-8" }),
    );
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }
  window.TeaUI = {
    esc: esc,
    icon: icon,
    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    confirmAction: confirmAction,
    openAuth: openAuth,
    go: go,
    rerender: render,
    refreshSession: refreshSession,
    userId: userId,
    isPublishedOrigin: isPublishedOrigin,
    authNotice: authNotice,
    download: download,
  };
  window.addEventListener("hashchange", function () {
    if (location.hash === "#view") {
      document.getElementById("view").focus();
      return;
    }
    render();
  });
  document.addEventListener("DOMContentLoaded", function () {
    if (!location.hash) history.replaceState(null, "", "#/home");
    renderUserArea();
    render();
    document.querySelector(".skip-link").onclick = function (e) {
      e.preventDefault();
      document.getElementById("view").focus();
    };
    document.getElementById("menuToggle").onclick = function () {
      var open = document.getElementById("nav").classList.toggle("open");
      this.setAttribute("aria-expanded", String(open));
    };
    TeaCloud.ready()
      .then(async function (ok) {
        if (!ok) {
          APP.authReady = true;
          return;
        }
        await refreshSession();
        if (currentKey() === "cellar" && APP.user) {
          var switchButton = document.getElementById("switchCloud");
          if (switchButton) switchButton.textContent = "返回云端茶仓";
          else render();
        }
        TeaCloud.onAuthStateChange(function (event, session) {
          var before = userId();
          if (event === "SIGNED_OUT") applySession(null);
          else if (session) applySession(session);
          if (before !== userId() && currentKey() === "cellar") render();
        });
      })
      .catch(function () {
        APP.authReady = true;
      });
  });
})();
