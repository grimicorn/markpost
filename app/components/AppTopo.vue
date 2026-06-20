<template>
  <div class="topo" aria-hidden="true">
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1440 520"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <path
        v-for="(line, index) in lines"
        :key="index"
        :d="line.d"
        stroke="var(--accent)"
        stroke-width="1"
        :opacity="line.opacity"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    seed?: number;
  }>(),
  {
    seed: 0,
  },
);

const lines = computed(() => {
  const result = [];
  for (let i = 0; i < 7; i++) {
    const y = 40 + i * 58 + (props.seed % 20);
    result.push({
      d: `M -50 ${y} C 220 ${y - 70}, 480 ${y + 70}, 760 ${y - 30} S 1300 ${y + 60}, 1600 ${y - 20}`,
      opacity: 0.1 + (i % 3) * 0.05,
    });
  }
  return result;
});
</script>
