<template>
  <section class="markdown-media">
    <div class="toolbar" role="toolbar" aria-label="文章工具列">
      <button type="button" class="button" :disabled="disabled" @click="insertHeading('## ')" title="插入二級標題">H2</button>
      <button type="button" class="button" :disabled="disabled" @click="insertHeading('### ')" title="插入三級標題">H3</button>
      <button type="button" class="button button--primary" :disabled="disabled" @click="openPicker">插入圖片</button>
      <span class="hint">從檔案庫選取或上傳後會直接插入，不必手打 <code>![圖片]</code>。</span>
    </div>
    <textarea
      ref="editor"
      :value="value || ''"
      :disabled="disabled"
      class="editor"
      rows="18"
      placeholder="輸入文章內容…"
      @input="onInput"
    />

    <div v-if="isPickerOpen" class="modal" role="dialog" aria-modal="true" aria-label="插入文章圖片">
      <div class="modal__backdrop" @click="closePicker" />
      <div class="modal__content">
        <header class="modal__header">
          <div><h3>插入文章圖片</h3><p>選取圖片後會在游標位置自動插入。</p></div>
          <button type="button" class="icon-button" aria-label="關閉" @click="closePicker">×</button>
        </header>
        <label class="field-label">圖片替代文字
          <input v-model.trim="alt" class="text-input" type="text" placeholder="例：百家樂牌桌畫面" />
        </label>
        <p class="field-hint">必填；會顯示給讀圖工具，也會在圖片載入失敗時顯示。</p>
        <label class="upload button button--primary" :class="{ 'is-disabled': uploading }">
          {{ uploading ? '上傳中…' : '從電腦上傳圖片' }}
          <input type="file" accept="image/*" :disabled="uploading" @change="upload" />
        </label>
        <input v-model.trim="query" class="search" type="search" placeholder="依檔名搜尋既有圖片" />
        <p v-if="loading" class="status">正在載入圖片…</p>
        <p v-else-if="error" class="status status--error">{{ error }}</p>
        <p v-else-if="filteredFiles.length === 0" class="status">找不到符合的圖片；可直接從電腦上傳。</p>
        <div v-else class="grid">
          <button v-for="file in filteredFiles" :key="file.id" type="button" class="file" :disabled="uploading" @click="insertFile(file)">
            <img :src="assetUrl(file.id)" :alt="file.title || file.filename_download" loading="lazy" />
            <span>{{ file.title || file.filename_download }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { computed, nextTick, ref } from 'vue';
import { useApi } from '@directus/extensions-sdk';

const nameWithoutExtension = (name = '') => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();

export default {
  props: { value: { type: String, default: '' }, disabled: { type: Boolean, default: false } },
  emits: ['input'],
  setup(props, { emit }) {
    const api = useApi();
    const editor = ref(null);
    const files = ref([]);
    const isPickerOpen = ref(false);
    const loading = ref(false);
    const uploading = ref(false);
    const error = ref('');
    const query = ref('');
    const alt = ref('');
    const assetUrl = (id) => `/assets/${id}?key=system-medium-cover`;
    const filteredFiles = computed(() => {
      const search = query.value.toLocaleLowerCase();
      return search ? files.value.filter((file) => `${file.title || ''} ${file.filename_download || ''}`.toLocaleLowerCase().includes(search)) : files.value;
    });
    const onInput = (event) => emit('input', event.target.value);
    function selectedText() {
      const el = editor.value;
      const value = props.value || '';
      return { start: el?.selectionStart ?? value.length, end: el?.selectionEnd ?? value.length, value };
    }
    function put(text) {
      const { start, end, value } = selectedText();
      const prefix = start > 0 && value[start - 1] !== '\n' ? '\n\n' : '';
      const suffix = end < value.length && value[end] !== '\n' ? '\n\n' : '\n';
      const next = `${value.slice(0, start)}${prefix}${text}${suffix}${value.slice(end)}`;
      emit('input', next);
      nextTick(() => { const position = start + prefix.length + text.length; editor.value?.focus(); editor.value?.setSelectionRange(position, position); });
    }
    function insertHeading(prefix) { put(`${prefix}${editor.value?.value.slice(editor.value.selectionStart, editor.value.selectionEnd) || '標題'}`); }
    async function loadFiles() {
      loading.value = true; error.value = '';
      try {
        const response = await api.get('/files', { params: { filter: { type: { _starts_with: 'image/' } }, fields: 'id,title,filename_download,type', sort: '-uploaded_on', limit: 100 } });
        files.value = response.data.data || [];
      } catch (cause) { error.value = cause?.response?.data?.errors?.[0]?.message || '無法載入圖片；請確認帳號有檔案庫權限後再試。'; }
      finally { loading.value = false; }
    }
    async function openPicker() { if (props.disabled) return; isPickerOpen.value = true; query.value = ''; error.value = ''; if (!files.value.length) await loadFiles(); }
    function closePicker() { if (!uploading.value) isPickerOpen.value = false; }
    function insertFile(file) {
      const description = alt.value || file.title || nameWithoutExtension(file.filename_download) || '圖片';
      if (!description.trim()) { error.value = '請填寫圖片替代文字後再插入。'; return; }
      put(`![${description.trim()}](/assets/${file.id})`);
      closePicker();
    }
    async function upload(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) { error.value = '只能上傳圖片檔案。'; return; }
      if (!alt.value) alt.value = nameWithoutExtension(file.name);
      uploading.value = true; error.value = '';
      try {
        const payload = new FormData(); payload.append('file', file);
        const response = await api.post('/files', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
        const uploaded = response.data.data;
        files.value.unshift(uploaded);
        insertFile(uploaded);
      } catch (cause) { error.value = cause?.response?.data?.errors?.[0]?.message || '圖片上傳失敗，請確認格式、大小及檔案庫權限。'; }
      finally { uploading.value = false; }
    }
    return { alt, assetUrl, closePicker, disabled: props.disabled, editor, error, filteredFiles, insertHeading, insertFile, isPickerOpen, loading, onInput, openPicker, query, upload, uploading };
  },
};
</script>

<style scoped>
.markdown-media { display: grid; gap: 10px; }.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }.button, .icon-button { border: 1px solid var(--theme--border-color, #586172); border-radius: 6px; padding: 8px 12px; background: var(--theme--background-accent, #1b222c); color: inherit; cursor: pointer; font: inherit; }.button--primary { border-color: var(--theme--primary, #2d7ff9); background: var(--theme--primary, #2d7ff9); color: #fff; }.button:disabled, .is-disabled { cursor: not-allowed; opacity: .55; }.hint, .field-hint, .modal__header p, .status { color: var(--theme--foreground-subdued, #a2aab7); font-size: 12px; }.hint code { color: inherit; }.editor, .text-input, .search { box-sizing: border-box; width: 100%; border: 1px solid var(--theme--border-color, #586172); border-radius: 6px; padding: 11px 12px; background: var(--theme--background, #10151d); color: inherit; font: inherit; }.editor { min-height: 320px; resize: vertical; line-height: 1.6; }.modal { position: fixed; z-index: 1000; inset: 0; display: grid; place-items: center; padding: 24px; }.modal__backdrop { position: absolute; inset: 0; background: rgb(0 0 0 / .6); }.modal__content { position: relative; width: min(1080px, 100%); max-height: min(760px, calc(100vh - 48px)); overflow: auto; border-radius: 12px; padding: 22px; background: var(--theme--background, #10151d); box-shadow: 0 20px 60px rgb(0 0 0 / .45); }.modal__header { display: flex; justify-content: space-between; gap: 16px; align-items: start; margin-bottom: 16px; }.modal__header h3, .modal__header p { margin: 0; }.modal__header p { margin-top: 4px; }.icon-button { font-size: 24px; line-height: 1; padding: 4px 10px; }.field-label { display: grid; gap: 7px; font-weight: 600; }.field-hint { margin: 6px 0 14px; }.upload { display: inline-flex; width: fit-content; margin-bottom: 14px; }.upload input { display: none; }.search { margin-bottom: 16px; }.status { margin: 24px 0; }.status--error { color: var(--theme--danger, #e35169); }.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }.file { min-width: 0; overflow: hidden; padding: 0; border: 2px solid transparent; border-radius: 8px; background: var(--theme--background-accent, #1b222c); color: inherit; cursor: pointer; text-align: left; }.file:hover { border-color: var(--theme--primary, #2d7ff9); }.file img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }.file span { display: block; overflow: hidden; padding: 8px; text-overflow: ellipsis; white-space: nowrap; }@media (max-width: 600px) { .modal { padding: 12px; }.modal__content { max-height: calc(100vh - 24px); padding: 16px; }.grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
