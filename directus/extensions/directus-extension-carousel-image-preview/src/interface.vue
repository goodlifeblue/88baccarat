<template>
  <section class="carousel-image-field">
    <div v-if="selectedFile" class="preview">
      <img :src="assetUrl(selectedFile.id)" :alt="selectedFile.title || selectedFile.filename_download" />
      <div class="preview__details">
        <strong>{{ selectedFile.title || selectedFile.filename_download }}</strong>
        <span>{{ selectedFile.type }}</span>
      </div>
      <div class="preview__actions">
        <button type="button" class="button" :disabled="disabled" @click="openPicker">更換圖片</button>
        <button type="button" class="button button--danger" :disabled="disabled" @click="clear">移除</button>
      </div>
    </div>

    <button v-else type="button" class="empty" :disabled="disabled" @click="openPicker">
      <span class="empty__icon">▣</span>
      <span>從「網站公開素材」選擇圖片</span>
      <small>選取後會在此顯示 16:9 預覽</small>
    </button>

    <div v-if="isPickerOpen" class="modal" role="dialog" aria-modal="true" aria-label="選擇輪播圖片">
      <div class="modal__backdrop" @click="closePicker" />
      <div class="modal__content">
        <header class="modal__header">
          <div>
            <h3>選擇輪播圖片</h3>
            <p>僅顯示「網站公開素材」中的圖片。</p>
          </div>
          <button type="button" class="icon-button" aria-label="關閉" @click="closePicker">×</button>
        </header>

        <input v-model.trim="query" class="search" type="search" placeholder="依檔名搜尋" />
        <p v-if="loading" class="status">正在載入圖片…</p>
        <p v-else-if="error" class="status status--error">{{ error }}</p>
        <p v-else-if="filteredFiles.length === 0" class="status">此資料夾沒有符合的圖片。</p>

        <div v-else class="grid">
          <button
            v-for="file in filteredFiles"
            :key="file.id"
            type="button"
            class="file"
            :class="{ 'file--selected': value === file.id }"
            @click="select(file)"
          >
            <img :src="assetUrl(file.id)" :alt="file.title || file.filename_download" loading="lazy" />
            <span>{{ file.title || file.filename_download }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { computed, ref, watch } from 'vue';
import { useApi } from '@directus/extensions-sdk';

export default {
  props: {
    value: { type: String, default: null },
    disabled: { type: Boolean, default: false },
  },
  emits: ['input'],
  setup(props, { emit }) {
    const api = useApi();
    const selectedFile = ref(null);
    const files = ref([]);
    const isPickerOpen = ref(false);
    const loading = ref(false);
    const error = ref('');
    const query = ref('');

    const assetUrl = (id) => `/assets/${id}?key=system-medium-cover`;
    const filteredFiles = computed(() => {
      const search = query.value.toLocaleLowerCase();
      if (!search) return files.value;
      return files.value.filter((file) => `${file.title || ''} ${file.filename_download || ''}`.toLocaleLowerCase().includes(search));
    });

    async function loadSelected() {
      if (!props.value) {
        selectedFile.value = null;
        return;
      }
      try {
        const response = await api.get(`/files/${props.value}`, { params: { fields: 'id,title,filename_download,type' } });
        selectedFile.value = response.data.data;
      } catch {
        selectedFile.value = null;
      }
    }

    async function openPicker() {
      if (props.disabled) return;
      isPickerOpen.value = true;
      query.value = '';
      if (files.value.length) return;
      loading.value = true;
      error.value = '';
      try {
        const folders = await api.get('/folders', { params: { filter: { name: { _eq: '網站公開素材' } }, fields: 'id', limit: 1 } });
        const folderId = folders.data.data?.[0]?.id;
        if (!folderId) throw new Error('找不到「網站公開素材」資料夾。');
        const response = await api.get('/files', {
          params: {
            filter: { folder: { _eq: folderId }, type: { _starts_with: 'image/' } },
            fields: 'id,title,filename_download,type',
            sort: '-uploaded_on',
            limit: 100,
          },
        });
        files.value = response.data.data;
      } catch (cause) {
        error.value = cause?.message || '無法載入公開圖片，請稍後再試。';
      } finally {
        loading.value = false;
      }
    }

    function closePicker() {
      isPickerOpen.value = false;
    }

    function select(file) {
      selectedFile.value = file;
      emit('input', file.id);
      closePicker();
    }

    function clear() {
      selectedFile.value = null;
      emit('input', null);
    }

    watch(() => props.value, loadSelected, { immediate: true });

    return { assetUrl, clear, closePicker, error, filteredFiles, isPickerOpen, loading, openPicker, query, select, selectedFile };
  },
};
</script>

<style scoped>
.carousel-image-field { max-width: 720px; }
.empty, .preview { border: 1px dashed var(--theme--border-color, #586172); border-radius: 10px; background: var(--theme--background, #10151d); }
.empty { width: 100%; min-height: 220px; display: grid; place-content: center; gap: 8px; color: var(--theme--foreground, #fff); cursor: pointer; font-size: 16px; }
.empty:hover { border-color: var(--theme--primary, #2d7ff9); }
.empty:disabled, .button:disabled { cursor: not-allowed; opacity: .55; }
.empty__icon { color: var(--theme--primary, #2d7ff9); font-size: 34px; }
.empty small, .preview__details span, .modal__header p { color: var(--theme--foreground-subdued, #a2aab7); }
.preview { overflow: hidden; }
.preview img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #0b0f14; }
.preview__details { padding: 12px 14px 0; display: grid; gap: 3px; }
.preview__actions { display: flex; gap: 8px; padding: 12px 14px 14px; }
.button, .icon-button { border: 0; border-radius: 6px; background: var(--theme--primary, #2d7ff9); color: #fff; cursor: pointer; padding: 8px 12px; font: inherit; }
.button--danger { background: var(--theme--danger, #e35169); }
.modal { position: fixed; z-index: 1000; inset: 0; display: grid; place-items: center; padding: 24px; }
.modal__backdrop { position: absolute; inset: 0; background: rgb(0 0 0 / .6); }
.modal__content { position: relative; width: min(1080px, 100%); max-height: min(760px, calc(100vh - 48px)); overflow: auto; border-radius: 12px; padding: 22px; background: var(--theme--background, #10151d); box-shadow: 0 20px 60px rgb(0 0 0 / .45); }
.modal__header { display: flex; justify-content: space-between; gap: 16px; align-items: start; margin-bottom: 16px; }
.modal__header h3, .modal__header p { margin: 0; }.modal__header p { margin-top: 4px; }.icon-button { font-size: 24px; line-height: 1; padding: 4px 10px; }
.search { box-sizing: border-box; width: 100%; margin-bottom: 16px; padding: 10px 12px; border: 1px solid var(--theme--border-color, #586172); border-radius: 6px; background: transparent; color: inherit; font: inherit; }
.status { margin: 24px 0; color: var(--theme--foreground-subdued, #a2aab7); }.status--error { color: var(--theme--danger, #e35169); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }
.file { min-width: 0; overflow: hidden; padding: 0; border: 2px solid transparent; border-radius: 8px; background: var(--theme--background-accent, #1b222c); color: inherit; cursor: pointer; text-align: left; }
.file:hover, .file--selected { border-color: var(--theme--primary, #2d7ff9); }.file img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }.file span { display: block; overflow: hidden; padding: 8px; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 600px) { .modal { padding: 12px; }.modal__content { max-height: calc(100vh - 24px); padding: 16px; }.grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
