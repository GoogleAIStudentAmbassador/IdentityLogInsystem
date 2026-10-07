const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('  IdentityLogInsystem - Cross-Platform Build Integrity Check');
console.log('====================================================\n');

function run(command, stepName) {
  console.log(`[${stepName}] Running: ${command}`);
  try {
    execSync(command, { cwd: rootDir, stdio: 'inherit' });
    console.log(`[OK] ${stepName} passed successfully!\n`);
  } catch (err) {
    console.error(`[FAIL] ${stepName} failed!`);
    process.exit(1);
  }
}

// Step 1: Lint
run('npx oxlint', 'Step 1/5: oxlint');

// Step 2: Adversarial Tests
run('node ./scripts/test_event_checkin_flow.cjs', 'Step 2/5: Automated Adversarial Test Suite');

// Step 3: Production Build
run('npx tsc -b && npx vite build', 'Step 3/5: Production Build');

// Step 4: Check dist output artifacts
console.log('[Step 4/5] Checking dist output artifacts...');
const expectedFiles = [
  'dist/index.html',
  'dist/home.html',
  'dist/oauth.html',
  'dist/share.html',
  'dist/manifest.json',
  'dist/favicon.ico',
  'dist/apple-touch-icon.png',
];

for (const relFile of expectedFiles) {
  const fullPath = path.join(rootDir, relFile);
  if (!fs.existsSync(fullPath)) {
    console.error(`[FAIL] Missing artifact: ${relFile}`);
    process.exit(1);
  }
  const stat = fs.statSync(fullPath);
  console.log(`  [OK] ${relFile} (${stat.size} bytes)`);
}
console.log('');

// Step 5: Validate HTML bundled assets, JS links, and CSS links
console.log('[Step 5/5] Validating bundled assets, JS links, and CSS links...');
const assetsDir = path.join(rootDir, 'dist/assets');
if (!fs.existsSync(assetsDir)) {
  console.error('[FAIL] dist/assets directory not found!');
  process.exit(1);
}

const assetFiles = fs.readdirSync(assetsDir);
const jsBundles = assetFiles.filter((f) => f.endsWith('.js'));
const cssBundles = assetFiles.filter((f) => f.endsWith('.css'));
console.log(`  Found ${jsBundles.length} JS bundles and ${cssBundles.length} CSS bundles.`);

const htmlPages = ['dist/index.html', 'dist/home.html', 'dist/oauth.html', 'dist/share.html'];
const scriptRegex = /<script\s+[^>]*src="([^"]+)"/g;
const linkRegex = /<link\s+[^>]*href="([^"]+)"/g;

for (const htmlFile of htmlPages) {
  const htmlContent = fs.readFileSync(path.join(rootDir, htmlFile), 'utf8');

  // Script tags
  let match;
  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    const rawSrc = match[1];
    if (rawSrc.startsWith('http://') || rawSrc.startsWith('https://') || rawSrc.startsWith('//')) {
      continue; // 外部 CDN スクリプト（例: Google Identity Services）はスキップ
    }
    const cleanSrc = rawSrc.split('?')[0].replace(/^\.?\//, '');
    const assetPath = path.join(rootDir, 'dist', cleanSrc);
    if (!fs.existsSync(assetPath)) {
      console.error(`[FAIL] Broken script tag in ${htmlFile}: ${rawSrc}`);
      process.exit(1);
    }
  }

  // Link stylesheet tags
  while ((match = linkRegex.exec(htmlContent)) !== null) {
    const rawHref = match[1];
    if (rawHref.startsWith('http://') || rawHref.startsWith('https://') || rawHref.startsWith('//')) {
      continue;
    }
    if (rawHref.includes('.css')) {
      const cleanHref = rawHref.split('?')[0].replace(/^\.?\//, '');
      const assetPath = path.join(rootDir, 'dist', cleanHref);
      if (!fs.existsSync(assetPath)) {
        console.error(`[FAIL] Broken stylesheet link in ${htmlFile}: ${rawHref}`);
        process.exit(1);
      }
    }
  }
  console.log(`  [OK] ${htmlFile} references valid JS and CSS bundles.`);
}

console.log('\n====================================================');
console.log('  ALL PHYSICAL VERIFICATION CHECKS PASSED [CLEARED]');
console.log('====================================================');
