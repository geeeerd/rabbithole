import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'jsdom'},server:{proxy:{'/api':'http://127.0.0.1:8000'}},build:{manifest:true,rollupOptions:{output:{manualChunks:{graph:['cytoscape'],react:['react','react-dom']}}}}});
