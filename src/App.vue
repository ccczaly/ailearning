<script setup lang="ts">
import { ref } from "vue";
import HeroHeading from "./components/HeroHeading.vue";
import KnowledgeUniverse from "./components/KnowledgeUniverse.vue";
const notice = ref("");
</script>
<template>
  <header class="topbar">
    <a class="brand" href="./"><span aria-hidden="true">✦</span> LearnAI</a>
    <nav aria-label="主导航">
      <a class="active" href="./" aria-current="page">首页</a
      ><button @click="notice = '学习偏好设置将在后续开放。'">设置</button>
    </nav>
    <div class="header-actions">
      <span>探索，从这里开始</span>
      <div class="avatar" aria-label="头像占位">L</div>
    </div>
  </header>
  <main>
    <section class="intro"><HeroHeading /></section>
    <KnowledgeUniverse
      @select="(title) => (notice = title + '：课程内容将在后续开放。')"
      @send="notice = '已收到你的学习想法。AI 导师将在后续接入。'"
    />
  </main>
  <div v-if="notice" class="notice" role="status">
    <span>{{ notice }}</span
    ><button aria-label="关闭提示" @click="notice = ''">×</button>
  </div>
</template>
