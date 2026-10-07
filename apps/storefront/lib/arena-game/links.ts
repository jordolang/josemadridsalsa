/**
 * Client-safe facts about the 3D Battle Arena game, shared by the nav, the homepage and the
 * game's API. No secrets and no Node modules, so client components can import it.
 */

/** Where the game is played: its own deployment, on the battle subdomain. */
export const BATTLE_ARENA_URL = 'https://battle.josemadridsalsa.com'

/** GET /api/arena/live: how many signed-in players have the game open right now. */
export interface BattleLiveStatus {
  playing: number
}
