window.VIEWS.home = {
  title: "首页",
  render: function (el) {
    el.innerHTML = `
      <section class="home-hero" aria-labelledby="heroTitle">
        <div class="hero-editorial">
          <p class="eyebrow"><span class="tiny-line"></span> 湖南 · 益阳 · 安化</p>
          <p class="hero-preface">安化黑茶的地方资料与辨识工具</p>
          <h1 id="heroTitle">看明白，<br>再喝这杯<span>茶。</span></h1>
          <p class="hero-intro">12 款茶品档案、11 站万里茶道、10 道千两茶工序。<br>还有金花与霉变的对照，和一个能问问题的茶博士。</p>
          <div class="hero-actions"><a class="btn btn-primary" href="#/archive">先查茶品档案 <span aria-hidden="true">↗</span></a><a class="text-link" href="#/road">沿茶道走一遍 <span aria-hidden="true">→</span></a></div>
          <div class="hero-footnote"><span class="seal-outline">山水<br>养茶</span><span>安化黑茶 · 梅山文化<br><small>资料整理自公开文献 · 配图为 AI 生成示意</small></span></div>
        </div>
        <div class="hero-landscape">
          <img src="assets/hero-tea-mountain.jpg" width="1536" height="1024" fetchpriority="high" alt="云雾环绕的茶山意象，AI 生成示意">
          <div class="landscape-veil"></div><span class="vertical-poem">安化茶山</span>
          <div class="landscape-caption"><span>茶山意象</span><small>AI 生成示意</small></div>
        </div>
      </section>
      <div class="discovery-strip" aria-label="浏览线索">
        <div><b>三尖 · 三砖 · 一卷</b><span>按品类查档案</span></div>
        <div><b>十道工序</b><span>看千两茶怎么做</span></div>
        <div><b>十一站茶道</b><span>从安化到圣彼得堡</span></div>
        <a href="#/doctor"><span class="status-dot"></span><span>有具体问题？<strong>问茶博士 ↗</strong></span></a>
      </div>
      <section class="section explore-section">
        <div class="section-head"><div><h2 class="section-title">按需要挑一个入口</h2></div><p class="section-aside">不用懂茶，也能查明白。</p></div>
        <div class="story-grid">
          <a class="story-card story-feature" href="#/craft"><img src="assets/qianliang-craft.jpg" width="1536" height="1024" loading="lazy" alt="千两茶手工制作场景，AI 生成示意"><div class="story-overlay"></div><div class="story-body"><span class="story-kicker">千两茶技艺</span><h3>十道工序，<br>做一支千两茶</h3><p>从选料、踩制到日晒夜露 49 天，逐道看。</p><span class="round-arrow" aria-hidden="true">↗</span></div></a>
          <a class="story-card story-light" href="#/archive"><div class="story-number" aria-hidden="true">茶</div><span class="story-kicker">茶品档案</span><h3>十二款茶，<br>一档一档查</h3><p>按品类筛，也能把两三款并排比较。</p><span class="story-link">查看档案 ↗</span></a>
          <a class="story-card story-green" href="#/flower"><div class="golden-motif" aria-hidden="true">✺</div><span class="story-kicker">金花鉴别</span><h3>金花和霉变，<br>到底怎么分</h3><p>六个维度对照，再做五道题试试。</p><span class="story-link">进入鉴别 ↗</span></a>
        </div>
      </section>
      <section class="road-feature section">
        <div class="road-feature-art"><img src="assets/tea-horse-road.jpg" width="1536" height="1024" loading="lazy" alt="茶道马帮意象，AI 生成示意"><span>文化场景示意 · AI 生成</span></div>
        <div class="road-feature-copy"><h2>从安化到圣彼得堡</h2><p>茶叶在资江边的黄沙坪码头装船，经洞庭、长江到汉口，再转汉水北上出塞。这一路走了两百多年。</p><div class="route-preview"><span>安化</span><i></i><span>汉口</span><i></i><span>恰克图</span><i></i><span>圣彼得堡</span></div><a class="text-link" href="#/road">看完整路线 →</a></div>
      </section>
      <section class="section companion-grid">
        <a class="companion" href="#/doctor"><span class="companion-icon" aria-hidden="true">问</span><div><h2>有具体问题，问茶博士</h2><p>选购、冲泡、存放都能问。云端没连上时，可以先读下面整理好的资料。</p><span class="text-link">去提问 ↗</span></div></a>
        <a class="companion" href="#/cellar"><span class="companion-icon" aria-hidden="true">藏</span><div><h2>给自己的茶做记录</h2><p>不用注册，记录存在你自己的浏览器里，随时可以导出备份。</p><span class="text-link">打开茶仓 ↗</span></div></a>
      </section>
      <div class="closing-line"><span></span><p>内容整理自公开文献与地方资料，发现错漏欢迎指出。</p><span></span></div>`;
  },
};
