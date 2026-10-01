import InterfaceComponent from './interface.vue';

export default {
  id: 'password-preview',
  name: '密碼（可預覽本次輸入）',
  icon: 'password',
  description: '新增或重設密碼時可切換顯示／隱藏；已儲存的密碼無法預覽。',
  component: InterfaceComponent,
  types: ['hash'],
};
