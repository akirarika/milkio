export default class RxjsDriver {
    constructor(value, inject) {
        this.value = new inject(value);
    }
    set(value) {
        this.value.next(value);
    }
    get() {
        return this.value.getValue();
    }
    forget() {
        this.value.next(void 0);
    }
    subscribe() {
        return this.value;
    }
}
//# sourceMappingURL=RxjsDriver.js.map