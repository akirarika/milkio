# Subscription Changes

## Subscription

In Kurimudb，`$` stands for `subscribe`。You can add a `$` after a value to suscribe its changes：

```js
configState.data.foo$((value, key) => {
  console.log(value, key);
});
```

By default, the closure function will be executed immediately, so that you can assign initial values to the reactive variables in your view. If you don't want to do so, but only want to execute it when the subsequent value changes, then the following can be done:

```js {5}
configState.data.foo$(
  (value, key) => {
    console.log(value, key);
  },
  { immediate: false }
);
```

You can also use in form of [类 Storage Api](/model.html#%E7%B1%BB-storage-api) to suscribe：

```js
configState.subscribeItem(key, closFunc, config);
```

## Bulk Suscription

If you want to subscribe to changes of multiple values at once, you can use function `batch$`: 

```js
import { batch$ } from "kurimudb";

batch$([configState.data.foo$, configState.data.bar$], (value, key) => {
  console.log(value, key);
});
```

## Auto Subscription

It may be a bit cumbersome to manually declare the value to be subscribed, so we also provide a more convenient way. When any of the values you use in the closure is changed, a subscription will be triggered: 

```js
import { auto$ } from "kurimudb";

auto$(() => {
  console.log(configState.data.foo);
  console.log(configState.data.bar);
});
```
Kurimudb collects which values are read and then subscribes to them. Therefore, the closure function must be **synchronized**.

> 📜 You need to use this function in version (^3.1.1).

## Subscribe Models

You can also subscribe to changes in the entire model. When any value in the model changes, the closure function will be triggered.

This is usually used in scenarios where you don't know which value you want to subscribe to, such as **the collection model**. A common example: a collection model for storing drafts. The view needs to change immediately when the user saves, adds or deletes drafts. This will come in handy here.

If you want to subscribe to the changes of models, just call the function `yourModel.$`.

```js {3,4,5}
ref: currentDraftData = [];

draftList.$((key) => {
  currentDraftData = draftList.all();
});

// in view..

draftList.insert({
  // ..
});
```

## Cancel Subscriptions

When you execute subscription function, the return value will be a cancelling subscription function. The subscription will be unsubscribed after you execute it:

```js
const unsubscribe = configState.data.foo$((value, key) => {
  // ..
});

// 退订
unsubscribe();
```

## Auto Unubscriptions

If you are using Vue/React or other frameworks, you probably hope to see all subscriptions generated in the components will be automatically unsubscribed when the components are destroyed.

You can mount a function to `kurimudbConfig.autoUnsubscribe`. This function will be executed every time the subscription function is executed. You can use it in conjunction with the lifecycle APIs of the framework to realize automatic unsubscriptions.

### Vue3

```js
import { onBeforeUnmount } from "vue";
import { kurimudbConfig } from "kurimudb";

kurimudbConfig.autoUnsubscribe = (unsubscribe) => {
  onBeforeUnmount(() => unsubscribe());
};
```

### React

To be continued... 🐸

### Ignore Automatic Unsubscriptions

If you don't want it to be automatically unsubscribed automatically in several scenarios when enable auto unsubscriptions, you can do it like this as following:

```js {5}
configState.data.foo$(
  (value, key) => {
    console.log(value, key);
  },
  { autoUnsubscribe: false }
);
```
