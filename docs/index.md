---
sidebar: false
---

# 足够简单的前端存储解决方案

<IndexComponent lang='zh'>
# EXAMPLE

```js
local.data.say = 'hello'; // create it
let say = local.data.say; // retrieve it
'say' in local.data; // does it exist
delete local.data.say; // delete it
local.data.say$((val) => {
  console.log(val);
}); // subscribe to its changes
```

</IndexComponent>

<script setup>
import IndexComponent from './components/IndexComponent.vue'
</script>
