<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from '../api';
import type { LearningModule } from '../data/learning';
import HeroHeading from "./HeroHeading.vue";
import KnowledgeUniverse from "./KnowledgeUniverse.vue";
import { auth, logout } from '../auth';
import { useRouter } from 'vue-router';
const router = useRouter();
async function signOut() {
  try { await logout(); await router.replace('/login'); }
  catch { notice.value = '退出失败，请检查网络后重试。'; }
}
const notice = ref("");
const modules = ref<LearningModule[]>([]);
const loading = ref(true);
const loadError = ref(false);
async function loadModules() {
  loading.value = true;
  loadError.value = false;
  try { modules.value = await api<LearningModule[]>('/learning/modules'); }
  catch { loadError.value = true; }
  finally { loading.value = false; }
}
function selectModule(module: LearningModule) {
  if (module.entrySlug) router.push(`/knowledge/${encodeURIComponent(module.entrySlug)}`);
  else notice.value = `${module.title}：内容准备中。`;
}
onMounted(loadModules);
</script>
<template>
  <header class="topbar">
    <a class="brand" href="./"><span aria-hidden="true">✦</span> LearnAI</a>
    <nav aria-label="主导航">
      <a class="active" href="./" aria-current="page">首页</a
      ><button @click="notice = '学习偏好设置将在后续开放。'">设置</button>
    </nav>
    <div class="header-actions">
      <span>{{ auth.user?.displayName }}</span>
      <div class="avatar" aria-label="用户头像">{{ auth.user?.displayName.slice(0, 1) }}</div>
      <button @click="signOut">退出登录</button>
    </div>
  </header>
  <main>
    <section class="intro"><HeroHeading /></section>
    <div v-if="loading" class="module-state" role="status">正在加载学习模块…</div>
    <div v-else-if="loadError" class="module-state" role="alert">
      <p>学习模块加载失败，请稍后重试。</p><button @click="loadModules">重新加载</button>
    </div>
    <div v-else-if="!modules.length" class="module-state" role="status">学习模块正在准备中。</div>
    <KnowledgeUniverse v-else
      :modules="modules"
      @select="selectModule"
      @send="notice = '已收到你的学习想法。AI 导师将在后续接入。'"
    />
  </main>
  <div v-if="notice" class="notice" role="status">
    <span>{{ notice }}</span
    ><button aria-label="关闭提示" @click="notice = ''">×</button>
  </div>
</template>
<style scoped>
.module-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #66769a; }
.module-state button { padding: 10px 20px; border-radius: 10px; background: #e7edff; color: #4e68b4; }
</style>
