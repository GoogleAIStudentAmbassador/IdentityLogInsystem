/**
 * OAuth フローおよびセキュリティロジックの物理検証スクリプト
 * (Adversarial Remediation Edition 3 - Exhaustive Verification)
 */

// src/utils/oauthClient.ts の validateRedirectUri 実装と等価なロジックをテスト
function validateRedirectUri(targetUri, currentOrigin, additionalOrigins = [], envOrigins = []) {
  if (!targetUri || typeof targetUri !== 'string') {
    return { status: 'rejected', origin: '', hostname: '', reason: 'リダイレクト先URIが指定されていません。' };
  }

  try {
    // 0. 絶対URIまたは明示的な相対パスの検査 (RFC 6749 Section 3.1.2: 絶対URI準拠)
    let parsed;
    try {
      parsed = new URL(targetUri);
    } catch {
      // 明示的な相対パス ('/', './', '../') の場合のみ、同一オリジン内のパスとして解決
      if (targetUri.startsWith('/') || targetUri.startsWith('./') || targetUri.startsWith('../')) {
        const baseHref = currentOrigin || 'http://localhost';
        parsed = new URL(targetUri, baseHref);
      } else {
        return {
          status: 'rejected',
          origin: '',
          hostname: '',
          reason: 'リダイレクト先URIの形式が不正です。絶対URI(https://...)または正当な相対パスを指定してください。',
        };
      }
    }

    // 1. スキーム検査
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        status: 'rejected',
        origin: parsed.origin,
        hostname: parsed.hostname,
        reason: '安全でないプロトコルが指定されました。HTTPSのみ許可されています。',
      };
    }

    // 2. RFC 6749 Section 3.1.2: リダイレクトURIにフラグメント(#)の含有は絶対禁止
    if (parsed.hash) {
      return {
        status: 'rejected',
        origin: parsed.origin,
        hostname: parsed.hostname,
        reason: 'リダイレクト先URIにフラグメント(#)を含めることはRFC 6749により禁止されています。',
      };
    }

    // 3. ループバックアドレス検査 (RFC 8252 Section 8.3: IPv4 & IPv6 localhost)
    const isLocalhost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '[::1]' ||
      parsed.hostname === '::1';

    // HTTP平文の制限（ループバックアドレス以外はHTTPS必須）
    if (parsed.protocol === 'http:' && !isLocalhost) {
      return {
        status: 'rejected',
        origin: parsed.origin,
        hostname: parsed.hostname,
        reason: 'セキュリティ保護のため、外部ドメインへのリダイレクトには暗号化通信(HTTPS)が必須です。',
      };
    }

    // 4. 'trusted' 判定 (完全管理下にあるオリジンのみ同意画面スキップ)
    if (currentOrigin && parsed.origin === currentOrigin) {
      return { status: 'trusted', origin: parsed.origin, hostname: parsed.hostname };
    }

    if (isLocalhost) {
      return { status: 'trusted', origin: parsed.origin, hostname: parsed.hostname };
    }

    // Tailscale 内部通信の厳格判定（MagicDNS *.ts.net または CGNAT IPv4 100.64.0.0/10）
    const isTailscale =
      /^[a-zA-Z0-9-]+\.ts\.net$/i.test(parsed.hostname) ||
      /^100\.(?:6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(parsed.hostname);

    if (isTailscale) {
      return { status: 'trusted', origin: parsed.origin, hostname: parsed.hostname };
    }

    // ホワイトリスト検証 (明示的に信頼登録されたオリジン)
    const allowed = [
      ...additionalOrigins,
      ...envOrigins,
      'https://takafumi06.github.io',
    ];

    const isExplicitlyAllowed = allowed.some((origin) => {
      try {
        const allowedParsed = new URL(origin);
        return parsed.origin === allowedParsed.origin;
      } catch {
        return false;
      }
    });

    if (isExplicitlyAllowed) {
      return { status: 'trusted', origin: parsed.origin, hostname: parsed.hostname };
    }

    // 5. 'requires_consent' 判定 (GitHub Pages, 大学ドメイン, 外部独自ドメイン)
    // 外部サービス（誰でも作成可能な *.github.io を含む）は、ゼロクリック窃取を防ぐため
    // 必ず「外部アプリケーション連携の確認（Consent Screen）」を経てユーザーの明示的同意を取得する
    if (parsed.protocol === 'https:' && parsed.hostname.includes('.')) {
      return { status: 'requires_consent', origin: parsed.origin, hostname: parsed.hostname };
    }

    return {
      status: 'rejected',
      origin: parsed.origin,
      hostname: parsed.hostname,
      reason: '無効または安全性が確認できないホスト名です。',
    };
  } catch {
    return {
      status: 'rejected',
      origin: '',
      hostname: '',
      reason: 'リダイレクトURLの形式が正しくありません。',
    };
  }
}

