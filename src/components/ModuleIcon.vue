<script setup lang="ts">
defineProps<{ name: string }>();
</script>
<template>
  <svg
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <g v-if="name === 'book'">
      <path
        d="M16 8C12 5 7 5 3 6v20c5-1 9-1 13 2 4-3 8-3 13-2V6c-4-1-9-1-13 2v20"
      />
      <path d="M7 11h5M7 16h5M20 11h5M20 16h5" opacity=".55" />
    </g>
    <g v-else-if="name === 'code'">
      <path d="m10 8-8 8 8 8m12-16 8 8-8 8M19 5l-6 22" stroke-width="2.7" />
    </g>
    <g v-else-if="name === 'database'">
      <ellipse cx="16" cy="7" rx="11" ry="4" />
      <path d="M5 7v18c0 5 22 5 22 0V7M5 13c0 5 22 5 22 0M5 19c0 5 22 5 22 0" />
    </g>
    <g v-else-if="name === 'case'">
      <rect x="3" y="10" width="26" height="18" rx="3" />
      <path d="M11 10V6h10v4M3 16c7 6 19 6 26 0M14 18h4v5h-4z" />
    </g>
    <g v-else-if="name === 'puzzle'">
      <path
        d="M5 5h8c-2-6 8-6 6 0h8v8c6-2 6 8 0 6v8h-8c2-6-8-6-6 0H5v-8c6 2 6-8 0-6z"
      />
    </g>
    <g v-else-if="name === 'network'">
      <path d="m7 24 8-14 10 12M15 10l10-5M25 5v17" />
      <circle cx="7" cy="24" r="3" fill="currentColor" />
      <circle cx="15" cy="10" r="3" fill="currentColor" />
      <circle cx="25" cy="5" r="3" fill="currentColor" />
      <circle cx="25" cy="22" r="3" fill="currentColor" />
    </g>
    <g v-else-if="name === 'bulb'">
      <path
        d="M11 23c0-5-5-6-5-12a10 10 0 0 1 20 0c0 6-5 7-5 12zM12 27h8M14 30h4M16 23V13m-4-2 4 3 4-3"
      />
    </g>
    <g v-else>
      <rect
        x="4"
        y="18"
        width="5"
        height="11"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
      <rect
        x="14"
        y="10"
        width="5"
        height="19"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
      <rect
        x="24"
        y="3"
        width="5"
        height="26"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
    </g>
  </svg>
</template>
