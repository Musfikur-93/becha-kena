import { config } from '../../config/env.js';

export interface TurnstileVerifier {
  verify(token: string, ip?: string): Promise<boolean>;
}

export class CloudflareTurnstileAdapter implements TurnstileVerifier {
  constructor(private readonly secret: string) {}

  async verify(token: string, ip?: string): Promise<boolean> {
    const formData = new URLSearchParams();
    formData.append('secret', this.secret);
    formData.append('response', token);
    if (ip) {
      formData.append('remoteip', ip);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) return false;
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  }
}

export class MockTurnstileAdapter implements TurnstileVerifier {
  async verify(token: string): Promise<boolean> {
    return token === 'test-pass' || token.startsWith('mock-');
  }
}

let activeVerifier: TurnstileVerifier | null = null;

export function getTurnstileVerifier(): TurnstileVerifier {
  if (!activeVerifier) {
    activeVerifier =
      config.TURNSTILE_MODE === 'live'
        ? new CloudflareTurnstileAdapter(config.TURNSTILE_SECRET)
        : new MockTurnstileAdapter();
  }
  return activeVerifier;
}

export function setTurnstileVerifier(verifier: TurnstileVerifier | null): void {
  activeVerifier = verifier;
}
