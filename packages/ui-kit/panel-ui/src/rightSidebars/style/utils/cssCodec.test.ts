import { describe, expect, it } from 'vitest';

import {
  buildClassSelector,
  extractClassNamesFromCss,
  formatRootCssPreview,
  parseSizeValue,
  readSelectorStyleFromCss,
  rootCssToStyleObject,
  styleObjectToRootCss,
  writeSelectorStyleToCss,
} from './cssCodec';

describe('cssCodec', () => {
  it('converts style object <-> :root CSS text losslessly', () => {
    const style = {
      backgroundColor: '#1677ff',
      borderRadius: '8px',
      display: 'flex',
      fontSize: '14px',
    };
    const rootCss = styleObjectToRootCss(style);
    expect(rootCss).toContain('background-color: #1677ff;');
    expect(rootCss).toContain('border-radius: 8px;');
    expect(rootCssToStyleObject(rootCss)).toEqual(style);
  });

  it('handles background url/gradient semicolons safely when parsing', () => {
    const parsed = rootCssToStyleObject(`:root {
      background-image: url("data:image/svg+xml;utf8,<svg></svg>");
      color: #333;
    }`);
    expect(parsed.backgroundImage).toBe(
      'url("data:image/svg+xml;utf8,<svg></svg>")',
    );
    expect(parsed.color).toBe('#333');
  });

  it('formats compact preview string', () => {
    expect(formatRootCssPreview({})).toBe(':root { }');
    expect(formatRootCssPreview({ width: '120px' })).toBe(
      ':root { width: 120px; }',
    );
  });

  it('reads, writes, and extracts class & pseudo-state rules in global CSS', () => {
    let css = '';
    css = writeSelectorStyleToCss(css, 'btn-primary', 'none', {
      backgroundColor: '#1677ff',
      color: '#ffffff',
    });
    css = writeSelectorStyleToCss(css, 'btn-primary', 'hover', {
      backgroundColor: '#4096ff',
    });

    expect(buildClassSelector('btn-primary', 'hover')).toBe(
      '.btn-primary:hover',
    );
    expect(readSelectorStyleFromCss(css, 'btn-primary', 'none')).toEqual({
      backgroundColor: '#1677ff',
      color: '#ffffff',
    });
    expect(readSelectorStyleFromCss(css, 'btn-primary', 'hover')).toEqual({
      backgroundColor: '#4096ff',
    });
    expect(extractClassNamesFromCss(css)).toEqual(['btn-primary']);

    // Clearing all declarations removes the rule cleanly
    css = writeSelectorStyleToCss(css, 'btn-primary', 'hover', {});
    expect(readSelectorStyleFromCss(css, 'btn-primary', 'hover')).toEqual({});
    expect(readSelectorStyleFromCss(css, 'btn-primary', 'none')).toEqual({
      backgroundColor: '#1677ff',
      color: '#ffffff',
    });
  });

  it('parses size values and units', () => {
    expect(parseSizeValue('120px')).toEqual({ num: '120', unit: 'px' });
    expect(parseSizeValue('50%')).toEqual({ num: '50', unit: '%' });
    expect(parseSizeValue('auto')).toEqual({ num: 'auto', unit: 'auto' });
    expect(parseSizeValue(undefined)).toEqual({ num: '', unit: 'px' });
  });
});
