module.exports = {
  title: "Kurimudb",
  head: [["link", { rel: "icon", href: "favicon.png" }]],
  markdown: {
    lineNumbers: true,
  },
  locales: {
    "/": {
      lang: "zh-CN",
      title: "Kurimudb",
      description: "Just playing around.",
    },
    "/en/": {
      lang: "en-US",
      title: "Kurimudb",
      description: "Just playing around.",
    },
  },
  themeConfig: {
    locales: {
      "/": {
        selectText: '选择语言',
        label: '简体中文',
        nav: [
          {
            text: "更新日志",
            link: "https://github.com/akirarika/kurimudb/releases",
          },
          { text: "Github", link: "https://github.com/akirarika/kurimudb" }
        ],
        sidebar: [
          {
            text: "文档",
            children: [
              { text: "入门", link: "/intro" },
              { text: "模型", link: "/model" },
              { text: "持久化", link: "/persistence" },
              {
                text: "驱动",
                children: [
                  { text: "LocalStorage", link: "/drivers/localstorage" },
                  { text: "Cookie", link: "/drivers/cookie" },
                  { text: "Dexie (IndexedDB)", link: "/drivers/dexie" },
                  { text: "自定义驱动", link: "/drivers/custom-driver" },
                ],
              },
              { text: "订阅变更", link: "/subscribe" },
              { text: "TypeScript", link: "/typescript" },
            ],
          },
          { text: "最佳实践", link: "/bestPractices" },
          { text: "模型生成器", link: "/modelCodeMaker" },
        ],
      },
      "/en/": {
        selectText: 'Languages',
        label: 'English',
        nav: [
          {
            text: "Changelog",
            link: "https://github.com/akirarika/kurimudb/releases",
          },
          { text: "Github", link: "https://github.com/akirarika/kurimudb" }
        ],
        sidebar: [
          {
            text: "Documents",
            children: [
              { text: "Getting Started", link: "/intro" },
              { text: "模型", link: "/model" },
              { text: "持久化", link: "/persistence" },
              {
                text: "驱动",
                children: [
                  { text: "LocalStorage", link: "/drivers/localstorage" },
                  { text: "Cookie", link: "/drivers/cookie" },
                  { text: "Dexie (IndexedDB)", link: "/drivers/dexie" },
                  { text: "自定义驱动", link: "/drivers/custom-driver" },
                ],
              },
              { text: "订阅变更", link: "/subscribe" },
              { text: "TypeScript", link: "/typescript" },
            ],
          },
          { text: "最佳实践", link: "/bestPractices" },
          { text: "模型生成器", link: "/modelCodeMaker" },
        ],
      },
    },
    search: true,
    author: "akirarika",
  },
};
