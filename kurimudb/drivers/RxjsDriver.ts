import { CacheDriverInterface } from '..';

export default class RxjsDriver implements CacheDriverInterface {
  value;

  constructor(value: any, inject: any) {
    this.value = new inject(value);
  }

  set(value: any): void {
    this.value.next(value);
  }

  get(): any {
    return this.value.getValue();
  }

  forget(): void {
    this.value.next(void 0);
  }

  subscribe(): any {
    return this.value;
  }
}
