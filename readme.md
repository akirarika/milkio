# Modexie (尚在开发阶段)

简体中文 | [English](./readme_en.md)

一个简单实用的 IndexedDB ORM 库，并用你最爱的 [Dexie.js](https://dexie.org/) 来写增删改查🎉

## 为什么要用 IndexedDB 与 Modexie？

### 为什么要用 IndexedDB？

1. 足够可靠的前端本地存储解决方案。

2. 可以存入 JavaScript 对象、巨量文本和图片视频等二进制数据，且理论上[没有容量和存储时间限制](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Browser_storage_limits_and_eviction_criteria)

3. 支持索引，可以保证海量内容下的搜索速度，支持事务，LocalStorage 修改多个值时一致性是无法保证的。

### 为什么要用 Modexie？

Modexie 为 IndexedDB 提供了模型、模型关联、迁移、填充等后端语言 ORM 库的功能，和视图模型绑定功能