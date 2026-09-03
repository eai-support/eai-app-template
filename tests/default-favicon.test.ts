import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('default browser branding', () => {
  it('uses the approved EAI Square Man favicon', () => {
    const favicon = readFileSync(join(process.cwd(), 'src/app/favicon.ico'));

    expect(favicon.subarray(0, 4)).toEqual(Buffer.from([0, 0, 1, 0]));
    expect(favicon.readUInt16LE(4)).toBe(4);
    expect(createHash('sha256').update(favicon).digest('hex')).toBe(
      'f54ae7ba71dccd1bfeb0d40db6ae759751efda2ee33f7a32d4438b586cc15303',
    );
  });
});
