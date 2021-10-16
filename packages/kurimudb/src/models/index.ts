import { CollectionModel as SyncCollectionModel } from "./sync/collection-model.class";
import { KeyValueModel as SyncKeyValueModel } from "./sync/key-value-model.class";
// import { CollectionModel as AsyncCollectionModel } from "./async/collection-model.class";
import { KeyValueModel as AsyncKeyValueModel } from "./async/key-value-model.class";

export { ModelOptionsInterface } from "./sync/model-options.interface";

export const SyncModels = {
  keyValue: SyncKeyValueModel,
  collection: SyncCollectionModel,
};

export const AsyncModels = {
  keyValue: AsyncKeyValueModel,
  // collection: AsyncCollectionModel,
};
