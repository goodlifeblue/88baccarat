// Preserve existing columns, widths, filters and bookmarks while showing page dates.
export async function configurePageDateColumns(api) {
  return configureAuditColumns(api, 'pages', ['title', 'page_type', 'path', 'status']);
}

export async function configureAuditColumns(api, collection, defaults) {
  const presets = await api(`/presets?filter[collection][_eq]=${collection}&limit=-1`);
  const views = presets.filter(preset => !preset.bookmark);
  if (!views.some(preset => !preset.user && !preset.role)) {
    await api('/presets', 'POST', {
      collection, layout: 'tabular',
      layout_query: { tabular: { fields: [...defaults, 'created_at', 'updated_at', 'updated_by'] } },
    });
  }
  for (const preset of views) {
    const query = preset.layout_query || {};
    const tabular = query.tabular || {};
    const fields = [...new Set([...(tabular.fields || defaults), 'created_at', 'updated_at', 'updated_by'])];
    await api(`/presets/${preset.id}`, 'PATCH', { layout_query: { ...query, tabular: { ...tabular, fields } } });
  }
}
