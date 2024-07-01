import { TSON } from "@southern-aurora/tson";

export type MilkioClientOptions = {
	baseUrl: string | (() => string) | (() => Promise<string>);
	timeout?: number;
	middlewares?: () => Array<MiddlewareOptions & { isMiddleware: true }>;
	fetch?: typeof fetch;
	abort?: typeof AbortController;
	storage?: {
		getItem: (key: string) => string | null | Promise<string | null>;
		setItem: (key: string, value: string) => void | Promise<void>;
		removeItem: (key: string) => void | Promise<void>;
	};
	memoryStorage?: boolean;
};

export const defineMilkioClient = <ApiSchema extends ApiSchemaExtend, FailCode extends FailCodeExtend>(builtinMiddlewares: Array<MiddlewareOptions & { isMiddleware: true }>) => {
	return (options: MilkioClientOptions) => {
		const $fetch = options.fetch ?? fetch;
		const $abort = options.abort ?? AbortController;
		const _bootstrapMiddlewares: Array<{
			id: string;
			index: number;
			middleware: BootstrapMiddleware;
		}> = [];
		const _beforeExecuteMiddlewares: Array<{
			id: string;
			index: number;
			middleware: BeforeExecuteMiddleware;
		}> = [];
		const _afterExecuteMiddlewares: Array<{
			id: string;
			index: number;
			middleware: AfterExecuteMiddleware;
		}> = [];

		if (options.memoryStorage === true) {
			const mapStorage = new Map<string, string>();
			options.storage = {
				async getItem(key: string) {
					return mapStorage.get(key) ?? null;
				},
				async setItem(key, value) {
					mapStorage.set(key, value);
				},
				async removeItem(key) {
					mapStorage.delete(key);
				},
			}
		} else if (!options.storage) {
			options.storage = localStorage;
		}

		const bootstrap = async () => {
			let baseUrl = options.baseUrl;
			if (typeof baseUrl === "function") baseUrl = await baseUrl();
			if (!baseUrl.endsWith("/")) baseUrl = `${baseUrl}/`;

			if (options.middlewares) {
				const middlewares = [...builtinMiddlewares, ...options.middlewares()];

				const push = (index: number, middlewares: Array<any>, middleware: any) => {
					const id = ++guid;
					middlewares.push({ id, index, middleware });
					return () =>
						middlewares.splice(
							middlewares.findIndex((v) => v.id === id),
							1,
						);
				};

				const _middlewareHandler = (index: number, options: MiddlewareOptions) => {
					if (options.bootstrap) push(index, _bootstrapMiddlewares, options.bootstrap);
					if (options.beforeExecute) push(index, _beforeExecuteMiddlewares, options.beforeExecute);
					if (options.afterExecute) push(index, _afterExecuteMiddlewares, options.afterExecute);
				};

				for (let index = 0; index < middlewares.length; index++) {
					const middlewareOptions = middlewares[index];
					_middlewareHandler(index, middlewareOptions);
				}

				_bootstrapMiddlewares.sort((a, b) => a.index - b.index);
				_beforeExecuteMiddlewares.sort((a, b) => a.index - b.index);
				_afterExecuteMiddlewares.sort((a, b) => b.index - a.index);

				for (const m of _bootstrapMiddlewares) {
					await m.middleware({ storage: options.storage as ClientStorage });
				}
			}

			return baseUrl;
		};

		const baseUrl: Promise<string> = bootstrap();

		const client = {
			options,
			async execute<Path extends keyof ApiSchema["apiMethodsTypeSchema"], Params extends ExecuteParams<Path>>(path: Path, executeOptions: { params: Params } & ExecuteOptions): Promise<ExecuteResult<Path>> {
				if (executeOptions.headers === undefined) executeOptions.headers = {};
				const url = (await baseUrl) + (path as string);

				if (executeOptions.headers["Accept"] === undefined) executeOptions.headers["Accept"] = "application/json";
				if (executeOptions.headers["Content-Type"] === undefined) executeOptions.headers["Content-Type"] = "application/json";

				for (const m of _beforeExecuteMiddlewares) {
					await m.middleware({ path: path as string, params: executeOptions.params, headers: executeOptions.headers, storage: options.storage as ClientStorage });
				}

				const body = TSON.stringify(executeOptions.params) ?? "";

				let result: { value: Record<any, any> }
				try {
					const response = await new Promise<string>(async (resolve, reject) => {
						const timeout = executeOptions?.timeout ?? options?.timeout ?? 6000;
						const timer = setTimeout(() => {
							reject(defineClientFail("execute-timeout", `Execute timeout after ${timeout}ms.`));
						}, timeout);

						try {
							const value = await (await $fetch(url, { method: "POST", body, headers: executeOptions.headers })).text();
							clearTimeout(timer);
							resolve(value);
						} catch (error) {
							reject(error);
						}
					});
					result = { value: TSON.parse(response) };
				} catch (error) {
					result = {
						value: {
							success: false,
							fail: {
								fromClient: true,
								code: 'NETWORK_ERROR',
								message: '',
								data: undefined,
							},
						}
					}
					return { ...result.value } as any;
				}

				for (const m of _afterExecuteMiddlewares) {
					await m.middleware({ path: path as string, storage: options.storage as ClientStorage, result });
				}

				return { ...result.value } as any;
			},

			executeStream<Path extends keyof ApiSchema["apiMethodsTypeSchema"], Params extends ExecuteParams<Path>, TypeSafeErrorPath extends keyof ExecuteParams<Path> = keyof ExecuteParams<Path>>(
				path: Path,
				eventOptions: { params: Params } & ExecuteStreamOptions,
			): {
				stream: AsyncGenerator<MilkioEvent<Path>>,
				getResult: () => (
					| {
						success: true;
						executeId: string;
					})
					| {
						success: false;
						executeId: string;
						fromClient: true | undefined,
						fail: {
							code: Exclude<keyof FailCode, "TYPE_SAFE_ERROR">;
							message: string;
							data: any;
						};
					}
					| {
						success: false;
						executeId: string;
						fail: {
							code: "TYPE_SAFE_ERROR";
							fromClient: true | undefined;
							message: string;
							data: {
								path: FlattenKeys<TypeSafeErrorPath> | "$input",
								expected: string,
								value: any
							}
						};
					}
			} {
				if (eventOptions.headers === undefined) eventOptions.headers = {};
				eventOptions.headers = { ...eventOptions.headers };
				if (eventOptions.headers['Accept'] === undefined) eventOptions.headers['Accept'] = 'text/event-stream';
				if (eventOptions.headers["Content-Type"] === undefined) eventOptions.headers["Content-Type"] = "application/json";
				const url = async () => ((await baseUrl) + (path as string));
				const body = TSON.stringify(eventOptions.params) ?? "";
				const stacks: Map<number, {
					promise: Promise<IteratorResult<any>>;
					resolve: (value: IteratorResult<any>) => void;
					reject: (reason: any) => void;
				}> = new Map();
				let stacksIndex: number = 0;
				let iteratorIndex: number = 0;
				let streamResult: any = undefined;

				const onmessage = (event: EventSourceMessage) => {
					if (event.data.startsWith("@")) {
						streamResult = TSON.parse(event.data.slice(1));
						return;
					} else {
						const index = ++stacksIndex;
						if (stacks.has(index)) stacks.get(index)!.resolve({ done: false, value: TSON.parse(event.data) });
						else {
							const stack = Promise.withResolvers<IteratorResult<any>>();
							stack.resolve({ done: false, value: TSON.parse(event.data) });
							stacks.set(index, stack);
						}
					}
				}

				let curRequestController: AbortController;

				async function create() {
					curRequestController = new $abort();
					curRequestController.signal.addEventListener('abort', () => iterator.return());
					try {
						for (const m of _beforeExecuteMiddlewares) {
							await m.middleware({ path: path as string, params: eventOptions.params, headers: eventOptions.headers!, storage: options.storage as ClientStorage });
						}

						const response = await $fetch(await url(), {
							method: 'POST',
							headers: eventOptions.headers,
							body: body,
							signal: curRequestController.signal,
						});

						const contentType = response.headers.get('Content-Type');
						if (!contentType?.startsWith('text/event-stream')) {
							throw new Error(`Expected content-type to be ${'text/event-stream'}, Actual: ${contentType}`);
						}

						await getBytes(response.body!, getLines(getMessages(onmessage)));

						for (const m of _afterExecuteMiddlewares) {
							await m.middleware({ path: path as string, storage: options.storage as ClientStorage, result: { value: undefined } });
						}

						await iterator.return();
					} catch (err) {
						if (!curRequestController.signal.aborted) curRequestController.abort();
						await iterator.throw(err);
					}
				}

				void create();

				const iterator = {
					...{
						next(): Promise<IteratorResult<unknown>> {
							const index = ++iteratorIndex;
							if (stacks.has(index - 2)) stacks.delete(index - 2);
							if (stacks.has(index)) {
								return stacks.get(index)!.promise;
							}
							else {
								const stack = Promise.withResolvers<IteratorResult<any>>();
								stacks.set(index, stack);
								return stack.promise;
							}
						},
						async return(): Promise<IteratorResult<void>> {
							if (!curRequestController.signal.aborted) curRequestController.abort();
							for (const [_, iterator] of stacks) iterator.resolve({ done: true, value: undefined });
							return { done: true, value: undefined }
						},
						async throw(err: any): Promise<IteratorResult<void>> {
							streamResult = {
								success: false,
								executeId: streamResult?.executeId ?? '',
								fail: {
									code: "NETWORK_ERROR",
									message: "Network Error",
									fromClient: true,
									data: err,
								}
							};
							if (!curRequestController.signal.aborted) curRequestController.abort();
							for (const [_, iterator] of stacks) iterator.resolve({ done: true, value: undefined });
							return { done: true, value: undefined }
						}
					} satisfies AsyncIterator<unknown>,
					[Symbol.asyncIterator]() {
						return this;
					},
				};

				return { getResult: () => streamResult, stream: iterator as any };
			},
		};

		type ExecuteParams<Path extends keyof ApiSchema["apiMethodsSchema"]> = Awaited<Parameters<ApiSchema["apiMethodsTypeSchema"][Path]["api"]["action"]>[0]>;
		type ExecuteResult<Path extends keyof ApiSchema["apiMethodsTypeSchema"], TypeSafeErrorPath extends ExecuteParams<Path> = ExecuteParams<Path>> =
			| {
				success: true;
				executeId: string;
				data: Awaited<ReturnType<ApiSchema["apiMethodsTypeSchema"][Path]["api"]["action"]>>;
			}
			| {
				success: false;
				executeId: string;
				fail: {
					code: "TYPE_SAFE_ERROR";
					fromClient: true | undefined;
					message: string;
					data: {
						path: FlattenKeys<TypeSafeErrorPath> | "$input",
						expected: string,
						value: any
					}
				};
			}
			| {
				success: false;
				executeId: string;
				fail: {
					code: Exclude<keyof FailCode, "TYPE_SAFE_ERROR">;
					fromClient: true | undefined;
					message: string;
					data: any;
				};
			};
		type MilkioEventResult<Path extends keyof ApiSchema["apiMethodsTypeSchema"]> = Awaited<ReturnType<ApiSchema["apiMethodsTypeSchema"][Path]["api"]["action"]>>;
		type MilkioEvent<Path extends keyof ApiSchema["apiMethodsTypeSchema"]> = Awaited<GeneratorGeneric<MilkioEventResult<Path>>>;


		return client;
	};
};

