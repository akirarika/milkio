<template> </template>

<script>
  import configState from "../scripts/models/configState";

  export default {
    data() {
      return {};
    },
    async mounted() {
      console.log(configState);
      configState.data.say = { hello: "world" };
      configState.data.balbala = "xxxxxx0;w";
      console.log(configState.data.say);
    },
  };
</script>
