import type { $context, $meta } from "../index.ts";

export function stream<StreamInitT extends StreamInit>(init: StreamInitT): Stream<StreamInitT> {
  const stream = init as unknown as Stream<StreamInitT>;
  stream.$milkioType = "stream";
  if (stream.meta === undefined) stream.meta = {};
  return stream;
}

export type StreamInit = {
  meta?: $meta;
  handler: (context: $context, params: any) => AsyncGenerator<unknown>;
};

export type Stream<StreamInitT extends StreamInit> = {
  $milkioType: "stream";
  meta: StreamInitT["meta"] extends undefined ? {} : StreamInitT["meta"];
  handler: StreamInitT["handler"];
};
