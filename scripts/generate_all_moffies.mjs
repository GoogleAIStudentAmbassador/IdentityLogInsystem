import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_KEY = process.env.MOFFY_API_KEY || '';
const API_URL = process.env.MOFFY_API_URL || 'https://moffy-profile-287701603412.asia-northeast1.run.app/api/v1/create_moffy';
const OUTPUT_FILE = path.join(__dirname, '../src/data/moffyPersonas.json');

export const MOFFY_PERSONA_PROMPTS = [
  {
    mbti: 'INTJ',
    title: 'ストラテジスト・モッフィー',
    signatureAccessory: '知的シルバー丸メガネ ＆ 青紫に光る星霜のGeminiタブレット',
    color: 'ディープパープル',
    accessories: '知的なシルバーの丸メガネをかけ、両手で青紫にやさしく発光する「星霜のGeminiタブレット」を抱えている',
    expression: '冷静沈着で深い洞察と知性に満ちた穏やかな微笑み',
  },
  {
    mbti: 'INTP',
    title: 'ラボ・モッフィー',
    signatureAccessory: '白衣風ミニケープ ＆ 星屑の液体が入った三角フラスコ',
    color: 'ターコイズブルー',
    accessories: '小さな白い研究用ケープ（白衣マント）を羽織り、手にGeminiカラーの星屑液体が入った「三角フラスコ」を持っている',
    expression: '知的好奇心にあふれ、ひらめきで瞳をキラキラ輝かせた思索の表情',
  },
  {
    mbti: 'ENTJ',
    title: 'ディレクター・モッフィー',
    signatureAccessory: '金色の星型クラウン王冠 ＆ アンバサダーの指揮杖（タクト）',
    color: 'ロイヤルゴールド',
    accessories: '頭に小さな金色の星型クラウン（小さな王冠）を乗せ、手には先端に星が輝く「アンバサダーの指揮杖（タクト）」を堂々と持っている',
    expression: '自信に満ちあふれた、チームを率いる誇らしげで頼もしい笑顔',
  },
  {
    mbti: 'ENTP',
    title: 'プロンプター・モッフィー',
    signatureAccessory: '金枠の片眼鏡（モノクル） ＆ 光る羽ペン型スタイラスと魔法のプロンプト帳',
    color: 'ネオンオレンジ',
    accessories: '右目に金枠の片眼鏡（モノクル）をつけ、光る羽ペン型のスタイラスペンと、開かれた「魔法のプロンプト帳」を小脇に抱えている',
    expression: '遊び心に満ちた、いたずらっぽくも知的なひらめきの笑顔',
  },
  {
    mbti: 'INFJ',
    title: 'オラクル・モッフィー',
    signatureAccessory: '若葉と星の冠 ＆ 胸元に優しく輝く星のペンダント',
    color: 'フォレストエメラルドグリーン',
    accessories: '頭に小さな若葉と星の冠を載せ、胸元にはやわらかな光を放つ「星のクリスタルペンダント」をつけている',
    expression: '静かで深い慈愛と共感に満ちた、すべてを優しく包み込む穏やかな微笑み',
  },
  {
    mbti: 'INFP',
    title: 'クリエイター・モッフィー',
    signatureAccessory: '画家のベレー帽 ＆ 虹色に光る絵筆と星空のパレット',
    color: 'パステルピンク',
    accessories: '頭にちょこんと画家のおしゃれなベレー帽をかぶり、手に虹色に光る絵筆と小さな「星空のパレット」を持っている',
    expression: '夢見るように純粋で、温かいイマジネーションにあふれた優しい微笑み',
  },
  {
    mbti: 'ENFJ',
    title: 'アンバサダー・モッフィー',
    signatureAccessory: 'Googleカラーのアンバサダーサッシュ（たすき） ＆ 星のハンドメガホン',
    color: 'ウォームアンバーイエロー',
    accessories: '肩から斜め掛けにGoogleカラー（青・赤・黄・緑）の「アンバサダーサッシュ（たすき）」を身につけ、手には小さな星のハンドメガホンを持っている',
    expression: '太陽のように温かく、誰もを歓迎するポジティブな最高の笑顔',
  },
  {
    mbti: 'ENFP',
    title: 'スパーク・モッフィー',
    signatureAccessory: '背中の小さな星のロケットリュック ＆ 手にしたきらめく星のステッキ',
    color: 'スカイブルー',
    accessories: '背中に小さな「星のロケットリュック」を背負い、手には先端がキラキラ輝く「星のステッキ」を元気いっぱいに掲げている',
    expression: '好奇心とワクワクが止まらない、口をいっぱいに開けた満面の笑顔',
  },
  {
    mbti: 'ISTJ',
    title: 'オーガナイザー・モッフィー',
    signatureAccessory: '首下げ学生アンバサダーID ＆ きっちり挟まれたバインダークリップボード',
    color: 'クラシックネイビーブルー',
    accessories: '首から青いストラップの「Google AI 学生アンバサダーIDカードホルダー」を下げ、几帳面なバインダークリップボードを抱えている',
    expression: '誠実で几帳面、安心感と信頼を与える穏やかで真面目な微笑み',
  },
  {
    mbti: 'ISFJ',
    title: 'ケアテイカー・モッフィー',
    signatureAccessory: 'モッフィー特製マグカップ ＆ 首に巻いたふんわりチェック柄マフラー',
    color: 'ミントグリーン',
    accessories: '首元にふんわりした暖かなチェック柄マフラーを巻き、両手で湯気の立つ「モッフィー特製マグカップ」を大切そうに包み込んでいる',
    expression: '心がほっとするような、思いやりと温もりに満ちた優しい笑顔',
  },
  {
    mbti: 'ESTJ',
    title: 'マネージャー・モッフィー',
    signatureAccessory: '青く発光するスマートウォッチ ＆ スケジュール手帳と赤ペン',
    color: 'インディゴブルー',
    accessories: '片手の手首に青く発光する最新の「スマートウォッチ」をつけ、もう一方の手にスケジュール手帳と赤ペンを持っている',
    expression: '仕事ができて頼もしい、テキパキとしたプロフェッショナルな微笑み',
  },
  {
    mbti: 'ESFJ',
    title: 'コネクター・モッフィー',
    signatureAccessory: '星型モッフィークッキーが入ったバスケット ＆ 可愛いパーティーリボン',
    color: 'コーラルピンク',
    accessories: '頭に小さな可愛いパーティーリボンをつけ、両手で焼きたての「星型モッフィークッキー」が詰まった編みカゴを持っている',
    expression: '仲間と一緒に過ごせる喜びがあふれる、華やかで明るい笑顔',
  },
  {
    mbti: 'ISTP',
    title: 'デベロッパー・モッフィー',
    signatureAccessory: 'おでこ掛けのエンジニアゴーグル ＆ 手にした星型ドライバー工具',
    color: 'スレートグレー',
    accessories: 'おでこにレトロフューチャーな「作業用エンジニアゴーグル」を装着し、手に小さな星型の精密ドライバー工具を持っている',
    expression: 'クールで職人気質、集中力に研ぎ澄まされた静かな自信の眼差し',
  },
  {
    mbti: 'ISFP',
    title: 'チル・モッフィー',
    signatureAccessory: '首に掛けた大型オーバーイヤーヘッドホン ＆ 星空のスケートボード',
    color: 'ラベンダーパープル',
    accessories: '首にスタイリッシュな大型オーバーイヤーヘッドホンを掛け、足元にGemini星空カラーのスケートボードを置いている',
    expression: '心地よいリズムに身をゆだねる、リラックスしたマイペースな笑顔',
  },
  {
    mbti: 'ESTP',
    title: 'ハッカー・モッフィー',
    signatureAccessory: 'スポーティーなサイバーサングラス ＆ 青く光るプロトタイプデバイス',
    color: 'クリムゾンレッド',
    accessories: '目元にスポーティーなブラックサイバーサングラスをかけ、手に青いLEDが光る未来的な超小型プロトタイプデバイスを持っている',
    expression: 'どんなチャレンジも受けて立つ、不敵でエネルギッシュな頼もしい笑み',
  },
  {
    mbti: 'ESFP',
    title: 'スター・モッフィー',
    signatureAccessory: 'キラキラ光るミラーボールマイク ＆ 頭に乗せた星型サングラス',
    color: 'ローズピンク',
    accessories: '頭の上にポップな星型サングラスを乗せ、手には星屑のようにキラキラ光る「ミラーボールマイク」を握りしめている',
    expression: 'スポットライトを浴びて心から楽しんでいる、最高に輝くキュートな笑顔',
  },
];

