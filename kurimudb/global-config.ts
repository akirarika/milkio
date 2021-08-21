/**
 * Kurimudb global config
 */
export const globalConfig = new (class KurimudbConfig {
  autoUnsubscribe: false | Function = false;
})();
