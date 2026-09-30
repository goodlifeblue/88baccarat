import { Readable } from 'node:stream';
import { extname } from 'node:path';

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.bmp', '.tif', '.tiff', '.ico', '.heic', '.heif', '.jxl', '.apng']);
export function isImageUpload(data, previous) {
  return [data, previous].some(file => file && (String(file.type || '').toLowerCase().startsWith('image/') || imageExtensions.has(extname(file.filename_download || '').toLowerCase())));
}
export function imageTooLarge() {
  const error = new Error('圖片大小不可超過 5 MB，請先壓縮圖片或降低尺寸後重新上傳；原有圖片不會被取代。');
  return Object.assign(error, { name: 'DirectusError', code: 'IMAGE_TOO_LARGE', status: 413, extensions: { max_bytes: IMAGE_MAX_BYTES, reason: error.message } });
}

// Directus 11.17.3 has only a post-write files.upload action. Validate BEFORE
// uploadOne to cover both /files multipart uploads and /files/import, and retain
// the original asset on failed replacements. Buffer at most 5 MiB per image.
export async function prepareImageUpload(stream) {
  const chunks = [];
  let size = 0;
  const iterator = stream.iterator({ destroyOnReturn: false });
  try {
    for (;;) {
      const next = await iterator.next();
      if (next.done) break;
      const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value);
      size += chunk.length;
      if (size > IMAGE_MAX_BYTES) throw imageTooLarge();
      chunks.push(chunk);
    }
    if (stream.truncated) throw imageTooLarge();
    return Readable.from(chunks);
  } catch (error) {
    // Drain a rejected multipart part without destroying the request socket.
    stream.resume();
    throw error;
  } finally {
    await iterator.return?.();
  }
}

const installed = Symbol.for('88baccarat.image-upload-limit');
export function installImageUploadLimit(FilesService) {
  const prototype = FilesService.prototype;
  if (prototype[installed]) return;
  const original = prototype.uploadOne;
  if (typeof original !== 'function') throw new Error('Image size guard: incompatible Directus FilesService');
  prototype.uploadOne = async function(stream, data, primaryKey, options) {
    const previous = primaryKey ? await this.knex('directus_files').where({ id: primaryKey }).select('type', 'filename_download').first() : null;
    const checked = isImageUpload(data, previous) ? await prepareImageUpload(stream) : stream;
    return original.call(this, checked, data, primaryKey, options);
  };
  prototype[installed] = true;
}
