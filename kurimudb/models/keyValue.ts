import { ModelOptionsInterface } from '..';
import BaseModel from './base';

export default class KeyValueModel<DataInterface, driver = any> extends BaseModel<DataInterface, driver> {
  modelType = 'keyValue';

  constructor(options: ModelOptionsInterface) {
    super(options);
  }
}