export function defineMiddleware(options: MiddlewareOptions): () => MiddlewareOptions & { isMiddleware: true } {
	return () => ({
		...options,
		isMiddleware: true,
	});
}

export const defineClientFail = (code: string, message: string, data?: unknown) => ({
	success: false,
	fail: {
		fromClient: true,
		code,
		message,
		data,
	},
});

let guid = 0;

export type ExecuteOptions = {
	headers?: Record<string, string>;
	timeout?: number;
};

export type ExecuteStreamOptions = {
	headers?: Record<string, string>;
	timeout?: number;
};

export type ApiSchemaExtend = {
	apiValidator: {
		generatedAt: number;
		validate: Record<any, any>;
	};
	apiMethodsSchema: Record<any, any>;
	apiMethodsTypeSchema: Record<any, any>;
	apiTestsSchema: Record<any, any>;
};

export type FailCodeExtend = Record<any, (...args: Array<any>) => any>;

export type BootstrapMiddleware = (data: { storage: ClientStorage }) => Promise<void> | void;
export type BeforeExecuteMiddleware = (data: { path: string; params: any; headers: Record<string, string>; storage: ClientStorage }) => Promise<void> | void;
export type AfterExecuteMiddleware = (data: { path: string; result: { value: any }; storage: ClientStorage }) => Promise<void> | void;

