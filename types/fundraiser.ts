/**
 * Shared types for the Jose Madrid Salsa Fundraiser Battle Arena feature.
 */

export interface CharacterState {
  id: string
  name: string
  cls: string
  gender: 'm' | 'f'
  skin: string
  hair: string
  quips: string[]
}

export interface FundraiserTeam {
  id: string
  name: string
  school: string
  color: string
  dark: string
  goal: number
  roster: CharacterState[]
}

export interface BattleState {
  phase: 'idle' | 'attacking' | 'defending' | 'victory' | 'defeat'
  tick: number
  shieldExpiresAt: string | null
}
