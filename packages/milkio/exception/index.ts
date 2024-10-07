import { TSON } from "@southern-aurora/tson";
import { type MilkioResponseReject, type Logger } from "..";

export interface $rejectCode {
  FAIL: string;
  REQUEST_FAIL: any;
  NOT_DEVELOP_MODE: string;
  REQUEST_TIMEOUT: { timeout: number; message: string };
  NOT_FOUND: { path: string };
  PARAMS_TYPE_INCORRECT: { path: string; expected: string; value: any; message: string } | null;
  RESULTS_TYPE_INCORRECT: { path: string; expected: string; value: any; message: string } | null;
  UNACCEPTABLE: { expected: string; message: string };
  PARAMS_TYPE_NOT_SUPPORTED: { expected: string };
  INTERNAL_SERVER_ERROR: undefined;
}

export function reject<Code extends keyof $rejectCode, RejectData extends $rejectCode[Code]>(code: Code, data: RejectData): MilkioRejectError<Code, RejectData> {
  const error = { $milkioReject: true, code: code, data: data } as MilkioRejectError<Code, RejectData>;
  Error.captureStackTrace(error);
  return error;
}

export type MilkioRejectError<Code extends keyof $rejectCode = keyof $rejectCode, RejectData extends $rejectCode[Code] = $rejectCode[Code]> = { code: Code; data: RejectData; stack: string; $milkioReject: true };

export function exceptionHandler(executeId: string, logger: Logger, error: MilkioRejectError<any, any> | any): MilkioResponseReject {
  const name = error?.code ?? error?.name ?? error?.constructor?.name ?? "Unnamed Exception";

  if (error?.$milkioReject === true && error?.code === "NOT_FOUND") {
    logger.info(name, error?.data?.path ?? "Unknown path");
  } else {
    try {
      const stack = error?.$milkioReject ? (error?.stack ?? "").split("\n").slice(2).join("\n") : error?.stack ?? "";
      logger.error(name, `\n${TSON.stringify(error?.data)}`, `\n${stack}\n`);
    } catch (_) {
      logger.error(name, `\n${error?.toString()}`, `\n${error?.stack}\n`);
    }
  }

  let result: MilkioResponseReject;

  if (error?.$milkioReject === true) result = { success: false, code: error.code, reject: error.data, executeId };
  else result = { success: false, code: "INTERNAL_SERVER_ERROR", reject: undefined, executeId };

  return result;
}
