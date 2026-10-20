<script setup lang="ts">
defineProps<{ name: 'book' | 'bulb' | 'check' }>();
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'book'">
      <path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Z"/><path d="M12 5v15M5 7c2-.3 3 0 4 1M15 8c1-1 2-1.3 4-1"/>
    </template>
    <template v-else-if="name === 'bulb'">
      <path d="M9 18h6M9 21h6M8 13a7 7 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z"/><path d="m10 8 2 2 2-2M12 10v6"/>
    </template>
    <template v-else><path d="m7 12 3 3 7-7"/><path d="M12 2 3 5v6c0 6 9 11 9 11s9-5 9-11V5l-9-3Z"/></template>
  </svg>
</template>
