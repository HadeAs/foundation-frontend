# 本次前端接口变更

版本：`1.0.0-f9de52bd8a4d`

## 新增接口

无。

## 修改接口

### `GET /api/v1/monitor/logs/api`

响应 `data.records[]` 新增可选字段：

- `requestContentType: string`：请求体媒体类型。
- `requestBody: string`：脱敏后的 JSON 或表单请求体。

### `GET /api/v1/monitor/logs/operation`

响应 `data.records[]` 新增可选字段：

- `queryString: string`：脱敏后的查询参数。
- `requestContentType: string`：请求体媒体类型。
- `requestBody: string`：脱敏后的 JSON 或表单请求体。

字段语义调整：

- `message`：HTTP 状态码不小于 400 时返回失败说明，不再返回 `ok`。

### `POST /api/v1/system/async-tasks`

- 当 `taskType=EXPORT_OPERATION_LOG` 时，导出的 CSV 新增 `queryString` 列；请求和响应字段不变。

`requestBody` 仅记录 `POST`、`PUT`、`PATCH`、`DELETE` 的 JSON 或表单内容；敏感路径不记录，敏感字段替换为 `[REDACTED]`，超过 8 KiB 时返回未记录提示文本。

## 废弃接口

无。
