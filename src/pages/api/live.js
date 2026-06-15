export const prerender = false;
import { getDb } from '../../utils/db.js';

export async function GET({ request }) {
  const url = new URL(request.url);
  const matchId = url.searchParams.get('matchId');
  const since = parseInt(url.searchParams.get('since') || '0', 10);

  if (!matchId) {
    return new Response(JSON.stringify({ error: "Missing matchId parameter" }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    const db = await getDb();
    const rantsForMatch = db.rants?.[matchId] || {};
    const recentRants = db.recentRants?.[matchId] || [];
    
    // Filter recent rants that happened after the 'since' timestamp
    const newRants = recentRants.filter(r => r.timestamp > since);

    return new Response(JSON.stringify({
      rants: rantsForMatch,
      newRants: newRants,
      timestamp: Date.now()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// Keep broadcastToMatch as a no-op function to prevent breaking older imports if any exist.
export function broadcastToMatch(matchId, data) {
  // No-op (live streaming is replaced by lightweight polling to avoid serverless timeouts)
}
