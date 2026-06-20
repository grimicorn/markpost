<template>
  <component
    :is="resolvedAs"
    :class="classes"
    :href="href"
    :disabled="disabled || undefined"
    :title="title"
    :style="style"
    v-bind="linkProps"
  >
    <AppIcon v-if="icon" :name="icon" :size="iconSize" />
    <slot />
    <AppIcon v-if="iconR" :name="iconR" :size="iconSize" />
  </component>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    variant?: "" | "accent" | "ghost";
    size?: "" | "sm" | "lg";
    icon?: string;
    iconR?: string;
    block?: boolean;
    disabled?: boolean;
    href?: string;
    title?: string;
    as?: "button" | "a";
    style?: string | Record<string, string>;
  }>(),
  {
    variant: "",
    size: "",
    block: false,
    disabled: false,
  },
);

const resolvedAs = computed(() => {
  if (props.href) {
    return "a";
  }
  return props.as ?? "button";
});

const linkProps = computed(() => {
  if (props.href) {
    return { href: props.href };
  }
  return {};
});

const classes = computed(() => {
  const list = ["btn"];
  if (props.variant) {
    list.push(`btn-${props.variant}`);
  }
  if (props.size) {
    list.push(`btn-${props.size}`);
  }
  if (props.block) {
    list.push("btn-block");
  }
  return list.join(" ");
});

const iconSize = computed(() => (props.size === "lg" ? 18 : 16));
</script>
