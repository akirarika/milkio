import { CollectionModel as SyncCollectionModel } from "./sync/collection-model.class";
import { KeyValueModel as SyncKeyValueModel } from "./sync/key-value-model.class";

export { ModelOptionsInterface } from "./model-options.interface";

export const SyncModels = {
  keyValue: SyncKeyValueModel,
  collection: SyncCollectionModel,
};

// export const AsyncModels = {
//   keyValue: AsyncKeyValueModel,
//   collection: AsyncCollectionModel,
// };
