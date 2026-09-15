const fileId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve Directus file references without changing website or external images. */
export function resolveDirectusAsset(value, base, legacyBases = []) {
  if (!value) return undefined;
  if (typeof value !== 'string') throw new Error('Image reference must be a string');
  const root = new URL(base.endsWith('/') ? base : `${base}/`);
  if (!['http:', 'https:'].includes(root.protocol) || root.username || root.password) throw new Error('Invalid DIRECTUS_URL');
  let path = fileId.test(value) ? `assets/${value}` : value.replace(/^\/?assets\//, 'assets/');
  if (/^https?:\/\//i.test(value)) {
    const absolute = new URL(value);
    const sources = [base, ...legacyBases].map((source) => new URL(source.endsWith('/') ? source : `${source}/`));
    const source = sources.find((source) => absolute.origin === source.origin && absolute.pathname.startsWith(`${source.pathname}assets/`));
    if (!source) return value;
    path = absolute.pathname.slice(source.pathname.length) + absolute.search + absolute.hash;
  }
  if (path.startsWith('assets/')) {
    const url = new URL(path, root);
    const id = url.pathname.slice(`${root.pathname}assets/`.length).split('/')[0];
    if (!url.pathname.startsWith(`${root.pathname}assets/`) || !fileId.test(id)) throw new Error('Invalid Directus file reference');
    url.searchParams.delete('access_token');
    return url.toString();
  }
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  throw new Error(`Unsupported image reference: ${value}`);
}

export function directusMarkdownImages(options = {}) {
  return (tree) => {
    const references = new Set();
    function collect(node) {
      if (node.type === 'imageReference') references.add(node.identifier);
      node.children?.forEach(collect);
    }
    function rewrite(node) {
      if (node.type === 'image' || (node.type === 'definition' && references.has(node.identifier))) {
        node.url = resolveDirectusAsset(node.url, options.base, options.legacyBases) || '';
      }
      node.children?.forEach(rewrite);
    }
    collect(tree);
    rewrite(tree);
  };
}
