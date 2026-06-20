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
withDefaults(
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

function findScrollParent(element: HTMLElement): Element | null {
  let parent: Element | null = element.parentElement;
  while (parent && !parent.classList.contains("scroll")) {
    parent = parent.parentElement;
  }
  return parent ?? null;
}

function isInView(element: HTMLElement, scrollTarget: Element | null): boolean {
  const rect = element.getBoundingClientRect();
  const view = scrollTarget
    ? scrollTarget.getBoundingClientRect()
    : { top: 0, bottom: window.innerHeight, height: window.innerHeight };
  const line = view.bottom - view.height * 0.12;
  return rect.top < line && rect.bottom > view.top;
}

onMounted(() => {
  const element = elementRef.value;
  if (!element) {
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.classList.add("in");
    return;
  }

  const scrollTarget = findScrollParent(element);
  const scrollEventTarget = scrollTarget ?? window;
  let done = false;

  const cleanup = () => {
    scrollEventTarget.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  };

  const check = () => {
    if (done || !elementRef.value) {
      return;
    }
    if (isInView(element, scrollTarget)) {
      element.classList.add("in");
      done = true;
      cleanup();
    }
  };

  const onScroll = () => check();

  scrollEventTarget.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  const rafId = requestAnimationFrame(check);

  onUnmounted(() => {
    cancelAnimationFrame(rafId);
    cleanup();
  });
});
</script>
