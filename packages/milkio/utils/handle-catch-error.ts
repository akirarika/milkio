import { failCode } from "../../../src/fail-code";
import { loggerPushTags, useLogger, type ExecuteId, type ExecuteResult } from "..";
import { configMilkio } from "../../../src/config/milkio";

export function handleCatchError(error: any, executeId: ExecuteId): ExecuteResult<any> {
	const logger = useLogger(executeId);

	if (configMilkio.debug !== false) {
		logger.error(`Error Data: ${JSON.stringify(error)}`);
		if (error.stack) logger.error("Error Stack: ", error.stack);
		else logger.error("Error Stack: ", error);
	}

	let result: ExecuteResult<any>;

	if (error.name !== "MilkioReject") {
		if (configMilkio.debug !== false) {
			// If it is not MilkioReject, it is considered an internal server error that should not be exposed
			logger.error(`FailCode: INTERNAL_SERVER_ERROR`);
		}

		result = {
			executeId,
			success: false,
			fail: {
				code: "INTERNAL_SERVER_ERROR",
				message: failCode.INTERNAL_SERVER_ERROR(),
				data: undefined,
			},
		};
	} else {
		if (configMilkio.debug !== false) {
			logger.error(`FailCode: ${error.code}`);
		}

		result = {
			executeId,
			success: false,
			fail: {
				code: error.code,
				message: error.message,
				data: error.data,
			},
		};
	}

	loggerPushTags(executeId, {
		fail: result,
	});

	return result;
}
