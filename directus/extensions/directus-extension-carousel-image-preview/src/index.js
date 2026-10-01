import InterfaceComponent from './interface.vue';

export default {
  id: 'carousel-image-preview',
  name: '輪播圖片選擇與預覽',
  icon: 'image',
  description: '從網站公開素材挑選圖片，並直接顯示 16:9 預覽。',
  component: InterfaceComponent,
  types: ['uuid'],
  recommendedDisplays: ['image'],
};
