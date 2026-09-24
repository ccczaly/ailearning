<script setup lang="ts">
import titleImage from "../assets/hero-title.png";
</script>

<template>
  <div class="hero-heading-group">
    <h1 class="hero-heading">
      <img
        class="hero-title-image"
        :src="titleImage"
        alt="和我一起，探索更大的 AI 世界吧！"
        width="2172"
        height="724"
        fetchpriority="high"
        draggable="false"
      />
    </h1>
  </div>
</template>

<style scoped>
.hero-heading-group {
  width: min(620px, 100%);
  margin: 0 auto;
}
.hero-heading {
  position: relative;
  width: 100%;
  aspect-ratio: 6 / 1;
  overflow: hidden;
  margin: 0;
  line-height: 0;
}
/* 以 CSS 收拢生成图片的透明留白，保留源图及其 alpha 通道。 */
.hero-title-image {
  position: absolute;
  display: block;
  width: 100%;
  height: auto;
  left: 0;
  top: 50%;
  transform: translateY(-53%);
  user-select: none;
}
</style>
