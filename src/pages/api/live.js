export const prerender = false;

// Global array to hold active SSE connections
globalThis.liveClients = globalThis.liveClients || [];

export async function GET({ request }) {
  const url = new URL(request.url);
  const matchId = url.searchParams.get('matchId');

  let controllerRef = null;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
      // Store connection along with the matchId they are watching
      const client = {
        controller,
        matchId
      };
      globalThis.liveClients.push(client);

      // Send initial connection event
      controller.enqueue(new TextEncoder().encode("data: connected\n\n"));
    },
    cancel() {
      // Remove connection on close
      globalThis.liveClients = globalThis.liveClients.filter(c => c.controller !== controllerRef);
    }
  });

  // Setup periodic ping (keep-alive) every 25 seconds to prevent timeout
  const pingInterval = setInterval(() => {
    try {
      if (controllerRef) {
        controllerRef.enqueue(new TextEncoder().encode(": keep-alive\n\n"));
      }
    } catch (e) {
      clearInterval(pingInterval);
      globalThis.liveClients = globalThis.liveClients.filter(c => c.controller !== controllerRef);
    }
  }, 25000);

  // Clean up interval if connection drops
  request.signal.addEventListener('abort', () => {
    clearInterval(pingInterval);
    globalThis.liveClients = globalThis.liveClients.filter(c => c.controller !== controllerRef);
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}

// Helper function to broadcast message to all clients watching a specific match
export function broadcastToMatch(matchId, data) {
  if (!globalThis.liveClients || globalThis.liveClients.length === 0) return;

  const message = `data: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(message);

  globalThis.liveClients.forEach(client => {
    if (client.matchId === matchId) {
      try {
        client.controller.enqueue(encoded);
      } catch (err) {
        // Remove inactive or failed connections
        globalThis.liveClients = globalThis.liveClients.filter(c => c !== client);
      }
    }
  });
}
