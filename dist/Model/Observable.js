import { Observable as RxObservable } from "rxjs";
export default class Observable extends RxObservable {
    constructor() {
        super((observer) => {
            if (!this.observer)
                this.observer = observer;
        });
    }
    next(type, primary, data) {
        if (!this.observer)
            return; // 当前还没有被 subscribe
        return this.observer.next({
            type,
            primary,
            data,
        });
    }
}
//# sourceMappingURL=Observable.js.map