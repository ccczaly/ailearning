import { createRouter, createWebHistory } from 'vue-router';
import { auth, restore } from './auth';
import HomeView from './components/HomeView.vue';
import LoginView from './components/LoginView.vue';
import KnowledgeView from './components/KnowledgeView.vue';
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView, meta: { requiresAuth: true } },
    { path: '/knowledge/:slug', component: KnowledgeView, meta: { requiresAuth: true } },
    { path: '/login', component: LoginView },
    { path: '/register', component: LoginView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
router.beforeEach(async to => {
  if (!auth.ready) {
    try { await restore(); }
    catch { return ['/login', '/register'].includes(to.path) ? true : { path: '/login', query: { reason: 'unavailable' } }; }
  }
  if (to.meta.requiresAuth && !auth.user) return '/login';
  if (['/login', '/register'].includes(to.path) && auth.user) return '/';
});
