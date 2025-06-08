import net from "node:net";

export async function checkPort(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const handler = (fail: boolean) => {
      clearTimeout(timer);
      resolve(!fail);
    };
    const tester = net
      .createServer()
      .once("error", (err: any) => {
        if (err.code !== "EADDRINUSE") return handler(false);
        handler(true);
      })
      .once("listening", () => {
        tester
          .once("close", () => {
            handler(false);
          })
          .close();
      })
      .listen(port);
    const timer = setTimeout(() => {
      handler(true);
      tester.close();
    }, 6000);
  });
}
