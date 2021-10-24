---
sidebar: false
---

# A simple web local database

<IndexComponent lang='en'>

# EXAMPLE

```js
local.data.say = 'hello'; // create it
let say = local.data.say; // retrieve it
'say' in local.data; // does it exist
delete local.data.say; // delete it
```

</IndexComponent>

<script setup>
import IndexComponent from '../components/IndexComponent.vue'
</script>
