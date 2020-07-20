<template>
  <div>
    hello world
    <button @click="add">添加一个随机数据</button>
    <button @click="put">Put(添加或更新) id = 1 的数据</button>
    <button @click="del">删除 id = 1 的数据</button>
    <div v-for="i in list" :key="i.id">
      {{ i.title }}
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      list: [],
    };
  },
  async mounted() {
    this.list = await this.$mydb.models.book.with("author").query("all");
    this.$mydb.models.book.watch(this.list, {
      creating: (obj) => {
        this.list.unshift(obj);
      },
    });
  },
  components: {},
  methods: {
    add() {
      this.$mydb.models.book.method("add", {
        title: Math.random()
          .toString(36)
          .slice(-8),
      });
    },
    put() {
      this.$mydb.models.book.method("put", {
        id: 1,
        title: Math.random()
          .toString(36)
          .slice(-8),
      });
    },
    del() {
      this.$mydb.models.book.method("delete", 1);
    },
  },
};
</script>

<style></style>
