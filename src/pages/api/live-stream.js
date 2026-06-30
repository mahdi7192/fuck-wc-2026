export const prerender = false;
import { EventEmitter } from 'events';
import Redis from 'ioredis';

const redisUrl = (typeof process !== 'undefined' && process.env?.REDIS_URL) || 
                 (typeof import.meta !== 'undefined' && import.meta.env?.REDIS_URL);
const hasRedis = !!redisUrl;

let redisClient = null;
if (hasRedis) {
  try {
    redisClient = new Redis(redisUrl);
  } catch (e) {
    console.error("Failed to connect Redis for live-stream:", e);
  }
}

export async function GET({ request }) {
  const url = new URL(request.url);
  const matchId = url.searchParams.get('matchId');

  if (!matchId) {
    return new Response(JSON.stringify({ error: "Missing matchId parameter" }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Create event stream response
  const stream = new ReadableStream({
    async start(controller) {
      // Keep connection alive with 15s heartbeats
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(": heartbeat\n\n");
        } catch (e) {
          // Stream might be closed
        }
      }, 15000);

      // Helper to enqueue formatted SSE data
      const sendEvent = (message) => {
        try {
          controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
        } catch (e) {
          // Stream might be closed
        }
      };

      let subClient = null;
      let ramListener = null;

      if (hasRedis && redisClient) {
        try {
          subClient = redisClient.duplicate();
          await subClient.connect().catch(() => {});
          
          await subClient.subscribe(`match_channel:${matchId}`);
          subClient.on('message', (channel, messageStr) => {
            try {
              const msg = JSON.parse(messageStr);
              sendEvent(msg);
            } catch (e) {}
          });
        } catch (error) {
          console.error("Redis SSE subscription duplicate client failed:", error);
        }
      }

      // Always fallback/use RAM event listener for local dev
      ramListener = (msg) => {
        sendEvent(msg);
      };
      if (globalThis.dbEvents) {
        globalThis.dbEvents.on(`match_channel:${matchId}`, ramListener);
      }

      // Cleanup on client disconnect
      const cleanup = async () => {
        clearInterval(heartbeatInterval);
        
        if (globalThis.dbEvents && ramListener) {
          globalThis.dbEvents.off(`match_channel:${matchId}`, ramListener);
        }
        
        if (subClient) {
          try {
            await subClient.unsubscribe();
            await subClient.quit();
          } catch (e) {}
        }
        
        try {
          controller.close();
        } catch (e) {}
      };

      request.signal.addEventListener('abort', cleanup);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disables buffering on proxies like Nginx/Vercel
    }
  });
}
