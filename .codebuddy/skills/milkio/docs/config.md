# Config

## 基于环境的 Config 文件

在 Milkio 中，Config 文件名即环境声明——不同环境的配置通过不同文件区分，而非写在同一个文件里。

| 文件名                  | 生效环境 | 说明                 |
| ----------------------- | -------- | -------------------- |
| `common.config.ts`      | 所有环境 | 通用配置，优先级最低 |
| `test.config.ts`        | 测试环境 | 仅测试环境生效       |
| `{mode}.config.ts`      | 对应模式 | 仅对应 Cookbook 模式生效 |

`common.config.ts` 优先级最低，当与其他环境配置存在同名键时，会被覆盖。

### 模式与文件名对应关系

项目通过 `COOKBOOK_MODE` 环境变量区分不同运行模式，配置文件名与模式名严格对应。例如：

| COOKBOOK_MODE 值 | 对应的配置文件名 |
| ----------------- | ---------------- |
| `test` | `test.config.ts` |
| `dvlp-zh-cn` | `dvlp-zh-cn.config.ts` |
| `dvlp-en` | `dvlp-en.config.ts` |
| `prod-zh-cn` | `prod-zh-cn.config.ts` |
| `prod-en` | `prod-en.config.ts` |

即：如果你要为 `dvlp-zh-cn` 模式编写专属配置，就创建 `dvlp-zh-cn.config.ts`；为 `prod-en` 编写，就创建 `prod-en.config.ts`。文件名就是模式名加 `.config.ts`。

## 编辑配置

### 全局配置

全局配置文件位于项目根目录的 `configs/` 目录下。

```typescript
// /configs/common.config.ts
import { config } from 'milkio';
export default config(() => ({
    database: {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '<PASSWORD>',
    },
}));
```

### 模块内配置

Milkio 支持在**任意模块内**定义专属的 Config 文件，这些配置会被自动加载。这样做的好处是：配置的作用域清晰可见——哪些配置只属于这个模块一目了然，更便于拆分与重构。

模块配置文件位于模块目录下的 `$configs/` 目录下。

**示例：**
```typescript
// /app/modules/shop/$configs/common.config.ts
import { config } from 'milkio';

export default config(() => ({
    shopFileUpload: {
        pageSize: 20,
        maxUploadSize: 10 * 1024 * 1024, // 10MB
        allowedFileTypes: ['jpg', 'png', 'gif', 'webp'],
    }
}));
```

注意，配置最好只导出一个对象，不要导出很多个宽泛的名称，很容易造成相互覆盖。

## 在代码中访问配置

在 Milkio 的 handler、action 等文件中，通过 `context.config` 访问配置。

### 在 Handler 中使用配置：

```typescript
// /app/modules/shop/$handlers/handle-order.handler.ts
import type { MilkioWorld } from 'milkio';
import type { generated } from '../../../../.milkio/index.ts';

export default (world: MilkioWorld<typeof generated>) => {
  world.on('order:validate', async ({ data, tx, context, fromModule }) => {
    if (fromModule !== 'shop') return;

    if (data.attachmentSize > context.config.shopFileUpload.maxUploadSize) {
      context.logger.error('附件大小超出限制', JSON.stringify({ size: data.attachmentSize, max: context.config.shopFileUpload.maxUploadSize }));
      throw context.reject('FILE_TOO_LARGE', undefined);
    }

    if (data.attachmentType && !context.config.shopFileUpload.allowedFileTypes.includes(data.attachmentType)) {
      context.logger.error('不支持的文件类型', JSON.stringify({ type: data.attachmentType }));
      throw context.reject('INVALID_FILE_TYPE', undefined);
    }

    // ... 更多代码
  });
};
```

### 在 Action 中使用配置：

```typescript
// /app/modules/shop/actions/list-products.action.ts
import { action } from 'milkio';

export default action({
  async handler(context) {
    // 访问全局配置
    const baseUrl = context.config.baseUrl;

    // 访问模块配置
    const pageSize = context.config.pageSize;

    return {
      baseUrl,
      pageSize,
    };
  },
});
```

## .env 文件

某些运行时支持 `.env` 文件自动加载环境变量，例如 Bun。

但 `.env` 缺乏类型定义，无法直观看出项目依赖哪些变量。因此，`.env` 的定位应是 config 的上游——环境变量提供原始值，config 负责类型化与默认值兜底。

```typescript
// 在 config 中使用环境变量
baseUrl: env.BASE_URL ?? 'http://localhost'
```

若环境变量未设置，则使用配置中的默认值。

## 重要注意事项

1. **不要直接导入配置文件**：始终通过 `context.config` 访问配置，以确保配置的正确合并与类型安全
2. **类型安全**：Milkio 会自动为配置生成类型，你可以获得完整的 TypeScript 类型提示
3. **配置文件位置**：全局配置在 `configs/`，模块配置在模块的 `$configs/` 目录
4. **命名规范**：配置文件必须以 `.config.ts` 结尾
5. **不要在配置文件外部硬编码配置数据**
