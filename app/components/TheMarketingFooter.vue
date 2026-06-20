<template>
  <footer style="border-top: 1px solid var(--line); padding: 28px 40px; margin-top: 0">
    <div class="row between wrap gap-4" style="max-width: 1180px; margin: 0 auto">
      <div class="row gap-3">
        <AppLogo :size="18" />
        <span class="mono faint" style="font-size: 12px">© 2026 markpost</span>
      </div>
      <div class="row gap-6 mono" style="font-size: 12px; color: var(--ink-3)">
        <NuxtLink
          to="/pricing"
          style="background: none; border: 0; cursor: pointer; font-family: var(--mono); font-size: 13px; padding: 0; color: var(--ink-3)"
        >
          pricing
        </NuxtLink>
        <NuxtLink
          to="/docs"
          style="background: none; border: 0; cursor: pointer; font-family: var(--mono); font-size: 13px; padding: 0; color: var(--ink-3)"
        >
          docs
        </NuxtLink>
        <NuxtLink
          to="/login"
          style="background: none; border: 0; cursor: pointer; font-family: var(--mono); font-size: 13px; padding: 0; color: var(--ink-3)"
        >
          sign in
        </NuxtLink>
        <span class="row gap-2">
          <AppBadge tone="ok" dot style="font-size: 10px">all systems go</AppBadge>
        </span>
      </div>
    </div>
  </footer>
</template>
