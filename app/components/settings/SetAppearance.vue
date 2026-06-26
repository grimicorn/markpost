<template>
  <div>
    <SetHead
      eyebrow="appearance"
      title="Appearance"
      desc="Personalize markpost. Your theme and accent colour are saved to your account and follow you everywhere."
    />

    <div class="card card-pad">
      <span class="field-label" style="margin-bottom: 12px">
        <span class="num">01</span> Theme
      </span>
      <div class="row wrap gap-3">
        <button
          v-for="themeOption in themeOptions"
          :key="themeOption.id"
          class="col"
          :style="{
            flex: 1,
            minWidth: '150px',
            cursor: 'pointer',
            border: '1px solid',
            borderColor:
              currentTheme === themeOption.id
                ? 'var(--accent)'
                : 'var(--line-2)',
            borderRadius: '10px',
            padding: '14px',
            background:
              currentTheme === themeOption.id
                ? 'var(--accent-tint)'
                : 'var(--surface-2)',
            gap: '10px',
            alignItems: 'stretch',
            boxShadow:
              currentTheme === themeOption.id
                ? '0 0 0 3px var(--accent-tint)'
                : 'none',
          }"
          @click="applyTheme(themeOption.id)"
        >
          <div
            :style="{
              height: '56px',
              borderRadius: '7px',
              border: '1px solid var(--line)',
              overflow: 'hidden',
              background: themeOption.id === 'dark' ? '#1a1916' : '#f4f3ef',
              display: 'flex',
            }"
          >
            <div
              :style="{
                width: '34%',
                borderRight:
                  '1px solid ' +
                  (themeOption.id === 'dark' ? '#2a2823' : '#e5e2da'),
                padding: '6px',
              }"
            >
              <div
                style="
                  height: 5px;
                  border-radius: 2px;
                  background: var(--accent);
                  width: 70%;
                "
              />
              <div
                :style="{
                  height: '4px',
                  borderRadius: '2px',
                  background: themeOption.id === 'dark' ? '#3a3730' : '#d6d2c8',
                  width: '90%',
                  marginTop: '5px',
                }"
              />
            </div>
            <div style="flex: 1; padding: 6px">
              <div
                :style="{
                  height: '4px',
                  borderRadius: '2px',
                  background: themeOption.id === 'dark' ? '#3a3730' : '#d6d2c8',
                  width: '80%',
                }"
              />
              <div
                :style="{
                  height: '4px',
                  borderRadius: '2px',
                  background: themeOption.id === 'dark' ? '#3a3730' : '#d6d2c8',
                  width: '55%',
                  marginTop: '5px',
                }"
              />
            </div>
          </div>
          <span
            class="row mono gap-2"
            :style="{
              fontSize: '12.5px',
              color:
                currentTheme === themeOption.id
                  ? 'var(--accent-700)'
                  : 'var(--ink-2)',
              fontWeight: currentTheme === themeOption.id ? 600 : 500,
            }"
          >
            <AppIcon :name="themeOption.ic" :size="15" />
            {{ themeOption.label }}
            <AppIcon
              v-if="currentTheme === themeOption.id"
              name="check"
              :size="14"
              style="margin-left: auto"
            />
          </span>
        </button>
      </div>

      <hr class="hairline" style="margin: 24px 0" />

      <span class="field-label" style="margin-bottom: 4px">
        <span class="num">02</span> Accent colour
      </span>
      <p class="muted" style="font-size: 13px; margin-bottom: 16px">
        Tints buttons, links, focus rings and highlights across the app.
      </p>
      <div
        style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 12px"
      >
        <button
          v-for="accentOption in ACCENTS"
          :key="accentOption.id"
          class="col"
          :style="{
            alignItems: 'center',
            gap: '7px',
            background: 'none',
            border: 0,
            cursor: 'pointer',
          }"
          :title="accentOption.name"
          @click="applyAccent(accentOption.hex)"
        >
          <span
            :style="{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: accentOption.hex,
              display: 'grid',
              placeItems: 'center',
              boxShadow:
                currentAccent === accentOption.hex
                  ? `0 0 0 2px var(--surface), 0 0 0 4px ${accentOption.hex}`
                  : 'none',
              transition: 'all .12s',
            }"
          >
            <AppIcon
              v-if="currentAccent === accentOption.hex"
              name="check"
              :size="18"
              :style="{ color: '#fff' }"
            />
          </span>
          <span
            class="mono"
            :style="{
              fontSize: '10px',
              color:
                currentAccent === accentOption.hex
                  ? 'var(--ink)'
                  : 'var(--ink-3)',
              letterSpacing: '.02em',
            }"
          >
            {{ accentOption.name }}
          </span>
        </button>
      </div>

      <hr class="hairline" style="margin: 24px 0" />

      <span class="field-label" style="margin-bottom: 12px">Preview</span>
      <div class="panel" style="padding: 18px">
        <div class="row between wrap gap-3">
          <div class="row wrap gap-2">
            <AppBtn variant="accent" size="sm" icon-r="arrowR">primary</AppBtn>
            <AppBtn size="sm">secondary</AppBtn>
            <AppBadge tone="accent" dot>accent badge</AppBadge>
          </div>
          <span class="mono" style="font-size: 12px; color: var(--accent-700)"
            >a tinted link →</span
          >
        </div>
        <div class="row gap-3" style="margin-top: 14px">
          <div class="grow">
            <AppField state="ok" msg="focus ring uses your accent">
              <input class="input" value="markpost" />
            </AppField>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SetHead from "./SetHead.vue";

const ACCENTS = [
  { id: "violet", name: "violet", hex: "#a855f7" },
  { id: "indigo", name: "indigo", hex: "#6366f1" },
  { id: "blue", name: "blue", hex: "#2f6fed" },
  { id: "emerald", name: "emerald", hex: "#0e9f6e" },
  { id: "amber", name: "amber", hex: "#d98613" },
  { id: "orange", name: "orange", hex: "#ea580c" },
  { id: "rose", name: "rose", hex: "#e11d6b" },
  { id: "ink", name: "graphite", hex: "#3f3d39" },
];

const themeOptions = [
  { id: "light", ic: "sun", label: "Light" },
  { id: "dark", ic: "moon", label: "Dark" },
  { id: "system", ic: "sliders", label: "System" },
];

const currentTheme = ref("light");
const currentAccent = ref("#a855f7");

const { isDark, setTheme } = useTheme();

const THEME_CHOICE_KEY = "mp_theme_choice";

onMounted(() => {
  const storedChoice = localStorage.getItem(THEME_CHOICE_KEY);
  currentTheme.value = storedChoice ?? (isDark.value ? "dark" : "light");
  const storedAccent = localStorage.getItem("mp_accent");
  if (storedAccent) {
    applyAccent(storedAccent);
  }
});

const applyTheme = (themeId: string) => {
  currentTheme.value = themeId;
  localStorage.setItem(THEME_CHOICE_KEY, themeId);
  if (themeId === "system") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    setTheme(prefersDark ? "dark" : "light");
  } else {
    setTheme(themeId as "dark" | "light");
  }
};

const applyAccent = (hex: string) => {
  currentAccent.value = hex;
  localStorage.setItem("mp_accent", hex);
  document.documentElement.style.setProperty("--accent", hex);
};
</script>