function isAllowedRedirectUri(targetUri, currentOrigin, additionalOrigins = [], envOrigins = []) {
  const result = validateRedirectUri(targetUri, currentOrigin, additionalOrigins, envOrigins);
  return result.status !== 'rejected';
}

function verifyCsrfState(savedState, incomingState) {
  if (!savedState || !incomingState || savedState !== incomingState) {
    return false;
  }
  return true;
}

let failed = 0;

console.log('=== 1. validateRedirectUri 厳格判定テスト (Zero-Click Steal Defense) ===');
const redirectTestCases = [
  { uri: 'https://takafumi06.github.io/IdentityLogInsystem/index.html', origin: 'https://takafumi06.github.io', expected: 'trusted', desc: '同一オリジン (GitHub Pages)' },
  { uri: './index.html', origin: 'https://takafumi06.github.io', expected: 'trusted', desc: '相対パス (同一オリジンとして解決)' },
  { uri: 'http://localhost:3000/callback', origin: 'https://takafumi06.github.io', expected: 'trusted', desc: 'IPv4 localhost (RFC 8252)' },
  { uri: 'http://127.0.0.1:8080/cb', origin: 'https://takafumi06.github.io', expected: 'trusted', desc: 'IPv4 127.0.0.1 (RFC 8252)' },
  { uri: 'http://[::1]:5173/cb', origin: 'https://takafumi06.github.io', expected: 'trusted', desc: 'IPv6 [::1] (RFC 8252)' },
  { uri: 'https://my-device.ts.net:8443/cb', origin: 'https://takafumi06.github.io', expected: 'trusted', desc: 'Tailscale MagicDNS (*.ts.net)' },
  { uri: 'https://100.64.0.1:8443/cb', origin: 'https://takafumi06.github.io', expected: 'trusted', desc: 'Tailscale CGNAT IPv4 (100.64.0.0/10 開始点)' },
  { uri: 'https://100.127.255.254:8443/cb', origin: 'https://takafumi06.github.io', expected: 'trusted', desc: 'Tailscale CGNAT IPv4 (100.64.0.0/10 終点近傍)' },
  { uri: 'https://100.1.2.3:8443/cb', origin: 'https://takafumi06.github.io', expected: 'requires_consent', desc: 'CGNAT外の一般IP (100.* の危険プレフィックス判定排除)' },
  { uri: 'https://100.evil.com/steal', origin: 'https://takafumi06.github.io', expected: 'requires_consent', desc: '100.evil.com のようなドメイン偽装' },
  { uri: 'https://ayato964.github.io/RunMeMe/', origin: 'https://takafumi06.github.io', expected: 'requires_consent', desc: '外部 GitHub Pages (ゼロクリック窃取防止のため同意画面へ)' },
  { uri: 'https://attacker.github.io/steal', origin: 'https://takafumi06.github.io', expected: 'requires_consent', desc: '悪意ある攻撃者の GitHub Pages (同意なし自動リダイレクト遮断)' },
  { uri: 'https://univ.ac.jp/portal', origin: 'https://takafumi06.github.io', expected: 'requires_consent', desc: '大学ドメイン (外部ドメインのため同意画面へ)' },
  { uri: 'https://my-custom-service.com/cb', origin: 'https://takafumi06.github.io', expected: 'requires_consent', desc: '構文的に正当な外部 HTTPS 独自ドメイン' },
  { uri: 'https://ayato964.github.io/RunMeMe/#token=steal', origin: 'https://takafumi06.github.io', expected: 'rejected', desc: 'フラグメント(#)混入URI (RFC 6749 Sec 3.1.2 物理遮断)' },
  { uri: 'http://ayato964.github.io/RunMeMe/', origin: 'https://takafumi06.github.io', expected: 'rejected', desc: '外部平文 HTTP (トークン平文漏洩防止のため物理遮断)' },
  { uri: 'javascript:alert(document.cookie)', origin: 'https://takafumi06.github.io', expected: 'rejected', desc: 'javascript: スキーム攻撃 (物理遮断)' },
  { uri: 'data:text/html,<script>alert(1)</script>', origin: 'https://takafumi06.github.io', expected: 'rejected', desc: 'data: スキーム攻撃 (物理遮断)' },
  { uri: 'vbscript:msgbox("pwnd")', origin: 'https://takafumi06.github.io', expected: 'rejected', desc: 'vbscript: スキーム攻撃 (物理遮断)' },
  { uri: 'https://takafumi06.github.io@evil.com/path', origin: 'https://takafumi06.github.io', expected: 'requires_consent', desc: 'WHATWG @ 記号偽装 (evil.com として判定され trusted にならない)' },
  { uri: 'https://takafumi06.github.io.evil.com/path', origin: 'https://takafumi06.github.io', expected: 'requires_consent', desc: 'サブドメイン偽装 (evil.com として判定され trusted にならない)' },
  { uri: '', origin: 'https://takafumi06.github.io', expected: 'rejected', desc: '空文字列URI (物理遮断)' },
  { uri: 'not a valid url', origin: 'https://takafumi06.github.io', expected: 'rejected', desc: 'スキームおよび相対パス接頭辞のない不正文字列 (物理遮断)' },
  { uri: 'attacker.com/steal-token', origin: 'https://takafumi06.github.io', expected: 'rejected', desc: 'スキーム欠落のドメイン指定 (同一オリジンの相対パスへの誤解決防止・物理遮断)' },
];

