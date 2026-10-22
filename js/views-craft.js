/* ======================= 千两茶制作技艺 ======================= */
window.VIEWS.craft = {
  title: "千两茶技艺",
  render: function (el) {
    var D = window.TEA_DATA;
    var esc = window.TeaUI.esc;
    var active = 0;

    el.innerHTML =
      '<div class="section-head"><div>' +
      '<h2 class="section-title">千两茶的十道核心工序</h2>' +
      '<p class="section-sub">千两茶又称花卷茶，始制于清嘉庆至道光年间，产地湖南安化。其包装与加工同步进行，由茶工用天然竹篾、粽片、蓼叶包装黑毛茶，经绞、压、踩、滚、锤等工序，形成每支净重老秤一千两（约 36.25 公斤）、高约 1.5 米的圆柱体紧压茶，是体积与质量为单体茶之最，号称「世界茶王」。' +
      "千两茶制作技艺于 2008 年列入第二批国家级非物质文化遗产名录。　点左侧工序逐道查看。</p>" +
      "</div></div>" +
      '<div class="craft-layout">' +
      '<div class="steps" id="craftSteps"></div>' +
      '<div id="craftStage"></div>' +
      "</div>" +
      '<section class="section">' +
      '<div class="card-grid g2">' +
      '<div class="card">' +
      "<h3>为什么千两茶无法机械替代</h3>" +
      "<p>全程二十余道工序需十余人协作，核心环节「踩制」由五至七名壮汉使用木杠与压棍完成，要求「装茶满，踩茶紧」。力道不匀会直接反映在成茶的松紧与后期转化上，" +
      "这种依赖经验与协作的判断，至今没有机械可以稳定复制。</p>" +
      "</div>" +
      '<div class="card">' +
      "<h3>七星灶与渥堆</h3>" +
      "<p>初制阶段以七星灶松柴明火烘焙，形成安化黑茶标志性的松烟香；渥堆则通过微生物参与的后发酵，使茶叶色泽转褐、滋味转醇。" +
      "这两道工序共同构成了黑茶「越陈越香」的基础。</p>" +
      "</div>" +
      "</div>" +
      "</section>";

    var stepsBox = el.querySelector("#craftSteps");
    var stageBox = el.querySelector("#craftStage");

    stepsBox.innerHTML = D.CRAFT_STEPS.map(function (s, i) {
      return (
        '<button class="step-btn' +
        (i === 0 ? " active" : "") +
        '" type="button" data-i="' +
        i +
        '">' +
        '<span class="idx">' +
        (i + 1) +
        "</span>" +
        '<span class="nm">' +
        esc(s.name) +
        "</span></button>"
      );
    }).join("");

    stepsBox.querySelectorAll(".step-btn").forEach(function (b) {
      b.onclick = function () {
        stepsBox.querySelectorAll(".step-btn").forEach(function (x) {
          x.classList.remove("active");
        });
        b.classList.add("active");
        show(parseInt(b.getAttribute("data-i"), 10));
      };
    });

    function show(i) {
      APP.craftStep = i;
      stepsBox.querySelectorAll("button").forEach(function (b, idx) {
        b.classList.toggle("active", idx === i);
        b.setAttribute("aria-pressed", String(idx === i));
      });
      var s = D.CRAFT_STEPS[i];
      var media = s.img
        ? '<img alt="AI 生成的工艺示意" src="' + s.img + '">'
        : '<div style="height:150px;display:flex;align-items:center;justify-content:center;' +
          "background:linear-gradient(135deg,var(--paper-3) 0%,var(--paper-2) 100%);" +
          'border-bottom:1px solid var(--line);">' +
          '<span style="font-family:var(--serif);font-size:34px;letter-spacing:12px;color:var(--line-2);">' +
          String(i + 1).padStart(2, "0") +
          "</span></div>";

      stageBox.innerHTML =
        '<div class="craft-stage fade">' +
        media +
        '<div class="body">' +
        (s.img
          ? '<p class="art-caption">配图为 AI 生成的工艺示意，不是现场实拍。</p>'
          : "") +
        "<h3>" +
        (i + 1) +
        ". " +
        esc(s.name) +
        "</h3>" +
        "<p>" +
        esc(s.desc) +
        "</p>" +
        '<div class="tagrow">' +
        s.tags
          .map(function (t) {
            return '<span class="tag">' + esc(t) + "</span>";
          })
          .join("") +
        "</div>" +
        '<div class="progress-bar"><i style="width:' +
        Math.round(((i + 1) / D.CRAFT_STEPS.length) * 100) +
        '%"></i></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;">' +
        '<button class="btn btn-sm" type="button" id="cPrev"' +
        (i === 0 ? " disabled" : "") +
        ">← 上一道</button>" +
        '<span style="font-size:12px;color:var(--muted);">第 ' +
        (i + 1) +
        " / " +
        D.CRAFT_STEPS.length +
        " 道工序</span>" +
        '<button class="btn btn-sm btn-gold" type="button" id="cNext"' +
        (i === D.CRAFT_STEPS.length - 1 ? " disabled" : "") +
        ">下一道 →</button>" +
        "</div>" +
        "</div>" +
        "</div>";

      var p = stageBox.querySelector("#cPrev");
      var n = stageBox.querySelector("#cNext");
      if (p)
        p.onclick = function () {
          jump(i - 1);
        };
      if (n)
        n.onclick = function () {
          jump(i + 1);
        };
    }

    function jump(i) {
      var btn = stepsBox.querySelector('.step-btn[data-i="' + i + '"]');
      if (btn) btn.click();
    }

    show(Math.min(APP.craftStep || 0, D.CRAFT_STEPS.length - 1));
  },
};
