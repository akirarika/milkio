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

        content += `\n
export type MilkioRejectFunction = {
    <Code extends keyof MilkioRejectCode>(code: Code, ...data: MilkioRejectCode[Code] extends undefined ? [] | [undefined] : [MilkioRejectCode[Code]]): MilkioRejectError<Code, MilkioRejectCode[Code]>;
};
export type MilkioRaiseFunction = {
    <T>(obj: T): MilkioRejectError<Extract<keyof T, keyof MilkioRejectCode>, any>;
};
export type MilkioRejectError<Code extends keyof MilkioRejectCode = keyof MilkioRejectCode, RejectData extends MilkioRejectCode[Code] = MilkioRejectCode[Code]> = { code: Code; data: RejectData; stack: string; $milkioReject: true };
export interface MilkioRejectCode extends `;
        let codeIndex = 0;
        const codeKeys: string[] = [];
        for await (const file of allFiles) {
            header += `\nimport type { _ as code_${codeIndex} } from "../app/${file.path}";`;
            codeKeys.push(`code_${codeIndex}`);
            ++codeIndex;
        }
        if (codeKeys.length > 0) {
            const omitKeys = codeKeys.map((k) => `keyof ${k}`).join(" | ");
            content += `Omit<$rejectCode, ${omitKeys}>`;
            for (const k of codeKeys) {
                content += `, ${k}`;
            }
        } else {
            content += "$rejectCode";
        }
        content += " {}";

        return [header, types, content];
    },
});
