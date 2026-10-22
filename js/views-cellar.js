/* ======================= 我的茶仓 ======================= */
window.VIEWS.cellar = {
  title: "我的茶仓",
  render: function (el) {
    var esc = window.TeaUI.esc;
    var toast = window.TeaUI.toast;
    var user = window.APP.user;

    if (!user)
      return window.renderLocalCellar(el, function (host) {
        renderNotes(host, null);
      });

    /* ---------------------------- 已登录 ---------------------------- */
    el.innerHTML =
      '<div class="section-head"><div>' +
      '<h2 class="section-title">我的茶仓</h2>' +
      '<p class="section-sub">已登录：' +
      esc(user.email || user.name || user.id) +
      "　·　品鉴笔记与存茶清单保存在平台云数据库，仅你本人可修改与删除。</p>" +
      "</div></div>" +
      '<div class="tabs">' +
      '<button type="button" data-tab="notes" class="active">品鉴笔记 · 茶友圈</button>' +
      '<button type="button" data-tab="cellar">我的存茶清单</button>' +
      "</div>" +
      '<div class="notice"><span>云端茶仓已登录。品鉴笔记会公开到茶友圈；存茶清单仅本人可见。</span><button class="btn btn-sm" id="openLocal">本机茶仓</button></div>' +
      '<div id="tabBody"></div>';
    var localCleanup = null;
    el.querySelector("#openLocal").onclick = function () {
      localCleanup = window.renderLocalCellar(el, function (host) {
        renderNotes(host, null);
      });
    };

    var tabs = el.querySelectorAll(".tabs button");
    var body = el.querySelector("#tabBody");
    var cur = "notes";

    tabs.forEach(function (b) {
      b.onclick = function () {
        tabs.forEach(function (x) {
          x.classList.remove("active");
        });
        b.classList.add("active");
        cur = b.getAttribute("data-tab");
        paint();
      };
    });

    function paint() {
      if (cur === "notes") renderNotes(body, user);
      else renderCellar(body, user);
    }
    paint();
    return function () {
      if (localCleanup) localCleanup();
    };

    /* ========================= 茶友圈 / 品鉴笔记 ========================= */
    function renderNotes(host, me) {
      host.innerHTML =
        (me ? formNote() : "") +
        '<div class="section-head" style="margin:26px 0 14px;">' +
        '<div><h2 class="section-title" style="font-size:20px;">茶友圈</h2>' +
        '<p class="section-sub">所有茶友的品鉴记录，公开可读。' +
        (me ? "你发布的内容只有你能删除。" : "登录后可发布自己的笔记。") +
        "</p></div>" +
        "</div>" +
        '<div class="card-grid g2" id="notesList"><div class="empty" style="grid-column:1/-1;"><b>正在读取…</b></div></div>';

      if (me) bindNoteForm(host);

      loadNotes(host);

      function loadNotes(h) {
        var listBox = h.querySelector("#notesList");
        if (!listBox || !listBox.isConnected) return;
        if (!window.TeaCloud.available()) {
          listBox.innerHTML =
            '<div class="empty" style="grid-column:1/-1;"><b>云数据库不可用</b>' +
            esc(TeaCloud.initError() || "") +
            "</div>";
          return;
        }
        TeaCloud.query(function () {
          return TeaCloud.from("tea_notes")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(60);
        }, false)
          .then(function (r) {
            if (r.error) {
              listBox.innerHTML =
                '<div class="empty" style="grid-column:1/-1;"><b>读取失败</b>' +
                esc(TeaCloud.friendlyError(r.error)) +
                "</div>";
              return;
            }
            var rows = r.data || [];
            if (!rows.length) {
              listBox.innerHTML =
                '<div class="empty" style="grid-column:1/-1;"><b>还没有笔记</b>成为第一个留下品鉴记录的人。</div>';
              return;
            }
            listBox.innerHTML = rows
              .map(function (n) {
                return noteCard(n, me);
              })
              .join("");
            listBox.querySelectorAll("[data-del]").forEach(function (b) {
              b.onclick = function () {
                TeaUI.confirmAction(
                  "删除公开笔记？",
                  "删除后无法撤销。",
                  function () {
                    delNote(b.getAttribute("data-del"), b);
                  },
                );
              };
            });
          })
          .catch(function (e) {
            listBox.innerHTML =
              '<div class="empty" style="grid-column:1/-1;"><b>读取失败</b>' +
              esc(TeaCloud.friendlyError(e)) +
              "</div>";
          });
      }

      function delNote(id, btn) {
        btn.disabled = true;
        btn.textContent = "删除中…";
        TeaCloud.query(function () {
          return TeaCloud.from("tea_notes").delete().eq("id", id).select();
        }, true)
          .then(function (r) {
            if (r.error) {
              btn.disabled = false;
              btn.textContent = "删除";
              return toast(TeaCloud.friendlyError(r.error));
            }
            var affected = Array.isArray(r.data) ? r.data : [];
            if (!affected.length) {
              btn.disabled = false;
              btn.textContent = "删除";
              return toast("未能删除——该记录可能不属于你。");
            }
            toast("已删除该条笔记。");
            loadNotes(host);
          })
          .catch(function (e) {
            btn.disabled = false;
            btn.textContent = "删除";
            toast(TeaCloud.friendlyError(e));
          });
      }

      function bindNoteForm(h) {
        var f = h.querySelector("#noteForm");
        if (!f) return;
        f.onsubmit = function (event) {
          event.preventDefault();
          var submit = f.querySelector("#nfSubmit");
          if (submit.disabled) return;
          var name = f.querySelector("#nfName").value.trim();
          if (!name) return toast("请先填写茶品名称。");
          var payload = {
            owner_name:
              f.querySelector("#nfWho").value.trim() ||
              (me.email || "").split("@")[0] ||
              "茶友",
            tea_name: name,
            tea_type: f.querySelector("#nfType").value,
            vintage: f.querySelector("#nfVintage").value.trim(),
            rating: Number(f.querySelector("#nfRating").value),
            aroma: f.querySelector("#nfAroma").value.trim(),
            liquor: f.querySelector("#nfLiquor").value.trim(),
            mouthfeel: f.querySelector("#nfMouth").value.trim(),
            note: f.querySelector("#nfNote").value.trim(),
          };
          var b = submit;
          b.disabled = true;
          b.textContent = "保存中…";
          TeaCloud.query(function () {
            return TeaCloud.from("tea_notes").insert(payload).select();
          }, true)
            .then(function (r) {
              b.disabled = false;
              b.textContent = "发布笔记";
              if (r.error) return toast(TeaCloud.friendlyError(r.error));
              var created = r.data && r.data[0];
              if (!created) return toast("写入未生效，请重新登录后再试。");
              f.reset();
              toast("笔记已发布到茶友圈。");
              loadNotes(host);
            })
            .catch(function (e) {
              b.disabled = false;
              b.textContent = "发布笔记";
              toast(TeaCloud.friendlyError(e));
            });
        };
      }

      function formNote() {
        return (
          '<div class="card" style="padding:22px;">' +
          '<h3 style="font-family:var(--serif);font-size:17px;letter-spacing:1px;margin:0 0 16px;">写一条品鉴笔记</h3>' +
          '<form id="noteForm">' +
          '<div class="field-row">' +
          '<div class="field"><label for="nfName">茶品名称 *</label><input id="nfName" type="text" maxlength="300" placeholder="如 2018 年手筑茯砖"></div>' +
          '<div class="field"><label for="nfType">茶品类型</label>' +
          '<select id="nfType"><option>茯砖茶</option><option>黑砖茶</option><option>花砖茶</option>' +
          "<option>千两茶</option><option>百两茶</option><option>十两茶</option>" +
          "<option>天尖茶</option><option>贡尖茶</option><option>生尖茶</option><option>其他</option></select></div>" +
          "</div>" +
          '<div class="field-row">' +
          '<div class="field"><label for="nfVintage">年份</label><input id="nfVintage" type="text" maxlength="300" placeholder="如 2018"></div>' +
          '<div class="field"><label for="nfRating">综合评分</label>' +
          '<select id="nfRating"><option value="5">★★★★★ 极佳</option><option value="4">★★★★☆ 良好</option>' +
          '<option value="3">★★★☆☆ 尚可</option><option value="2">★★☆☆☆ 一般</option><option value="1">★☆☆☆☆ 欠佳</option></select></div>' +
          '<div class="field"><label for="nfWho">显示昵称</label><input id="nfWho" type="text" maxlength="300" placeholder="可选"></div>' +
          "</div>" +
          '<div class="field-row">' +
          '<div class="field"><label for="nfAroma">香气</label><input id="nfAroma" type="text" maxlength="300" placeholder="如 菌花香高扬，带陈木香"></div>' +
          '<div class="field"><label for="nfLiquor">汤色</label><input id="nfLiquor" type="text" maxlength="300" placeholder="如 橙红明亮"></div>' +
          "</div>" +
          '<div class="field"><label for="nfMouth">滋味</label><input id="nfMouth" type="text" maxlength="300" placeholder="如 醇厚顺滑，回甘明显"></div>' +
          '<div class="field"><label for="nfNote">品鉴笔记</label><textarea maxlength="5000" id="nfNote" placeholder="记录冲泡参数、香气变化、存放环境与你自己的判断…"></textarea></div>' +
          '<button class="btn btn-primary" type="submit" id="nfSubmit">发布笔记</button>' +
          "</form>" +
          "</div>"
        );
      }

      function noteCard(n, me) {
        var d = n.created_at ? new Date(n.created_at) : null;
        var ds = d
          ? d.getFullYear() +
            "-" +
            String(d.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(d.getDate()).padStart(2, "0")
          : "";
        var mine =
          me &&
          n.owner_id &&
          String(n.owner_id) === String(window.TeaUI.userId());
        var who = n.owner_name || "茶友";
        var stars =
          "★★★★★".slice(0, Math.max(0, Math.min(5, Number(n.rating) || 0))) +
          "☆☆☆☆☆".slice(0, 5 - Math.max(0, Math.min(5, Number(n.rating) || 0)));
        return (
          '<div class="note">' +
          '<div class="note-top">' +
          '<div class="note-who"><span class="av">' +
          esc(String(who).slice(0, 1)) +
          "</span>" +
          "<span>" +
          esc(who) +
          '</span><span style="color:var(--muted);">·</span><span style="color:var(--muted);">' +
          esc(ds) +
          "</span></div>" +
          '<div style="display:flex;align-items:center;gap:10px;">' +
          '<span class="stars">' +
          stars +
          "</span>" +
          (mine
            ? '<button class="btn btn-sm btn-ghost" type="button" data-del="' +
              esc(n.id) +
              '">删除</button>'
            : "") +
          "</div>" +
          "</div>" +
          "<h4>" +
          esc(n.tea_name) +
          (n.tea_type
            ? '　<span style="font-size:12px;color:var(--muted);font-family:var(--sans);">' +
              esc(n.tea_type) +
              "</span>"
            : "") +
          (n.vintage
            ? '　<span style="font-size:12px;color:var(--muted);font-family:var(--sans);">' +
              esc(n.vintage) +
              " 年</span>"
            : "") +
          "</h4>" +
          (n.note ? '<p class="body">' + esc(n.note) + "</p>" : "") +
          '<div class="note-grid">' +
          "<div><dt>香气</dt><dd>" +
          esc(n.aroma || "—") +
          "</dd></div>" +
          "<div><dt>汤色</dt><dd>" +
          esc(n.liquor || "—") +
          "</dd></div>" +
          "<div><dt>滋味</dt><dd>" +
          esc(n.mouthfeel || "—") +
          "</dd></div>" +
          "</div>" +
          "</div>"
        );
      }
    }

    /* ========================= 我的存茶清单 ========================= */
    function renderCellar(host, me) {
      host.innerHTML =
        '<div class="card" style="padding:22px;">' +
        '<h3 style="font-family:var(--serif);font-size:17px;letter-spacing:1px;margin:0 0 16px;">添加一款存茶</h3>' +
        '<form id="cellarForm">' +
        '<div class="field-row">' +
        '<div class="field"><label for="cfName">茶品名称 *</label><input id="cfName" type="text" maxlength="300" placeholder="如 2016 年千两茶"></div>' +
        '<div class="field"><label for="cfType">类型</label>' +
        '<select id="cfType"><option>茯砖茶</option><option>黑砖茶</option><option>花砖茶</option>' +
        "<option>千两茶</option><option>百两茶</option><option>十两茶</option>" +
        "<option>天尖茶</option><option>贡尖茶</option><option>生尖茶</option><option>其他</option></select></div>" +
        "</div>" +
        '<div class="field-row">' +
        '<div class="field"><label for="cfVintage">年份</label><input id="cfVintage" type="text" maxlength="300" placeholder="如 2016"></div>' +
        '<div class="field"><label for="cfQty">数量</label><input id="cfQty" type="text" maxlength="300" placeholder="如 1 支 / 3 砖"></div>' +
        "</div>" +
        '<div class="field"><label for="cfStore">存放条件</label><input id="cfStore" type="text" maxlength="300" placeholder="如 书房纸箱存放，离地离墙，湿度 55%"></div>' +
        '<button class="btn btn-gold" type="submit" id="cfSubmit">存入库房</button>' +
        "</form>" +
        "</div>" +
        '<div class="section-head" style="margin:26px 0 14px;">' +
        '<div><h2 class="section-title" style="font-size:20px;">我的存茶清单</h2>' +
        '<p class="section-sub">仅你自己可见，可添加或删除。</p></div>' +
        "</div>" +
        '<div class="card-grid g3" id="cellarList"><div class="empty" style="grid-column:1/-1;"><b>正在读取…</b></div></div>';

      var listBox = host.querySelector("#cellarList");
      var f = host.querySelector("#cellarForm");

      f.onsubmit = function (event) {
        event.preventDefault();
        var submit = f.querySelector("#cfSubmit");
        if (submit.disabled) return;
        var name = f.querySelector("#cfName").value.trim();
        if (!name) return toast("请先填写茶品名称。");
        var b = submit;
        b.disabled = true;
        b.textContent = "保存中…";
        TeaCloud.query(function () {
          return TeaCloud.from("tea_cellar")
            .insert({
              owner_name: (me.email || "").split("@")[0] || "我",
              tea_name: name,
              tea_type: f.querySelector("#cfType").value,
              vintage: f.querySelector("#cfVintage").value.trim(),
              quantity: f.querySelector("#cfQty").value.trim(),
              storage_note: f.querySelector("#cfStore").value.trim(),
            })
            .select();
        }, true)
          .then(function (r) {
            b.disabled = false;
            b.textContent = "存入库房";
            if (r.error) return toast(TeaCloud.friendlyError(r.error));
            if (!(r.data && r.data[0]))
              return toast("写入未生效，请重新登录后再试。");
            f.reset();
            toast("已存入库房。");
            load();
          })
          .catch(function (e) {
            b.disabled = false;
            b.textContent = "存入库房";
            toast(TeaCloud.friendlyError(e));
          });
      };

      function load() {
        TeaCloud.query(function () {
          return TeaCloud.from("tea_cellar")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);
        }, false)
          .then(function (r) {
            if (r.error) {
              listBox.innerHTML =
                '<div class="empty" style="grid-column:1/-1;"><b>读取失败</b>' +
                esc(TeaCloud.friendlyError(r.error)) +
                "</div>";
              return;
            }
            var rows = r.data || [];
            if (!rows.length) {
              listBox.innerHTML =
                '<div class="empty" style="grid-column:1/-1;"><b>库房还是空的</b>把手上正在存的茶录进来，方便日后翻查年份与存放条件。</div>';
              return;
            }
            listBox.innerHTML = rows
              .map(function (c) {
                return (
                  '<div class="card">' +
                  '<h3 style="font-size:16px;">' +
                  esc(c.tea_name) +
                  "</h3>" +
                  '<p style="margin-bottom:10px;">' +
                  esc(c.tea_type || "") +
                  (c.vintage ? "　·　" + esc(c.vintage) : "") +
                  (c.quantity ? "　·　" + esc(c.quantity) : "") +
                  "</p>" +
                  (c.storage_note
                    ? '<p style="font-size:12.5px;color:var(--muted);">存放：' +
                      esc(c.storage_note) +
                      "</p>"
                    : "") +
                  '<div style="margin-top:14px;"><button class="btn btn-sm btn-ghost" type="button" data-del="' +
                  esc(c.id) +
                  '">移出清单</button></div>' +
                  "</div>"
                );
              })
              .join("");
            listBox.querySelectorAll("[data-del]").forEach(function (b) {
              b.onclick = function () {
                TeaUI.confirmAction(
                  "移出存茶清单？",
                  "此操作将删除云端记录，无法撤销。",
                  function () {
                    b.disabled = true;
                    TeaCloud.query(function () {
                      return TeaCloud.from("tea_cellar")
                        .delete()
                        .eq("id", b.getAttribute("data-del"))
                        .select();
                    }, true)
                      .then(function (r2) {
                        if (r2.error) {
                          b.disabled = false;
                          return toast(TeaCloud.friendlyError(r2.error));
                        }
                        if (!(Array.isArray(r2.data) && r2.data.length)) {
                          b.disabled = false;
                          return toast("未能删除该记录。");
                        }
                        toast("已移出清单。");
                        load();
                      })
                      .catch(function (e) {
                        b.disabled = false;
                        toast(TeaCloud.friendlyError(e));
                      });
                  },
                );
              };
            });
          })
          .catch(function (e) {
            listBox.innerHTML =
              '<div class="empty" style="grid-column:1/-1;"><b>读取失败</b>' +
              esc(TeaCloud.friendlyError(e)) +
              "</div>";
          });
      }
      load();
    }
  },
};
