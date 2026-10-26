import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
const t='http://localhost:3001';
export default defineConfig({plugins:[react()],server:{host:true,allowedHosts:true,proxy:{'/api':t,'/uploads':t,'/socket.io':{target:t,ws:true}}}});
