import Vue from "vue";
import App from "./App.vue";
import store from "./store";
import Connection from "./Connection";
import Book from "./models/Book";
import Author from "./models/Author";
import Dexie from "dexie";

Vue.config.productionTip = false;

// 初始化时传入一个数据库连接和所有用到的模型，获取一个 Modexie 连接
// 然后挂载到 Vue 实例上方便使用（不喜欢 Vue 也可以挂到 window 对象上什么的）
Vue.prototype.$mydb = new Connection(new Dexie("mydb"), [Book, Author]);
window.mydb = new Connection(new Dexie("mydb"), [Book, Author]);

new Vue({
  store,
  render: (h) => h(App),
}).$mount("#app");
