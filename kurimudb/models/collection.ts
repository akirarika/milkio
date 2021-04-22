import { ModelOptionsInterface } from '..';
import BaseModel from './base';

export default class CollectionModel<DataItemInterface, driver = any> extends BaseModel<DataItemInterface[], driver> {
  modelType = 'collection';
  private __INCREMENT = 0; // 模型自增的主键，仅在未持久化时使用

  constructor(options: ModelOptionsInterface) {
    super(options);
  }

  /**
   * 插入数据
   * 向集合模型中插入一条新数据，此数据的主键会自动递增
   *
   * @param value
   * @returns 新数据的id
   */
  insert(value: DataItemInterface): number | Promise<number> {
    if (this?.storage) {
      if (this.async)
        return (async () => {
          const storage = this.storage as any;
          const key = await storage.insert(value);
          this.cache.add(key, value);
          this.changed.set(key);
          return key;
        })();
      else {
        const storage = this.storage as any;
        const key = storage.insert(value);
        this.cache.add(key, value);
        this.changed.set(key);
        return key;
      }
    } else {
      // 不持久化
      const key = ++this['__INCREMENT'];
      this.cache.add(key, value);
      this.changed.set(key);
      return key;
    }
  }
}
