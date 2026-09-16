export function validatePath(path) {
  if (typeof path !== 'string' || !/^\/[\p{L}\p{N}_.~\/-]*$/u.test(path) || path.includes('//') || path.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('Redirect paths must be site-relative paths without queries, fragments, wildcards, or dot segments');
  }
  return path;
}

export function compileRedirects(rows) {
  const rules = new Map();
  for (const row of rows) {
    if (!row.enabled) continue;
    const from = validatePath(row.old_path), to = validatePath(row.new_path);
    if (Number(row.status_code) !== 301) throw new Error('Only 301 redirects are supported');
    if (rules.has(from)) throw new Error(`Duplicate redirect source: ${from}`);
    rules.set(from, to);
  }
  if (rules.size > 2000) throw new Error('Cloudflare Pages supports at most 2000 static redirects');
  return [...rules.keys()].sort().map(from => {
    let to = rules.get(from);
    const seen = new Set([from]);
    while (rules.has(to)) {
      if (seen.has(to)) throw new Error(`Redirect loop: ${from}`);
      seen.add(to); to = rules.get(to);
    }
    if (seen.has(to)) throw new Error(`Redirect loop: ${from}`);
    return { old_path: from, new_path: to, status_code: 301 };
  });
}
