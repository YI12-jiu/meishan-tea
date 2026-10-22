/* Exercise the unmodified, vendored SDK against a local HTTP protocol fixture.
 * No SDK stubs, production requests, real email delivery, or paid model calls. */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..");
const OUT = process.env.TEST_OUTPUT || path.join(ROOT, "test-results");
const results = [],
  calls = [],
  errors = [],
  external = [];
let base,
  existing = true,
  rejectLogin = false,
  rejectLogout = false;
let modelMode = "normal",
  streamMode = "normal",
  streamClosed = false;
const session = {
  access_token: "fixture-access",
  refresh_token: "fixture-refresh",
  expires_in: 3600,
  sub: "fixture-user",
  name: "测试茶友",
};
function json(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, base);
  if (url.pathname.startsWith("/.cloud/")) {
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = text ? JSON.parse(text) : null;
    calls.push({
      path: url.pathname,
      query: url.search,
      method: req.method,
      headers: req.headers,
      body,
    });
    if (req.headers["x-wb-webapp-access-key"] !== "wbpk_local_protocol_fixture")
      return json(res, { message: "missing fixture key" }, 403);
    switch (url.pathname) {
      case "/.cloud/auth/v1/signin":
        return rejectLogin
          ? json(
              res,
              { error: "invalid_grant", message: "invalid credentials" },
              401,
            )
          : json(res, session);
      case "/.cloud/auth/v1/signup":
        return json(res, session);
      case "/.cloud/auth/v1/token":
        return json(res, session);
      case "/.cloud/auth/v1/verification":
        return json(res, {
          verification_id: "fixture-verification",
          is_user: existing,
        });
      case "/.cloud/auth/v1/verification/verify":
        return json(res, { verification_token: "fixture-verification-token" });
      case "/.cloud/auth/v1/reset":
        return json(res, {});
      case "/.cloud/auth/v1/user/signout":
        return json(
          res,
          rejectLogout ? { message: "temporary backend failure" } : {},
          rejectLogout ? 503 : 200,
        );
      case "/.cloud/llm/models":
        return json(res, {
          data:
            modelMode === "empty"
              ? [{ id: "off", enabled: false }]
              : [
                  {
                    id: "off",
                    name: "不可用",
                    enabled: false,
                    isDefault: true,
                  },
                  { id: "fallback", name: "备用模型", enabled: true },
                  {
                    id: "preferred",
                    name: "默认模型",
                    enabled: true,
                    isDefault: true,
                  },
                  { id: "disabled", name: "已停用", disabled: true },
                ],
        });
      case "/.cloud/llm/chat/completions": {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        });
        const delta = (text) =>
          "data: " +
          JSON.stringify({ choices: [{ delta: { content: text } }] }) +
          "\n\n";
        res.write(delta("这是一段茶文化回答。"));
        if (streamMode === "slow") {
          streamClosed = false;
          res.on("close", () => {
            streamClosed = true;
          });
          return;
        }
        if (streamMode !== "interrupted") res.write("data: [DONE]\n\n");
        return res.end();
      }
      case "/.cloud/database/rest/tea_archives":
        return json(res, []);
      case "/.cloud/database/rest/tea_notes":
      case "/.cloud/database/rest/tea_cellar":
        if (req.method === "POST")
          return json(
            res,
            [{ ...body, id: "fixture-row", owner_id: "fixture-user" }],
            201,
          );
        return json(res, []);
      default:
        return json(res, { message: "Unhandled fixture endpoint" }, 404);
    }
  }
  const target = path.resolve(
    ROOT,
    "." +
      decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
  );
  if (!target.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (url.pathname === "/js/config.js") {
    res.writeHead(200, { "Content-Type": "application/javascript" });
    return res.end(
      fs
        .readFileSync(target, "utf8")
        .replace(/endpoint:\s*"[^"]+"/, "endpoint: " + JSON.stringify(base))
        .replace(
          /publishableKey:\s*"[^"]+"/,
          'publishableKey: "wbpk_local_protocol_fixture"',
        ),
    );
  }
  fs.readFile(target, (e, data) => {
    res.writeHead(e ? 404 : 200, {
      "Content-Type":
        {
          ".js": "application/javascript",
          ".css": "text/css",
          ".html": "text/html; charset=utf-8",
          ".woff2": "font/woff2",
          ".svg": "image/svg+xml",
          ".jpg": "image/jpeg",
        }[path.extname(target)] || "application/octet-stream",
    });
    res.end(e ? "Not found" : data);
  });
});
async function check(name, run) {
  try {
    await run();
    results.push({ name, passed: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, passed: false, error: e.message });
    console.error("FAIL", name, e.message);
  }
}
async function main() {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: process.env.CHROMIUM_ARGS
      ? JSON.parse(process.env.CHROMIUM_ARGS)
      : ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  async function newPage(hash = "home") {
    const ctx = await browser.newContext();
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
      return route.continue();
    });
    const p = await ctx.newPage();
    p.setDefaultTimeout(6000);
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base + "/#/" + hash);
    await p.waitForFunction(() => APP.authReady);
    assert.equal(await p.evaluate(() => TeaCloud.available()), true);
    return p;
  }
  const last = (suffix) => calls.findLast((c) => c.path.endsWith(suffix));
  async function openAuth(p, mode) {
    await p.locator("#loginBtn").click();
    if (mode === "reset") await p.locator("#forgotPassword").click();
    else if (mode && mode !== "login")
      await p.locator('[data-mode="' + mode + '"]').click();
    await p.locator("#authEmail").fill("fixture@example.invalid");
  }
  async function sentOtp(p) {
    await p.locator("#authSend").click();
    await p.waitForFunction(() =>
      document.querySelector("#authHint").textContent.includes("验证码已发送"),
    );
    await p.locator("#authCode").fill("123456");
  }
  async function loggedIn(p) {
    await p.locator("#signOutBtn").waitFor();
    await p.waitForFunction(() => !document.querySelector("#authForm"));
  }
  try {
    await check(
      "real SDK password login, persisted session and logout",
      async () => {
        const p = await newPage();
        await openAuth(p, "login");
        await p.locator("#authPassword").fill("FixturePassword123");
        await p.locator("#authSubmit").click();
        await loggedIn(p);
        assert.deepEqual(last("/v1/signin").body, {
          username: "fixture@example.invalid",
          password: "FixturePassword123",
        });
        assert.equal(await p.evaluate(() => APP.user.id), "fixture-user");
        await p.reload();
        await p.locator("#signOutBtn").waitFor();
        await p.locator("#signOutBtn").click();
        await p.locator("#loginBtn").waitFor();
        assert.equal(
          last("/v1/user/signout").headers.authorization,
          "Bearer fixture-access",
        );
        await p.reload();
        await p.waitForFunction(() => APP.authReady);
        assert.equal(await p.evaluate(() => APP.user), null);
        await p.context().close();
      },
    );
    await check(
      "real SDK invalid credentials show useful error and allow retry",
      async () => {
        rejectLogin = true;
        const p = await newPage();
        await openAuth(p, "login");
        await p.locator("#authPassword").fill("WrongPassword123");
        await p.locator("#authSubmit").click();
        await p.locator("#authErr:not([hidden])").waitFor();
        assert.match(await p.locator("#authErr").textContent(), /凭据无效/);
        assert.equal(await p.locator("#authSubmit").isEnabled(), true);
        assert.equal(await p.evaluate(() => APP.user), null);
        rejectLogin = false;
        await p.locator("#authSubmit").click();
        await loggedIn(p);
        await p.context().close();
      },
    );
    await check(
      "real SDK existing-user OTP exchanges verification token for session",
      async () => {
        existing = true;
        const p = await newPage();
        await openAuth(p, "otp");
        await sentOtp(p);
        assert.equal(await p.locator("#passwordField").isHidden(), true);
        assert.deepEqual(last("/v1/verification").body, {
          email: "fixture@example.invalid",
          usage: "email",
        });
        await p.locator("#authSubmit").click();
        await loggedIn(p);
        assert.deepEqual(last("/v1/verification/verify").body, {
          verification_id: "fixture-verification",
          verification_code: "123456",
        });
        assert.deepEqual(last("/v1/signin").body, {
          username: "fixture@example.invalid",
          verification_token: "fixture-verification-token",
        });
        await p.context().close();
      },
    );
    await check(
      "real SDK new-user OTP requires password and uses signup endpoint",
      async () => {
        existing = false;
        const p = await newPage();
        await openAuth(p, "otp");
        await sentOtp(p);
        assert.equal(await p.locator("#passwordField").isVisible(), true);
        assert.equal(
          await p.locator("#authPassword").getAttribute("required"),
          "",
        );
        await p.locator("#authPassword").fill("NewPassword123");
        await p.locator("#authSubmit").click();
        await loggedIn(p);
        assert.deepEqual(last("/v1/signup").body, {
          email: "fixture@example.invalid",
          password: "NewPassword123",
          verification_token: "fixture-verification-token",
        });
        await p.context().close();
        existing = true;
      },
    );
    await check(
      "real SDK reset-password handle verifies, resets and logs in",
      async () => {
        const p = await newPage();
        await openAuth(p, "reset");
        await sentOtp(p);
        assert.deepEqual(last("/v1/verification").body, {
          email: "fixture@example.invalid",
          usage: "PASSWORD_RESET",
          target: "USER",
        });
        await p.locator("#authPassword").fill("ResetPassword123");
        await p.locator("#authSubmit").click();
        await loggedIn(p);
        assert.deepEqual(last("/v1/reset").body, {
          email: "fixture@example.invalid",
          new_password: "ResetPassword123",
          verification_token: "fixture-verification-token",
        });
        assert.equal(last("/v1/signin").body.password, "ResetPassword123");
        await p.context().close();
      },
    );
    await check(
      "real SDK local logout succeeds even when revoke endpoint fails",
      async () => {
        const p = await newPage();
        await openAuth(p, "login");
        await p.locator("#authPassword").fill("FixturePassword123");
        await p.locator("#authSubmit").click();
        await loggedIn(p);
        rejectLogout = true;
        await p.locator("#signOutBtn").click();
        await p.locator("#loginBtn").waitFor();
        await p.reload();
        await p.waitForFunction(() => APP.authReady);
        assert.equal(await p.evaluate(() => APP.user), null);
        rejectLogout = false;
        await p.context().close();
      },
    );
    await check(
      "real SDK filters disabled models and selects backend default",
      async () => {
        const p = await newPage("doctor");
        await p.waitForFunction(
          () => !document.querySelector("#docSend").disabled,
        );
        assert.deepEqual(
          await p
            .locator("#docModel option")
            .evaluateAll((opts) => opts.map((o) => o.value)),
          ["fallback", "preferred"],
        );
        assert.equal(await p.locator("#docModel").inputValue(), "preferred");
        await p.locator("#docInput").fill("讲讲安化黑茶");
        await p.locator("#docSend").click();
        await p.waitForFunction(
          () => APP.teaChat.turns.at(-1)?.status === "complete",
        );
        assert.equal(last("/llm/chat/completions").body.model, "preferred");
        assert.equal(last("/llm/chat/completions").body.stream, true);
        assert.match(
          last("/llm/chat/completions").headers["x-conversation-id"],
          /^tea-/,
        );
        await p.context().close();
      },
    );
    await check(
      "real SDK interrupted SSE keeps partial response and restores question",
      async () => {
        streamMode = "interrupted";
        const p = await newPage("doctor");
        await p.waitForFunction(
          () => !document.querySelector("#docSend").disabled,
        );
        await p.locator("#docInput").fill("断流后还保留吗");
        await p.locator("#docSend").click();
        await p.waitForFunction(
          () => APP.teaChat.turns.at(-1)?.status === "error",
        );
        assert.match(
          await p.locator("#docLog").textContent(),
          /这是一段茶文化回答/,
        );
        assert.match(await p.locator("#docLog").textContent(), /回答中途断开/);
        assert.equal(
          await p.locator("#docInput").inputValue(),
          "断流后还保留吗",
        );
        await p.context().close();
        streamMode = "normal";
      },
    );
    await check(
      "real SDK stop aborts the HTTP stream and leaves a stopped turn",
      async () => {
        streamMode = "slow";
        const p = await newPage("doctor");
        await p.waitForFunction(
          () => !document.querySelector("#docSend").disabled,
        );
        await p.locator("#docInput").fill("停止这次回答");
        await p.locator("#docSend").click();
        await p.waitForFunction(() => APP.teaChat.turns.at(-1)?.a.length > 0);
        await p.locator("#docStop").click();
        assert.equal(
          await p.evaluate(() => APP.teaChat.turns.at(-1).status),
          "stopped",
        );
        await p.waitForFunction(
          () => !document.querySelector("#docSend").disabled,
        );
        // Browser connection close is observable at the local HTTP fixture.
        for (let i = 0; !streamClosed && i < 40; i++)
          await new Promise((r) => setTimeout(r, 50));
        assert.equal(streamClosed, true);
        await p.context().close();
        streamMode = "normal";
      },
    );
    await check(
      "real SDK no enabled models keeps sending unavailable",
      async () => {
        modelMode = "empty";
        const p = await newPage("doctor");
        await p.waitForFunction(() =>
          document.querySelector("#docNotice").textContent.includes("没有可用"),
        );
        assert.equal(await p.locator("#docSend").isDisabled(), true);
        await p.context().close();
        modelMode = "normal";
      },
    );
    await check(
      "real SDK database builder sends query filters and bearer session",
      async () => {
        const p = await newPage();
        await openAuth(p, "login");
        await p.locator("#authPassword").fill("FixturePassword123");
        await p.locator("#authSubmit").click();
        await loggedIn(p);
        const result = await p.evaluate(async () => {
          const rows = await TeaCloud.query(() =>
            TeaCloud.from("tea_cellar").select("*").eq("owner_id", APP.user.id),
          );
          const saved = await TeaCloud.query(
            () =>
              TeaCloud.from("tea_cellar")
                .insert({ tea_name: "协议测试" })
                .select(),
            true,
          );
          return { rows, saved };
        });
        assert.equal(result.rows.error, null);
        assert.equal(result.saved.data[0].tea_name, "协议测试");
        const reads = calls.filter(
          (c) => c.path.endsWith("/tea_cellar") && c.method === "GET",
        );
        assert.match(reads.at(-1).query, /owner_id=eq.fixture-user/);
        assert.equal(
          last("/tea_cellar").headers.authorization,
          "Bearer fixture-access",
        );
        await p.context().close();
      },
    );
    await check(
      "vendored SDK uses only local network without browser exceptions",
      async () => {
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        assert.ok(calls.length > 20);
      },
    );
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(
      path.join(OUT, "sdk-results.json"),
      JSON.stringify(
        {
          sdkVersion: "0.1.3-dev.c090db7.202610050023",
          transport: "local HTTP fixture",
          productionRequests: 0,
          results,
        },
        null,
        2,
      ),
    );
  }
  if (results.some((r) => !r.passed)) process.exitCode = 1;
}
main().catch((e) => {
  console.error(e);
  server.closeAllConnections();
  server.close();
  process.exitCode = 1;
});
