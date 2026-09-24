<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import gsap from "gsap";
import { modules } from "../data/modules";
import { createKnowledgeScene } from "../scene/createKnowledgeScene";
import ModuleIcon from "./ModuleIcon.vue";
import mentorImage from "../assets/xiaobaozi.png";

const emit = defineEmits<{
  select: [title: string];
  send: [message: string];
}>();
const shell = ref<HTMLElement>();
const stage = ref<HTMLElement>();
const canvas = ref<HTMLCanvasElement>();
const webglReady = ref(false);
const mentorInScene = ref(false);
const message = ref("");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const motion = modules.map(() => ({ y: 0, scale: 1 }));
const pointer = { x: 0, y: 0 };
let cleanup = () => {};
function focusPlanet(index: number, focused: boolean) {
  gsap.to(motion[index]!, {
    scale: focused ? 1.09 : 1,
    duration: reducedMotion.matches ? 0 : 0.5,
    ease: "power3.out",
    overwrite: "auto",
  });
}
function movePointer(event: PointerEvent) {
  if (!stage.value || reducedMotion.matches || event.pointerType === "touch")
    return;
  const rect = stage.value.getBoundingClientRect();
  gsap.to(pointer, {
    x: Math.max(
      -1,
      Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2),
    ),
    y: Math.max(
      -1,
      Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2),
    ),
    duration: 1.5,
    ease: "power2.out",
    overwrite: true,
  });
}
function resetPointer() {
  gsap.to(pointer, { x: 0, y: 0, duration: 1.4, overwrite: true });
}
function send() {
  if (!message.value.trim()) return;
  emit("send", message.value.trim());
  message.value = "";
}
onMounted(() => {
  if (!canvas.value || !stage.value || !shell.value) return;
  const stageElement = stage.value;
  const canvasElement = canvas.value;
  const buttons = [
    ...stageElement.querySelectorAll<HTMLElement>(".planet-button"),
  ];
  const fit = () => {
    if (shell.value)
      stageElement.style.setProperty(
        "--scene-scale",
        String(
          Math.min(
            shell.value.clientWidth / 1480,
            shell.value.clientHeight / 680,
            1.14,
          ),
        ),
      );
  };
  const observer = new ResizeObserver(fit);
  observer.observe(shell.value);
  fit();
  let scene: ReturnType<typeof createKnowledgeScene> | undefined;
  try {
    scene = createKnowledgeScene(canvasElement);
    webglReady.value = true;
  } catch (error) {
    console.warn("三维场景不可用，显示静态模块。", error);
  }
  const tweens: gsap.core.Tween[] = [];
  const configureMotion = () => {
    tweens.splice(0).forEach((tween) => tween.kill());
    gsap.killTweensOf(pointer);
    pointer.x = pointer.y = 0;
    motion.forEach((state, index) => {
      state.y = 0;
      if (!reducedMotion.matches)
        tweens.push(
          gsap.to(state, {
            y: index % 2 ? -8 : 8,
            duration: 3.5 + index * 0.2,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          }),
        );
    });
  };
  configureMotion();
  if (!reducedMotion.matches) {
    gsap.fromTo(
      pointer,
      { x: -0.4, y: 0.18 },
      {
        x: 0,
        y: 0,
        duration: 2.6,
        ease: "power2.out",
        overwrite: true,
      },
    );
  }
  const fallback = () => {
    buttons.forEach((button, index) => {
      const item = modules[index]!;
      button.style.left = `${item.x - item.radius}px`;
      button.style.top = `${item.y - item.radius}px`;
      button.style.setProperty("--radius", `${item.radius}px`);
      button.style.removeProperty("opacity");
      button.classList.remove("is-occluded", "label-left");
    });
  };
  const tick = () => {
    if (!scene) return;
    const frame = scene.render(pointer, motion);
    mentorInScene.value = frame.mentorReady;
    frame.layout.forEach((position, index) => {
      const button = buttons[index]!;
      button.style.left = `${position.x - position.radius}px`;
      button.style.top = `${position.y - position.radius}px`;
      button.style.setProperty("--radius", `${position.radius}px`);
      button.style.setProperty(
        "--label-opacity",
        String(
          Math.max(0.68, Math.min(1, 1 - (position.distance - 1000) / 2200)),
        ),
      );
      button.style.zIndex = String(Math.round(4000 - position.distance));
      button.classList.toggle(
        "label-left",
        position.x > 1100 || modules[index]!.id === "products",
      );
      button.classList.toggle("is-occluded", position.occluded);
      button.dataset.depth = position.distance.toFixed(1);
    });
  };
  const visibility = () => {
    if (document.hidden) {
      gsap.ticker.remove(tick);
      tweens.forEach((tween) => tween.pause());
    } else {
      gsap.ticker.add(tick);
      tweens.forEach((tween) => tween.resume());
    }
  };
  const lostContext = (event: Event) => {
    event.preventDefault();
    webglReady.value = false;
    mentorInScene.value = false;
    scene?.dispose();
    scene = undefined;
    fallback();
  };
  canvasElement.addEventListener("webglcontextlost", lostContext);
  document.addEventListener("visibilitychange", visibility);
  reducedMotion.addEventListener("change", configureMotion);
  tick();
  visibility();
  cleanup = () => {
    observer.disconnect();
    gsap.ticker.remove(tick);
    tweens.forEach((tween) => tween.kill());
    motion.forEach((state) => gsap.killTweensOf(state));
    gsap.killTweensOf(pointer);
    canvasElement.removeEventListener("webglcontextlost", lostContext);
    document.removeEventListener("visibilitychange", visibility);
    reducedMotion.removeEventListener("change", configureMotion);
    scene?.dispose();
  };
});
onBeforeUnmount(() => cleanup());
</script>
<template>
  <section
    ref="shell"
    class="universe-shell"
    aria-label="AI 学习模块"
    @pointermove="movePointer"
    @pointerleave="resetPointer"
  >
    <div
      ref="stage"
      class="universe-stage"
      :class="{ 'webgl-ready': webglReady, 'mentor-in-scene': mentorInScene }"
    >
      <div class="scene-halo" aria-hidden="true" />
      <canvas ref="canvas" class="universe-canvas" aria-hidden="true" />
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
        :style="{
          left: `${item.x - item.radius}px`,
          top: `${item.y - item.radius}px`,
          '--radius': `${item.radius}px`,
          '--planet-color': item.color,
          '--planet-ink': item.ink,
        }"
        @pointerenter="focusPlanet(index, true)"
        @pointerleave="focusPlanet(index, false)"
        @focus="focusPlanet(index, true)"
        @blur="focusPlanet(index, false)"
        @click="emit('select', item.title)"
      >
        <span class="planet-face"
          ><span class="planet-fallback" /><ModuleIcon :name="item.icon"
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
