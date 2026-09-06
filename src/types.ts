export type MbtiType =
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';

export interface ShardPalette {
  name: 'blue' | 'red' | 'yellow' | 'green';
  color: string;
  glow: string;
}

export const SHARD_PALETTES: ShardPalette[] = [
  { name: 'blue', color: '#4285f4', glow: 'rgba(66, 133, 244, 0.7)' },
  { name: 'red', color: '#ea4335', glow: 'rgba(234, 67, 53, 0.7)' },
  { name: 'yellow', color: '#fbbc04', glow: 'rgba(251, 188, 4, 0.7)' },
  { name: 'green', color: '#34a853', glow: 'rgba(52, 168, 83, 0.7)' },
];


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

export type GradeType = 'B1' | 'B2' | 'B3' | 'B4' | 'M1' | 'M2' | 'D1' | 'D2' | 'D3' | 'その他';

export const GRADE_OPTIONS: { value: GradeType; label: string }[] = [
  { value: 'B1', label: '学部1年 (B1)' },
  { value: 'B2', label: '学部2年 (B2)' },
  { value: 'B3', label: '学部3年 (B3)' },
  { value: 'B4', label: '学部4年 (B4)' },
  { value: 'M1', label: '修士1年 (M1)' },
  { value: 'M2', label: '修士2年 (M2)' },
  { value: 'D1', label: '博士1年 (D1)' },
  { value: 'D2', label: '博士2年 (D2)' },
  { value: 'D3', label: '博士3年 (D3)' },
  { value: 'その他', label: 'その他 (社会人/既卒)' },
];

export interface RegistrationResult {
  discord_user_id: string;
  photo_url?: string | null;
  default_photo_url?: string | null;
  arranged_photo_url?: string | null;
  grade?: GradeType | string | null;
  university?: string | null;
  is_staff?: boolean;
  created_at: string;
  updated_at: string;
  google_id?: string | null;
  mbti?: MbtiType | null;
}

export interface AuthConfigResponse {
  google_client_id: string;
}

export interface GoogleLoginResponse {
  status?: string;
  message: string;
  access_token?: string | null;
  token_type?: string;
  is_admin?: boolean;
  admin_token?: string | null;
  needs_registration?: boolean;
  temp_token?: string | null;
  google_email?: string | null;
  google_name?: string | null;
  user?: {
    discord_user_id: string;
    custom_discord_id?: string | null;
    display_name?: string | null;
    grade?: string | null;
    university?: string | null;
    is_staff?: boolean;
    photo_url?: string | null;
    default_photo_url?: string | null;
    arranged_photo_url?: string | null;
    created_at: string;
    updated_at: string;
    google_id?: string | null;
    google_email?: string | null;
    auth_provider?: string;
  } | null;
}

export type LoginResponse = GoogleLoginResponse;

export interface GoogleRegisterPayload {
  temp_token: string;
  discord_user_id: string;
  grade: GradeType | string;
  university: string;
  photo?: Blob | File | null;
  arranged_photo?: Blob | File | null;
}

// Google Identity Services (GIS) グローバル型定義
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string; select_by?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: string | number;
              locale?: string;
            }
          ) => void;
          prompt: (notification?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean; getNotDisplayedReason: () => string; getSkippedReason: () => string }) => void) => void;
        };
      };
    };
  }
}

export interface UserMoffySession {
  discordUserId: string;
  mbti: MbtiType;
  traitScores?: Record<'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P', number> | null;
  cardDataUrl?: string;
  arrangedPhotoUrl?: string | null;
  defaultPhotoUrl?: string | null;
  grade?: string | null;
  university?: string | null;
  updatedAt: string;
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

export interface ArchetypeDefault {
  color: string;
  expression: string;
  hair_features: string;
  body_shape: string;
  body_features: string;
  mouth_features: string;
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

export type GameStage = 'intro' | 'checking_auth' | 'quiz' | 'customize' | 'generating' | 'result';

