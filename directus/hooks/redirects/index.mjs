// SQLite triggers run in the same transaction as the article update. Directus
// pre-update filters execute before that transaction and must not write rules.
import { registerFloatingValidation } from './floating-validation.mjs';
import { registerContentValidation } from './content-validation.mjs';
import { installImageUploadLimit } from './image-upload-limit.mjs';

export default function register({ init, filter }, { database, logger, services }) {
  installImageUploadLimit(services.FilesService);
  registerFloatingValidation(filter, database);
  registerContentValidation(filter, database);
  init('app.before', async () => {
    if (await database.schema.hasTable('homepage_block_articles')) {
      await database.raw('CREATE UNIQUE INDEX IF NOT EXISTS homepage_block_article_unique ON homepage_block_articles (block_id, article_id)');
      await database.raw("CREATE UNIQUE INDEX IF NOT EXISTS homepage_block_anchor_unique ON homepage_blocks (anchor) WHERE enabled = 1 AND anchor IS NOT NULL AND anchor != ''");
    }
    if (database.client.config.client !== 'sqlite3') {
      throw new Error('Automatic article redirects require the SQLite trigger; migrate it before changing database engines.');
    }
    if (!await database.schema.hasTable('articles') || !await database.schema.hasTable('redirects')) {
      logger.warn('Run directus:setup, then restart Directus to enable article redirects.');
      return;
    }
    const oldPath = "'/' || OLD.category || '/' || OLD.slug || '/'";
    const newPath = "'/' || NEW.category || '/' || NEW.slug || '/'";
    for (const [table, field] of [['articles', 'updated_by'], ['redirects', 'created_at'], ['redirects', 'updated_at'], ['redirects', 'updated_by']]) {
      if (!await database.schema.hasColumn(table, field)) {
        logger.warn('Run directus:setup and restart Directus to upgrade redirect audit fields. Existing trigger preserved.');
        return;
      }
    }
    const now = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
    await database.transaction(async trx => {
    await trx.raw('DROP TRIGGER IF EXISTS article_url_redirects');
    await trx.raw(`CREATE TRIGGER article_url_redirects
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
        UPDATE redirects SET new_path = ${newPath}, updated_at = ${now}, updated_by = NEW.updated_by WHERE new_path = ${oldPath};
        INSERT INTO redirects (id, old_path, new_path, status_code, enabled, created_at, updated_at, updated_by)
          VALUES (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-8' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))), ${oldPath}, ${newPath}, 301, 1, ${now}, ${now}, NEW.updated_by);
      END`);
    });
    logger.info('Transactional article URL redirects enabled (SQLite)');
  });
}
