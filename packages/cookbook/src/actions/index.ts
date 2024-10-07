import { emitter } from "../emitter";

export type MilkioActionParams = {
  type: "milkio@logger";
  log: Array<any>;
};

export const actionHandler = async (options: MilkioActionParams): Promise<MilkioActionResultSuccess> => {
  if (options.type === "milkio@logger") {
    emitter.emit("data", {
      type: "milkio@logger",
      log: options.log,
    });
  }
  return {};
};

export type MilkioActionResultSuccess = {};
export type MilkioActionResultFail = { success: false };
