const ENCODING = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ENCODING_LEN = ENCODING.length;

let __fastIdPool = new Uint8Array(256);
let __fastIdPoolIndex = 256;
let __fastIdCounter = 0;

export function __createId(): string {
    if (__fastIdPoolIndex + 16 > 256) {
        crypto.getRandomValues(__fastIdPool);
        __fastIdPoolIndex = 0;
    }
    const id = Array.from<string>({ length: 24 });
    // 前 8 字符: 时间戳 base62（同一毫秒内相同，由后续 counter 区分）
    const ts = __bigIntToString(BigInt(Date.now())).padStart(8, "0");
    for (let i = 0; i < 8; i++) {
        id[i] = ts[i];
    }
    // 中间 6 字符: 纯随机
    for (let i = 8; i < 14; i++) {
        id[i] = ENCODING[__fastIdPool[__fastIdPoolIndex++] % ENCODING_LEN];
    }
    // 后 10 字符: 计数器 + 随机混合
    const counter = __fastIdCounter++;
    for (let i = 14; i < 24; i++) {
        const mix = (counter + __fastIdPool[__fastIdPoolIndex++ % 256]) & 0xFFFF;
        id[i] = ENCODING[mix % ENCODING_LEN];
    }
    return id.join("");
}

function __bigIntToString(value: bigint): string {
    const base = BigInt(ENCODING_LEN);
    let result = "";
    let current = value;

    if (current === 0n) return ENCODING[0];

    while (current > 0n) {
        const remainder = current % base;
        result = ENCODING[Number(remainder)] + result;
        current = current / base;
    }
    return result;
}
