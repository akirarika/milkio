import Vue from "vue";
import App from "./App.vue";
import store from "./store";
import Connection from "./models/Model";
import Book from "./models/Book";
import Author from "./models/Author";
import Dexie from "dexie";

Vue.config.productionTip = false;

Vue.prototype.$mydb = new Connection(new Dexie("mydb"), [Book, Author]);
// window.mydb = new Connection(new Dexie("mydb"), [Book, Author]);

new Vue({
  store,
  render: (h) => h(App),
}).$mount("#app");
