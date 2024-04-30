export function envToNumber(value: string | undefined, defaultValue: number) {
	if (value === undefined) return defaultValue;

	return Number.parseInt(value, 10);
}