export type MiddlewareOptions = {
	bootstrap?: BootstrapMiddleware;
	beforeExecute?: BeforeExecuteMiddleware;
	afterExecute?: AfterExecuteMiddleware;
};

export type ClientStorage = {
	getItem: (key: string) => Promise<string | null>;
	setItem: (key: string, value: string) => Promise<void>;
	removeItem: (key: string) => Promise<void>;
};

export type ExecuteResultSuccess<Result> = {
	executeId: string;
	success: true;
	data: Result;
};

export type GeneratorGeneric<T> = T extends AsyncGenerator<infer I> ? I : never;

export type FlattenKeys<T extends any, Prefix extends string = ''> = {
	[K in keyof T]: T[K] extends object
	? FlattenKeys<T[K], `${Prefix}${Exclude<K, symbol>}.`>
	: `$input.${Prefix}${Exclude<K, symbol>}`
}[keyof T];

// *** This part of the code is based on `@microsoft/fetch-event-source` rewrite, thanks to the work of Microsoft *** //
// *** https://github.com/Azure/fetch-event-source/blob/main/src/parse.ts                                         *** //

/**
 * Represents a message sent in an event stream
 * https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format
 */
export interface EventSourceMessage {
	data: string;
}

/**
* Converts a ReadableStream into a callback pattern.
* @param stream The input ReadableStream.
* @param onChunk A function that will be called on each new byte chunk in the stream.
* @returns {Promise<void>} A promise that will be resolved when the stream closes.
*/
export async function getBytes(stream: ReadableStream<Uint8Array>, onChunk: (arr: Uint8Array) => void) {
	const reader = stream.getReader();
	let result: ReadableStreamReadResult<Uint8Array>;
	while (!(result = await reader.read()).done) {
		onChunk(result.value);
	}
}

