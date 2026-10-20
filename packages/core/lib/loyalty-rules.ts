/**
 * Points earned per dollar spent.
 * @constant
 * @type {number}
 */
export const POINTS_PER_DOLLAR = 10; // 10 points per $1 spent

/**
 * Points each customer gets when a referred friend places their first order: the friend and
 * the customer who referred them both earn this.
 * @constant
 * @type {number}
 */
export const REFERRAL_POINTS = 500;

/**
 * Thresholds for loyalty tiers based on lifetime points.
 * @constant
 * @type {Object}
 * @property {number} BRONZE - Minimum points for Bronze tier.
 * @property {number} SILVER - Minimum points for Silver tier.
 * @property {number} GOLD - Minimum points for Gold tier.
 * @property {number} PLATINUM - Minimum points for Platinum tier.
 */
export const TIER_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 500,
  GOLD: 1000,
  PLATINUM: 2500,
};
