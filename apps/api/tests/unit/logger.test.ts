import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { createLogger, scrubPresignedTokens } from '../../src/utils/logger.js';

describe('Phase B02: Logger PII & pre-signed token redaction', () => {
  it('redacts phone numbers, OTPs, NIDs, and X-Amz-Signature tokens', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, cb) {
        lines.push(chunk.toString());
        cb();
      }
    });

    const testLogger = createLogger(sink);
    testLogger.level = 'info';

    testLogger.info(
      {
        phoneNumber: '+8801711223344',
        otpCode: '123456',
        nidNumber: '1995269123456',
        signedUrl:
          'https://r2-private.bechakena.com/kyc/front.enc?X-Amz-Signature=secret123&X-Amz-Credential=cred456'
      },
      'Sensitive test log'
    );

    const output = lines.join('');
    expect(output).not.toContain('+8801711223344');
    expect(output).not.toContain('123456');
    expect(output).not.toContain('1995269123456');
    expect(output).not.toContain('secret123');
    expect(output).not.toContain('cred456');
    expect(output).toContain('[REDACTED]');
  });

  it('scrubs X-Amz-Signature from arbitrary strings', () => {
    const cleaned = scrubPresignedTokens(
      'GET https://r2.example.com/a.enc?X-Amz-Signature=abcdef987&foo=bar'
    );
    expect(cleaned).toBe('GET https://r2.example.com/a.enc?X-Amz-Signature=[REDACTED]&foo=bar');
  });
});
