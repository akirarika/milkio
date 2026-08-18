import net from "node:net";
import dgram from "node:dgram";
import { once } from "node:events";

const MIN_PORT = 32767;
const MAX_PORT = 65535;

export async function getRandomPort(): Promise<number> {
  const attemptedPorts = new Set<number>();

  while (true) {
    const port = Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1)) + MIN_PORT;

    if (attemptedPorts.has(port)) continue;
    attemptedPorts.add(port);

    if (await isPortAvailable(port)) {
      return port;
    }
  }
}

async function isPortAvailable(port: number): Promise<boolean> {
  // 仅绑定 IPv4 (0.0.0.0) 的进程（如 mysqld）不会被默认的 IPv6 双栈 bind
  // 检测到，导致 getRandomPort 误判端口可用，随后 Bun.serve 绑定即抛
  // EADDRINUSE。必须分别探测 IPv4 与 IPv6 两个地址族。
  if (!(await isTcpHostAvailable(port, "0.0.0.0"))) return false;
  if (!(await isTcpHostAvailable(port, "::"))) return false;

  const udpOk = await checkUDP(port);
  if (!udpOk) return false;

  return true;
}

async function isTcpHostAvailable(port: number, host: string): Promise<boolean> {
  const tcpServer = net.createServer();
  tcpServer.unref();

  let tcpBound = false;
  try {
    tcpServer.listen({ port, host });
    await once(tcpServer, "listening");
    tcpBound = true;
  } catch (err: any) {
    if (err.code === "EADDRINUSE") return false;
  }

  if (tcpBound) {
    // tcpServer.close() 是异步的，若未等其完成就返回端口，调用方立即
    // bind 同一端口会因端口尚未释放而 EADDRINUSE（Bun.serve 直接抛错）。
    // 必须等 close 完成、端口真正从内核释放后再返回。
    await new Promise<void>((resolve) => {
      tcpServer.close(() => resolve());
      // listen 成功但 close 前连接未建立时 close 回调必然触发；防御性兜底
      tcpServer.on("error", () => resolve());
    });
  }
  return true;
}

async function checkUDP(port: number): Promise<boolean> {
  const udpSocket = dgram.createSocket("udp4");
  udpSocket.unref();

  try {
    udpSocket.bind(port);
    await once(udpSocket, "listening");
    return true;
  } catch (err: any) {
    return err.code !== "EADDRINUSE";
  } finally {
    try {
      udpSocket.close();
    } catch {}
  }
}
