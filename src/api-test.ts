export default {
  async onBootstrap() {
    // ..
  },
  async onBefore() {
    return {
      // The content returned here will be mixed into the test object
    }
  }
}