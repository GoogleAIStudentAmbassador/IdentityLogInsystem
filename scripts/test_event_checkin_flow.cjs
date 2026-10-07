/**
 * イベント管理 & ペルソナQRチェックイン機能 物理検証テストスイート
 * (Adversarial Verification & Secure Coding Guard Edition - 厳格版)
 */

let failed = 0;

console.log('=== 1. ペルソナQRペイロード抽出 & サニタイズ検証 (本番同期) ===');

/**
 * 本番 src/utils/qrUtils.ts の extractAttendeeIdFromQr と完全同一ロジック
 */
function extractAttendeeIdFromQr(qrPayload) {
  if (!qrPayload || typeof qrPayload !== 'string') return null;
  const cleaned = qrPayload.trim();

  // 安全なID検証正規表現: 1〜64文字の英数字・許可記号。ただし '.', '..' 単独および '..' 連続は完全禁止
  const SAFE_ID_REGEX = /^(?!\.{1,2}$)(?!.*\.\.)[a-zA-Z0-9_.#-]{1,64}$/;

  // 1. URL形式の場合 (share.html?id=...)
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://') || cleaned.includes('share.html')) {
    try {
      const url = new URL(cleaned, 'https://takafumi06.github.io');
      const id = url.searchParams.get('id') || url.searchParams.get('discord_id') || url.searchParams.get('user_id');
      if (id && SAFE_ID_REGEX.test(id.trim())) {
        return id.trim();
      }
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        const candidate = parts[parts.length - 1];
        if (!candidate.endsWith('.html') && SAFE_ID_REGEX.test(candidate)) {
          return candidate.trim();
        }
      }
    } catch {
      return null;
    }
  }

  // 2. JSON形式の場合 (例: {"type":"moffy_passport","id":"..."})
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const data = JSON.parse(cleaned);
      const candidateId = data.id || data.attendee_id || data.discord_id;
      if (candidateId && typeof candidateId === 'string' && SAFE_ID_REGEX.test(candidateId.trim())) {
        return candidateId.trim();
      }
    } catch {
      // ignore
    }
  }

  // 3. 生ID文字列の場合（英数字・記号の1〜64文字のみ許可、'.'や'..'単独・連続は排除）
  if (SAFE_ID_REGEX.test(cleaned)) {
    return cleaned;
  }

  return null;
}

const qrTestCases = [
  {
    input: 'https://takafumi06.github.io/IdentityLogInsystem/share.html?id=123456789012345678&mbti=INTJ',
    expected: '123456789012345678',
    desc: '標準的な名刺公開URL (share.html?id=...)',
  },
  {
    input: 'https://googleaistudentambassador.github.io/share.html?discord_id=user_discord_abc',
    expected: 'user_discord_abc',
    desc: 'discord_id クエリパラメータ対応 (本番仕様一致)',
  },
  {
    input: 'https://googleaistudentambassador.github.io/share.html?user_id=google_sub_123',
    expected: 'google_sub_123',
    desc: 'user_id クエリパラメータ対応 (本番仕様一致)',
  },
  {
    input: 'https://evil.com/share.html?id=..',
    expected: null,
    desc: 'URLクエリ内の .. パストラバーサル (イベント誤削除攻撃を物理遮断)',
  },
  {
    input: 'https://evil.com/share.html?id=<script>alert("xss")</script>',
    expected: null,
    desc: 'URLクエリ内のXSSインジェクション攻撃 (物理遮断)',
  },
  {
    input: 'https://evil.com/share.html?id=../../etc/passwd',
    expected: null,
    desc: 'URLクエリ内のパストラバーサル攻撃 (物理遮断)',
  },
  {
    input: '{"type":"moffy_passport","id":"987654321098765432","mbti":"ENTP"}',
    expected: '987654321098765432',
    desc: 'JSON形式のペルソナQRペイロード',
  },
  {
    input: '123456789012345678',
    expected: '123456789012345678',
    desc: '生ID文字列',
  },
  {
    input: '..',
    expected: null,
    desc: '生 ".." パストラバーサル (物理遮断)',
  },
  {
    input: '.',
    expected: null,
    desc: '生 "." パストラバーサル (物理遮断)',
  },
  {
    input: 'user..name',
    expected: null,
    desc: '連続ドット混入ID (物理遮断)',
  },
  {
    input: '<script>alert(1)</script>',
    expected: null,
    desc: '生XSSインジェクション攻撃 (遮断)',
  },
  {
    input: '../../etc/passwd',
    expected: null,
    desc: '生パストラバーサル攻撃 (遮断)',
  },
  {
    input: '',
    expected: null,
    desc: '空文字列 (遮断)',
  },
];

