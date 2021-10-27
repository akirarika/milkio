<script setup lang="ts">
import { ref } from '@vue/reactivity';
import { auto$ } from 'kurimudb';
import { testCollection } from '../models/test-collection';
import { testState } from '../models/test-state';

let count = ref(0);

testState.auto$(async () => {
  const a = await testState.data.count;
  count.value = a;
  console.log(a);
});

const func = async () => {
  await testState.setItem('count', 1 + (await testState.data.count));
};

(async () => {
  console.warn(
    await testCollection.bulkInsertItem([
      {
        count: 2333333333,
        test: new Map(),
      },
    ]),
  );
})();
</script>

<template>
  <p>
    <button type="button" @click="func">count is: {{ count }}</button>
  </p>
</template>

<style scoped>
a {
  color: #42b983;
}

label {
  margin: 0 0.5em;
  font-weight: bold;
}

code {
  background-color: #eee;
  padding: 2px 4px;
  border-radius: 4px;
  color: #304455;
}
</style>
