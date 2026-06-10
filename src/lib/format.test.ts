import { describe, expect, it } from 'vitest';
import { fileNameFromItem, formatBytes, formatEta, progressPercent } from './format';
describe('download formatting helpers', () => {
  it('formats byte sizes for dashboard display', () => { expect(formatBytes(1536)).toBe('1.5 KB'); expect(formatBytes('1048576')).toBe('1.0 MB'); });
  it('calculates bounded progress percentage', () => { expect(progressPercent('50', '200')).toBe(25); expect(progressPercent('250', '200')).toBe(100); expect(progressPercent('10', '0')).toBe(0); });
  it('formats ETA from remaining bytes and speed', () => { expect(formatEta(50, 100, 10)).toBe('5s'); expect(formatEta(0, 3600, 60)).toBe('1m 0s'); expect(formatEta(50, 100, 0)).toBe('∞'); });
  it('extracts a useful file name', () => { expect(fileNameFromItem({ files: [{ path: '/tmp/ubuntu.iso' }] })).toBe('ubuntu.iso'); expect(fileNameFromItem({ bittorrent: { info: { name: 'movie' } } })).toBe('movie'); });
});
