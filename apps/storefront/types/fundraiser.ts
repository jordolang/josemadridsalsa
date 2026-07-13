export interface FundraiserCharacter {
  id:     string;
  name:   string;
  cls:    CharacterClass;
  gender: "m" | "f";
  skin:   string;
  hair:   string;
  quips:  string[];
}

export type CharacterClass =
  | "warrior"
  | "mage"
  | "rogue"
  | "archer"
  | "paladin"
  | "berserker";

export interface FundraiserTeam {
  id:      string;
  name:    string;
  school:  string;
  color:   string;
  dark:    string;
  goal:    number;
  roster:  FundraiserCharacter[];
}

export interface BattleState {
  hp:              Record<string, number>;
  maxHp:           Record<string, number>;
  scores:          Record<string, number>;
  shielded:        boolean;
  shieldExpiresAt: string | null;
}

export interface CharacterState {
  id:    string;
  state: "idle" | "attack" | "hit" | "dead" | "heal";
}

export interface BattleFeedItem {
  id:   number;
  type: "attack" | "defend" | "sale" | "shield" | "death" | "event" | "click";
  msg:  string;
}

export interface SaleWebhookPayload {
  apiKey:   string;
  amount?:  number;
  orderId?: string;
}

export interface SaleWebhookResponse {
  success:       boolean;
  teamId:        string;
  teamName:      string;
  salesCount:    number;
  saleEventId:   string;
  triggerAttack: boolean;
}
