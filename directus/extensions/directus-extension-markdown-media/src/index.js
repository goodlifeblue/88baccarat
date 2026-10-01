import InterfaceComponent from './interface.vue';

export default {
  id: 'markdown-media',
  name: '文章編輯器（圖片自動插入）',
  icon: 'article',
  description: '從檔案庫選取或上傳圖片後，自動插入 Markdown 圖片。',
  component: InterfaceComponent,
  types: ['text'],
};
