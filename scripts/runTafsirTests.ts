import { runTafsirServiceTests } from '../src/services/tafsirService.test';
import { runTafsirProxyTests } from '../src/tests/tafsirProxy.test';
import { runTafsirSanitizerTests } from '../src/utils/tafsirSanitizer.test';

async function main() {
  const suites = [
    ['Tafsir service', runTafsirServiceTests],
    ['Tafsir API proxy', runTafsirProxyTests],
    ['Tafsir text sanitizer', runTafsirSanitizerTests]
  ] as const;

  let passed = 0;
  let failed = 0;

  for (const [name, run] of suites) {
    console.log(`\n▶ ${name}`);
    const result = await run();
    passed += result.passed;
    failed += result.failed;
  }

  console.log(`\nTAFSIR REGRESSION RESULT: ${passed} PASSED | ${failed} FAILED`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error('Tafsir regression runner failed:', error);
  process.exitCode = 1;
});
