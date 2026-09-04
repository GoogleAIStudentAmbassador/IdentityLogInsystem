export type MbtiType =
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';

export interface LikertQuestion {
  id: number;
  text: string;
  dimension: 'EI' | 'SN' | 'TF' | 'JP';
  /**
   * positive: 同意するとこの特性に加点
   * 例: positive='E' の場合、同意(+2)ならEに加点、反対(-2)ならIに加点
   */
  positive: 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';
  negative: 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';
}

export type ArchetypeId = MbtiType;

export interface Archetype {
  id: ArchetypeId;
  mbtiCode: MbtiType;
  groupName: 'ANALYST' | 'DIPLOMAT' | 'SENTINEL' | 'EXPLORER';
  title: string;
  subtitle: string;
  badge: string;
  symbol: string;
  description: string;
  traits: string[];
  stats: {
    atk: number;
    def: number;
    int: number;
    spd: number;
    cha: number;
  };
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgGradient: [string, string];
  luckyItem: string;
  signatureAccessory?: string;
  officialImageUrl?: string;
}

export interface RegistrationResult {
  discord_user_id: string;
  photo_url: string;
  default_photo_url?: string;
  arranged_photo_url?: string | null;
  created_at: string;
  updated_at: string;
  google_id: string | null;
}

export interface MoffyChecks {
  has_no_nose: boolean;
  has_four_pointed_star_pupils: boolean;
  has_gemini_or_magical_eyes: boolean;
  is_fluffy_3dcg: boolean;
  has_chubby_cute_silhouette: boolean;
}

export interface VerifyMoffyResponse {
  is_moffy: boolean;
  confidence_score: number;
  confidence?: number | null;
  category: string;
  checks: MoffyChecks;
  reason: string;
}

export interface CreateMoffyParams {
  color: string;
  expression: string;
  hair_features: string;
  body_shape: string;
  body_features: string;
  mouth_features: string;
  accessories?: string;
}

export interface CreateMoffyResponse {
  status: string;
  image_url: string;
  prompt_used: string;
  created_at: string;
  base64_data?: string | null;
}

export interface EditImageResponse {
  status: string;
  image_url: string;
  prompt_used: string;
  created_at: string;
  base64_data?: string | null;
}

export interface PartnerProfileResponse {
  discord_user_id: string;
  photo_url: string;
  default_photo_url: string;
  arranged_photo_url?: string | null;
  created_at: string;
  updated_at: string;
  google_id?: string | null;
}

export type GameStage = 'intro' | 'quiz' | 'customize' | 'generating' | 'result';

