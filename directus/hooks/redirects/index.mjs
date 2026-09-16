// SQLite triggers run in the same transaction as the article update. Directus
// pre-update filters execute before that transaction and must not write rules.
export default function register({ init }, { database, logger }) {
  init('app.before', async () => {
    if (database.client.config.client !== 'sqlite3') {
      throw new Error('Automatic article redirects require the SQLite trigger; migrate it before changing database engines.');
    }
    if (!await database.schema.hasTable('articles') || !await database.schema.hasTable('redirects')) {
      logger.warn('Run directus:setup, then restart Directus to enable article redirects.');
      return;
    }
    const oldPath = "'/' || OLD.category || '/' || OLD.slug || '/'";
    const newPath = "'/' || NEW.category || '/' || NEW.slug || '/'";
    await database.raw(`CREATE TRIGGER IF NOT EXISTS article_url_redirects
      AFTER UPDATE OF slug, category ON articles
      WHEN OLD.status = 'published' AND NEW.status = 'published'
        AND OLD.category IN ('baccarat','strategy','guide','tips','comparison')
        AND NEW.category IN ('baccarat','strategy','guide','tips','comparison')
        AND (OLD.slug != NEW.slug OR OLD.category != NEW.category)
      BEGIN
        SELECT RAISE(ABORT, 'New URL is reserved by another redirect') WHERE EXISTS (
          SELECT 1 FROM redirects WHERE old_path = ${newPath}
          AND (new_path != ${oldPath} OR enabled != 1)
        );
        SELECT RAISE(ABORT, 'Old URL already has a redirect') WHERE EXISTS (
          SELECT 1 FROM redirects WHERE old_path = ${oldPath}
        );
        DELETE FROM redirects WHERE old_path = ${newPath} AND new_path = ${oldPath} AND enabled = 1;
        UPDATE redirects SET new_path = ${newPath} WHERE new_path = ${oldPath};
        INSERT INTO redirects (id, old_path, new_path, status_code, enabled)
          VALUES (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-8' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))), ${oldPath}, ${newPath}, 301, 1);
      END`);
    logger.info('Transactional article URL redirects enabled (SQLite)');
  });
}
