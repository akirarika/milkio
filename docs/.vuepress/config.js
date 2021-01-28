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
      ["/database/", "数据库"],
      ["/monitor/", "模型订阅"],
    ],
  },
};
