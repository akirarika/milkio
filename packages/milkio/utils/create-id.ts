type IdGeneratorOptions = {
  length?: number;
  timestamp: boolean;
  sequential: boolean;
};

function defineIdGenerator(options: IdGeneratorOptions) {
  if (!options.length) options.length = 24;
  if (options.length < 1) throw new Error("Invalid length");
  if (options.length > 61) throw new Error("Invalid length");
  if (options.timestamp && options.length < 9) throw new Error("Invalid length");
  let lastTime = 0;
  let lastDecimal = 0n;
  return {
    createId() {
      let randLength = options.length!;
      const now = Date.now();
      let id = "";
      if (options.timestamp) {
        randLength -= 8;
        id = `${id}${__bigIntToString(BigInt(now)).padStart(8, "0")}`;
      }
      if (options.sequential && lastTime === now) {
        id = `${id}${__bigIntToString(++lastDecimal).padStart(1, "0")}`;
      } else {
        lastTime = now;
        const min = 0n;
        const max = __getMaxValue(BigInt(randLength));
        lastDecimal = __secureRandomBigInt(min, max);
        id = `${id}${__bigIntToString(lastDecimal).padStart(randLength, "0")}`;
      }
      return id;
    },
    getIdTimestamp(id: string) {
      return options.timestamp ? Number(__stringToBigInt(id.slice(0, 8).replaceAll("0", ""))) : 0;
    },
  };
}

const ENCODING = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function __secureRandomBigInt(min: bigint, max: bigint): bigint {
  if (min >= max) throw new Error("Invalid range");

  const range = max - min + 1n;
  const byteCount = Math.ceil(Number(BigInt(range.toString(2).length)) / 8);
  const entropyBytes = new Uint8Array(byteCount);

  let randomValue: bigint;
  do {
    crypto.getRandomValues(entropyBytes);
    randomValue =
      BigInt(
        `0x${Array.from(entropyBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}`,
      ) % range;
  } while (randomValue < 0n);

  return min + randomValue;
}

function __bigIntToString(value: bigint): string {
  const base = BigInt(ENCODING.length);
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

function __stringToBigInt(str: string): bigint {
  const charMap: { [key: string]: number } = {};
  for (let i = 0; i < ENCODING.length; i++) {
    charMap[ENCODING[i]] = i;
  }

  const base = BigInt(ENCODING.length);
  let result = 0n;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (!(char in charMap)) {
      throw new Error(`Invalid character '${char}' in input string`);
    }
    const value = BigInt(charMap[char]);
    result = result * base + value;
  }

  return result;
}

function __getMaxValue(n: bigint): bigint {
  return BigInt(ENCODING.length) ** n - 1n;
}

const idGenerator = defineIdGenerator({ length: 24, timestamp: false, sequential: false });

export const __createId = idGenerator.createId;
