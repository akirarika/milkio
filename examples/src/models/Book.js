export default {
  /**
   * 模型名称
   * 会以此为依据创建同名的表，一个模型对应一张表
   */
  name: "book",
  /**
   * 函数集合
   * 第一个参数是当前表对象，可以链式调用对此模型的表进行增删改查
   * 可以返回 Promise 会自动 await
   */
  methods: {
    all(table) {
      table.toArray();
    },
  },
  /**
   * 查询函数集合
   * 函数必须返回一个对象(代表某条结果)或数组(代表数条结果)，可以是 Promise
   * 函数和查询函数的区别是，查询函数要求明确格式的返回值，好处是，可以使用
   * 加载关联/响应式数据更新功能。建议"增删改"使用函数，"查"使用查询函数
   */
  queries: {
    all(table) {
      return table.toArray();
    },
    async first(table) {
      return [await table.where({ id: 1 }).first()];
    },
  },
  /**
   * 默认属性
   * 创建或更新时，若值不存在，则填入默认属性
   * 若默认属性是一个函数，则无论值是否存在，每次创建或更新都会
   * 覆盖为此值，可用来实现如自动维护更新时的时间戳等功能
   */
  attributes: {
    color_tag_id: 0, // 默认没有 tag
    directory_id: 1, // 默认存放在第一个文件夹
    permission: 0, // 默认没有权限
    type: 0,
    word_num: 0,
    updated_at() {
      return new Date().getTime();
    },
    created_at: new Date().getTime(),
  },
  /**
   * 关联函数集合
   * 在使用关联功能后，此函数查询的结果会在查询函数结果返回前挂载到对象属性上
   * 需返回：
   * {
   *  mount: 一个函数，返回 boolean 值，用于判断查询结果挂载位置
   *  array: 关联查询的结果
   *  defaults: 若存在未匹配的挂载属性，则赋予的默认值
   * }
   */
  relationships: {
    async author({ hasOne, belongsTo, hasMany, belongsToMany }) {
      return await hasMany({
        model: "author",
        // foreignKey: "book_id",
        // localKey: "id",
      });
    },
  },
  /**
   * 迁移
   * 声明版本和表索引的结构，
   */
  migrations: {
    1: (store) => store("++id, title"),
    2: (store) => store("++id, title, author_id"),
  },
  /**
   * 数据填充
   * 在用户首次运行程序时，自动填充的数据
   */
  async seeding(table) {
    return await table.add({
      title: "1984",
      author_id: [1, 2],
    });
  },
};
