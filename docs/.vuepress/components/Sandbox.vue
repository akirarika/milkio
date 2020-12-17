<template>
  <div>
    <div v-for="(d, i) in list">{{ i }}: {{ d }}</div>
  </div>
</template>

<script>
import note from "../models/note";
import config from "../models/config";

export default {
  data() {
    return {
      list: [],
    };
  },
  async mounted() {
    note.$.subscribe(async () => (this.list = await note.getIdBelow5Results()));
    setTimeout(async () => {
      note.data[1] = {
        title: "world",
      };
    }, 1000);

    // setTimeout(async () => {
    //   await new config.data(
    //     {
    //       title: "hello",
    //     },
    //     "test"
    //   );
    // }, 1000);
    // setTimeout(async () => {
    //   delete config.data.test;
    // }, 2000);
  },
  methods: {},
};
</script>