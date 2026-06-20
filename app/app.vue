<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
</template>

<script setup lang="ts">
const { initTheme } = useTheme();
onMounted(initTheme);
</script>