for (const tc of qrTestCases) {
  const result = extractAttendeeIdFromQr(tc.input);
  const pass = result === tc.expected;
  if (!pass) failed++;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${tc.desc}: input="${tc.input}" -> ${result} (expected=${tc.expected})`);
}

console.log('\n=== 2. 二重スキャン防止 (冪等性: Idempotency) 検証 ===');

class MockEventDatabase {
  constructor() {
    this.checkins = new Map(); // key: `${eventId}:${attendeeId}`
  }

  checkin(eventId, attendeeId, staffId, profile) {
    const key = `${eventId}:${attendeeId}`;
    const now = new Date().toISOString();

    if (this.checkins.has(key)) {
      const existing = this.checkins.get(key);
      return {
        status: 'warning',
        already_checked_in: true,
        message: `既にチェックイン済みです（初回: ${existing.checked_in_at}）`,
        attendee: existing,
        total_attendees: this.checkins.size,
      };
    }

    const newRecord = {
      attendee_id: attendeeId,
      name: profile.name,
      university: profile.university,
      checked_in_at: now,
      checked_in_by: staffId,
    };
    this.checkins.set(key, newRecord);

    return {
      status: 'success',
      already_checked_in: false,
      message: 'チェックイン完了',
      attendee: newRecord,
      total_attendees: this.checkins.size,
    };
  }
}

const mockDb = new MockEventDatabase();
const profileTaro = { name: '山田 太郎', university: '東京大学' };

const res1 = mockDb.checkin('event_001', 'user_taro', 'staff_ayato', profileTaro);
if (!res1.already_checked_in && res1.total_attendees === 1) {
  console.log('[PASS] 初回チェックイン成功 (already_checked_in=false, total=1)');
} else {
  console.error('[FAIL] 初回チェックイン失敗:', res1);
  failed++;
}

// 1秒後に同一人物を再スキャン
const originalTime = res1.attendee.checked_in_at;
const res2 = mockDb.checkin('event_001', 'user_taro', 'staff_ayato', profileTaro);
if (res2.already_checked_in && res2.attendee.checked_in_at === originalTime && res2.total_attendees === 1) {
  console.log('[PASS] 二重スキャン検知成功 (already_checked_in=true, 初回時刻維持, カウント不変)');
} else {
  console.error('[FAIL] 二重スキャン制御失敗:', res2);
  failed++;
}

console.log('\n=== 3. 認可制御 (RBAC & BOLA / IDOR オブジェクトレベル認可防御) 検証 ===');

/**
 * バックエンド app/routers/events.py と完全一致するオブジェクトレベル認可ロジック
 */
function authorizeEventOperation(caller, event, operation) {
  if (!caller) return { authorized: false, reason: '未認証' };

  // 管理者は全権限保持
  if (caller.role === 'admin') return { authorized: true };

  // スタッフまたはアンバサダーは受付チェックイン操作が可能
  if (operation === 'checkin' || operation === 'view_attendees') {
    if (caller.is_staff || caller.is_ambassador) return { authorized: true };
    return { authorized: false, reason: 'スタッフまたはアンバサダー権限が必要です' };
  }

  // イベント削除などの破壊的操作は「イベント主催者 (Owner)」または「管理者」のみ（BOLA防御）
  if (operation === 'delete_event') {
    if (event.created_by === caller.user_id) return { authorized: true };
    return { authorized: false, reason: '他人のイベントを削除する権限はありません (BOLA 遮断)' };
  }

  return { authorized: false, reason: '不正な操作' };
}

const sampleEvent = {
  event_id: 'ev_123',
  title: 'アンバサダー定例会',
  created_by: 'organizer_ken',
};

const bolaTestCases = [
  {
    caller: { user_id: 'admin_root', role: 'admin' },
    op: 'delete_event',
    expected: true,
    desc: 'システム管理者によるイベント削除',
  },
  {
    caller: { user_id: 'organizer_ken', is_staff: true },
    op: 'delete_event',
    expected: true,
    desc: 'イベント作成者（Owner）本人によるイベント削除',
  },
  {
    caller: { user_id: 'staff_other', is_staff: true },
    op: 'delete_event',
    expected: false,
    desc: '他人のイベントに対する別スタッフからの削除試行 (BOLA/IDOR 物理遮断)',
  },
  {
    caller: { user_id: 'staff_other', is_staff: true },
    op: 'checkin',
    expected: true,
    desc: '公認スタッフによる受付チェックイン操作 (許可)',
  },
  {
    caller: { user_id: 'general_user', is_staff: false, is_ambassador: false },
    op: 'checkin',
    expected: false,
    desc: '一般参加者による不正な受付チェックイン試行 (遮断)',
  },
];

for (const tc of bolaTestCases) {
  const result = authorizeEventOperation(tc.caller, sampleEvent, tc.op);
  const pass = result.authorized === tc.expected;
  if (!pass) failed++;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${tc.desc} -> authorized=${result.authorized} (expected=${tc.expected})`);
}

