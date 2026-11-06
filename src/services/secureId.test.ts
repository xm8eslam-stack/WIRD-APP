import { createSecureId } from './secureId';

export function runSecureIdTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  test('Secure IDs are valid UUIDs and unique across immediate calls', () => {
    const first = createSecureId();
    const second = createSecureId();
    assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(first), 'ID must be an RFC 4122 version-4 UUID');
    assert(first !== second, 'Independent events must not share an ID');
  });

  return { passed, failed };
}
