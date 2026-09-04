import { confirm, input, select } from "@inquirer/prompts";
import type { CookbookPromptOption } from "@milkio/cookbook-command";

export type PromptOptions = CookbookPromptOption;

export async function prompt<T = any>(message: string, options?: CookbookPromptOption): Promise<T> {
    if (!options) {
        throw new Error(`Missing prompt options for: ${message}`);
    }

    switch (options.type) {
        case "confirm":
            return (await confirm({ message, default: options.initial })) as T;
        case "text":
            return (await input({ message, default: options.placeholder ?? options.default })) as T;
        case "select": {
            const choices = (options.options ?? []).map((item) => ({
                name: item.label,
                value: item.value,
                description: item.description,
                disabled: item.disabled,
            }));
            return (await select({ message, choices, default: options.default, loop: options.loop })) as T;
        }
        default:
            throw new Error(`Unsupported prompt type: ${(options as any).type}`);
    }
}
