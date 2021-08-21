export { AbstractDriver as PersistenceInterface } from "./abstract-driver.class";
export { globalConfig as kurimudbConfig } from "./global-config";
export { auto$ } from "./helpers/auto$.func";
export { batch$ } from "./helpers/batch$.func";
export { ModelOptionsInterface } from "./models/model-options.interface";

import { CollectionModel } from "./models/collection-model.class";
import { KeyValueModel } from "./models/key-value-model.class";
export const Models = { keyValue: KeyValueModel, collection: CollectionModel };
