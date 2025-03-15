import { search } from "@inquirer/prompts";
import { uniqWith } from "lodash-es";

export async function select<Data extends Record<any, any>>(data: Array<Data>, key: keyof Data): Promise<null | Data> {
    const items: Array<{ value: string }> = [];
    for (const itemName in data) {
        const item = (data[itemName]);
        items.push({ value: item[key] })
    }

    const selected = await search({
        message: "Select your item:",
        source: async (input) => {
            if (!input) return items;
            const filtered = items.filter((item) =>
                containsCharsInOrder(input.toLowerCase(), item.value.toLowerCase())
            );

            return uniqWith(filtered, (a, b) => a.value === b.value)
                .sort((a, b) => {
                    const scoreA = calculateScore(input, a.value);
                    const scoreB = calculateScore(input, b.value);

                    // 优先按最长连续匹配降序排序
                    if (scoreB.maxContiguous !== scoreA.maxContiguous) {
                        return scoreB.maxContiguous - scoreA.maxContiguous;
                    }

                    // 连续长度相同时，按匹配起始位置升序排序
                    return scoreA.firstMatchIndex - scoreB.firstMatchIndex;
                });
        },
    });
    
    const item = data.find((item) => item[key] === selected);
    if (!item) return null;
    return { ...item };
}

const containsCharsInOrder = (input: string, target: string): boolean => {
    let inputIndex = 0;
    for (const char of target) {
        if (char === input[inputIndex]) {
            inputIndex++;
            if (inputIndex === input.length) break;
        }
    }
    return inputIndex === input.length;
};
const calculateScore = (input: string, target: string) => {
    let maxContiguous = 0;
    let currentContiguous = 0;
    let firstMatchIndex = -1;

    let inputIndex = 0;
    for (let i = 0; i < target.length; i++) {
        if (target[i] === input[inputIndex]) {
            if (firstMatchIndex === -1) firstMatchIndex = i;
            currentContiguous++;
            inputIndex++;
            maxContiguous = Math.max(maxContiguous, currentContiguous);
        } else {
            currentContiguous = 0;
        }
    }

    return { maxContiguous, firstMatchIndex };
};