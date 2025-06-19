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
  const tcpServer = net.createServer();
  tcpServer.unref();

  try {
    tcpServer.listen(port);
    await once(tcpServer, "listening");
    return await checkUDP(port);
  } catch (err: any) {
    if (err.code === "EADDRINUSE") return false;
    return await checkUDP(port);
  } finally {
    tcpServer.close();
  }
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
