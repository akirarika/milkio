import type { IValidation } from "typia";
import { reject } from "../kernel/fail";

export function _validate(validator: IValidation.IFailure | IValidation.ISuccess): any {
	if (validator.success) return validator.data;
	const error = validator.errors[0];

	if (error.value === undefined) error.value === "undefined";
	if (error.value === null) error.value === "null";

	throw reject("TYPE_SAFE_ERROR", {
		path: error.path,
		expected: error.expected,
		value: error.value,
	});
}
