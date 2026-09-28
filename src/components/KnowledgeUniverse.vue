<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { modules } from "../data/modules";
import ModuleIcon from "./ModuleIcon.vue";
import mentorImage from "../assets/xiaobaozi.png";

const emit = defineEmits<{
  select: [title: string];
  send: [message: string];
}>();
const shell = ref<HTMLElement>();
const stage = ref<HTMLElement>();
const message = ref("");
let observer: ResizeObserver | undefined;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
function resetParallax() {
  stage.value?.style.setProperty("--pointer-x", "0");
  stage.value?.style.setProperty("--pointer-y", "0");
}
function movePointer(event: PointerEvent) {
  if (!stage.value || !shell.value || reducedMotion.matches || event.pointerType !== "mouse") return;
  const rect = shell.value.getBoundingClientRect();
  const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
  const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
  stage.value.style.setProperty("--pointer-x", String(x));
  stage.value.style.setProperty("--pointer-y", String(y));
}
function send() {
  if (!message.value.trim()) return;
  emit("send", message.value.trim());
  message.value = "";
}
onMounted(() => {
  if (!shell.value || !stage.value) return;
  const fit = () => {
    if (!shell.value || !stage.value) return;
    stage.value.style.setProperty("--scene-scale", String(Math.min(
      shell.value.clientWidth / 1480,
      shell.value.clientHeight / 680,
      1.14,
    )));
  };
  observer = new ResizeObserver(fit);
  observer.observe(shell.value);
  fit();
  reducedMotion.addEventListener("change", resetParallax);
  window.addEventListener("blur", resetParallax);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  reducedMotion.removeEventListener("change", resetParallax);
  window.removeEventListener("blur", resetParallax);
});
</script>
<template>
  <section
    ref="shell"
    class="universe-shell"
    aria-label="AI 学习模块"
    @pointermove="movePointer"
    @pointerleave="resetParallax"
    @pointercancel="resetParallax"
  >
    <div
      ref="stage"
      class="universe-stage"
    >
      <div class="scene-halo" aria-hidden="true" />
      <div class="mentor">
        <div class="mentor-platform" aria-hidden="true" />
        <img
          class="mentor-image"
          :src="mentorImage"
          alt="AI 导师小包子"
          fetchpriority="high"
          draggable="false"
        />
      </div>
      <button
        v-for="(item, index) in modules"
        :key="item.id"
        class="planet-button"
        :class="{ 'label-left': item.x > 720, 'is-near': item.depth === 'near', 'is-far': item.depth === 'far' }"
        :style="{
          left: `${item.x - item.radius}px`,
          top: `${item.y - item.radius}px`,
          '--radius': `${item.radius}px`,
          '--planet-color': item.color,
          '--planet-ink': item.ink,
          '--float-delay': `${index * -0.7}s`,
          '--float-duration': `${5 + index * 0.3}s`,
        }"
        @click="emit('select', item.title)"
      >
        <span class="planet-face"
          ><span class="planet-surface" /><ModuleIcon :name="item.icon"
        /></span>
        <span class="planet-info"
          ><strong>{{ item.title }}</strong
          ><span class="planet-count"
            >{{ item.count }} <span>/ {{ item.total }}</span></span
          ><span
            class="planet-progress"
            role="progressbar"
            :aria-label="item.title + '学习进度'"
            :aria-valuenow="item.count"
            :aria-valuemin="0"
            :aria-valuemax="item.total"
            ><span
              :style="{ width: `${(item.count / item.total) * 100}%` }" /></span
        ></span>
      </button>
      <form class="chat-box" @submit.prevent="send">
        <span class="chat-icon" aria-hidden="true">✧</span
        ><input
          v-model="message"
          aria-label="你的学习想法"
          placeholder="和我聊聊你的学习想法…"
          maxlength="500"
        /><button
          class="send"
          :disabled="!message.trim()"
          aria-label="发送学习想法"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
          >
            <path
              d="m3 10 18-7-7 18-3-8-8-3Zm8 3L21 3"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </form>
    </div>
  </section>
</template>