const enum ControlChars {
	NewLine = 10,
	CarriageReturn = 13,
	Space = 32,
	Colon = 58,
}

/** 
* Parses arbitary byte chunks into EventSource line buffers.
* Each line should be of the format "field: value" and ends with \r, \n, or \r\n. 
* @param onLine A function that will be called on each new EventSource line.
* @returns A function that should be called for each incoming byte chunk.
*/
export function getLines(onLine: (line: Uint8Array, fieldLength: number) => void) {
	let buffer: Uint8Array | undefined;
	let position: number; // current read position
	let fieldLength: number; // length of the `field` portion of the line
	let discardTrailingNewline = false;

	// return a function that can process each incoming byte chunk:
	return function onChunk(arr: Uint8Array) {
		if (buffer === undefined) {
			buffer = arr;
			position = 0;
			fieldLength = -1;
		} else {
			// we're still parsing the old line. Append the new bytes into buffer:
			buffer = concat(buffer, arr);
		}

		const bufLength = buffer.length;
		let lineStart = 0; // index where the current line starts
		while (position < bufLength) {
			if (discardTrailingNewline) {
				if (buffer[position] === ControlChars.NewLine) {
					lineStart = ++position; // skip to next char
				}

				discardTrailingNewline = false;
			}

			// start looking forward till the end of line:
			let lineEnd = -1; // index of the \r or \n char
			for (; position < bufLength && lineEnd === -1; ++position) {
				switch (buffer[position]) {
					case ControlChars.Colon:
						if (fieldLength === -1) { // first colon in line
							fieldLength = position - lineStart;
						}
						break;
					// @ts-ignore:7029 \r case below should fallthrough to \n:
					case ControlChars.CarriageReturn:
						discardTrailingNewline = true;
					case ControlChars.NewLine:
						lineEnd = position;
						break;
				}
			}

			if (lineEnd === -1) {
				// We reached the end of the buffer but the line hasn't ended.
				// Wait for the next arr and then continue parsing:
				break;
			}

			// we've reached the line end, send it out:
			onLine(buffer.subarray(lineStart, lineEnd), fieldLength);
			lineStart = position; // we're now on the next line
			fieldLength = -1;
		}

		if (lineStart === bufLength) {
			buffer = undefined; // we've finished reading it
		} else if (lineStart !== 0) {
			// Create a new view into buffer beginning at lineStart so we don't
			// need to copy over the previous lines when we get the new arr:
			buffer = buffer.subarray(lineStart);
			position -= lineStart;
		}
	}
}

/** 
* Parses line buffers into EventSourceMessages.
* @param onId A function that will be called on each `id` field.
* @param onRetry A function that will be called on each `retry` field.
* @param onMessage A function that will be called on each message.
* @returns A function that should be called for each incoming line buffer.
*/
export function getMessages(
	onMessage?: (msg: EventSourceMessage) => void
) {
	let message = newMessage();
	const decoder = new TextDecoder();

	// return a function that can process each incoming line buffer:
	return function onLine(line: Uint8Array, fieldLength: number) {
		if (line.length === 0) {
			// empty line denotes end of message. Trigger the callback and start a new message:
			onMessage?.(message);
			message = newMessage();
		} else if (fieldLength > 0) { // exclude comments and lines with no values
			// line is of format "<field>:<value>" or "<field>: <value>"
			// https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
			const field = decoder.decode(line.subarray(0, fieldLength));
			const valueOffset = fieldLength + (line[fieldLength + 1] === ControlChars.Space ? 2 : 1);
			const value = decoder.decode(line.subarray(valueOffset));

			switch (field) {
				case 'data':
					// if this message already has data, append the new value to the old.
					// otherwise, just set to the new value:
					message.data = message.data
						? message.data + '\n' + value
						: value; // otherwise, 
					break;
			}
		}
	}
}

function concat(a: Uint8Array, b: Uint8Array) {
	const res = new Uint8Array(a.length + b.length);
	res.set(a);
	res.set(b, a.length);
	return res;
}

function newMessage(): EventSourceMessage {
	return {
		data: '',
	};
}