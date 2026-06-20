<template>
  <div
    style="
      height: 100vh;
      display: grid;
      grid-template-columns: 232px 1fr;
      background: var(--bg);
    "
  >
    <!-- sidebar -->
    <aside
      style="
        border-right: 1px solid var(--line);
        background: var(--surface);
        display: flex;
        flex-direction: column;
        padding: 18px 14px;
      "
    >
      <NuxtLink
        to="/"
        style="padding: 4px 8px; margin-bottom: 18px; display: block"
      >
        <AppLogo :size="22" />
      </NuxtLink>

      <nav class="col gap-2" style="flex: 1">
        <span class="kicker" style="padding: 4px 8px 8px">workspace</span>
        <NuxtLink
          v-for="navItem in navItems"
          :key="navItem.id"
          :to="navItem.path"
          class="row gap-3"
          :style="{
            width: '100%',
            border: 0,
            cursor: 'pointer',
            background:
              active === navItem.id ? 'var(--accent-tint)' : 'transparent',
            color: active === navItem.id ? 'var(--accent-700)' : 'var(--ink-2)',
            padding: '9px 10px',
            borderRadius: '7px',
            fontFamily: 'var(--mono)',
            fontSize: '13.5px',
            fontWeight: active === navItem.id ? 600 : 500,
            transition: 'all .12s',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }"
        >
          <AppIcon :name="navItem.ic" :size="17" />
          {{ navItem.label }}
          <AppBadge
            v-if="navItem.id === 'inbox'"
            tone="accent"
            style="margin-left: auto; font-size: 9.5px; padding: 1px 6px"
          >
            3
          </AppBadge>
        </NuxtLink>

        <div style="margin-top: 18px"><hr class="hairline" /></div>

        <a
          href="/docs"
          class="row gap-3"
          style="
            width: 100%;
            border: 0;
            cursor: pointer;
            background: transparent;
            color: var(--ink-2);
            padding: 9px 10px;
            border-radius: 7px;
            font-family: var(--mono);
            font-size: 13.5px;
            margin-top: 6px;
            display: flex;
            align-items: center;
            gap: 12px;
          "
        >
          <AppIcon name="book" :size="17" />
          Docs
          <AppIcon
            name="external"
            :size="13"
            :style="{ marginLeft: 'auto', color: 'var(--ink-3)' }"
          />
        </a>
      </nav>

      <!-- plan card -->
      <div class="panel" style="padding: 12px; margin-bottom: 12px">
        <div class="row between">
          <AppBadge tone="accent" dot>pro trial</AppBadge>
          <span class="mono faint" style="font-size: 11px">9d left</span>
        </div>
        <div
          style="
            height: 5px;
            border-radius: 99px;
            background: var(--bg-2);
            margin-top: 10px;
            overflow: hidden;
          "
        >
          <div style="width: 64%; height: 100%; background: var(--accent)" />
        </div>
        <NuxtLink
          to="/pricing"
          class="mono"
          style="
            font-size: 11.5px;
            color: var(--accent-700);
            margin-top: 10px;
            display: block;
            background: none;
            border: 0;
            cursor: pointer;
            padding: 0;
          "
        >
          upgrade plan →
        </NuxtLink>
      </div>

      <!-- user -->
      <NuxtLink
        to="/settings"
        class="row gap-3"
        style="
          width: 100%;
          border: 1px solid var(--line);
          cursor: pointer;
          background: var(--surface-2);
          padding: 8px 10px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          gap: 12px;
        "
      >
        <span
          style="
            width: 28px;
            height: 28px;
            border-radius: 7px;
            background: var(--accent-tint);
            color: var(--accent-700);
            display: grid;
            place-items: center;
            font-family: var(--mono);
            font-size: 13px;
            font-weight: 600;
            flex: none;
          "
        >
          {{ userInitial }}
        </span>
        <span
          class="col"
          style="align-items: flex-start; line-height: 1.2; overflow: hidden"
        >
          <span style="font-size: 13px; font-weight: 500">{{ userName }}</span>
          <span
            class="mono faint"
            style="
              font-size: 10.5px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 130px;
            "
          >
            {{ userEmail }}
          </span>
        </span>
        <AppIcon
          name="chevR"
          :size="14"
          :style="{ marginLeft: 'auto', color: 'var(--ink-3)' }"
        />
      </NuxtLink>
    </aside>

    <!-- main -->
    <div style="display: flex; flex-direction: column; min-width: 0">
      <header
        class="row between"
        style="
          padding: 0 26px;
          height: 60px;
          border-bottom: 1px solid var(--line);
          background: color-mix(in oklab, var(--bg) 84%, transparent);
          backdrop-filter: blur(8px);
          flex: none;
        "
      >
        <div class="col" style="gap: 2px; min-width: 0; flex: none">
          <span
            v-if="crumb"
            class="mono faint"
            style="font-size: 11px; letter-spacing: 0.08em; white-space: nowrap"
          >
            {{ crumb }}
          </span>
          <h1
            style="
              font-size: 17px;
              font-weight: 600;
              letter-spacing: -0.02em;
              white-space: nowrap;
            "
          >
            {{ title }}
          </h1>
        </div>
        <div class="row gap-3">
          <div class="input-wrap" style="display: flex">
            <span class="lead-addon"><AppIcon name="search" :size="15" /></span>
            <input
              class="input has-lead"
              placeholder="search records…"
              style="height: 36px; width: 190px; font-size: 13px"
            />
            <span class="addon"><AppKbd>⌘K</AppKbd></span>
          </div>
          <slot name="actions" />
          <button
            class="icon-btn"
            style="
              border: 1px solid var(--line);
              border-radius: 7px;
              width: 36px;
              height: 36px;
              justify-content: center;
              color: var(--ink-2);
            "
            title="toggle theme"
            @click="toggleTheme"
          >
            <AppIcon :name="isDark ? 'sun' : 'moon'" :size="17" />
          </button>
          <button
            class="icon-btn"
            style="
              border: 1px solid var(--line);
              border-radius: 7px;
              width: 36px;
              height: 36px;
              justify-content: center;
              color: var(--ink-2);
            "
          >
            <AppIcon name="bell" :size="17" />
          </button>
        </div>
      </header>
      <div class="scroll" style="overflow-y: auto; flex: 1">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  active: string;
  title: string;
  crumb?: string;
}>();

const { isDark, initTheme, toggleTheme } = useTheme();
onMounted(initTheme);

const { user } = useUser();

const userName = computed(() => {
  if (user.value?.firstName && user.value?.lastName) {
    return `${user.value.firstName} ${user.value.lastName[0]}.`;
  }
  if (user.value?.firstName) {
    return user.value.firstName;
  }
  return "Dan H.";
});

const userEmail = computed(
  () => user.value?.primaryEmailAddress?.emailAddress ?? "dan@markpost.io",
);

const userInitial = computed(() => userName.value[0]?.toUpperCase() ?? "D");

const navItems = [
  { id: "inbox", ic: "inbox", label: "Inbox", path: "/inbox" },
  { id: "sources", ic: "plug", label: "Sources", path: "/sources" },
  { id: "activity", ic: "activity", label: "Activity", path: "/activity" },
  { id: "settings", ic: "sliders", label: "Settings", path: "/settings" },
];
</script>