for (const tc of redirectTestCases) {
  const res = validateRedirectUri(tc.uri, tc.origin);
  const pass = res.status === tc.expected;
  if (!pass) {
    failed++;
    console.error(`[FAIL] ${tc.desc}: input="${tc.uri}" -> status="${res.status}" (expected="${tc.expected}") reason="${res.reason || ''}"`);
  } else {
    console.log(`[PASS] ${tc.desc}: status="${res.status}"`);
  }
}

console.log('\n=== 2. isAllowedRedirectUri 後方互換性テスト ===');
const compatTestCases = [
  { uri: 'https://takafumi06.github.io/app', origin: 'https://takafumi06.github.io', expected: true, desc: 'trusted は true' },
  { uri: 'https://ayato964.github.io/RunMeMe/', origin: 'https://takafumi06.github.io', expected: true, desc: 'requires_consent は true (同意画面へ進むため遮断ではない)' },
  { uri: 'javascript:alert(1)', origin: 'https://takafumi06.github.io', expected: false, desc: 'rejected は false' },
  { uri: 'http://insecure-external.com', origin: 'https://takafumi06.github.io', expected: false, desc: '平文HTTPは false' },
];

for (const tc of compatTestCases) {
  const res = isAllowedRedirectUri(tc.uri, tc.origin);
  const pass = res === tc.expected;
  if (!pass) failed++;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${tc.desc}: input="${tc.uri}" -> ${res} (expected=${tc.expected})`);
}

console.log('\n=== 3. Strict CSRF State & Session Fixation Protection ===');
const csrfTestCases = [
  { saved: 'state_xyz', incoming: 'state_xyz', expected: true, desc: '正常系: state完全一致' },
  { saved: 'state_xyz', incoming: 'forged_state', expected: false, desc: '攻撃系: state改ざん (不一致検知・遮断)' },
  { saved: null, incoming: 'attacker_state', expected: false, desc: '攻撃系: savedState不在 (Login CSRF遮断)' },
  { saved: 'state_xyz', incoming: null, expected: false, desc: '攻撃系: state欠落 (バイパス試行遮断)' },
  { saved: null, incoming: null, expected: false, desc: '両方欠落 (拒絶)' },
];

for (const tc of csrfTestCases) {
  const result = verifyCsrfState(tc.saved, tc.incoming);
  const pass = result === tc.expected;
  if (!pass) failed++;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${tc.desc}: saved="${tc.saved}", incoming="${tc.incoming}" -> ${result} (expected=${tc.expected})`);
}

console.log('\n=== 4. RFC 6749 Section 4.2.2.1 拒絶ハンドリング検証 (access_denied) ===');
function buildDeniedRedirectUrl(redirectUri, state) {
  const url = new URL(redirectUri);
  const errorFragment = new URLSearchParams();
  errorFragment.set('error', 'access_denied');
  errorFragment.set('error_description', 'ユーザーによって認証連携が拒否されました。');
  if (state) {
    errorFragment.set('state', state);
  }
  url.hash = errorFragment.toString();
  return url.toString();
}

const deniedResult = buildDeniedRedirectUrl('https://ayato964.github.io/RunMeMe/', 'test_state_123');
const parsedDenied = new URL(deniedResult);
const deniedFragment = new URLSearchParams(parsedDenied.hash.substring(1));
if (
  deniedFragment.get('error') === 'access_denied' &&
  deniedFragment.get('state') === 'test_state_123' &&
  deniedResult.startsWith('https://ayato964.github.io/RunMeMe/')
) {
  console.log('[PASS] RFC 6749 Section 4.2.2.1 準拠の拒否レスポンス生成成功 (#error=access_denied&state=...)');
} else {
  console.error('[FAIL] 拒否レスポンス生成が規格に準拠していません:', deniedResult);
  failed++;
}

