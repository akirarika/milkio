---
sidebar: false
---

# Simple Enough Front-end Storage Solution

<IndexComponent lang='en'>
# EXAMPLE

```js
local.data.say = 'hello'; // create it
let say = local.data.say; // retrieve it
'say' in local.data; // does it exist
delete local.data.say; // delete it
```

# OR

```js
local.setItem('say', 'hello'); // create it
let say = local.getItem('say'); // retrieve it
local.hasItem('say'); // does it exist
local.removeItem('say'); // delete it
local.bulkSetItem({
  say: 'hello',
  then: 'goodbye',
}); // bulk create
local.bulkGetItem(['say', 'then']); // bulk retrieve
local.bulkRemoveItem(['say', 'then']); // bulk delete
```

</IndexComponent>

<script setup>
import IndexComponent from '../components/IndexComponent.vue'
</script>
