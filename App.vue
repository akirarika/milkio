<template>
  <div>
    <div>请按 F12 打开控制台</div>
  </div>
</template>

<script lang="ts">
  import { defineAsyncComponent, defineComponent } from "vue";
  import test from "./test";

  export default defineComponent({
    name: "App",
    setup() {
      test();
    },
  });
</script>

<style>
  #app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
    margin-top: 60px;
  }
</style>
