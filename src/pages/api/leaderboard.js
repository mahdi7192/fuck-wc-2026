export const prerender = false;
import { getLeaderboard } from '../../utils/db';

export async function GET() {
  try {
    const { players, teams, users } = await getLeaderboard();

    return new Response(JSON.stringify({ players, teams, users }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
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
