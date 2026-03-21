export const SUPPORTED_SPORTS = [
  "football", "basketball", "baseball", "softball", "soccer", "volleyball",
  "track and field", "cross country", "wrestling", "swimming", "tennis",
  "golf", "lacrosse", "field hockey", "cheerleading", "gymnastics",
  "hockey", "water polo", "bowling", "rugby", "dance", "drill team",
  "powerlifting", "archery", "fencing", "rowing", "badminton", "table tennis",
];

export const SEARCH_QUERY_TEMPLATES = {
  by_city: "{city} {state} high school athletics",
  by_city_coaches: "high schools in {city} {state} coaching staff directory",
  by_district: "{district} school district athletics {state}",
  by_k12_domain: "site:*.k12.{state_abbrev}.us {city} athletics",
  by_city_middle: "{city} {state} middle school athletics",
};

export const MAX_SEARCH_PAGES = 3;
export const MAX_QUERIES_PER_TARGET = 5;

// URL patterns that indicate a school website
export const SCHOOL_DOMAIN_PATTERNS = [
  ".k12.", ".edu", "finalsite.com", "schoolpointe.com", "blackboard.com",
  "powerschool.com", "schoolwires.net", "edlio.com", "edlioschool.com",
  "campusinsite.com", "thrillshare.com", "apptegy.com",
];

// Keywords in titles/snippets that indicate a school
export const SCHOOL_TITLE_KEYWORDS = [
  "high school", "middle school", "junior high", "elementary school",
  "school district", "independent school district", "isd",
  "unified school district", "usd", "academy", "preparatory", "prep school",
];

// Domains to exclude from school results
export const EXCLUDED_DOMAINS = [
  "niche.com", "greatschools.org", "usnews.com", "wikipedia.org",
  "zillow.com", "realtor.com", "yelp.com", "facebook.com", "twitter.com",
  "instagram.com", "youtube.com", "linkedin.com", "indeed.com",
  "glassdoor.com", "maxpreps.com", "hudl.com", "pinterest.com",
];

// ATHLETICS PAGE DISCOVERY
export const ATHLETICS_PAGE_KEYWORDS = [
  "athletics", "sports", "athletic", "coaches", "coaching-staff",
  "coaching staff", "staff-directory", "staff directory", "our-team",
  "our coaches", "varsity", "booster", "athletic-department", "athletic department",
];

// Common URL path patterns for athletics pages
export const ATHLETICS_URL_PATTERNS = [
  "/athletics", "/sports", "/athletics/coaches", "/athletics/staff",
  "/athletics/coaching-staff", "/athletics/directory", "/page/athletics",
  "/domain/athletics", "/departments/athletics", "/our-school/athletics",
];

// STAFF TITLE PATTERNS
export const STAFF_TITLE_PATTERNS: Record<string, RegExp> = {
  athletic_director: /(?:athletic\s+director|\ba\.?d\.?\b|director\s+of\s+athletics|athletics\s+director|athletic\s+coordinator)/i,
  head_coach: /(?:head\s+coach|varsity\s+coach|varsity\s+head|lead\s+coach)/i,
  assistant_coach: /(?:assistant\s+coach|asst\.?\s+coach|jv\s+coach|junior\s+varsity\s+coach|freshman\s+coach)/i,
  coordinator: /(?:offensive\s+coordinator|defensive\s+coordinator|coordinator)/i,
  trainer: /(?:athletic\s+trainer|sports\s+trainer|trainer)/i,
};

// Generic email prefixes to filter out
export const GENERIC_EMAIL_PREFIXES = [
  "info@", "office@", "admin@", "webmaster@", "noreply@", "no-reply@",
  "support@", "contact@", "general@", "main@", "secretary@", "front@",
  "help@", "enrollment@", "registrar@", "attendance@",
];

// SUBJECT LINE TEMPLATES
export const SUBJECT_LINE_TEMPLATES: Record<string, string> = {
  default: "Fundraising Opportunity for {school_name} {sport}",
  profit: "Earn 50% Profit for {school_name} Athletics",
  easy: "Easy Fundraiser for {school_name} {sport} - No Upfront Cost",
  direct: "{sport} Fundraiser - 50% Profit, Zero Risk",
  personal: "Coach, Here's a Fundraiser Your {sport} Team Will Love",
};

// SPORT-SPECIFIC FUNDRAISER PITCHES
export const SPORT_PITCHES: Record<string, string> = {
  football: "equipment upgrades, travel expenses, and team gear",
  basketball: "tournament fees, uniforms, and training equipment",
  baseball: "field maintenance, equipment, and tournament travel",
  softball: "field equipment, uniforms, and travel costs",
  soccer: "league fees, uniforms, and tournament expenses",
  volleyball: "net equipment, uniforms, and tournament fees",
  "track and field": "hurdles, shot puts, and meet travel costs",
  "cross country": "race entry fees, team gear, and travel",
  wrestling: "mats, singlets, and tournament travel",
  swimming: "pool time, lane equipment, and meet fees",
  tennis: "court maintenance, rackets, and match travel",
  golf: "green fees, equipment, and tournament entry",
  lacrosse: "sticks, protective gear, and league fees",
  "field hockey": "sticks, turf time, and tournament travel",
  cheerleading: "uniforms, camp fees, and competition travel",
  gymnastics: "equipment, leotards, and meet fees",
  hockey: "ice time, equipment, and travel expenses",
  "water polo": "pool time, caps, and tournament fees",
};

export const DEFAULT_PITCH = "equipment, travel, and program needs";

export const MAX_PAGES_PER_SCHOOL = 5;
export const REQUEST_DELAY = 3000;
export const PAGE_LOAD_TIMEOUT = 30000;

export const STATE_ABBREVIATIONS: Record<string, string> = {
  Alabama: "al", Alaska: "ak", Arizona: "az", Arkansas: "ar", California: "ca",
  Colorado: "co", Connecticut: "ct", Delaware: "de", Florida: "fl", Georgia: "ga",
  Hawaii: "hi", Idaho: "id", Illinois: "il", Indiana: "in", Iowa: "ia",
  Kansas: "ks", Kentucky: "ky", Louisiana: "la", Maine: "me", Maryland: "md",
  Massachusetts: "ma", Michigan: "mi", Minnesota: "mn", Mississippi: "ms",
  Missouri: "mo", Montana: "mt", Nebraska: "ne", Nevada: "nv", "New Hampshire": "nh",
  "New Jersey": "nj", "New Mexico": "nm", "New York": "ny", "North Carolina": "nc",
  "North Dakota": "nd", Ohio: "oh", Oklahoma: "ok", Oregon: "or", Pennsylvania: "pa",
  "Rhode Island": "ri", "South Carolina": "sc", "South Dakota": "sd", Tennessee: "tn",
  Texas: "tx", Utah: "ut", Vermont: "vt", Virginia: "va", Washington: "wa",
  "West Virginia": "wv", Wisconsin: "wi", Wyoming: "wy",
};
