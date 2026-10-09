<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { auth, restore } from './auth';
const router = useRouter();
function expired() { void router.replace({ path: '/login', query: { reason: 'expired' } }); }
function checkSession() {
  if (auth.user && document.visibilityState === 'visible') void restore().catch(() => {});
}
onMounted(() => {
  window.addEventListener('auth-expired', expired);
  window.addEventListener('focus', checkSession);
  document.addEventListener('visibilitychange', checkSession);
});
onUnmounted(() => {
  window.removeEventListener('auth-expired', expired);
  window.removeEventListener('focus', checkSession);
  document.removeEventListener('visibilitychange', checkSession);
});
</script>
<template><RouterView /></template>
