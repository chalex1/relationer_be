import { createApp } from 'vue'
import App from './App.vue'
import ReferencesPage from './pages/ReferencesPage.vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import './style.css'
createApp(window.location.pathname.replace(/\/+$/, '') === '/references' ? ReferencesPage : App).mount('#app')
