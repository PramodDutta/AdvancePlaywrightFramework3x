/**
 * Runs a spec N times through the DeFlaky CLI, pushes to the DeFlaky dashboard,
 * then copies the result into the TTA report's Flaky tab.
 *
 *   npm run flaky                                        # flaky demo spec, 2 runs
 *   npm run flaky -- src/tests/aiTests/e2e-checkout-flaky.spec.ts 5
 *
 * Why a wrapper: DeFlaky writes .deflaky/last-run.json only after ALL runs end,
 * but the TTA report is written during the last run. So the data is copied to
 * tta-report/deflaky-data.js afterwards, and the report loads it from there.
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const { spawnSync } = require('child_process');

const spec = process.argv[2] || 'src/tests/aiTests/e2e-checkout-flaky.spec.ts';
const runs = process.argv[3] || '2';
const token = process.env.DEFLAKY_TOKEN || process.env.DEFLAKY_API_KEY || '';

const args = ['run', '-c', `npx playwright test ${spec} --project=chromium`, '-r', runs];
if (token) args.push('--push');
else console.warn('DEFLAKY_API_KEY not set: running locally without --push.');

const result = spawnSync('deflaky', args, { stdio: 'inherit', env: { ...process.env, DEFLAKY_TOKEN: token } });
if (result.error) {
    console.error(`Could not start deflaky (${result.error.message}). Install it: npm install -g deflaky-cli`);
    process.exit(1);
}

const source = '.deflaky/last-run.json';
if (fs.existsSync(source)) {
    fs.mkdirSync('tta-report', { recursive: true });
    fs.writeFileSync('tta-report/deflaky-data.js', `window.DEFLAKY_DATA = ${fs.readFileSync(source, 'utf8')};\n`);
    console.log('DeFlaky results added to the TTA report Flaky tab: open tta-report/index.html');
}
process.exit(result.status ?? 1);
