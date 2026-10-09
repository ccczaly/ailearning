<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { login, register } from '../auth';
import { ApiError } from '../api';
const route = useRoute();
const router = useRouter();
const username = ref('');
const password = ref('');
const confirmation = ref('');
const registering = computed(() => route.path === '/register');
const busy = ref(false);
const error = ref('');
const backgroundVideo = `${import.meta.env.BASE_URL}media/login-background.mp4`;
const backgroundPoster = `${import.meta.env.BASE_URL}media/login-background.jpg`;
watch(registering, () => { password.value = ''; confirmation.value = ''; error.value = ''; });
const message = computed(() => route.query.registered === '1' ? '注册成功，请使用新账号登录。' : route.query.reason === 'expired' ? '登录已过期，请重新登录。' : route.query.reason === 'unavailable' ? '暂时无法连接服务，请稍后重试。' : '');
async function submit() {
  if (busy.value) return;
  error.value = '';
  if (registering.value) {
    if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username.value.trim())) { error.value = '账号需为 3–64 位字母、数字、点、下划线或短横线。'; return; }
    if (password.value.length < 12 || new TextEncoder().encode(password.value).length > 72) { error.value = '密码至少 12 个字符，最多 72 个 UTF-8 字节。'; return; }
    if (password.value !== confirmation.value) { error.value = '两次输入的密码不一致。'; return; }
  }
  busy.value = true;
  try {
    if (registering.value) {
      await register(username.value.trim(), password.value);
      await router.replace({ path: '/login', query: { registered: '1' } });
    } else {
      await login(username.value.trim(), password.value);
      await router.replace('/');
    }
  }
  catch (failure) {
    error.value = failure instanceof ApiError
      ? failure.status === 429 ? '尝试次数过多，请等待一分钟后重试。'
        : failure.code === 'USERNAME_TAKEN' ? '该账号已被注册，请更换账号或返回登录。'
        : failure.code === 'INVALID_USERNAME' ? '账号需为 3–64 位字母、数字、点、下划线或短横线。'
        : failure.code === 'INVALID_PASSWORD' ? '密码至少 12 个字符，最多 72 个 UTF-8 字节。'
        : failure.code === 'INVALID_CREDENTIALS' ? '账号或密码错误，或账号已被禁用。'
        : failure.code === 'CSRF_INVALID' ? '页面验证已过期，请重新提交。'
        : '提交失败，请稍后重试。'
      : '无法连接服务，请检查网络后重试。';
  } finally { password.value = ''; confirmation.value = ''; busy.value = false; }
}
</script>
<template>
  <main class="login-page">
    <video
      v-if="!registering"
      class="login-background"
      :src="backgroundVideo"
      :poster="backgroundPoster"
      autoplay
      muted
      loop
      playsinline
      preload="metadata"
      aria-hidden="true"
      tabindex="-1"
    ></video>
    <div v-if="!registering" class="login-overlay" aria-hidden="true"></div>
    <section class="login-card">
      <div class="login-brand">✦ LearnAI</div>
      <p class="login-eyebrow">开启你的 AI 学习之旅</p>
      <h1>{{ registering ? '创建账号' : '欢迎回来' }}</h1>
      <p class="login-description">{{ registering ? '注册，开启你的知识宇宙。' : '登录，继续探索你的知识宇宙。' }}</p>
      <p v-if="message" role="status" class="login-message">{{ message }}</p>
      <form @submit.prevent="submit">
        <label for="username">账号</label>
        <input id="username" v-model="username" autocomplete="username" maxlength="64" required placeholder="请输入账号" :disabled="busy" />
        <label for="password">密码</label>
        <input id="password" v-model="password" type="password" :autocomplete="registering ? 'new-password' : 'current-password'" required placeholder="请输入密码" :disabled="busy" />
        <template v-if="registering">
          <p id="register-help" class="register-help">账号为 3–64 位字母、数字、点、下划线或短横线；密码至少 12 个字符，最多 72 个 UTF-8 字节。</p>
          <label for="confirmation">确认密码</label>
          <input id="confirmation" v-model="confirmation" type="password" autocomplete="new-password" required placeholder="请再次输入密码" :disabled="busy" />
        </template>
        <p v-if="error" role="alert" class="login-error">{{ error }}</p>
        <button class="login-submit" type="submit" :disabled="busy">{{ busy ? '正在提交…' : registering ? '注册' : '登录' }}</button>
      </form>
      <p class="login-footnote">
        {{ registering ? '已有账号？' : '还没有账号？' }}
        <RouterLink v-if="!busy" :to="registering ? '/login' : '/register'">{{ registering ? '去登录' : '立即注册' }}</RouterLink>
      </p>
    </section>
  </main>
</template>
<style scoped>
.login-page { position: relative; isolation: isolate; flex: 1; display: grid; place-items: center; padding: 24px; overflow: auto; background: radial-gradient(ellipse at 20% 20%, #e3eaff, transparent 55%), radial-gradient(ellipse at 90% 80%, #e9e0ff, transparent 50%), #f8faff; }
.login-background { position: fixed; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; z-index: -2; }
.login-overlay { position: fixed; inset: 0; background: rgb(18 25 48 / 18%); pointer-events: none; z-index: -1; }
.login-card { width: min(100%, 440px); padding: 40px; background: #ffffffeb; border: 1px solid white; border-radius: 28px; box-shadow: 0 20px 70px #6375b51a; backdrop-filter: blur(12px); }
.login-brand { font-size: 23px; font-weight: 750; color: #5264c8; }
.login-eyebrow { margin-top: 28px; color: #7382ad; font-size: 12px; letter-spacing: 2px; }
h1 { margin: 10px 0; font-size: 32px; }
.login-description, .login-footnote { color: #7c869e; line-height: 1.7; }
form { display: grid; gap: 12px; margin-top: 28px; }
label { font-weight: 600; }
input { width: 100%; padding: 13px 15px; border: 1px solid #dce2f3; background: #fbfcff; border-radius: 10px; margin-bottom: 8px; }
input:focus { outline: 2px solid #899aee; outline-offset: 2px; }
.login-submit { margin-top: 6px; padding: 14px; border-radius: 12px; color: white; background: #6375df; font-weight: 600; }
button:disabled { opacity: .6; cursor: wait; }
.login-error { color: #af334e; margin: 0; }
.login-message { color: #675297; background: #f3efff; padding: 12px; border-radius: 8px; }
.login-footnote { text-align: center; font-size: 12px; margin-bottom: 0; }
.register-help { color: #7c869e; font-size: 12px; line-height: 1.6; margin: 0; }
.login-footnote a { color: #5264c8; font-weight: 600; }
</style>