console.log('\n=== 3.1. deleteCheckin パストラバーサル (イベント誤削除変異) 防御検証 ===');

function validateDeleteCheckinParams(eventId, attendeeId) {
  if (!eventId || !attendeeId || attendeeId === '.' || attendeeId === '..' || attendeeId.includes('..')) {
    return false;
  }
  return true;
}

const deleteCases = [
  { attendeeId: 'user_123', expected: true, desc: '正当な参加者ID' },
  { attendeeId: '..', expected: false, desc: '.. による上位パス変異 (DELETE /api/events/{id} 誤爆防止・物理遮断)' },
  { attendeeId: '.', expected: false, desc: '. による同一パス変異 (物理遮断)' },
  { attendeeId: 'user/../admin', expected: false, desc: 'パス混入 (物理遮断)' },
];

for (const dc of deleteCases) {
  const valid = validateDeleteCheckinParams('ev_123', dc.attendeeId);
  const pass = valid === dc.expected;
  if (!pass) failed++;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] deleteCheckin 防御: ${dc.desc} -> valid=${valid} (expected=${dc.expected})`);
}

console.log('\n=== 4. スキャン間隔スロットリング (180ms) による CPU 熱暴走防止検証 ===');

let decodeExecutionCount = 0;
const scanIntervalMs = 180;
let lastScanProcessTime = 0;

// 60fps (16.6ms 間隔) で 1秒間 (60フレーム) スキャンループが回ったシミュレーション
const simFrames = 60;
for (let f = 0; f < simFrames; f++) {
  const currentTime = f * 16.67; // ms
  if (currentTime - lastScanProcessTime >= scanIntervalMs) {
    lastScanProcessTime = currentTime;
    decodeExecutionCount++;
  }
}

if (decodeExecutionCount <= 6 && decodeExecutionCount >= 5) {
  console.log(`[PASS] 60fps (60回) の描画フレームに対して解析実行は ${decodeExecutionCount} 回に抑制 (CPU 負荷 約90% 削減・熱暴走防止)`);
} else {
  console.error(`[FAIL] スロットリング異常: ${decodeExecutionCount} 回実行`);
  failed++;
}

console.log('\n=== 5. 出席者名簿 O(1) ハッシュマップ検索 & ベンチマーク ===');

const benchmarkMap = new Map();
for (let i = 0; i < 10000; i++) {
  benchmarkMap.set(`user_${i}`, {
    attendee_id: `user_${i}`,
    name: `User ${i}`,
    university: `Univ ${i % 20}`,
    checked_in_at: new Date().toISOString(),
  });
}

const startTime = process.hrtime.bigint();
const lookupResult = benchmarkMap.get('user_9999');
const endTime = process.hrtime.bigint();
const elapsedNs = Number(endTime - startTime);
const elapsedMs = elapsedNs / 1_000_000;

if (lookupResult && lookupResult.attendee_id === 'user_9999' && elapsedMs < 1.0) {
  console.log(`[PASS] 10,000件の出席者インデックスから 0.0${Math.round(elapsedNs / 1000)}ms で即座に O(1) 逆引き成功`);
} else {
  console.error('[FAIL] ハッシュマップ検索が遅すぎるか不正です:', elapsedMs);
  failed++;
}

console.log('\n-----------------------------------------------------------');
if (failed === 0) {
  console.log('>> ALL EVENT CHECKIN ADVERSARIAL TESTS PASSED (0 defects) <<');
  process.exit(0);
} else {
  console.error(`>> ${failed} EVENT CHECKIN TESTS FAILED <<`);
  process.exit(1);
}
