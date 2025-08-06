import { createFlow, reject, stream } from "milkio";

export default stream({
  async *handler(context, params: {}): AsyncGenerator<{ counter: number }> {
    const flow = createFlow<{ counter: number }>();

    setTimeout(() => {
      flow.emit({ counter: 500 });
    }, 500);
    setTimeout(() => {
      flow.emit({ counter: 1000 });
    }, 1000);
    setTimeout(() => {
      flow.emit({ counter: 1500 });
    }, 1500);
    setTimeout(() => {
      flow.throw(reject("FAIL", "FAIL"));
    }, 2000);

    for await (const chunk of flow) yield chunk;
  },
});
