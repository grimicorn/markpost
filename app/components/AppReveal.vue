<template>
  <component
    :is="as"
    ref="elementRef"
    :class="['reveal', $attrs.class]"
    :style="[$attrs.style, delay ? { transitionDelay: `${delay}ms` } : {}]"
    v-bind="filteredAttrs"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    as?: string;
    delay?: number;
  }>(),
  {
    as: "div",
    delay: 0,
  },
);

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const filteredAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs;
  return rest;
});

const elementRef = ref<HTMLElement | null>(null);

onMounted(() => {
  const element = elementRef.value;
  if (!element) {
    return;
  }

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    element.classList.add("in");
    return;
  }

  let scrollParent: Element | null = element.parentElement;
  while (scrollParent && !scrollParent.classList.contains("scroll")) {
    scrollParent = scrollParent.parentElement;
  }
  const scrollTarget = scrollParent ?? null;

  let done = false;

  const check = () => {
    if (done || !elementRef.value) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const view = scrollTarget
      ? scrollTarget.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight, height: window.innerHeight };
    const line = view.bottom - view.height * 0.12;
    if (rect.top < line && rect.bottom > view.top) {
      element.classList.add("in");
      done = true;
      cleanup();
    }
  };

  const scrollEventTarget = scrollTarget ?? window;
  const onScroll = () => check();

  const cleanup = () => {
    scrollEventTarget.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  };

  scrollEventTarget.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  const rafId = requestAnimationFrame(check);

  onUnmounted(() => {
    cancelAnimationFrame(rafId);
    cleanup();
  });
});
</script>
