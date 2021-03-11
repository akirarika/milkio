module.exports = {
  title: "Kurimudb",
  base: "/kurimudb/",
  theme: "yuu",
  themeConfig: {
    yuu: {
      defaultColorTheme: "blue",
    },
    nav: [
      {
        text: "更新日志",
        link: "https://github.com/akirarika/kurimudb/releases",
      },
      { text: "Github", link: "https://github.com/akirarika/kurimudb" },
    ],
    sidebar: [
      ["/", "介绍"],
      ["/intro/", "入门"],
      ["/typescript/", "Typescript"],
      ["/cache/", "缓存驱动"],
      ["/persistence/", "持久化驱动"],
      ["/more/", "深入"],
    ],
  },
};
