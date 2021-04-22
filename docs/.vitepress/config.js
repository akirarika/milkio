module.exports = {
  title: "Kurimudb",
  description: "Just playing around.",
  head: [["link", { rel: "icon", href: "favicon.png" }]],
  markdown: {
    lineNumbers: true,
  },
  themeConfig: {
    search: true,
    author: "akirarika",
    nav: [
      {
        text: "更新日志",
        link: "https://github.com/akirarika/kurimudb/releases",
      },
      { text: "Github", link: "https://github.com/akirarika/kurimudb" },
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
};
