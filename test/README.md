# 浏览器验证

## 默认验证（不访问真实云端）

安装 Node.js 22+，在项目目录运行：

```bash
npm ci
npx playwright install chromium
npm test
```

脚本启动仅绑定 `127.0.0.1` 的临时静态服务器，自动启动 Chromium。覆盖四种视口宽度（1440、768、390、320），实际点击七个路由与关键交互。23 项页面检查结果写入 `test-results/results.json`；桌面与手机截图写在同目录。

本机功能直接使用真实浏览器存储和下载能力。`e2e-local.cjs` 中云登录、数据库、模型通过 SDK 替身验证页面逻辑。

`e2e-sdk.cjs` 直接加载 `vendor/` 内未修改的真实 SDK，通过本地 HTTP fixture 返回后端原始 JSON/SSE，补充 12 项协议检查：密码登录与会话恢复、错误重试、已有用户 OTP、新用户 OTP 注册、重置密码、远端退出失败时本地会话清理、停用模型筛选与默认模型、完整 SSE、异常断流、HTTP 取消、无模型降级、数据库过滤与 Bearer 标头。结果写入 `test-results/sdk-results.json`。

两组测试均阻断外部请求，不能用这个结果证明真实邮箱投递、线上模型生成或行级权限已经通过验收。测试凭据仅用于本地 fixture，不是真实账号。

特殊环境可设置 `CHROMIUM_EXECUTABLE_PATH` 指向可用 Chromium，`CHROMIUM_ARGS` 为启动参数 JSON 数组，`TEST_OUTPUT` 指定输出目录。这些变量只影响测试，不进入应用。

## 历史云端探针

保留 `e2e-check.js`，但它会调用模型、尝试匿名写入，属于**有副作用的测试**。现已取消默认生产地址，必须明确指定隔离测试环境：

```bash
SITE_URL=https://your-isolated-test-host.example \
ALLOW_MUTATION_TESTS=true \
CDP_PORT=9444 \
node test/e2e-check.js
```

还需要自行启动带该 CDP 端口的独立浏览器配置。这个脚本不是日常本地验证入口，也不能在没有隔离测试表/测试账号的情况下作为生产检查运行。

权限测试中的网络异常和未知错误现在计为未通过，不再把“任何报错”都当作权限隔离成功。若写入探针意外成功，测试会失败，需要维护者检查并清理该次测试记录；名为 cleanup 的历史检查仅检查残留，不执行删除。

可用 `npm run test:local` 或 `npm run test:sdk` 分别执行两组。修改应用源码后用 `npm run build:offline` 重新生成独立体验文件。
