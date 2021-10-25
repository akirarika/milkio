### [中文版](./README.md)
## Introduction to Kurimudb

Kurimudb is a progressive **Web front-end local persistence library**. It can save your data to LocalStorage, IndexedDB, Cookie, and elsewhere. Also, support subscribing to the mutating of data.

In addition to persistent data, Kurimudb can be [Model layer](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel#Components_of_MVVM_pattern) of your application if your want, then take the responsibility of state management in your application (i.e., Vuex, Redux and Mobx) to make your app “single source of truth” really.

Kurimudb's persistence feature is driver-oriented. It means you can replace the implementation without changing the code. We build several common drivers. If these are not for you, you can build your own driver.

## Developer Document

You can [click here](https://kurimudb.nito.ink/) to read the document.

## Todo

Things to be done:

- [ ] i18n

- [ ] Cloud synchronization function: After the data in the model is modified, the data will be synchronized to the cloud (the backend is implemented by the user), and the data will be automatically pulled to the local when the cloud is changed

- [ ] Spare drive function: Specify a drive array. If the drive at the front of the array is not available in the current environment, use the drive at the back as a replacement (in order to maintain data consistency, the specific drive used will be specified when the user uses it for the first time. , Even if the user’s environment supports the top-ranked driver (such as updating the browser), the current driver will still be maintained))
