## KMap

<!-- KMap is a collection of like objects, the difference is that it will be traversed in strict insertion order. -->

KMap 是一个类似对象的集合，不同之处在于，遍历它时，它将严格按照内部元素被插入的顺序遍历。

你既可以像对象一样直接从中取出键所对应的值，也可以像数组一样按顺序遍历它。

```js
import { makeKMap } from 'kurimudb';

const map = makeKMap();

map['foo'] = 'bar';
map[520] = 'baz';

for (const key in map) {
  console.log(key, map[key]);
}

// echo: 'foo', 'bar'
// echo: '520', 'baz'
```
