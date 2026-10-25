import { defineWatcherExtension } from "../extensions";

export const codeWatcherExtension = defineWatcherExtension({
    async: true,
    filter: (file) => {
        return file.type === "code";
    },
    declares: async (root, mode, options, project, changeFiles, allFiles) => {
        let header = "";
        const types = "";
        let content = "";

        // Sort by path so the generated declares order is stable (glob order is not guaranteed).
        const codeFiles = [...allFiles].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

        const failKeys: Array<string> = [];
        const faultKeys: Array<string> = [];
        let codeIndex = 0;
        for (const file of codeFiles) {
            header += `\nimport type { Fail as fail_${codeIndex}, Fault as fault_${codeIndex} } from "../app/${file.path}";`;
            failKeys.push(`fail_${codeIndex}`);
            faultKeys.push(`fault_${codeIndex}`);
            ++codeIndex;
        }

        content += `\nexport interface MilkioFailCode extends $failCode`;
        for (const key of failKeys) content += `, ${key}`;
        content += " {}";

        content += `\nexport interface MilkioFaultCode extends $faultCode`;
        for (const key of faultKeys) content += `, ${key}`;
        content += " {}";

        content += `\n
// A code must belong to exactly one bucket (fail or fault), otherwise client narrowing is ambiguous.
type $AssertTrue<T extends true> = T;
export type $NoCodeInBothKinds = $AssertTrue<[Extract<keyof MilkioFailCode, keyof MilkioFaultCode>] extends [never] ? true : false>;

/** Server-side fail union (data is part of the client contract) */
export type MilkioFailAny = { [K in keyof MilkioFailCode & string]: MilkioFail<K, MilkioFailCode[K]> }[keyof MilkioFailCode & string];

/** Server-side fault union (data/stack are only used internally) */
export type MilkioFaultAny = { [K in keyof MilkioFaultCode & string]: MilkioFaultShape<K, MilkioFaultCode[K]> }[keyof MilkioFaultCode & string];

/** Client-visible union: all fail-codes + one generic fault shape; internal fault-codes are never exposed here */
export type MilkioPublicFailure = MilkioFailAny | MilkioPublicFault;

export type MilkioFailFunction = <Code extends keyof MilkioFailCode & string>(
    code: Code,
    ...data: MilkioFailCode[Code] extends undefined ? [] | [undefined] : [MilkioFailCode[Code]]
) => MilkioFail<Code, MilkioFailCode[Code]>;

export type MilkioFaultFunction = <Code extends keyof MilkioFaultCode & string>(
    code: Code,
    ...data: MilkioFaultCode[Code] extends undefined ? [] | [undefined] : [MilkioFaultCode[Code]]
) => MilkioFaultShape<Code, MilkioFaultCode[Code]>;
`;

        return [header, types, content];
    },
});
