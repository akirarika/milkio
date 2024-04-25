import typia from "typia";
import { _validate, type ExecuteResultFail, type ExecuteResultSuccess } from "milkio";
import { type TSONEncode } from "@southern-aurora/tson";
import type * as $$default from "../../../../src/apps/$/default";
type ParamsT = Parameters<typeof $$default['api']['action']>[0];
export const validateParams = async (params: any) => ((input: any): typia.IValidation<ParamsT> => { const validate = (input: any): typia.IValidation<ParamsT> => {
    const errors = [] as any[];
    const __is = (input: any): input is ParamsT => {
        const $io0 = (input: any): boolean => Array.isArray(input.commands) && input.commands.every((elem: any) => "string" === typeof elem) && ("object" === typeof input.options && null !== input.options && false === Array.isArray(input.options) && $io1(input.options));
        const $io1 = (input: any): boolean => Object.keys(input).every((key: any) => {
            const value = input[key];
            if (undefined === value)
                return true;
            return true === value || "string" === typeof value;
        });
        return "object" === typeof input && null !== input && $io0(input);
    };
    if (false === __is(input)) {
        const $report = (typia.misc.validatePrune as any).report(errors);
        ((input: any, _path: string, _exceptionable: boolean = true): input is ParamsT => {
            const $join = (typia.misc.validatePrune as any).join;
            const $vo0 = (input: any, _path: string, _exceptionable: boolean = true): boolean => [(Array.isArray(input.commands) || $report(_exceptionable, {
                    path: _path + ".commands",
                    expected: "Array<string>",
                    value: input.commands
                })) && input.commands.map((elem: any, _index1: number) => "string" === typeof elem || $report(_exceptionable, {
                    path: _path + ".commands[" + _index1 + "]",
                    expected: "string",
                    value: elem
                })).every((flag: boolean) => flag) || $report(_exceptionable, {
                    path: _path + ".commands",
                    expected: "Array<string>",
                    value: input.commands
                }), ("object" === typeof input.options && null !== input.options && false === Array.isArray(input.options) || $report(_exceptionable, {
                    path: _path + ".options",
                    expected: "Record<string, string | true>",
                    value: input.options
                })) && $vo1(input.options, _path + ".options", true && _exceptionable) || $report(_exceptionable, {
                    path: _path + ".options",
                    expected: "Record<string, string | true>",
                    value: input.options
                })].every((flag: boolean) => flag);
            const $vo1 = (input: any, _path: string, _exceptionable: boolean = true): boolean => [false === _exceptionable || Object.keys(input).map((key: any) => {
                    const value = input[key];
                    if (undefined === value)
                        return true;
                    return true === value || "string" === typeof value || $report(_exceptionable, {
                        path: _path + $join(key),
                        expected: "(string | true)",
                        value: value
                    });
                }).every((flag: boolean) => flag)].every((flag: boolean) => flag);
            return ("object" === typeof input && null !== input || $report(true, {
                path: _path + "",
                expected: "__type",
                value: input
            })) && $vo0(input, _path + "", true) || $report(true, {
                path: _path + "",
                expected: "__type",
                value: input
            });
        })(input, "$input", true);
    }
    const success = 0 === errors.length;
    return {
        success,
        errors,
        data: success ? input : undefined
    } as any;
}; const prune = (input: ParamsT): void => {
    const $io1 = (input: any): boolean => Object.keys(input).every((key: any) => {
        const value = input[key];
        if (undefined === value)
            return true;
        return true === value || "string" === typeof value;
    });
    const $po0 = (input: any): any => {
        if ("object" === typeof input.options && null !== input.options)
            $po1(input.options);
        for (const key of Object.keys(input)) {
            if ("commands" === key || "options" === key)
                continue;
            delete input[key];
        }
    };
    const $po1 = (input: any): any => {
        Object.entries(input).forEach(([key, value]: any) => {
            if (undefined === value)
                return;
            if (RegExp(/(.*)/).test(key)) { }
        });
        for (const key of Object.keys(input)) {
            if (RegExp(/(.*)/).test(key))
                continue;
            delete input[key];
        }
    };
    if ("object" === typeof input && null !== input)
        $po0(input);
}; const output = validate(input); if (output.success)
    prune(input); return output; })(params);
