export type SSEMessage = {
  data: any;
  event?: string;
  id?: string;
};

export async function* fetchEventSource(input: string | URL | globalThis.Request, init?: RequestInit): AsyncIterableIterator<SSEMessage> {
  const response = await fetch(input, {
    ...init,
    headers: {
      Accept: "text/event-stream",
      ...init?.headers,
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`SSE request failed: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const eventEndIndex = buffer.indexOf("\n\n");
        if (eventEndIndex === -1) {
          break;
        }

        const eventData = buffer.slice(0, eventEndIndex);
        buffer = buffer.slice(eventEndIndex + 2);

        const message: SSEMessage = { data: "" };
        for (const line of eventData.split("\n")) {
          const colonIndex = line.indexOf(":");
          if (colonIndex === -1) continue;

          const field = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim();

          switch (field) {
            case "event":
              message.event = value;
              break;
            case "data":
              message.data += `${value}\n`;
              break;
            case "id":
              message.id = value;
              break;
          }
        }

        if (message.data && message.data.trim() !== "") {
          try {
            message.data = JSON.parse(message.data.trim());
            yield message;
          } catch (error) {}
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
