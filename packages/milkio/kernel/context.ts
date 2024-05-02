import type { ExecuteId, Logger, MilkioHttpResponse } from "..";

export type MilkioContext = {
	path: string;
	executeId: ExecuteId;
	headers: Headers;
	logger: Logger;
	/**
	 * Additional information about the request
	 * These are usually only fully implemented when called by an Http server
	 * During testing or when calling between microservices, some or all of the values may be undefined
	 */
	detail: Partial<FrameworkHttpDetail>;
};

export type FrameworkHttpDetail = {
	path: string;
	executeId: ExecuteId;
	fullurl: URL;
	ip: string;
	request: Request;
	response: MilkioHttpResponse;
};
