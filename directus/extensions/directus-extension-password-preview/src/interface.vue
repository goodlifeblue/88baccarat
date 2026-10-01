<template>
  <div class="password-field">
    <div class="password-field__control">
      <input
        :id="inputId"
        :value="value || ''"
        :type="revealed ? 'text' : 'password'"
        :disabled="disabled"
        :autocomplete="autocomplete"
        class="password-field__input"
        placeholder="輸入新密碼"
        @input="onInput"
      />
      <button
        type="button"
        class="password-field__toggle"
        :disabled="disabled || !value"
        :aria-label="revealed ? '隱藏本次輸入的密碼' : '顯示本次輸入的密碼'"
        :title="revealed ? '隱藏密碼' : '顯示密碼'"
        @click="revealed = !revealed"
      >{{ revealed ? '隱藏' : '顯示' }}</button>
    </div>
    <p class="password-field__hint">僅能預覽本次輸入的密碼；儲存後會以雜湊形式保存，無法再次查看。</p>
  </div>
</template>

<script>
import { computed, ref } from 'vue';

export default {
  props: {
    value: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  emits: ['input'],
  setup(props, { emit }) {
    const revealed = ref(false);
    const inputId = `password-preview-${Math.random().toString(36).slice(2)}`;
    const autocomplete = computed(() => props.value ? 'new-password' : 'off');
    const onInput = (event) => emit('input', event.target.value);
    return { autocomplete, inputId, onInput, revealed };
  },
};
</script>

<style scoped>
.password-field { display: grid; gap: 8px; }
.password-field__control { display: flex; gap: 8px; }
.password-field__input { min-width: 0; flex: 1; padding: 10px 12px; border: 1px solid var(--theme--border-color, #586172); border-radius: 6px; background: var(--theme--background, #10151d); color: inherit; font: inherit; }
.password-field__toggle { flex: 0 0 auto; border: 1px solid var(--theme--border-color, #586172); border-radius: 6px; padding: 0 13px; background: var(--theme--background-accent, #1b222c); color: inherit; cursor: pointer; font: inherit; }
.password-field__toggle:disabled { cursor: not-allowed; opacity: .55; }
.password-field__hint { margin: 0; color: var(--theme--foreground-subdued, #a2aab7); font-size: 12px; line-height: 1.5; }
</style>
