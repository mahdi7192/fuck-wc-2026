export const prerender = false;
import { getPrediction, setPrediction } from '../../utils/db.js';

export async function GET({ request }) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const matchId = url.searchParams.get('matchId');

  if (!userId || !matchId) {
    return new Response(JSON.stringify({ error: "Missing userId or matchId parameter" }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const playerId = await getPrediction(userId, matchId);
    return new Response(JSON.stringify({ playerId }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST({ request }) {
  try {
    const { userId, matchId, playerId } = await request.json();

    if (!userId || !matchId) {
      return new Response(JSON.stringify({ error: "Missing userId or matchId parameter" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await setPrediction(userId, matchId, playerId);

    return new Response(JSON.stringify({ success: true, playerId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
