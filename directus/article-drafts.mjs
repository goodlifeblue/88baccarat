// Only adjust article draft fields; preserve content, choices and permissions.
export async function configureArticleDrafts(api) {
  const fields = await api('/fields/articles');
  for (const name of ['title', 'slug', 'content', 'excerpt', 'category']) {
    const field = fields.find(item => item.field === name);
    if (!field) throw new Error(`Missing articles.${name}`);
    await api(`/fields/articles/${name}`, 'PATCH', {
      ...(field.schema.is_nullable ? {} : { schema: { is_nullable: true } }),
      meta: { required: false },
    });
  }
  const status = fields.find(item => item.field === 'status');
  await api('/fields/articles/status', 'PATCH', { meta: {
    options: { ...status.meta.options, choices: status.meta.options.choices.map(choice =>
      choice.value === 'draft' ? { ...choice, text: '暫存文章（草稿）' } : choice) },
  } });
}
