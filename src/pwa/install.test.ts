import { describe, expect, it } from 'vitest';
import { installMode } from './install';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1';
const base = { standalone: false, installed: false, canPrompt: false, maxTouchPoints: 0 };

describe('tryb instalacji PWA', () => {
  it('zainstalowana gra nie proponuje instalacji', () => {
    expect(installMode({ ...base, standalone: true, canPrompt: true, userAgent: ANDROID })).toBe(
      'installed',
    );
    expect(installMode({ ...base, installed: true, userAgent: IPHONE })).toBe('installed');
  });

  it('z systemowym oknem — przycisk instalacji', () => {
    expect(installMode({ ...base, canPrompt: true, userAgent: ANDROID })).toBe('prompt');
  });

  it('iPhone i iPad (przedstawiający się jako Mac z dotykiem) — instrukcja', () => {
    expect(installMode({ ...base, userAgent: IPHONE })).toBe('ios');
    expect(installMode({ ...base, userAgent: IPAD, maxTouchPoints: 5 })).toBe('ios');
    expect(installMode({ ...base, userAgent: IPAD })).toBe('unavailable');
  });

  it('bez wsparcia — nic', () => {
    expect(installMode({ ...base, userAgent: ANDROID })).toBe('unavailable');
  });
});
