---
sidebar: false
---

# 足够简单的 Web 本地存储库

<IndexComponent>

# EXAMPLE

```js
local.data.say = "hello"; // create it
let say = local.data.say; // retrieve it
"say" in local.data; // does it exist
delete local.data.say; // delete it
```

</IndexComponent>

<script setup>
import IndexComponent from './components/IndexComponent.vue'
</script>