type ResultsT = Awaited<ReturnType<typeof $$default['api']['action']>>;
export const validateResults = async (results: any) => { _validate(((input: any): typia.IValidation<TSONEncode<ExecuteResultSuccess<ResultsT> | ExecuteResultFail>> => {
    const errors = [] as any[];
    const __is = (input: any): input is TSONEncode<ExecuteResultSuccess<ResultsT> | ExecuteResultFail> => {
        const $io0 = (input: any): boolean => "string" === typeof input.executeId && false === input.success && ("object" === typeof input.fail && null !== input.fail && $io1(input.fail));
        const $io1 = (input: any): boolean => ("NETWORK_ERROR" === input.code || "INTERNAL_SERVER_ERROR" === input.code || "NOT_FOUND" === input.code || "NOT_ALLOW_METHOD" === input.code || "TYPE_SAFE_ERROR" === input.code || "BUSINESS_FAIL" === input.code) && "string" === typeof input.message && (null !== input.data && (undefined === input.data || "string" === typeof input.data || "object" === typeof input.data && null !== input.data && $io2(input.data)));
        const $io2 = (input: any): boolean => "string" === typeof input.path && "string" === typeof input.expected && "string" === typeof input.value;
        const $io3 = (input: any): boolean => "string" === typeof input.executeId && true === input.success && (null !== input.data && undefined === input.data);
        const $iu0 = (input: any): any => (() => {
            if (false === input.success)
                return $io0(input);
            else if (true === input.success)
                return $io3(input);
            else
                return false;
        })();
        return "object" === typeof input && null !== input && $iu0(input);
    };
    if (false === __is(input)) {
        const $report = (typia.validate as any).report(errors);
        ((input: any, _path: string, _exceptionable: boolean = true): input is TSONEncode<ExecuteResultSuccess<ResultsT> | ExecuteResultFail> => {
            const $vo0 = (input: any, _path: string, _exceptionable: boolean = true): boolean => ["string" === typeof input.executeId || $report(_exceptionable, {
                    path: _path + ".executeId",
                    expected: "string",
                    value: input.executeId
                }), false === input.success || $report(_exceptionable, {
                    path: _path + ".success",
                    expected: "false",
                    value: input.success
                }), ("object" === typeof input.fail && null !== input.fail || $report(_exceptionable, {
                    path: _path + ".fail",
                    expected: "RecursiveObjectXToString<Fail<\"NETWORK_ERROR\" | \"INTERNAL_SERVER_ERROR\" | \"NOT_FOUND\" | \"NOT_ALLOW_METHOD\" | \"TYPE_SAFE_ERROR\" | \"BUSINESS_FAIL\">, bigint | RegExp | URL | Date | Uint8Array | ArrayBuffer>",
                    value: input.fail
                })) && $vo1(input.fail, _path + ".fail", true && _exceptionable) || $report(_exceptionable, {
                    path: _path + ".fail",
                    expected: "RecursiveObjectXToString<Fail<\"NETWORK_ERROR\" | \"INTERNAL_SERVER_ERROR\" | \"NOT_FOUND\" | \"NOT_ALLOW_METHOD\" | \"TYPE_SAFE_ERROR\" | \"BUSINESS_FAIL\">, bigint | RegExp | URL | Date | Uint8Array | ArrayBuffer>",
                    value: input.fail
                })].every((flag: boolean) => flag);
            const $vo1 = (input: any, _path: string, _exceptionable: boolean = true): boolean => ["NETWORK_ERROR" === input.code || "INTERNAL_SERVER_ERROR" === input.code || "NOT_FOUND" === input.code || "NOT_ALLOW_METHOD" === input.code || "TYPE_SAFE_ERROR" === input.code || "BUSINESS_FAIL" === input.code || $report(_exceptionable, {
                    path: _path + ".code",
                    expected: "(\"BUSINESS_FAIL\" | \"INTERNAL_SERVER_ERROR\" | \"NETWORK_ERROR\" | \"NOT_ALLOW_METHOD\" | \"NOT_FOUND\" | \"TYPE_SAFE_ERROR\")",
                    value: input.code
                }), "string" === typeof input.message || $report(_exceptionable, {
                    path: _path + ".message",
                    expected: "string",
                    value: input.message
                }), (null !== input.data || $report(_exceptionable, {
                    path: _path + ".data",
                    expected: "(__type | string | undefined)",
                    value: input.data
                })) && (undefined === input.data || "string" === typeof input.data || ("object" === typeof input.data && null !== input.data || $report(_exceptionable, {
                    path: _path + ".data",
                    expected: "(__type | string | undefined)",
                    value: input.data
                })) && $vo2(input.data, _path + ".data", true && _exceptionable) || $report(_exceptionable, {
                    path: _path + ".data",
                    expected: "(__type | string | undefined)",
                    value: input.data
                }))].every((flag: boolean) => flag);
            const $vo2 = (input: any, _path: string, _exceptionable: boolean = true): boolean => ["string" === typeof input.path || $report(_exceptionable, {
                    path: _path + ".path",
                    expected: "string",
                    value: input.path
                }), "string" === typeof input.expected || $report(_exceptionable, {
                    path: _path + ".expected",
                    expected: "string",
                    value: input.expected
                }), "string" === typeof input.value || $report(_exceptionable, {
                    path: _path + ".value",
                    expected: "string",
                    value: input.value
                })].every((flag: boolean) => flag);
            const $vo3 = (input: any, _path: string, _exceptionable: boolean = true): boolean => ["string" === typeof input.executeId || $report(_exceptionable, {
                    path: _path + ".executeId",
                    expected: "string",
                    value: input.executeId
                }), true === input.success || $report(_exceptionable, {
                    path: _path + ".success",
                    expected: "true",
                    value: input.success
                }), (null !== input.data || $report(_exceptionable, {
                    path: _path + ".data",
                    expected: "undefined",
                    value: input.data
                })) && (undefined === input.data || $report(_exceptionable, {
                    path: _path + ".data",
                    expected: "undefined",
                    value: input.data
                }))].every((flag: boolean) => flag);
            const $vu0 = (input: any, _path: string, _exceptionable: boolean = true): any => (() => {
                if (false === input.success)
                    return $vo0(input, _path, true && _exceptionable);
                else if (true === input.success)
                    return $vo3(input, _path, true && _exceptionable);
                else
                    return $report(_exceptionable, {
                        path: _path,
                        expected: "(RecursiveObjectXToString<ExecuteResultFail, bigint | RegExp | URL | Date | Uint8Array | ArrayBuffer> | RecursiveObjectXToString<ExecuteResultSuccess<void>, bigint | RegExp | URL | Date | Uint8Array | ArrayBuffer>)",
                        value: input
                    });
            })();
            return ("object" === typeof input && null !== input || $report(true, {
                path: _path + "",
                expected: "(RecursiveObjectXToString<ExecuteResultFail, bigint | RegExp | URL | Date | Uint8Array | ArrayBuffer> | RecursiveObjectXToString<ExecuteResultSuccess<void>, bigint | RegExp | URL | Date | Uint8Array | ArrayBuffer>)",
                value: input
            })) && $vu0(input, _path + "", true) || $report(true, {
                path: _path + "",
                expected: "(RecursiveObjectXToString<ExecuteResultFail, bigint | RegExp | URL | Date | Uint8Array | ArrayBuffer> | RecursiveObjectXToString<ExecuteResultSuccess<void>, bigint | RegExp | URL | Date | Uint8Array | ArrayBuffer>)",
                value: input
            });
        })(input, "$input", true);
    }
    const success = 0 === errors.length;
    return {
        success,
        errors,
        data: success ? input : undefined
    } as any;
})(results)); return ((input: TSONEncode<ExecuteResultSuccess<ResultsT> | ExecuteResultFail>): string => {
    const $io0 = (input: any): boolean => "string" === typeof input.executeId && false === input.success && ("object" === typeof input.fail && null !== input.fail && $io1(input.fail));
    const $io1 = (input: any): boolean => ("NETWORK_ERROR" === input.code || "INTERNAL_SERVER_ERROR" === input.code || "NOT_FOUND" === input.code || "NOT_ALLOW_METHOD" === input.code || "TYPE_SAFE_ERROR" === input.code || "BUSINESS_FAIL" === input.code) && "string" === typeof input.message && (null !== input.data && (undefined === input.data || "string" === typeof input.data || "object" === typeof input.data && null !== input.data && $io2(input.data)));
    const $io2 = (input: any): boolean => "string" === typeof input.path && "string" === typeof input.expected && "string" === typeof input.value;
    const $io3 = (input: any): boolean => "string" === typeof input.executeId && true === input.success && (null !== input.data && undefined === input.data);
    const $string = (typia.json.stringify as any).string;
    const $throws = (typia.json.stringify as any).throws;
    const $so0 = (input: any): any => `{"executeId":${$string(input.executeId)},"success":${input.success},"fail":${$so1(input.fail)}}`;
    const $so1 = (input: any): any => `{${undefined === input.data ? "" : `"data":${undefined !== input.data ? (() => {
        if ("string" === typeof input.data)
            return $string(input.data);
        if ("object" === typeof input.data && null !== input.data)
            return `{"path":${$string((input.data as any).path)},"expected":${$string((input.data as any).expected)},"value":${$string((input.data as any).value)}}`;
        $throws({
            expected: "(__type | string | undefined)",
            value: input.data
        });
    })() : undefined},`}"code":${(() => {
        if ("string" === typeof input.code)
            return $string(input.code);
        if ("string" === typeof input.code)
            return "\"" + input.code + "\"";
        $throws({
            expected: "(\"BUSINESS_FAIL\" | \"INTERNAL_SERVER_ERROR\" | \"NETWORK_ERROR\" | \"NOT_ALLOW_METHOD\" | \"NOT_FOUND\" | \"TYPE_SAFE_ERROR\")",
            value: input.code
        });
    })()},"message":${$string(input.message)}}`;
    const $so3 = (input: any): any => `{"executeId":${$string(input.executeId)},"success":${input.success}}`;
    const $su0 = (input: any): any => (() => {
        if (false === input.success)
            return $so0(input);
        else if (true === input.success)
            return $so3(input);
        else
            $throws({
                expected: "(RecursiveObjectXToString<ExecuteResultFail, bigint | RegExp | URL | Date | Uint8Array | ArrayBuffer> | RecursiveObjectXToString<ExecuteResultSuccess<void>, bigint | RegExp | URL | Date | Uint8Array | ArrayBuffer>)",
                value: input
            });
    })();
    return $su0(input);
})(results); };
export const randParams = async () => ((generator?: Partial<typia.IRandomGenerator>): import("typia").Resolved<ParamsT> => {
    const $generator = (typia.random as any).generator;
    const $pick = (typia.random as any).pick;
    const $ro0 = (_recursive: boolean = false, _depth: number = 0): any => ({
        commands: (generator?.array ?? $generator.array)(() => (generator?.customs ?? $generator.customs)?.string?.([]) ?? (generator?.string ?? $generator.string)()),
        options: $ro1(_recursive, _recursive ? 1 + _depth : _depth)
    });
    const $ro1 = (_recursive: boolean = false, _depth: number = 0): any => {
        const output = {} as any;
        (generator?.array ?? $generator.array)(() => output[(generator?.customs ?? $generator.customs)?.string?.([]) ?? (generator?.string ?? $generator.string)()] = $pick([
            () => true,
            () => (generator?.customs ?? $generator.customs)?.string?.([]) ?? (generator?.string ?? $generator.string)()
        ])(), (generator?.integer ?? $generator.integer)(0, 3));
        return output;
    };
    return $ro0();
})();
