import { describe, expect, it } from 'vitest';

import { extractVars, missingRequiredVars, renderTemplate } from './template-render.js';

describe('renderTemplate', () => {
  it('substitutes variables', () => {
    const { output } = renderTemplate('Hi {{name}}!', { name: 'Ada' });
    expect(output).toBe('Hi Ada!');
  });

  it('supports nested paths', () => {
    const { output } = renderTemplate('{{user.first}} {{user.last}}', {
      user: { first: 'Ada', last: 'Lovelace' },
    });
    expect(output).toBe('Ada Lovelace');
  });

  it('reports missing variables and renders them empty', () => {
    const { output, missing } = renderTemplate('Hi {{name}} ({{plan}})', { name: 'Ada' });
    expect(output).toBe('Hi Ada ()');
    expect(missing).toEqual(['plan']);
  });
});

describe('extractVars', () => {
  it('collects unique vars across subject + body', () => {
    expect(extractVars('Hi {{name}}', 'Welcome {{name}} to {{org}}', null)).toEqual([
      'name',
      'org',
    ]);
  });
});

describe('missingRequiredVars', () => {
  it('returns only the absent required vars', () => {
    expect(missingRequiredVars(['name', 'org'], { name: 'Ada' })).toEqual(['org']);
  });
  it('treats null as missing', () => {
    expect(missingRequiredVars(['name'], { name: null })).toEqual(['name']);
  });
  it('returns empty when all present', () => {
    expect(missingRequiredVars(['name'], { name: 'Ada' })).toEqual([]);
  });
});
