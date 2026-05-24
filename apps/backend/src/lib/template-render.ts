/**
 * Minimal {{ variable }} interpolation. Variables are looked up in the supplied
 * record; nested paths (a.b.c) are supported. Returns the rendered string plus
 * the list of variables that were referenced but missing from the data.
 */
const VAR_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

export interface RenderResult {
  output: string;
  missing: string[];
}

function lookup(path: string, data: Record<string, unknown>): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

export function renderTemplate(
  template: string,
  data: Record<string, unknown>,
): RenderResult {
  const missing = new Set<string>();
  const output = template.replace(VAR_PATTERN, (_match, rawPath: string) => {
    const value = lookup(rawPath, data);
    if (value === undefined || value === null) {
      missing.add(rawPath);
      return '';
    }
    return String(value);
  });
  return { output, missing: [...missing] };
}

/** Extract the unique set of {{ variables }} referenced by a template string. */
export function extractVars(...templates: (string | null | undefined)[]): string[] {
  const vars = new Set<string>();
  for (const t of templates) {
    if (!t) continue;
    for (const m of t.matchAll(VAR_PATTERN)) {
      if (m[1]) vars.add(m[1]);
    }
  }
  return [...vars];
}

/**
 * Determine which of `required` vars are absent from `data`. Used to gate
 * dispatch: any missing required var routes the event to dead-letter.
 */
export function missingRequiredVars(
  required: string[],
  data: Record<string, unknown>,
): string[] {
  return required.filter((v) => lookup(v, data) === undefined || lookup(v, data) === null);
}
