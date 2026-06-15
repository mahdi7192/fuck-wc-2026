export const prerender = false;
import { getDb } from '../../utils/db';

export async function GET() {
  try {
    const db = await getDb();
    
    // Convert players totals object to sorted array of top 10
    const topPlayers = Object.entries(db.totals.players || {})
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalRants - a.totalRants)
      .slice(0, 10);

    // Convert teams totals object to sorted array of top 10
    const topTeams = Object.entries(db.totals.teams || {})
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalRants - a.totalRants)
      .slice(0, 10);

    // Convert user totals object to sorted array of top 10
    const topUsers = Object.entries(db.userTotals || {})
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalRants - a.totalRants)
      .slice(0, 10);

    return new Response(JSON.stringify({ players: topPlayers, teams: topTeams, users: topUsers }), {
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