async function generateSingle(persona, attempt = 1) {
  const form = new FormData();
  form.append('color', persona.color);
  form.append('accessories', persona.accessories);
  form.append('expression', persona.expression);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
      },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    if (attempt < 3) {
      console.warn(`[Retry ${attempt}] Error for ${persona.mbti}: ${err.message}. Retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
      return generateSingle(persona, attempt + 1);
    }
    throw err;
  }
}

async function main() {
  console.log('=== Starting Moffy 16 Archetypes Generation ===');
  let results = {};

  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      results = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      console.log(`Loaded existing results: ${Object.keys(results).length} items already present.`);
    } catch {
      results = {};
    }
  }

  for (let i = 0; i < MOFFY_PERSONA_PROMPTS.length; i++) {
    const persona = MOFFY_PERSONA_PROMPTS[i];
    if (results[persona.mbti] && results[persona.mbti].imageUrl) {
      console.log(`[${i + 1}/${MOFFY_PERSONA_PROMPTS.length}] Skipping ${persona.mbti} (${persona.title}) - already generated: ${results[persona.mbti].imageUrl}`);
      continue;
    }

    console.log(`[${i + 1}/${MOFFY_PERSONA_PROMPTS.length}] Generating ${persona.mbti} - ${persona.title}...`);
    console.log(`  Accessory: ${persona.signatureAccessory}`);
    console.log(`  Color: ${persona.color}`);
    
    const startTime = Date.now();
    try {
      const response = await generateSingle(persona);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  -> Done in ${elapsed}s! URL: ${response.image_url}`);

      results[persona.mbti] = {
        mbti: persona.mbti,
        title: persona.title,
        signatureAccessory: persona.signatureAccessory,
        color: persona.color,
        accessories: persona.accessories,
        expression: persona.expression,
        imageUrl: response.image_url,
        promptUsed: response.prompt_used,
        createdAt: response.created_at,
      };

      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
    } catch (err) {
      console.error(`  -> FAILED generating ${persona.mbti}:`, err.message);
    }

    // small pause between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n=== Generation Complete! ===');
  console.log(`Total personas saved: ${Object.keys(results).length} / ${MOFFY_PERSONA_PROMPTS.length}`);
}

main().catch(err => {
  console.error('Fatal error in main:', err);
  process.exit(1);
});
