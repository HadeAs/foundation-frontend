# 项目协作约定

## 文档与设计同步

- 项目文档目录是 `doc/`，不要另建 `docs/` 存放重复规范。
- 开发前阅读 `doc/SPEC.md`；涉及页面原型或统一样式时，同时阅读 `doc/PROTOTYPE_DESIGN_GUIDE.md` 与对应原型 `interaction-spec.md`。
- 后续新增、变更、取消功能时，必须在同一轮交付内同步更新 SPEC 的对应正文、验收场景及待确认项；不能仅在聊天或变更日志中记录。
- 原型交互变化同步页面说明；全局风格变化同步设计指南；局部例外明确范围。更新日期，清除过时冲突规则，文档与代码一起提交。
- 区分已确认业务、原型演示、正式实现和接口待确认项；不得编造接口契约或把模拟反馈当成真实功能。
- 用户自行进行真实浏览器验证。未经用户重新明确要求，不运行 Playwright 或其他真实浏览器自动化；可做静态、单元及本地 DOM 检查，并准确说明验证范围。

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
