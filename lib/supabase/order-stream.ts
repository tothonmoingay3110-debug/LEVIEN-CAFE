import { createAdminClient } from "./admin";

type OrderStreamOptions = {
  filter?: string;
  channelPrefix: "admin-orders" | "tracked-order" | "order-display";
};

export function createOrderEventStream(request: Request, options: OrderStreamOptions) {
  const encoder = new TextEncoder();
  const supabase = createAdminClient();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;

      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const send = (event: string, payload: object) => {
        enqueue(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
      };

      let channel = supabase
        .channel(`${options.channelPrefix}-${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            ...(options.filter ? { filter: options.filter } : {}),
          },
          () => send("orders", { changed: true }),
        );

      cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        void supabase.removeChannel(channel);
        try {
          controller.close();
        } catch {
          // The browser may already have closed the stream.
        }
      };

      channel = channel.subscribe((status) => {
        if (status === "SUBSCRIBED") send("ready", { connected: true });
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          send("unavailable", { connected: false });
        }
      });

      enqueue("retry: 3000\n\n");
      heartbeat = setInterval(() => enqueue(": keepalive\n\n"), 15000);
      request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
