import { defineIdGenerator } from "milkid";

const idGenerator = defineIdGenerator({
  length: 24,
  timestamp: true,
  sequential: true,
});

export const createId = idGenerator.createId;
