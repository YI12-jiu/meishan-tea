/* ======================= 万里茶道 ======================= */
window.VIEWS.road = {
  title: "万里茶道",
  render: function (el) {
    var D = window.TEA_DATA;
    var esc = window.TeaUI.esc;
    var active = 0;

    el.innerHTML =
      '<div class="section-head"><div>' +
      '<h2 class="section-title">从资江码头到圣彼得堡</h2>' +
      '<p class="section-sub">安化是万里茶道的重要起点。茶叶自资江沿岸的小淹、边江、江南、洞市、唐家观、黄沙坪、酉州、东坪等茶马古镇装船，顺资江而下，经洞庭、长江至汉口，再转汉水北上，出塞越境抵达俄国。点任意节点看这一程。</p>' +
      "</div></div>" +
      '<div class="card" style="padding:0;overflow:hidden;border-radius:var(--r-lg);margin-bottom:26px;">' +
      '<img src="assets/tea-horse-road.jpg" alt="万里茶道古道上驮运茶柱的马帮" style="width:100%;height:clamp(160px,26vw,260px);object-fit:cover;display:block;">' +
      "</div>" +
      '<p class="art-caption">马帮文化场景为 AI 生成示意；下方为路线顺序导览，不按地理比例绘制。</p>' +
      '<div class="road-layout">' +
      '<div class="road-map" id="roadMap"></div>' +
      '<div id="roadDetail"></div>' +
      "</div>" +
      '<section class="section">' +
      '<div class="section-head"><div>' +
      '<h2 class="section-title">安化黑茶大事记</h2>' +
      "</div></div>" +
      '<div class="timeline">' +
      D.TIMELINE.map(function (t) {
        return (
          '<div class="tl-item"><span>' +
          esc(t.year) +
          "</span><b>" +
          esc(t.title) +
          "</b><p>" +
          esc(t.text) +
          "</p></div>"
        );
      }).join("") +
      "</div>" +
      "</section>";

    var mapBox = el.querySelector("#roadMap");
    var detailBox = el.querySelector("#roadDetail");

    mapBox.innerHTML = D.ROAD_NODES.map(function (n, i) {
      return (
        (i > 0 ? '<div class="road-rail"></div>' : "") +
        '<button type="button" class="road-node" data-i="' +
        i +
        '">' +
        '<span class="dot"></span>' +
        '<span><span class="t">' +
        esc(n.name) +
        '</span><br><span class="s">' +
        esc(n.phase) +
        "　·　" +
        esc(n.sub) +
        "</span></span>" +
        "</button>"
      );
    }).join("");

    mapBox.querySelectorAll(".road-node").forEach(function (node) {
      node.onclick = function () {
        select(parseInt(node.getAttribute("data-i"), 10));
      };
    });

    function select(i) {
      active = i;
      APP.roadStep = i;
      mapBox.querySelectorAll(".road-node").forEach(function (n) {
        var idx = parseInt(n.getAttribute("data-i"), 10);
        n.classList.toggle("active", idx === i);
        n.setAttribute("aria-pressed", String(idx === i));
        n.classList.toggle("done", idx < i);
      });
      var n = D.ROAD_NODES[i];
      detailBox.innerHTML =
        '<div class="card fade" style="padding:24px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">' +
        '<span class="tag">第 ' +
        (i + 1) +
        " 程</span>" +
        '<span class="tag" style="background:var(--tea-soft);color:var(--tea);border-color:#E8D5C6;">' +
        esc(n.phase) +
        "</span>" +
        "</div>" +
        '<h3 style="font-family:var(--serif);font-size:22px;letter-spacing:2px;margin:8px 0 4px;">' +
        esc(n.name) +
        "</h3>" +
        '<p style="font-size:13px;color:var(--muted);margin:0 0 14px;">' +
        esc(n.sub) +
        "</p>" +
        '<p style="font-size:14.5px;line-height:1.95;color:var(--ink-2);margin:0;">' +
        esc(n.detail) +
        "</p>" +
        '<div class="progress-bar"><i style="width:' +
        Math.round(((i + 1) / D.ROAD_NODES.length) * 100) +
        '%"></i></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;">' +
        '<button class="btn btn-sm" type="button" id="prevNode"' +
        (i === 0 ? " disabled" : "") +
        ">← 上一程</button>" +
        '<span style="font-size:12px;color:var(--muted);">' +
        (i + 1) +
        " / " +
        D.ROAD_NODES.length +
        "</span>" +
        '<button class="btn btn-sm" type="button" id="nextNode"' +
        (i === D.ROAD_NODES.length - 1 ? " disabled" : "") +
        ">下一程 →</button>" +
        "</div>" +
        "</div>";
      var p = detailBox.querySelector("#prevNode");
      var nx = detailBox.querySelector("#nextNode");
      if (p)
        p.onclick = function () {
          select(i - 1);
        };
      if (nx)
        nx.onclick = function () {
          select(i + 1);
        };
    }

    select(Math.min(APP.roadStep || 0, D.ROAD_NODES.length - 1));
  },
};
