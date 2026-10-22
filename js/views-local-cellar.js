window.renderLocalCellar = function (el, renderPublicNotes) {
  var esc = TeaUI.esc,
    filter = "tea",
    alive = true;
  el.innerHTML =
    '<div id="localCellar"><div class="section-head"><div><h1 class="section-title">我的茶仓</h1><p class="section-sub">目前是本机模式，记录只保存在这台设备的浏览器里，不会上传。</p></div></div>' +
    '<div class="mode-banner"><div><strong>本机茶仓 · 无需登录</strong><p>记录仅保存在此浏览器，不会上传、公开或自动同步。清理浏览器会丢失记录，请定期导出备份。</p></div><button class="btn btn-sm" id="switchCloud">' +
    (APP.user ? "返回云端茶仓" : "登录云端茶仓") +
    "</button></div>" +
    '<div class="cellar-summary" id="localSummary"></div><div class="local-toolbar"><div class="tabs" style="margin:0"><button type="button" data-kind="tea" class="active">存茶清单</button><button type="button" data-kind="note">品鉴笔记</button></div><div class="local-actions"><button class="btn btn-sm" id="exportLocal">导出备份</button><button class="btn btn-sm" id="importLocal">导入备份</button><button class="btn btn-primary btn-sm" id="addLocal">＋ 添加存茶</button></div></div>' +
    '<input type="file" id="backupFile" accept="application/json,.json" hidden><p id="localResult" role="status" class="form-note"></p><div id="localRecords" class="card-grid g3"></div></div>';
  var box = el.querySelector("#localRecords");
  el.querySelector("#switchCloud").onclick = function () {
    if (APP.user) TeaUI.rerender();
    else TeaUI.openAuth("login");
  };
  el.querySelectorAll("[data-kind]").forEach(function (b) {
    b.onclick = function () {
      filter = b.dataset.kind;
      el.querySelectorAll("[data-kind]").forEach(function (n) {
        n.classList.toggle("active", n === b);
        n.setAttribute("aria-pressed", String(n === b));
      });
      el.querySelector("#addLocal").textContent =
        filter === "tea" ? "＋ 添加存茶" : "＋ 写品鉴笔记";
      paint();
    };
  });
  el.querySelector("#addLocal").onclick = function () {
    edit();
  };
  el.querySelector("#exportLocal").onclick = function () {
    try {
      TeaUI.download("梅山茶脉-本机茶仓备份.json", TeaStore.exportData());
      TeaUI.toast("备份已生成，请妥善保存下载的文件。");
    } catch (e) {
      TeaUI.toast(e.message);
    }
  };
  el.querySelector("#importLocal").onclick = function () {
    el.querySelector("#backupFile").click();
  };
  el.querySelector("#backupFile").onchange = async function () {
    var file = this.files[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("文件超过 5 MB，请选择较小的茶仓备份。");
      var text = await file.text();
      if (!alive) return;
      var n = TeaStore.importData(text);
      paint();
      el.querySelector("#localResult").textContent =
        "已导入 " + n + " 条新记录；相同编号的已有记录保持不变。";
    } catch (e) {
      if (alive)
        el.querySelector("#localResult").textContent =
          "导入未完成：" + e.message;
    }
    this.value = "";
  };
  function paint() {
    var rows;
    try {
      rows = TeaStore.read();
    } catch (e) {
      el.querySelector("#localSummary").innerHTML = "";
      box.innerHTML =
        '<div class="empty" style="grid-column:1/-1"><b>本机数据暂不可读</b><p>' +
        esc(e.message) +
        '</p><button class="btn" id="rawBackup">导出原始数据</button></div>';
      box.querySelector("#rawBackup").onclick = function () {
        try {
          TeaUI.download(
            "梅山茶脉-原始数据.txt",
            TeaStore.raw(),
            "text/plain;charset=utf-8",
          );
        } catch (err) {
          TeaUI.toast("浏览器禁止读取原始数据，请检查隐私设置。");
        }
      };
      return;
    }
    var teas = rows.filter(function (r) {
      return r.kind === "tea";
    }).length;
    el.querySelector("#localSummary").innerHTML =
      "<div><b>" +
      teas +
      "</b><span>款存茶</span></div><div><b>" +
      (rows.length - teas) +
      "</b><span>篇品鉴笔记</span></div><div><b>本机</b><span>记录保存位置</span></div>";
    var visible = rows.filter(function (r) {
      return r.kind === filter;
    });
    if (!visible.length) {
      box.innerHTML =
        '<div class="empty" style="grid-column:1/-1"><b>' +
        (filter === "tea"
          ? "茶仓，等你放入第一款茶。"
          : "今天这杯茶，有什么不同？") +
        '</b><p>从一条真实记录开始。这里没有预填的演示数据。</p><button class="btn btn-primary" id="firstLocal">' +
        (filter === "tea" ? "添加第一款存茶" : "写下第一篇品鉴") +
        "</button></div>";
      box.querySelector("button").onclick = function () {
        edit();
      };
      return;
    }
    box.innerHTML = visible
      .map(function (r, i) {
        return (
          '<article class="card local-card"><span class="record-kind">' +
          (r.kind === "tea" ? "我的存茶" : "私密品鉴 · 仅本机") +
          "</span><h3>" +
          esc(r.name) +
          '</h3><p class="record-meta">' +
          esc([r.type, r.vintage, r.quantity].filter(Boolean).join(" · ")) +
          "</p>" +
          (r.storage ? "<p>存放：" + esc(r.storage) + "</p>" : "") +
          '<p class="record-note">' +
          esc(r.note || "还没有补充笔记。") +
          '</p><div class="record-actions"><button class="btn btn-sm" data-edit="' +
          i +
          '">编辑</button><button class="btn btn-sm btn-ghost" data-delete="' +
          i +
          '">删除</button></div></article>'
        );
      })
      .join("");
    box.querySelectorAll("[data-edit]").forEach(function (b) {
      b.onclick = function () {
        edit(visible[Number(b.dataset.edit)]);
      };
    });
    box.querySelectorAll("[data-delete]").forEach(function (b) {
      b.onclick = function () {
        var r = visible[Number(b.dataset.delete)];
        TeaUI.confirmAction(
          "删除这条记录？",
          "将删除「" + r.name + "」。删除后可通过此前导出的备份恢复。",
          function () {
            try {
              TeaStore.remove(r.id);
              paint();
              TeaUI.toast("记录已删除。");
            } catch (e) {
              TeaUI.toast(e.message);
            }
          },
        );
      };
    });
  }
  function edit(record) {
    var r = record || { kind: filter };
    var host = TeaUI.openModal(
      record
        ? "编辑记录"
        : r.kind === "tea"
          ? "添加一款存茶"
          : "写一篇品鉴笔记",
      '<form id="localForm"><div id="localError" class="form-err" role="alert" hidden></div>' +
        '<div class="field"><label for="localName">茶品名称 *</label><input id="localName" name="name" required maxlength="100" placeholder="例如：2020 年手筑茯砖" value="' +
        esc(r.name) +
        '"></div>' +
        '<div class="field-row"><div class="field"><label for="localType">茶品类型</label><select id="localType" name="type">' +
        [
          "茯砖茶",
          "黑砖茶",
          "花砖茶",
          "千两茶",
          "百两茶",
          "十两茶",
          "天尖茶",
          "贡尖茶",
          "生尖茶",
          "其他",
        ]
          .map(function (t) {
            return (
              "<option" +
              (r.type === t ? " selected" : "") +
              ">" +
              t +
              "</option>"
            );
          })
          .join("") +
        '</select></div><div class="field"><label for="localVintage">年份</label><input id="localVintage" name="vintage" maxlength="30" placeholder="如 2020 / 年份不详" value="' +
        esc(r.vintage) +
        '"></div></div>' +
        (r.kind === "tea"
          ? '<div class="field-row"><div class="field"><label for="localQuantity">数量</label><input id="localQuantity" name="quantity" maxlength="100" placeholder="如 2 砖 / 500 克" value="' +
            esc(r.quantity) +
            '"></div><div class="field"><label for="localStorage">存放位置 / 条件</label><input id="localStorage" name="storage" maxlength="300" placeholder="如 书房纸箱，离地离墙" value="' +
            esc(r.storage) +
            '"></div></div>'
          : "") +
        '<div class="field"><label for="localNote">' +
        (r.kind === "tea" ? "备注" : "品鉴记录") +
        '</label><textarea id="localNote" name="note" maxlength="5000" rows="4" placeholder="香气、汤色、滋味，或值得记住的小细节…">' +
        esc(r.note) +
        '</textarea></div><p class="form-note">仅保存到此浏览器，不会发布到茶友圈。</p><div class="dialog-actions"><button class="btn" type="button" data-close>取消</button><button class="btn btn-primary" type="submit">保存到本机</button></div></form>',
    );
    host.querySelector("form").onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      var value = {
        id:
          r.id ||
          (window.crypto && crypto.randomUUID
            ? crypto.randomUUID()
            : "local-" +
              Date.now() +
              "-" +
              Math.random().toString(36).slice(2)),
        kind: r.kind,
        updatedAt: new Date().toISOString(),
      };
      ["name", "type", "vintage", "quantity", "storage", "note"].forEach(
        function (key) {
          value[key] = String(fd.get(key) || "").trim();
        },
      );
      try {
        if (!value.name) throw new Error("请填写茶品名称。");
        TeaStore.save(value);
        TeaUI.closeModal();
        paint();
        TeaUI.toast("已保存到本机。");
      } catch (err) {
        var n = host.querySelector("#localError");
        n.hidden = false;
        n.textContent = err.message;
      }
    };
  }
  if (renderPublicNotes) {
    el.querySelector("#localCellar").insertAdjacentHTML(
      "beforeend",
      '<div class="local-community"><button class="btn btn-ghost" id="cPeek">浏览公开茶友圈 →</button><section id="peekBox" class="section" hidden></section></div>',
    );
    el.querySelector("#cPeek").onclick = async function () {
      var peek = el.querySelector("#peekBox");
      peek.hidden = !peek.hidden;
      this.textContent = peek.hidden ? "浏览公开茶友圈 →" : "收起茶友圈 ↑";
      if (!peek.hidden) {
        peek.innerHTML = '<p class="form-note">正在检查云端连接…</p>';
        await TeaCloud.ready();
        if (alive && !peek.hidden) renderPublicNotes(peek);
      }
    };
  }
  paint();
  return function () {
    alive = false;
  };
};
