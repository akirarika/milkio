import { join } from "node:path";
import { consola } from "consola";
import type { BunFile } from "bun";
import typia, { tags } from "typia";
import { exit, cwd } from "node:process";
import { TSON } from "@southern-aurora/tson";
import type { MilkioOptions } from "../..";
import type { MilkioActionParams } from "../../actions";
export const getOptions = async (milkioToml: BunFile) => {
    if (!(await milkioToml.exists())) {
        consola.error(`The "milkio.toml" file does not exist in the current directory: ${join(cwd())}`);
        exit(0);
    }
    const options = Bun.TOML.parse(await milkioToml.text());
    const checkResult = (() => { const $io0 = (input: any): boolean => "object" === typeof input.general && null !== input.general && $io1(input.general); const $io1 = (input: any): boolean => "number" === typeof input.developPort; const $vo0 = (input: any, _path: string, _exceptionable: boolean = true): boolean => [("object" === typeof input.general && null !== input.general || $report(_exceptionable, {
            path: _path + ".general",
            expected: "__type",
            value: input.general
        })) && $vo1(input.general, _path + ".general", true && _exceptionable) || $report(_exceptionable, {
            path: _path + ".general",
            expected: "__type",
            value: input.general
        })].every((flag: boolean) => flag); const $vo1 = (input: any, _path: string, _exceptionable: boolean = true): boolean => ["number" === typeof input.developPort || $report(_exceptionable, {
            path: _path + ".developPort",
            expected: "number",
            value: input.developPort
        })].every((flag: boolean) => flag); const __is = (input: any): input is MilkioOptions => "object" === typeof input && null !== input && $io0(input); let errors: any; let $report: any; return (input: any): typia.IValidation<MilkioOptions> => {
        if (false === __is(input)) {
            errors = [];
            $report = (typia.validate as any).report(errors);
            ((input: any, _path: string, _exceptionable: boolean = true) => ("object" === typeof input && null !== input || $report(true, {
                path: _path + "",
                expected: "MilkioOptions",
                value: input
            })) && $vo0(input, _path + "", true) || $report(true, {
                path: _path + "",
                expected: "MilkioOptions",
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
        consola.error(`"Milkio.toml" format is incorrect, [${error.path.slice(7)}] should be ${error.expected}, but it is actually ${error.value}`);
        exit(0);
    }
    return options as any;
};
export const getActionOptions = (options: string) => {
    const checkResult = (() => { const $io0 = (input: any): boolean => "object" === typeof input.general && null !== input.general && $io1(input.general); const $io1 = (input: any): boolean => "number" === typeof input.developPort; const $vo0 = (input: any, _path: string, _exceptionable: boolean = true): boolean => [("object" === typeof input.general && null !== input.general || $report(_exceptionable, {
            path: _path + ".general",
            expected: "__type",
            value: input.general
        })) && $vo1(input.general, _path + ".general", true && _exceptionable) || $report(_exceptionable, {
            path: _path + ".general",
            expected: "__type",
            value: input.general
        })].every((flag: boolean) => flag); const $vo1 = (input: any, _path: string, _exceptionable: boolean = true): boolean => ["number" === typeof input.developPort || $report(_exceptionable, {
            path: _path + ".developPort",
            expected: "number",
            value: input.developPort
        })].every((flag: boolean) => flag); const $po0 = (input: any): any => {
        if ("object" === typeof input.general && null !== input.general)
            $po1(input.general);
        for (const key of Object.keys(input)) {
            if ("general" === key)
                continue;
            delete input[key];
        }
    }; const $po1 = (input: any): any => {
        for (const key of Object.keys(input)) {
            if ("developPort" === key)
                continue;
            delete input[key];
        }
    }; const __is = (input: any): input is MilkioOptions => "object" === typeof input && null !== input && $io0(input); let errors: any; let $report: any; const __validate = (input: any): typia.IValidation<MilkioOptions> => {
        if (false === __is(input)) {
            errors = [];
            $report = (typia.misc.validatePrune as any).report(errors);
            ((input: any, _path: string, _exceptionable: boolean = true) => ("object" === typeof input && null !== input || $report(true, {
                path: _path + "",
                expected: "MilkioOptions",
                value: input
            })) && $vo0(input, _path + "", true) || $report(true, {
                path: _path + "",
                expected: "MilkioOptions",
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
    }; const __prune = (input: MilkioOptions): void => {
        if ("object" === typeof input && null !== input)
            $po0(input);
    }; return (input: any): typia.IValidation<MilkioOptions> => {
        const result = __validate(input);
        if (result.success)
            __prune(input);
        return result;
    }; })()(TSON.parse(options));
    if (!checkResult.success) {
        throw checkResult.errors.at(0)!;
    }
    return options;
};
