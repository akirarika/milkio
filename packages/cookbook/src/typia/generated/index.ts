import { join } from "node:path";
import { consola } from "consola";
import type { BunFile } from "bun";
import typia from "typia";
import { exit, cwd } from "node:process";
import { TSON } from "@southern-aurora/tson";
import type { CookbookOptions } from "../..";
import type { MilkioActionParams } from "../../actions";
export const getOptions = async (milkioToml: BunFile) => {
    if (!(await milkioToml.exists())) {
        consola.error(`The "cookbook.toml" file does not exist in the current directory: ${join(cwd())}`);
        exit(0);
    }
    const options = Bun.TOML.parse(await milkioToml.text());
    const checkResult = (() => { const $join = (typia.validateEquals as any).join; const $io0 = (input: any, _exceptionable: boolean = true): boolean => "object" === typeof input.projects && null !== input.projects && false === Array.isArray(input.projects) && $io1(input.projects, true && _exceptionable) && ("object" === typeof input.general && null !== input.general && $io3(input.general, true && _exceptionable)) && (2 === Object.keys(input).length || Object.keys(input).every((key: any) => {
        if (["projects", "general"].some((prop: any) => key === prop))
            return true;
        const value = input[key];
        if (undefined === value)
            return true;
        return false;
    })); const $io1 = (input: any, _exceptionable: boolean = true): boolean => Object.keys(input).every((key: any) => {
        const value = input[key];
        if (undefined === value)
            return true;
        return "object" === typeof value && null !== value && $io2(value, true && _exceptionable);
    }); const $io2 = (input: any, _exceptionable: boolean = true): boolean => ("milkio" === input.type || "other" === input.type) && "number" === typeof input.port && (Array.isArray(input.start) && input.start.every((elem: any, _index1: number) => "string" === typeof elem)) && (Array.isArray(input.build) && input.build.every((elem: any, _index2: number) => "string" === typeof elem)) && (undefined === input.lazyRoutes || "boolean" === typeof input.lazyRoutes) && (undefined === input.typiaMode || "generation" === input.typiaMode || "bundler" === input.typiaMode) && (undefined === input.significant || Array.isArray(input.significant) && input.significant.every((elem: any, _index3: number) => "string" === typeof elem)) && (undefined === input.insignificant || Array.isArray(input.insignificant) && input.insignificant.every((elem: any, _index4: number) => "string" === typeof elem)) && (4 === Object.keys(input).length || Object.keys(input).every((key: any) => {
        if (["type", "port", "start", "build", "lazyRoutes", "typiaMode", "significant", "insignificant"].some((prop: any) => key === prop))
            return true;
        const value = input[key];
        if (undefined === value)
            return true;
        return false;
    })); const $io3 = (input: any, _exceptionable: boolean = true): boolean => "number" === typeof input.cookbookPort && (1 === Object.keys(input).length || Object.keys(input).every((key: any) => {
        if (["cookbookPort"].some((prop: any) => key === prop))
            return true;
        const value = input[key];
        if (undefined === value)
            return true;
        return false;
    })); const $vo0 = (input: any, _path: string, _exceptionable: boolean = true): boolean => [("object" === typeof input.projects && null !== input.projects && false === Array.isArray(input.projects) || $report(_exceptionable, {
            path: _path + ".projects",
            expected: "Record<string, __type>",
            value: input.projects
        })) && $vo1(input.projects, _path + ".projects", true && _exceptionable) || $report(_exceptionable, {
            path: _path + ".projects",
            expected: "Record<string, __type>",
            value: input.projects
        }), ("object" === typeof input.general && null !== input.general || $report(_exceptionable, {
            path: _path + ".general",
            expected: "__type.o1",
            value: input.general
        })) && $vo3(input.general, _path + ".general", true && _exceptionable) || $report(_exceptionable, {
            path: _path + ".general",
            expected: "__type.o1",
            value: input.general
        }), 2 === Object.keys(input).length || (false === _exceptionable || Object.keys(input).map((key: any) => {
            if (["projects", "general"].some((prop: any) => key === prop))
                return true;
            const value = input[key];
            if (undefined === value)
                return true;
            return $report(_exceptionable, {
                path: _path + $join(key),
                expected: "undefined",
                value: value
            });
        }).every((flag: boolean) => flag))].every((flag: boolean) => flag); const $vo1 = (input: any, _path: string, _exceptionable: boolean = true): boolean => [false === _exceptionable || Object.keys(input).map((key: any) => {
            const value = input[key];
            if (undefined === value)
                return true;
            return ("object" === typeof value && null !== value || $report(_exceptionable, {
                path: _path + $join(key),
                expected: "__type",
                value: value
            })) && $vo2(value, _path + $join(key), true && _exceptionable) || $report(_exceptionable, {
                path: _path + $join(key),
                expected: "__type",
                value: value
            });
        }).every((flag: boolean) => flag)].every((flag: boolean) => flag); const $vo2 = (input: any, _path: string, _exceptionable: boolean = true): boolean => ["milkio" === input.type || "other" === input.type || $report(_exceptionable, {
            path: _path + ".type",
            expected: "(\"milkio\" | \"other\")",
            value: input.type
        }), "number" === typeof input.port || $report(_exceptionable, {
            path: _path + ".port",
            expected: "number",
            value: input.port
        }), (Array.isArray(input.start) || $report(_exceptionable, {
            path: _path + ".start",
            expected: "Array<string>",
            value: input.start
        })) && input.start.map((elem: any, _index5: number) => "string" === typeof elem || $report(_exceptionable, {
            path: _path + ".start[" + _index5 + "]",
            expected: "string",
            value: elem
        })).every((flag: boolean) => flag) || $report(_exceptionable, {
            path: _path + ".start",
            expected: "Array<string>",
            value: input.start
        }), (Array.isArray(input.build) || $report(_exceptionable, {
            path: _path + ".build",
            expected: "Array<string>",
            value: input.build
        })) && input.build.map((elem: any, _index6: number) => "string" === typeof elem || $report(_exceptionable, {
            path: _path + ".build[" + _index6 + "]",
            expected: "string",
            value: elem
        })).every((flag: boolean) => flag) || $report(_exceptionable, {
            path: _path + ".build",
            expected: "Array<string>",
            value: input.build
        }), undefined === input.lazyRoutes || "boolean" === typeof input.lazyRoutes || $report(_exceptionable, {
            path: _path + ".lazyRoutes",
            expected: "(boolean | undefined)",
            value: input.lazyRoutes
        }), undefined === input.typiaMode || "generation" === input.typiaMode || "bundler" === input.typiaMode || $report(_exceptionable, {
            path: _path + ".typiaMode",
            expected: "(\"bundler\" | \"generation\" | undefined)",
            value: input.typiaMode
        }), undefined === input.significant || (Array.isArray(input.significant) || $report(_exceptionable, {
            path: _path + ".significant",
            expected: "(Array<string> | undefined)",
            value: input.significant
        })) && input.significant.map((elem: any, _index7: number) => "string" === typeof elem || $report(_exceptionable, {
            path: _path + ".significant[" + _index7 + "]",
            expected: "string",
            value: elem
        })).every((flag: boolean) => flag) || $report(_exceptionable, {
            path: _path + ".significant",
            expected: "(Array<string> | undefined)",
            value: input.significant
        }), undefined === input.insignificant || (Array.isArray(input.insignificant) || $report(_exceptionable, {
            path: _path + ".insignificant",
            expected: "(Array<string> | undefined)",
            value: input.insignificant
        })) && input.insignificant.map((elem: any, _index8: number) => "string" === typeof elem || $report(_exceptionable, {
            path: _path + ".insignificant[" + _index8 + "]",
            expected: "string",
            value: elem
        })).every((flag: boolean) => flag) || $report(_exceptionable, {
            path: _path + ".insignificant",
            expected: "(Array<string> | undefined)",
            value: input.insignificant
        }), 4 === Object.keys(input).length || (false === _exceptionable || Object.keys(input).map((key: any) => {
            if (["type", "port", "start", "build", "lazyRoutes", "typiaMode", "significant", "insignificant"].some((prop: any) => key === prop))
                return true;
            const value = input[key];
            if (undefined === value)
                return true;
            return $report(_exceptionable, {
                path: _path + $join(key),
                expected: "undefined",
                value: value
            });
        }).every((flag: boolean) => flag))].every((flag: boolean) => flag); const $vo3 = (input: any, _path: string, _exceptionable: boolean = true): boolean => ["number" === typeof input.cookbookPort || $report(_exceptionable, {
            path: _path + ".cookbookPort",
            expected: "number",
            value: input.cookbookPort
        }), 1 === Object.keys(input).length || (false === _exceptionable || Object.keys(input).map((key: any) => {
            if (["cookbookPort"].some((prop: any) => key === prop))
                return true;
            const value = input[key];
            if (undefined === value)
                return true;
            return $report(_exceptionable, {
                path: _path + $join(key),
                expected: "undefined",
                value: value
            });
        }).every((flag: boolean) => flag))].every((flag: boolean) => flag); const __is = (input: any, _exceptionable: boolean = true): input is CookbookOptions => "object" === typeof input && null !== input && $io0(input, true); let errors: any; let $report: any; return (input: any): typia.IValidation<CookbookOptions> => {
        if (false === __is(input)) {
            errors = [];
            $report = (typia.validateEquals as any).report(errors);
            ((input: any, _path: string, _exceptionable: boolean = true) => ("object" === typeof input && null !== input || $report(true, {
                path: _path + "",
                expected: "CookbookOptions",
                value: input
            })) && $vo0(input, _path + "", true) || $report(true, {
                path: _path + "",
                expected: "CookbookOptions",
                value: input
            }))(input, "$input", true);
            const success = 0 === errors.length;
            return {
                success,
                errors,
                data: success ? input : undefined
            } as any;
        }
        return {
            success: true,
            errors: [],
            data: input
        } as any;
    }; })()(options);
    if (!checkResult.success) {
        const error = checkResult.errors.at(0)!;
        consola.error(`The "cookbook.toml" format is incorrect, [${error.path.slice(7)}] should be ${error.expected}, but it is actually ${error.value}. You may be missing some properties in the configuration item, or adding some properties that will not be used. If you have extra properties, these properties are likely due to a misspelling.`);
        exit(0);
    }
    return options as any;
};
export const getActionOptions = (options: string): any => {
    const results = TSON.parse(options);
    const checkResult = (() => { const $io0 = (input: any): boolean => "milkio@logger" === input.type && Array.isArray(input.log); const $vo0 = (input: any, _path: string, _exceptionable: boolean = true): boolean => ["milkio@logger" === input.type || $report(_exceptionable, {
            path: _path + ".type",
            expected: "\"milkio@logger\"",
            value: input.type
        }), Array.isArray(input.log) || $report(_exceptionable, {
            path: _path + ".log",
            expected: "Array<any>",
            value: input.log
        })].every((flag: boolean) => flag); const $po0 = (input: any): any => {
        for (const key of Object.keys(input)) {
            if ("type" === key || "log" === key)
                continue;
            delete input[key];
        }
    }; const __is = (input: any): input is MilkioActionParams => "object" === typeof input && null !== input && $io0(input); let errors: any; let $report: any; const __validate = (input: any): typia.IValidation<MilkioActionParams> => {
        if (false === __is(input)) {
            errors = [];
            $report = (typia.misc.validatePrune as any).report(errors);
            ((input: any, _path: string, _exceptionable: boolean = true) => ("object" === typeof input && null !== input || $report(true, {
                path: _path + "",
                expected: "MilkioActionParams",
                value: input
            })) && $vo0(input, _path + "", true) || $report(true, {
                path: _path + "",
                expected: "MilkioActionParams",
                value: input
            }))(input, "$input", true);
            const success = 0 === errors.length;
            return {
                success,
                errors,
                data: success ? input : undefined
            } as any;
        }
        return {
            success: true,
            errors: [],
            data: input
        } as any;
    }; const __prune = (input: MilkioActionParams): void => {
        if ("object" === typeof input && null !== input)
            $po0(input);
    }; return (input: any): typia.IValidation<MilkioActionParams> => {
        const result = __validate(input);
        if (result.success)
            __prune(input);
        return result;
    }; })()(results);
    if (!checkResult.success) {
        throw checkResult.errors.at(0)!;
    }
    return results;
};
