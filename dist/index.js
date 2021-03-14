import _localStorageDriver from "./drivers/LocalStorageDriver";
import _cookieDriver from "./drivers/CookieDriver";
import _dexieDriver from "./drivers/DexieDriver";
import _rxjsDriver from "./drivers/RxjsDriver";
import _model from "./model/index";
// model base class
export const Model = _model;
// built-in drivers
export const LocalStorageDriver = _localStorageDriver;
export const CookieDriver = _cookieDriver;
export const DexieDriver = _dexieDriver;
export const RxjsDriver = _rxjsDriver;
//# sourceMappingURL=index.js.map