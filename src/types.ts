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
  created_at: string;
  updated_at: string;
  google_id: string | null;
}

export type GameStage = 'intro' | 'quiz' | 'password' | 'generating' | 'result';
