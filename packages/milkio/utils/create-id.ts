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
    // 前 8 字符: 时间戳 base36（Date.now().toString(36) 替代 BigInt，~100x 更快）
    const ts = Date.now().toString(36).padStart(8, "0");
    // 字符串拼接替代 Array.from + join，避免数组分配
    let id = ts;
    // 中间 6 字符: 纯随机
    for (let i = 0; i < 6; i++) {
        id += ENCODING.charAt(__fastIdPool[__fastIdPoolIndex++]! % ENCODING_LEN);
    }
    // 后 10 字符: 计数器 + 随机混合
    const counter = __fastIdCounter++;
    for (let i = 0; i < 10; i++) {
        const mix = (counter + __fastIdPool[__fastIdPoolIndex++ % 256]!) & 0xFFFF;
        id += ENCODING.charAt(mix % ENCODING_LEN);
    }
    return id;
}