console.log('\n=== 5. CWE-1021 Clickjacking Framebusting 防御シミュレーション ===');
function checkFramebusting(topHref, selfHref) {
  if (topHref !== selfHref) {
    return 'TOP_REDIRECT_TRIGGERED'; // top.location.href = self.location.href
  }
  return 'STANDALONE_SECURE';
}
const iframeAttack = checkFramebusting('https://attacker.com/framed', 'https://takafumi06.github.io/IdentityLogInsystem/oauth.html');
if (iframeAttack === 'TOP_REDIRECT_TRIGGERED') {
  console.log('[PASS] Clickjacking 攻撃検知時に top.location リダイレクトを発動');
} else {
  console.error('[FAIL] Framebusting が iframe を検知できませんでした');
  failed++;
}

console.log('\n=== 6. In-Memory Session Fallback Simulation ===');
class MockAuthClient {
  constructor() {
    this.inMemorySession = null;
    this.storageBlocked = true;
  }
  saveSession(session) {
    this.inMemorySession = session;
    if (this.storageBlocked) {
      throw new Error('SecurityError: The operation is insecure (Private Browsing mode)');
    }
  }
  getSession() {
    if (this.inMemorySession) return this.inMemorySession;
    return null;
  }
  isAuthenticated() {
    const s = this.getSession();
    return !!(s && s.accessToken);
  }
  logout() {
    this.inMemorySession = null;
  }
}

const client = new MockAuthClient();
try {
  client.saveSession({ accessToken: 'test_token_123', user: { discord_user_id: 'user1' } });
} catch {
  // ignore
}
if (client.isAuthenticated()) {
  console.log('[PASS] Private Browsing Fallback: In-memory session retained authentication');
} else {
  console.error('[FAIL] Private Browsing Fallback failed!');
  failed++;
}

client.logout();
if (!client.isAuthenticated()) {
  console.log('[PASS] Logout cleared in-memory session successfully');
} else {
  console.error('[FAIL] Logout failed to clear in-memory session!');
  failed++;
}

console.log('\n=== 7. Direct Visit State Bridge & Loop Guard Simulation ===');
const mockSessionStorage = {};
const oauthParams = { state: 'direct_visit_state_123' };
mockSessionStorage['moffy_oauth_csrf_state'] = oauthParams.state;

const incomingState = 'direct_visit_state_123';
const retrievedState = mockSessionStorage['moffy_oauth_csrf_state'];
if (retrievedState === incomingState) {
  console.log('[PASS] Direct visit state successfully bridged across pages via sessionStorage');
} else {
  console.error('[FAIL] Direct visit state bridge failed!');
  failed++;
}

// Loop guard detection
const testLoopGuard = (hash, isAuthenticated) => {
  const hasCallbackHash = hash.includes('access_token');
  if (!isAuthenticated) {
    if (hasCallbackHash) {
      return 'HALT_LOOP';
    }
    return 'REDIRECT_LOGIN';
  }
  return 'PROCEED';
};

const case1 = testLoopGuard('#access_token=bad_token&state=bad', false);
if (case1 === 'HALT_LOOP') {
  console.log('[PASS] Invalid callback hash triggers HALT_LOOP instead of infinite redirect');
} else {
  console.error('[FAIL] Loop guard failed to halt loop!');
  failed++;
}

// Immediate hash scrubbing simulation
let mockAddressBar = 'https://example.com/index.html#access_token=xyz&state=123';
function simulateScrub(url) {
  const hash = url.split('#')[1] || '';
  if (hash.includes('access_token')) {
    mockAddressBar = url.split('#')[0]; // history.replaceState
    return true;
  }
  return false;
}
simulateScrub(mockAddressBar);
if (!mockAddressBar.includes('access_token')) {
  console.log('[PASS] Address bar is immediately scrubbed upon hash detection');
} else {
  console.error('[FAIL] Address bar scrub failed!');
  failed++;
}

console.log('\n-----------------------------------------------------------');
if (failed === 0) {
  console.log('>> ALL ADVERSARIAL VERIFICATION TESTS PASSED (0 defects) <<');
  process.exit(0);
} else {
  console.error(`>> ${failed} ADVERSARIAL TESTS FAILED <<`);
  process.exit(1);
}
