# Benchmark 基准测试

对比 milkio、Elysia、Koa、NestJS 四个框架在 JSON API 场景下的性能表现。

## 目录结构

```
benchmark/
├── __TEST__.test.ts              # 测试编排器（启动/停止服务器、运行基准）
├── json.action.ts                # milkio benchmark 端点
├── milkio-prod.ts                # milkio 生产模式服务器（端口 19000）
├── utils/
│   └── report.ts                 # 报告格式化 & 对比表格
└── $frameworks/
    ├── package.json              # 框架依赖（elysia, koa, @nestjs/*）
    ├── elysia/server.ts          # Elysia 服务器（端口 19001）
    ├── koa/server.ts             # Koa 服务器（端口 19002）
    └── nest/server.ts            # NestJS 服务器（端口 19003）
```

## 运行

```bash
# 在 projects/test 目录执行
npx vitest run app/modules/benchmark/__TEST__.test.ts
```

`co test` 会跳过本文件（`describe.skip`），避免基准测试在常规 CI 中启动外部服务器。

测试会自动：
1. 安装框架依赖（首次运行）
2. 构建 milkio（生成 .milkio 声明文件）
3. 启动全部 4 个服务器（端口 19000-19003）
4. 预热所有框架（10 次请求）
5. 在 4 个并发级别（C1/C10/C50/C100）下各发送 1000 次 POST 请求
6. 输出单框架报告 + 最终对比排名表
7. 停止所有服务器

## 测试维度

| 维度 | 方法 | 端点 | 负载 |
|------|------|------|------|
| JSON POST | POST | `/benchmark/json` | `{ a: 1, b: 2 }` → `{ result: 3 }` |

## 并发级别

- C1：测纯延迟
- C10：低并发
- C50：中并发
- C100：高并发

## 公平性保障

- 所有框架实现相同的 JSON echo 端点
- 测试前统一预热（JIT 编译、连接池初始化）
- 每个并发级别单独预热 5 次
- 统一的 fetch 客户端、批次并发控制
- milkio 使用生产模式（非 vite dev），端口 19000
- 其他框架同样独立端口、独立进程
