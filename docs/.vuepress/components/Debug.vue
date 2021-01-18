<template>
  <div>
    <p>
      <button @click="printNote">打印 Note 模型</button>
      <button @click="printConfig">打印 Config 模型</button>
      <button @click="nextShow">显示模型数据</button>
    </p>
    <p>
      <button @click="addNote">添加 Note 数据</button>
    </p>
    <div v-show="0 === show">已隐藏模型数据</div>
    <div v-show="1 === show">
      <p>Note 模型数据:</p>
      <div v-for="(d, i) in noteList">{{ i }}: {{ d }}</div>
    </div>
    <div v-show="2 === show">
      <p>Config 模型数据:</p>
      <div v-for="(d, i) in configList">{{ i }}: {{ d }}</div>
    </div>
  </div>
</template>

<script>
import note from "../scripts/models/note";
import config from "../scripts/models/config";
import { local } from "../../../dist";

export default {
  data() {
    return {
      show: 1,
      noteList: {},
      configList: {},
    };
  },
  async mounted() {
    console.warn(await local.data.xxx);

    note.$.subscribe(async () => (this.noteList = await note.all()));
    config.$.subscribe(async () => (this.configList = await config.all()));
    config.data.test$.subscribe(console.log);

    config.data.test = {
      title: "test",
    };

    console.log(await config.data.test);

    // setTimeout(async () => {
    //   note.data[1] = {
    //     title: "world",
    //   };
    // }, 1000);
  },
  methods: {
    async addNote() {
      console.log(
        "addNote",
        await new note.data({
          title: `name-${new Date().getTime()}`,
        })
      );
    },
    nextShow() {
      if (this.show < 2) return this.show++;
      this.show = 0;
    },
    printNote() {
      console.log(note);
    },
    printConfig() {
      console.log(config);
    },
  },
};
</script>