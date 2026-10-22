window.VIEWS.archive = {
  title: "茶品档案",
  render: function (el) {
    var D = TEA_DATA,
      esc = TeaUI.esc,
      current = "全部",
      search = "",
      selected = [],
      alive = true;
    var rows = D.ARCHIVES.slice();
    el.innerHTML =
      '<div class="section-head"><div><h1 class="section-title">茶品档案</h1><p class="section-sub">三尖、三砖、一卷，共 12 款。可以按类别筛，也可以直接搜风味或工艺。</p></div><span class="archive-total">' +
      rows.length +
      " 份茶品档案</span></div>" +
      '<div class="archive-toolbar"><div class="search-field"><label for="archSearch">搜索茶品</label><input id="archSearch" type="search" placeholder="搜茶名、风味或工艺，如：菌花香" maxlength="100"></div><div class="filters" id="archFilters"></div></div>' +
      '<div class="archive-meta"><span id="archCount" role="status"></span><span id="archSrc">内置档案 · 云端连接后检查更新</span></div>' +
      '<div class="card-grid g3" id="archList"></div><div id="compareBar" class="compare-bar" hidden></div>';
    var listBox = el.querySelector("#archList"),
      srcBox = el.querySelector("#archSrc"),
      filters = el.querySelector("#archFilters");
    filters.innerHTML = D.CATEGORIES.map(function (c) {
      return (
        '<button class="chip' +
        (c === current ? " active" : "") +
        '" type="button" aria-pressed="' +
        (c === current) +
        '">' +
        esc(c) +
        "</button>"
      );
    }).join("");
    filters.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        current = b.textContent;
        filters.querySelectorAll("button").forEach(function (n) {
          n.classList.toggle("active", n === b);
          n.setAttribute("aria-pressed", String(n === b));
        });
        paint();
      };
    });
    el.querySelector("#archSearch").oninput = function () {
      search = this.value.trim().toLocaleLowerCase();
      paint();
    };
    function paint() {
      var filtered = rows.filter(function (t) {
        return (
          (current === "全部" || t.category === current) &&
          [t.name, t.flavor, t.craft, t.description, t.origin]
            .join(" ")
            .toLocaleLowerCase()
            .includes(search)
        );
      });
      el.querySelector("#archCount").textContent =
        "找到 " + filtered.length + " 款 · 可选 2–3 款对比";
      if (!filtered.length) {
        listBox.innerHTML =
          '<div class="empty" style="grid-column:1/-1"><b>没有匹配的茶</b><p>换个关键词，或者清除分类再试。</p><button class="btn" id="clearSearch">清除筛选</button></div>';
        listBox.querySelector("button").onclick = function () {
          search = "";
          el.querySelector("#archSearch").value = "";
          filters.querySelector("button").click();
        };
        return;
      }
      listBox.innerHTML = filtered
        .map(function (t, i) {
          return (
            '<article class="tea-card"><div class="tea-card-top"><span class="cat">' +
            esc(t.category) +
            '</span><span class="tea-index">' +
            String(rows.indexOf(t) + 1).padStart(2, "0") +
            '</span></div><button class="tea-detail" type="button" data-detail="' +
            i +
            '"><h2>' +
            esc(t.name) +
            '</h2><span class="tea-flavor">' +
            esc(t.flavor || "风味待补充") +
            '</span><p class="desc">' +
            esc(t.description || "") +
            '</p><span class="detail-link">看完整档案 →</span></button><div class="tea-card-bottom"><span>' +
            (t.gold_flower ? "◆ 含金花" : esc(t.origin || "产区待补充")) +
            '</span><button class="compare-toggle" type="button" data-compare="' +
            i +
            '" aria-pressed="' +
            selected.includes(t) +
            '">' +
            (selected.includes(t) ? "✓ 已选对比" : "＋ 加入对比") +
            "</button></div></article>"
          );
        })
        .join("");
      listBox.querySelectorAll("[data-detail]").forEach(function (b) {
        b.onclick = function () {
          detail(filtered[Number(b.dataset.detail)]);
        };
      });
      listBox.querySelectorAll("[data-compare]").forEach(function (b) {
        b.onclick = function () {
          var t = filtered[Number(b.dataset.compare)],
            idx = selected.indexOf(t);
          if (idx >= 0) selected.splice(idx, 1);
          else if (selected.length < 3) selected.push(t);
          else {
            TeaUI.toast("一次最多比较 3 款茶。");
            return;
          }
          paint();
          paintCompare();
        };
      });
    }
    function detail(t) {
      var host = TeaUI.openModal(
        t.name,
        '<div class="detail-panel"><span class="tag">' +
          esc(t.category) +
          '</span><dl class="kv">' +
          [
            ["年份渊源", t.year_label],
            ["核心产区", t.origin],
            ["关键工艺", t.craft],
            ["风味特征", t.flavor],
          ]
            .map(function (pair) {
              return (
                "<dt>" +
                pair[0] +
                "</dt><dd>" +
                esc(pair[1] || "未收录") +
                "</dd>"
              );
            })
            .join("") +
          "</dl><p>" +
          esc(t.description) +
          '</p><p class="form-note">来源：平台茶品档案，团队整理。历史与品鉴描述仅作文化学习参考。</p><button class="btn btn-primary" id="askTea">问茶博士 →</button></div>',
      );
      host.querySelector("#askTea").onclick = function () {
        APP.pendingQuestion = "请介绍" + t.name + "的工艺与风味。";
        TeaUI.go("doctor");
      };
    }
    function paintCompare() {
      var bar = el.querySelector("#compareBar");
      bar.hidden = !selected.length;
      bar.innerHTML =
        "<span>已选 " +
        selected.length +
        " 款：" +
        selected
          .map(function (t) {
            return esc(t.name);
          })
          .join("、") +
        '</span><div><button class="btn btn-sm" id="clearCompare">清空</button><button class="btn btn-primary btn-sm" id="openCompare"' +
        (selected.length < 2 ? " disabled" : "") +
        ">并排比较 →</button></div>";
      bar.querySelector("#clearCompare").onclick = function () {
        selected = [];
        paint();
        paintCompare();
      };
      bar.querySelector("#openCompare").onclick = function () {
        TeaUI.openModal(
          "茶品对比",
          '<div class="table-scroll"><table class="compare-table"><caption>按同一维度比较所选茶品</caption><thead><tr><th scope="col">比较维度</th>' +
            selected
              .map(function (t) {
                return '<th scope="col">' + esc(t.name) + "</th>";
              })
              .join("") +
            "</tr></thead><tbody>" +
            [
              ["category", "类别"],
              ["flavor", "风味"],
              ["craft", "工艺"],
              ["origin", "产区"],
              ["year_label", "渊源"],
            ]
              .map(function (f) {
                return (
                  '<tr><th scope="row">' +
                  f[1] +
                  "</th>" +
                  selected
                    .map(function (t) {
                      return "<td>" + esc(t[f[0]] || "未收录") + "</td>";
                    })
                    .join("") +
                  "</tr>"
                );
              })
              .join("") +
            "</tbody></table></div>",
        );
      };
    }
    paint();
    TeaCloud.ready().then(function (ok) {
      if (!alive) return;
      if (!ok) {
        srcBox.textContent = "内置档案 · 非实时云端数据";
        return;
      }
      return TeaCloud.query(function () {
        return TeaCloud.from("tea_archives")
          .select("*")
          .order("sort_order", { ascending: true });
      })
        .then(function (r) {
          if (!alive) return;
          if (r.error || !Array.isArray(r.data) || !r.data.length)
            throw new Error("empty");
          var valid = r.data.filter(function (x) {
            return (
              x && typeof x.name === "string" && typeof x.category === "string"
            );
          });
          if (!valid.length) throw new Error("invalid");
          var names = selected.map(function (t) {
            return t.name;
          });
          rows = valid;
          selected = rows
            .filter(function (t) {
              return names.includes(t.name);
            })
            .slice(0, 3);
          srcBox.textContent = "云端档案 · 本次已更新";
          el.querySelector(".archive-total").textContent =
            rows.length + " 份茶品档案";
          paint();
          paintCompare();
        })
        .catch(function () {
          if (alive) srcBox.textContent = "内置档案 · 云端暂未连接";
        });
    });
    return function () {
      alive = false;
    };
  },
};
