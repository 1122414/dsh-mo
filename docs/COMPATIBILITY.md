# DSH 接入契约与验收

## 接入依据（2026-10-19 检查）

本项目按 DeepSeek 官方仓库当前公开接口编写，**未声明一个尚未实际运行过的 DSH release 版本已兼容**。代码搜索快照为 `687f282e8625c6b8d11ff58211a90524be2e4317`；读取 master 时核对了以下文件 blob。

| 官方来源 | 已核对契约 | blob SHA |
|---|---|---|
| [ui-session](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-session/src/client/index.ts) | `ctx.uiSession.sessionStatus`，`getSnapshot/subscribe`；Map 中的 `running` 与 `pendingInteraction` | `29aeebce04d4c0e2c54236a92ce30a4fb0df1520` |
| [connection](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/connection/src/client/index.ts) | `ctx.connection.generation` 可观察来源；undefined 代表未就绪或断开 | `95d83f59fefed69fb2631d2e6308a0b235e8b1cb` |
| [Client Modules](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/client-modules.md) | `dsh.client` 包依赖声明、`exports["./client"]`、ModuleLoader | `0f9bb5b06859751a846408a40169e3d905a41ec1` |

`dsh.client.inject` 填包名；客户端导出 `inject` 填服务名 `uiSession` / `connection`。两者不要混淆。Host 入口仅让包进入加载图，不注册任何能力。

## 为什么不只读 running

官方 [Agent 说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/agent/README.md) 指出，等待授权和问题回答的 turn 仍可以是 running。统一 UI 状态的 pendingInteraction 优先于 running。不能用「历史上有未回答问题」替代「当前正在等待」，因为 timed question 可能已经让 Agent 继续工作。

映射顺序：

1. 连接无 generation 或重连后尚无新状态：停止。
2. 状态不是符合结构的 Map：报错并停止。
3. pendingInteraction 存在：waiting。
4. running 严格为 true：running；false：idle；其余：unknown。

不读消息文本、不拦截提问/授权 waterfall、不替用户确认、不发工具调用。旧 DSH 缺少依赖服务时插件可能不能激活；未进行未证实的字段回退。

## 验证等级

| 层级 | 本次结果 |
|---|---|
| TypeScript 严格编译 | 通过 |
| 计时、计算、存储、适配契约、构建 VM 测试 | 43/43 通过 |
| Chromium 离线 DOM 夹具 | 8/8 通过；显式模拟 Storage 与 Locks |
| 真浏览器 localhost + 同源多标签页 | 未完成：当前执行环境策略阻止 localhost 导航 |
| 实际 DSH Web 安装与状态事件 | 未执行 |
| Electron Desktop 安装、卸载和持久化 | 未执行 |

测试替身证明的是插件对已核对契约的行为，不证明某台机器的 DSH 实际注入了这些服务。离线 DOM 测试也不能证明真实浏览器锁、公用 localStorage 或后台节流策略。

## 本机验收清单

- [ ] 在测试 Harness home 安装插件，boot graph 包含 `dsh-mo`，卡片可见，无红色插件诊断。
- [ ] 记录当前 `dsh --version`、操作系统、浏览器版本及 Web/Desktop profile。
- [ ] 第一次打开未保存设置不计量；保存后短于 5 秒任务为 0。
- [ ] 用真实长任务核对前 5 秒不计，连续工具调用不重置。
- [ ] 提问、工具执行授权、计划确认期间停止，回复后重新等待 5 秒。
- [ ] 两个真实会话并行、切换当前会话，重叠时间只计算一次。
- [ ] 断网、Host 重启、页面刷新、浏览器休眠后不补算未知区间。
- [ ] 同源打开第二标签页只读，关闭记录页后第二页接管；不双写也不清空已有记录。
- [ ] 午休、非工作日和跨午夜只按对应当地日期与班次计费。
- [ ] 设置错误显示提示；存储损坏保留原值，能导出；重置需要确认。
- [ ] 卸载/热替换移除卡片、计时器和订阅，不影响 Agent。

跨设备、多个浏览器或不同端口分别记录，**不提供跨设备去重保证**。Desktop 的安装应走应用自带插件管理器，不用外部 CLI 重写应用管理的包树。
