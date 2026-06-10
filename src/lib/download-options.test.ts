import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { buildDownloadOptions, isPixeldrainUrl } = require('../../electron/download-options.cjs');

describe('download option host profiles', () => {
  it('detects Pixeldrain URLs that need compatibility mode', () => {
    expect(isPixeldrainUrl('https://pixeldrain.com/api/file/HUc25t6o?download')).toBe(true);
    expect(isPixeldrainUrl('https://example.com/file.iso')).toBe(false);
  });

  it('uses normal fastest mode for generic hosts', () => {
    const options = buildDownloadOptions({ url: 'https://example.com/file.iso', split: 16 }, '/tmp');
    expect(options.split).toBe('16');
    expect(options['max-connection-per-server']).toBe('16');
    expect(options['http-accept-gzip']).toBe('false');
  });

  it('uses reliable Pixeldrain compatibility mode to avoid TLS pull failures', () => {
    const options = buildDownloadOptions({ url: 'https://pixeldrain.com/api/file/HUc25t6o?download', split: 16 }, '/tmp');
    expect(options.split).toBe('1');
    expect(options['max-connection-per-server']).toBe('1');
    expect(options['http-accept-gzip']).toBe('false');
  });
});
