# 介绍

## Kurimudb 是什么

Kurimudb 是一款渐进式的 **Web 端本地存储库**，可将数据保存到 LocalStorage、IndexedDB、Cookie 等地方，和订阅值的变更。

除了持久化数据之外，若你愿意，Kurimudb 还能成为你应用的 [Model 层](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel#Components_of_MVVM_pattern) 抽象，接任你应用中状态管理库的职责 (如 Vuex、Redux、Mobx)，使你应用真正拥有单一数据来源。

Kurimudb 是驱动化的，这意味着你可以几乎不更改代码的情况下更换具体实现。我们提供了 `Cookie` `LocalStorage` 和 `Dexie (IndexedDB)` 三种驱动。如果不满足你的需求，你还可以编写自己的驱动实现。

# 文档

你可以[点击这里](https://kurimudb.nito.ink/)来阅读文档。

# 后续计划

- [x] 为文档网站做一个首页

- [ ] LocalStorage 驱动可以使用 `all` 函数

- [ ] 批量订阅功能无需手动声明要订阅的值，而是自动推断

- [ ] 编写一个不依赖 Dexie 的轻量级 IndexedDB 驱动 (现有 Dexie 驱动会继续保留，也不会停止维护)

- [ ] 做一个 Nodejs 驱动，可以存储 json 数据和 blob 对象，用于 electron 之类的场景

- [ ] （待定）加入适配微信小程序和 uniapp 驱动

- [ ] 备用驱动功能，指定一个驱动数组，若数组中靠前的驱动在当前环境下不可使用，则使用靠后的驱动作为替代（为了保持数据一致性，具体使用的驱动，会在用户首次使用时指定，即使后续此用户的环境支持了排名靠前的驱动（如使用新浏览器），也依然会保持当前所使用的驱动））

- [ ] （待定）加入对服务端渲染的资瓷，服务端中添加的数据，会在用户访问页面后存储到浏览器里

- [ ] 国际化
