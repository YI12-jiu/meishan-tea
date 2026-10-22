/* Real Chromium interactions against a temporary local server. No production calls. */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..");
const OUT = process.env.TEST_OUTPUT || path.join(ROOT, "test-results");
const results = [];
fs.mkdirSync(OUT, { recursive: true });
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, passed: false, error: e.message });
    console.error("FAIL", name, e.message);
  }
}
async function main() {
  const server = http.createServer((req, res) => {
    const decoded = decodeURIComponent(req.url.split("?")[0]);
    let target = path.resolve(ROOT, "." + decoded);
    if (!target.startsWith(ROOT + path.sep) && target !== ROOT) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (fs.existsSync(target) && fs.statSync(target).isDirectory())
      target = path.join(target, "index.html");
    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css",
      ".jpg": "image/jpeg",
      ".woff2": "font/woff2",
      ".svg": "image/svg+xml",
    };
    fs.readFile(target, (e, data) => {
      res.writeHead(e ? 404 : 200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
      });
      res.end(e ? "Not found" : data);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: process.env.CHROMIUM_ARGS
      ? JSON.parse(process.env.CHROMIUM_ARGS)
      : ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const errors = [],
    external = [];
  async function newPage(mockUser) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
      acceptDownloads: true,
    });
    await ctx.route("**/*", (route) => {
      if (
        !route
          .request()
          .url()
          .startsWith(base + "/")
      ) {
        external.push(route.request().url());
        return route.abort();
      }
      if (
        mockUser !== undefined &&
        new URL(route.request().url()).pathname.endsWith("/js/config.js")
      )
        return route.fulfill({
          contentType: "application/javascript",
          body: fs
            .readFileSync(path.join(ROOT, "js/config.js"), "utf8")
            .replace(/mode:\s*["']auto["']/, 'mode: "enabled"'),
        });
      return route.continue();
    });
    if (mockUser !== undefined)
      await ctx.addInitScript(
        ({ user }) => {
          window.__mock = {
            tables: { tea_notes: [], tea_cellar: [] },
            calls: [],
            fail: false,
            streamMode: "normal",
            delay: 50,
            user: user
              ? { id: "test-user", email: "test@example.invalid" }
              : null,
          };
          window.WorkBuddyCloud = {
            createWorkBuddyCloud() {
              const mock = window.__mock;
              function query(table) {
                let kind = "select",
                  data,
                  id;
                const q = {
                  select() {
                    return q;
                  },
                  order() {
                    return q;
                  },
                  limit() {
                    return q;
                  },
                  eq(k, v) {
                    id = v;
                    return q;
                  },
                  insert(p) {
                    kind = "insert";
                    data = p;
                    return q;
                  },
                  delete() {
                    kind = "delete";
                    return q;
                  },
                  then(resolve, reject) {
                    return new Promise((r) =>
                      setTimeout(() => {
                        if (mock.fail)
                          return r({ error: { message: "测试网络失败" } });
                        if (table === "tea_archives")
                          return r({ data: window.TEA_DATA.ARCHIVES });
                        if (kind === "insert") {
                          const row = {
                            ...data,
                            id: "row-" + Date.now(),
                            owner_id: "test-user",
                            created_at: new Date().toISOString(),
                          };
                          mock.tables[table].unshift(row);
                          return r({ data: [row] });
                        }
                        if (kind === "delete") {
                          const matches = mock.tables[table].filter(
                            (x) => String(x.id) === String(id),
                          );
                          mock.tables[table] = mock.tables[table].filter(
                            (x) => String(x.id) !== String(id),
                          );
                          return r({ data: matches });
                        }
                        r({ data: mock.tables[table].slice() });
                      }, mock.delay),
                    ).then(resolve, reject);
                  },
                };
                return q;
              }
              return {
                auth: {
                  getSession: async () => ({
                    data: mock.user ? { user: mock.user } : null,
                  }),
                  signInWithPassword: async () => ({
                    error: { message: "测试：凭据不正确" },
                  }),
                  sendOtp: async () => ({
                    data: { verificationId: "test", isExistingUser: true },
                  }),
                  verifyOtp: async () => ({
                    error: { message: "测试：验证码错误" },
                  }),
                  signOut: async () =>
                    mock.fail
                      ? { error: { message: "退出失败" } }
                      : { data: null },
                  onAuthStateChange() {},
                },
                database: { from: query },
                llm: {
                  models: {
                    list: async () => {
                      await new Promise((r) => setTimeout(r, 60));
                      return [{ id: "test-model", name: "测试模型" }];
                    },
                  },
                  chat: {
                    completions: {
                      async *create(payload) {
                        mock.calls.push(payload.messages);
                        const mode = mock.streamMode;
                        if (mode === "error") throw new Error("测试流失败");
                        if (mode === "empty") return;
                        if (mode === "slow") {
                          await new Promise((r) => setTimeout(r, 200));
                          yield {
                            choices: [{ delta: { content: "旧请求迟到内容" } }],
                          };
                          return;
                        }
                        yield {
                          choices: [{ delta: { content: "这是测试回答。" } }],
                        };
                      },
                    },
                  },
                },
              };
            },
          };
        },
        { user: mockUser },
      );
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(6000);
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    return page;
  }
  async function nav(page, key) {
    if (
      (await page.locator("#menuToggle").isVisible()) &&
      !(await page.locator("#nav").isVisible())
    )
      await page.locator("#menuToggle").click();
    await page.locator('#nav a[href="#/' + key + '"]').click();
    await page.locator('#view[data-page="' + key + '"]').waitFor();
  }
  let page;
  try {
    page = await newPage();
    await check(
      "7 routes render on desktop and 390px mobile without horizontal overflow",
      async () => {
        for (const width of [1440, 390, 320, 768]) {
          await page.setViewportSize({ width, height: 900 });
          for (const key of [
            "home",
            "archive",
            "road",
            "craft",
            "flower",
            "doctor",
            "cellar",
          ]) {
            await nav(page, key);
            assert.equal(
              await page
                .locator("#view .empty b")
                .filter({ hasText: "页面暂未展开" })
                .count(),
              0,
            );
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
              `${key} overflows at ${width}`,
            );
            if (width === 1440 || width === 390)
              await page.screenshot({
                path: path.join(OUT, `${key}-${width}.png`),
                fullPage: true,
              });
          }
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
      },
    );
    await check(
      "archive search, category, empty reset and comparison",
      async () => {
        await nav(page, "archive");
        assert.equal(await page.locator(".tea-card").count(), 12);
        await page.locator("#archSearch").fill("菌花香");
        assert.ok((await page.locator(".tea-card").count()) > 0);
        await page.locator("#archSearch").fill("没有这款茶");
        await page.locator("#clearSearch").click();
        assert.equal(await page.locator(".tea-card").count(), 12);
        await page
          .locator("#archFilters button")
          .filter({ hasText: "三尖" })
          .click();
        assert.equal(await page.locator(".tea-card").count(), 3);
        await page.locator('[data-compare="0"]').click();
        await page.locator('[data-compare="1"]').click();
        await page.locator("#openCompare").click();
        assert.equal(await page.locator(".compare-table thead th").count(), 3);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#modalHost").isHidden(), true);
      },
    );
    await check(
      "detail keyboard access, modal focus trap and handoff to AI",
      async () => {
        await page.locator('[data-detail="0"]').focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.getByRole("dialog").count(), 1);
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page
            .locator("#askTea")
            .evaluate((n) => n === document.activeElement),
          true,
        );
        await page.locator("#askTea").click();
        await page.locator("#docInput").waitFor();
        assert.match(await page.locator("#docInput").inputValue(), /天尖茶/);
        assert.equal(await page.locator("#docSend").isDisabled(), true);
        assert.match(
          await page.locator("#docNotice").textContent(),
          /尚未连接/,
        );
      },
    );
    await check(
      "road and craft interactions remember progress within session",
      async () => {
        await nav(page, "road");
        await page.locator("#nextNode").click();
        assert.match(await page.locator("#roadDetail").textContent(), /益阳/);
        await nav(page, "home");
        await nav(page, "road");
        assert.match(await page.locator("#roadDetail").textContent(), /益阳/);
        await nav(page, "craft");
        await page.locator("#cNext").click();
        assert.equal(
          await page
            .locator('.step-btn[aria-pressed="true"]')
            .getAttribute("data-i"),
          "1",
        );
        await nav(page, "home");
        await nav(page, "craft");
        assert.equal(
          await page
            .locator('.step-btn[aria-pressed="true"]')
            .getAttribute("data-i"),
          "1",
        );
      },
    );
    await check(
      "quiz completes and resets; illustration attribution is visible",
      async () => {
        await nav(page, "flower");
        assert.match(await page.locator("#view").textContent(), /不是实拍照片/);
        for (const answer of [1, 2, 1, 2, 0]) {
          await page.locator('.quiz-opt[data-i="' + answer + '"]').click();
          await page.locator("#quizNext").click();
        }
        assert.match(await page.locator("#quizBox").textContent(), /5 \/ 5/);
        await page.locator("#quizAgain").click();
        assert.equal(await page.locator(".quiz-opt").count(), 4);
      },
    );
    await check(
      "local cellar create, edit, refresh and escaped text",
      async () => {
        await nav(page, "cellar");
        await page.locator("#addLocal").click();
        await page.locator("#localName").fill("2020 年测试茯砖");
        await page.locator("#localNote").fill("<img src=x onerror=alert(1)>");
        await page.getByRole("button", { name: "保存到本机" }).click();
        assert.equal(await page.locator(".local-card").count(), 1);
        assert.equal(await page.locator(".local-card img").count(), 0);
        await page.locator("[data-edit]").click();
        await page.locator("#localQuantity").fill("2 砖");
        await page.getByRole("button", { name: "保存到本机" }).click();
        await page.reload();
        await page.locator(".local-card").waitFor();
        assert.match(await page.locator(".local-card").textContent(), /2 砖/);
      },
    );
    let backup;
    await check(
      "export, delete confirmation, import and duplicate-safe import",
      async () => {
        const download = page.waitForEvent("download");
        await page.locator("#exportLocal").click();
        const d = await download;
        const p = await d.path();
        backup = fs.readFileSync(p);
        assert.equal(JSON.parse(backup).records.length, 1);
        await page.locator("[data-delete]").click();
        await page.getByRole("button", { name: "取消", exact: true }).click();
        assert.equal(await page.locator(".local-card").count(), 1);
        await page.locator("[data-delete]").click();
        await page.locator("#confirmAction").click();
        assert.equal(await page.locator(".local-card").count(), 0);
        await page.locator("#backupFile").setInputFiles({
          name: "backup.json",
          mimeType: "application/json",
          buffer: backup,
        });
        await page.locator(".local-card").waitFor();
        await page.locator("#backupFile").setInputFiles({
          name: "backup.json",
          mimeType: "application/json",
          buffer: backup,
        });
        assert.equal(await page.locator(".local-card").count(), 1);
      },
    );
    await check("invalid backup cannot overwrite data", async () => {
      await page.locator("#backupFile").setInputFiles({
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from("{bad"),
      });
      await page.waitForFunction(() =>
        document
          .getElementById("localResult")
          .textContent.includes("导入未完成"),
      );
      assert.equal(await page.locator(".local-card").count(), 1);
    });
    await check(
      "private tasting notes and storage failure retain unsaved input",
      async () => {
        await page.locator('[data-kind="note"]').click();
        await page.locator("#addLocal").click();
        await page.locator("#localName").fill("未保存的品鉴");
        await page.evaluate(() => {
          window.originalSetItem = Storage.prototype.setItem;
          Storage.prototype.setItem = function () {
            throw new DOMException("Quota", "QuotaExceededError");
          };
        });
        await page.getByRole("button", { name: "保存到本机" }).click();
        assert.equal(await page.getByRole("dialog").count(), 1);
        assert.match(
          await page.locator("#localError").textContent(),
          /未能保存/,
        );
        assert.equal(
          await page.locator("#localName").inputValue(),
          "未保存的品鉴",
        );
        await page.evaluate(
          () => (Storage.prototype.setItem = window.originalSetItem),
        );
        await page.getByRole("button", { name: "保存到本机" }).click();
        assert.equal(await page.locator(".local-card").count(), 1);
      },
    );
    await check(
      "public community is retained without login, with honest offline state",
      async () => {
        await page.locator("#cPeek").click();
        assert.match(
          await page.locator("#peekBox").textContent(),
          /云数据库不可用/,
        );
      },
    );
    await check(
      "corrupt local data is preserved and can be recovered",
      async () => {
        await page.evaluate(() => {
          window.savedLocal = localStorage.getItem(
            "meishan-tea:local-cellar:v1",
          );
          localStorage.setItem("meishan-tea:local-cellar:v1", "broken");
          TeaUI.rerender();
        });
        assert.match(
          await page.locator("#localRecords").textContent(),
          /原数据未被覆盖/,
        );
        assert.equal(
          await page.evaluate(() =>
            localStorage.getItem("meishan-tea:local-cellar:v1"),
          ),
          "broken",
        );
        await page.evaluate(() => {
          localStorage.setItem(
            "meishan-tea:local-cellar:v1",
            window.savedLocal,
          );
          TeaUI.rerender();
        });
      },
    );
    await check(
      "offline login errors are handled without getting stuck",
      async () => {
        await page.locator("#loginBtn").click();
        await page.locator("#authEmail").fill("user@example.invalid");
        await page.locator("#authPassword").fill("password123");
        await page.locator("#authSubmit").click();
        await page.locator("#authErr:not([hidden])").waitFor();
        assert.equal(await page.locator("#authSubmit").isDisabled(), false);
        await page.keyboard.press("Escape");
      },
    );
    const cloud = await newPage(true);
    await check(
      "mock cloud note saves once, resets its form and appears in the list",
      async () => {
        await cloud.waitForFunction(() => APP.user);
        await nav(cloud, "cellar");
        await cloud.locator("#nfName").fill("云端回归测试笔记");
        await cloud.locator("#nfNote").fill("只写测试替身，不访问生产");
        await cloud.locator("#nfSubmit").click();
        await cloud.waitForFunction(() =>
          document
            .querySelector("#notesList")
            .textContent.includes("云端回归测试笔记"),
        );
        assert.equal(await cloud.locator("#nfName").inputValue(), "");
        assert.equal(
          await cloud.evaluate(() => __mock.tables.tea_notes.length),
          1,
        );
      },
    );
    await check(
      "mock cloud cellar save/reset, confirmed deletion and failed-write draft preservation",
      async () => {
        await cloud.locator('[data-tab="cellar"]').click();
        await cloud.locator("#cfName").fill("云端测试存茶");
        await cloud.locator("#cfSubmit").click();
        await cloud.waitForFunction(() =>
          document
            .querySelector("#cellarList")
            .textContent.includes("云端测试存茶"),
        );
        assert.equal(await cloud.locator("#cfName").inputValue(), "");
        await cloud.locator("#cellarList [data-del]").click();
        await cloud.locator("#confirmAction").click();
        await cloud.waitForFunction(
          () => __mock.tables.tea_cellar.length === 0,
        );
        await cloud.evaluate(() => (__mock.fail = true));
        await cloud.locator("#cfName").fill("网络失败要保留");
        await cloud.locator("#cfSubmit").click();
        await cloud.waitForFunction(
          () => !document.querySelector("#cfSubmit").disabled,
        );
        assert.equal(
          await cloud.locator("#cfName").inputValue(),
          "网络失败要保留",
        );
      },
    );
    await check(
      "failed sign-out retains session; successful sign-out clears private view",
      async () => {
        await cloud.locator("#signOutBtn").click();
        await cloud.waitForFunction(
          () => !document.querySelector("#signOutBtn").disabled,
        );
        assert.ok(await cloud.evaluate(() => APP.user));
        await cloud.evaluate(() => (__mock.fail = false));
        await cloud.locator("#signOutBtn").click();
        await cloud.locator("#localCellar").waitFor();
        assert.equal(await cloud.locator("#cellarList").count(), 0);
      },
    );
    const ai = await newPage(false);
    await check(
      "AI streaming completes, context pairs stay intact, route return retains conversation",
      async () => {
        await nav(ai, "doctor");
        await ai.waitForFunction(
          () => !document.querySelector("#docSend").disabled,
        );
        await ai.locator("#docInput").fill("介绍茯砖茶");
        await ai.locator("#docSend").click();
        await ai.waitForFunction(
          () => APP.teaChat.turns.at(-1).status === "complete",
        );
        await nav(ai, "archive");
        await nav(ai, "doctor");
        assert.match(await ai.locator("#docLog").textContent(), /这是测试回答/);
        await ai.waitForFunction(
          () => !document.querySelector("#docSend").disabled,
        );
        await ai.locator("#docInput").fill("再讲讲工艺");
        await ai.locator("#docSend").click();
        await ai.waitForFunction(
          () =>
            APP.teaChat.turns.length === 2 &&
            APP.teaChat.turns[1].status === "complete",
        );
        assert.deepEqual(
          await ai.evaluate(() => __mock.calls[1].map((m) => m.role)),
          ["system", "user", "assistant", "user"],
        );
      },
    );
    await check("Chinese IME Enter does not prematurely submit", async () => {
      const count = await ai.evaluate(() => __mock.calls.length);
      await ai.locator("#docInput").fill("拼音输入中");
      await ai
        .locator("#docInput")
        .dispatchEvent("keydown", { key: "Enter", isComposing: true });
      assert.equal(await ai.evaluate(() => __mock.calls.length), count);
    });
    await check(
      "AI reset ignores late deltas from old request and unlocks new conversation",
      async () => {
        await ai.evaluate(() => (__mock.streamMode = "slow"));
        await ai.locator("#docInput").fill("慢请求");
        await ai.locator("#docSend").click();
        await ai.locator("#docReset").click();
        await ai.waitForTimeout(280);
        assert.equal(await ai.evaluate(() => APP.teaChat.turns.length), 0);
        assert.doesNotMatch(
          await ai.locator("#docLog").textContent(),
          /旧请求迟到内容/,
        );
        assert.equal(await ai.locator("#docSend").isDisabled(), false);
      },
    );
    await check("AI stop and route change cancel stale streams", async () => {
      await ai.locator("#docInput").fill("停止请求");
      await ai.locator("#docSend").click();
      await ai.locator("#docStop").click();
      assert.equal(await ai.locator("#docSend").isDisabled(), false);
      await ai.locator("#docInput").fill("离开页面请求");
      await ai.locator("#docSend").click();
      await nav(ai, "home");
      await ai.waitForTimeout(280);
      await nav(ai, "doctor");
      assert.doesNotMatch(
        await ai.locator("#docLog").textContent(),
        /旧请求迟到内容/,
      );
      assert.ok(
        await ai.evaluate(() =>
          APP.teaChat.turns.every((t) => t.status === "stopped"),
        ),
      );
    });
    await check(
      "AI errors restore question and never leave send disabled",
      async () => {
        await ai.evaluate(() => (__mock.streamMode = "error"));
        await ai.waitForFunction(
          () => !document.querySelector("#docSend").disabled,
        );
        await ai.locator("#docInput").fill("失败保留问题");
        await ai.locator("#docSend").click();
        await ai.waitForFunction(
          () => APP.teaChat.turns.at(-1).status === "error",
        );
        assert.equal(
          await ai.locator("#docInput").inputValue(),
          "失败保留问题",
        );
        assert.equal(await ai.locator("#docSend").isDisabled(), false);
      },
    );
    await check(
      "cloud SDK load failure does not block local pages or archive filtering",
      async () => {
        const ctx = await browser.newContext();
        await ctx.route("**/*", (r) => {
          const url = r.request().url();
          if (new URL(url).pathname.endsWith("/js/config.js"))
            return r.fulfill({
              contentType: "application/javascript",
              body: fs
                .readFileSync(path.join(ROOT, "js/config.js"), "utf8")
                .replace(/mode:\s*["']auto["']/, 'mode: "enabled"'),
            });
          if (
            !url.startsWith(base + "/") ||
            url.includes("/vendor/workbuddy-cloud-sdk/")
          )
            return r.abort();
          return r.continue();
        });
        const p = await ctx.newPage();
        await p.goto(base + "/#/archive");
        await p.getByRole("button", { name: "三尖", exact: true }).click();
        assert.equal(await p.locator(".tea-card").count(), 3);
        await ctx.close();
      },
    );
    await check(
      "no uncaught browser exceptions or production requests",
      async () => {
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
      },
    );
    await check(
      "standalone file opens without external assets and local cellar works",
      async () => {
        const ctx = await browser.newContext({
          viewport: { width: 390, height: 844 },
          reducedMotion: "reduce",
        });
        const requests = [];
        await ctx.route("**/*", (r) => {
          if (/^https?:/.test(r.request().url())) {
            requests.push(r.request().url());
            return r.abort();
          }
          return r.continue();
        });
        const p = await ctx.newPage();
        p.on("pageerror", (e) => errors.push(e.message));
        await p.goto("file://" + path.join(ROOT, "离线体验.html"));
        await p.evaluate(() => document.fonts.ready);
        assert.equal(await p.locator(".home-hero").count(), 1);
        assert.equal(
          await p
            .locator(".hero-landscape img")
            .evaluate((n) => n.complete && n.naturalWidth > 0),
          true,
        );
        await nav(p, "cellar");
        await p.locator("#addLocal").click();
        await p.locator("#localName").fill("单文件体验记录");
        await p.getByRole("button", { name: "保存到本机" }).click();
        assert.equal(await p.locator(".local-card").count(), 1);
        assert.deepEqual(requests, []);
        assert.deepEqual(errors, []);
        await ctx.close();
      },
    );
    const failed = results.filter((r) => !r.passed).length;
    fs.writeFileSync(
      path.join(OUT, "results.json"),
      JSON.stringify(
        {
          browser: browser.version(),
          date: new Date().toISOString(),
          scope:
            "local Chromium with blocked external network; cloud services mocked",
          total: results.length,
          passed: results.length - failed,
          failed,
          results,
        },
        null,
        2,
      ),
    );
    process.exitCode = failed ? 1 : 0;
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
