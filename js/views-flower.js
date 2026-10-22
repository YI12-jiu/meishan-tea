/* ======================= 金花鉴别 ======================= */
window.VIEWS.flower = {
  title: "金花鉴别",
  render: function (el) {
    var F = window.TEA_DATA.FLOWER;
    var QUIZ = window.TEA_DATA.QUIZ;
    var esc = window.TeaUI.esc;

    el.innerHTML =
      '<div class="section-head"><div>' +
      '<h2 class="section-title">金花与霉变</h2>' +
      '<p class="section-sub">这是安化黑茶最容易买错、也最容易被误判的地方。茯砖茶砖体内生长的「金花」是冠突散囊菌的闭囊壳，属有益菌，是品质的重要标志；' +
      "而受潮引起的霉变则是杂菌滋生，不可饮用。两者在形态、颜色、分布与气味上都有明确区别，下面按六个维度对照。</p>" +
      "</div></div>" +
      '<div class="notice warn"><span>本页用于认识形态差异，无法确认实物是否安全。怀疑霉变时不要靠试喝来鉴别，应停止饮用并咨询专业人员。</span></div>' +
      '<div class="compare">' +
      plate("good", F.good) +
      plate("bad", F.bad) +
      "</div>" +
      '<section class="section">' +
      '<div class="section-head"><div>' +
      '<h2 class="section-title">茯砖断面的金花（示意）</h2>' +
      '<p class="section-sub">下面是 AI 生成的形态示意，不是实拍照片，不能用来判断手中茶品的真伪或安全。</p>' +
      "</div></div>" +
      '<div class="card" style="padding:0;overflow:hidden;border-radius:var(--r-lg);">' +
      '<img loading="lazy" src="assets/golden-flower.jpg" alt="茯砖茶断面上的金黄色金花颗粒" style="width:100%;height:clamp(200px,32vw,340px);object-fit:cover;display:block;">' +
      "</div>" +
      "</section>" +
      '<section class="section">' +
      '<div class="section-head"><div>' +
      '<h2 class="section-title">五道自测题</h2>' +
      '<p class="section-sub">选一个答案，立刻看到解析。</p>' +
      "</div></div>" +
      '<div class="quiz" id="quizBox"></div>' +
      "</section>";

    /* -------------------- 菌相示意（程序化 SVG） -------------------- */
    function rng(seed) {
      var s = seed;
      return function () {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
      };
    }

    function fibers(rnd, w, h, n) {
      var out = "";
      for (var i = 0; i < n; i++) {
        var x = rnd() * w,
          y = rnd() * h,
          len = 20 + rnd() * 70,
          ang = rnd() * Math.PI;
        var x2 = x + Math.cos(ang) * len,
          y2 = y + Math.sin(ang) * len;
        out +=
          '<path d="M' +
          x.toFixed(1) +
          " " +
          y.toFixed(1) +
          " L" +
          x2.toFixed(1) +
          " " +
          y2.toFixed(1) +
          '" stroke="#5A4630" stroke-width="' +
          (1 + rnd() * 2.2).toFixed(1) +
          '" stroke-linecap="round" fill="none" opacity="' +
          (0.35 + rnd() * 0.4).toFixed(2) +
          '"/>';
      }
      return out;
    }

    function goodPlate() {
      var w = 320,
        h = 200,
        r = rng(20261006);
      var s =
        '<svg viewBox="0 0 ' +
        w +
        " " +
        h +
        '" width="100%" style="display:block;">' +
        '<rect width="' +
        w +
        '" height="' +
        h +
        '" fill="#3A2C1E"/>' +
        fibers(r, w, h, 70);
      for (var i = 0; i < 74; i++) {
        var x = 10 + r() * (w - 20),
          y = 10 + r() * (h - 20),
          rad = 2.2 + r() * 3.4;
        s +=
          '<circle cx="' +
          x.toFixed(1) +
          '" cy="' +
          y.toFixed(1) +
          '" r="' +
          rad.toFixed(1) +
          '" fill="#D8A93A" opacity="0.95"/>' +
          '<circle cx="' +
          (x - rad * 0.3).toFixed(1) +
          '" cy="' +
          (y - rad * 0.3).toFixed(1) +
          '" r="' +
          (rad * 0.38).toFixed(1) +
          '" fill="#F3DE9E" opacity="0.85"/>';
      }
      return s + "</svg>";
    }

    function badPlate() {
      var w = 320,
        h = 200,
        r = rng(19990815);
      var s =
        '<svg viewBox="0 0 ' +
        w +
        " " +
        h +
        '" width="100%" style="display:block;">' +
        '<rect width="' +
        w +
        '" height="' +
        h +
        '" fill="#3A2C1E"/>' +
        fibers(r, w, h, 70);
      /* 成片蔓延的丝状霉斑 */
      var patches = [
        [58, 62, 62],
        [214, 54, 54],
        [140, 148, 74],
        [278, 152, 46],
      ];
      patches.forEach(function (p) {
        var cx = p[0],
          cy = p[1],
          rad = p[2];
        s +=
          '<ellipse cx="' +
          cx +
          '" cy="' +
          cy +
          '" rx="' +
          rad +
          '" ry="' +
          (rad * 0.7).toFixed(0) +
          '" fill="#7C8A5E" opacity="0.30"/>';
        for (var i = 0; i < 46; i++) {
          var a = r() * Math.PI * 2,
            len = 6 + r() * (rad * 0.85);
          var x1 = cx + Math.cos(a) * r() * rad * 0.5,
            y1 = cy + Math.sin(a) * r() * rad * 0.5;
          var x2 = x1 + Math.cos(a) * len,
            y2 = y1 + Math.sin(a) * len;
          var col = r() > 0.55 ? "#9AA87C" : r() > 0.4 ? "#C9CDB4" : "#5E6B45";
          s +=
            '<path d="M' +
            x1.toFixed(1) +
            " " +
            y1.toFixed(1) +
            " Q" +
            ((x1 + x2) / 2 + (r() - 0.5) * 10).toFixed(1) +
            " " +
            ((y1 + y2) / 2 + (r() - 0.5) * 10).toFixed(1) +
            " " +
            x2.toFixed(1) +
            " " +
            y2.toFixed(1) +
            '" stroke="' +
            col +
            '" stroke-width="' +
            (0.6 + r() * 1.2).toFixed(1) +
            '" fill="none" stroke-linecap="round" opacity="' +
            (0.5 + r() * 0.45).toFixed(2) +
            '"/>';
        }
      });
      return s + "</svg>";
    }

    function plate(kind, data) {
      var art = kind === "good" ? goodPlate() : badPlate();
      var cls = kind === "good" ? "cmp good" : "cmp bad";
      var mark =
        kind === "good"
          ? "金花形态示意 · 不代表安全判定"
          : "✕ 不可饮用 · 杂菌滋生";
      return (
        '<div class="' +
        cls +
        '">' +
        '<div class="cmp-head"><span>' +
        esc(data.title) +
        '</span><span style="font-size:12px;font-family:var(--sans);">' +
        mark +
        "</span></div>" +
        '<div class="cmp-plate">' +
        art +
        "</div>" +
        '<div class="cmp-body">' +
        '<p style="font-size:13px;color:var(--ink-3);margin:0 0 12px;">' +
        esc(data.caption) +
        "</p>" +
        "<ul>" +
        data.points
          .map(function (p) {
            return "<li><b>" + esc(p[0]) + "</b>　" + esc(p[1]) + "</li>";
          })
          .join("") +
        "</ul>" +
        "</div></div>"
      );
    }

    /* ------------------------------ 自测题 ------------------------------ */
    var qBox = el.querySelector("#quizBox");
    var idx = 0,
      score = 0,
      answered = false;

    function renderQ() {
      if (idx >= QUIZ.length) {
        var level =
          score === QUIZ.length
            ? "全对！你已掌握这些基础知识，实物安全仍需专业判断。"
            : score >= QUIZ.length - 1
              ? "相当不错，只差一点点。"
              : score >= QUIZ.length / 2
                ? "基础还行，建议回头再看看上面的六维对照。"
                : "建议先把上面的对照表读一遍，再来一遍。";
        qBox.innerHTML =
          '<div style="text-align:center;padding:14px 0;">' +
          '<div style="font-family:var(--serif);font-size:40px;color:var(--tea);letter-spacing:2px;">' +
          score +
          " / " +
          QUIZ.length +
          "</div>" +
          '<p style="font-size:14px;color:var(--ink-2);margin:12px 0 20px;">' +
          level +
          "</p>" +
          '<button class="btn btn-primary" type="button" id="quizAgain">再做一遍</button>' +
          "</div>";
        qBox.querySelector("#quizAgain").onclick = function () {
          idx = 0;
          score = 0;
          answered = false;
          renderQ();
        };
        return;
      }

      var q = QUIZ[idx];
      answered = false;
      qBox.innerHTML =
        '<p style="font-size:12px;color:var(--muted);letter-spacing:1px;margin:0 0 10px;">第 ' +
        (idx + 1) +
        " / " +
        QUIZ.length +
        " 题　·　当前得分 " +
        score +
        "</p>" +
        '<p class="quiz-q">' +
        esc(q.q) +
        "</p>" +
        '<div class="quiz-opts">' +
        q.opts
          .map(function (o, i) {
            return (
              '<button class="quiz-opt" type="button" data-i="' +
              i +
              '">' +
              String.fromCharCode(65 + i) +
              ".　" +
              esc(o) +
              "</button>"
            );
          })
          .join("") +
        "</div>" +
        '<div id="quizFb"></div>';

      qBox.querySelectorAll(".quiz-opt").forEach(function (b) {
        b.onclick = function () {
          if (answered) return;
          answered = true;
          var pick = parseInt(b.getAttribute("data-i"), 10);
          var ok = pick === q.answer;
          if (ok) score++;
          qBox.querySelectorAll(".quiz-opt").forEach(function (x) {
            var xi = parseInt(x.getAttribute("data-i"), 10);
            x.disabled = true;
            if (xi === q.answer) x.classList.add("right");
            else if (xi === pick) x.classList.add("wrong");
          });
          var fb = qBox.querySelector("#quizFb");
          fb.innerHTML =
            '<div class="quiz-explain"><b style="color:' +
            (ok ? "var(--bamboo)" : "var(--danger)") +
            ';">' +
            (ok
              ? "答对了。"
              : "正确答案是 " + String.fromCharCode(65 + q.answer) + "。") +
            "</b>　" +
            esc(q.explain) +
            "</div>" +
            '<div style="margin-top:16px;text-align:right;"><button class="btn btn-sm btn-primary" type="button" id="quizNext">' +
            (idx === QUIZ.length - 1 ? "查看结果" : "下一题 →") +
            "</button></div>";
          fb.querySelector("#quizNext").onclick = function () {
            idx++;
            renderQ();
          };
        };
      });
    }

    renderQ();
  },
};
