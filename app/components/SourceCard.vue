<template>
  <div class="card card-pad">
    <div class="row between">
      <div class="row gap-3">
        <span
          v-if="source.letter"
          :style="{
            width: '40px',
            height: '40px',
            borderRadius: '9px',
            background: 'var(--accent-tint)',
            color: 'var(--accent-700)',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--mono)',
            fontWeight: 600,
            fontSize: '17px',
            flex: 'none',
          }"
        >
          {{ source.letter }}
        </span>
        <span
          v-else
          :style="{
            width: '40px',
            height: '40px',
            borderRadius: '9px',
            background: 'var(--accent-tint)',
            color: 'var(--accent-700)',
            display: 'grid',
            placeItems: 'center',
            flex: 'none',
          }"
        >
          <AppIcon :name="source.ic ?? 'zap'" :size="20" />
        </span>
        <div class="col" style="gap: 3px">
          <span class="row gap-2" style="align-items: center">
            <span style="font-weight: 600; font-size: 15px">{{
              source.name
            }}</span>
            <AppChip
              v-if="source.via"
              style="font-size: 10px; padding: 1px 6px"
            >
              via {{ source.via }}
            </AppChip>
          </span>
          <span class="mono faint" style="font-size: 11.5px">{{
            source.sub
          }}</span>
        </div>
      </div>
      <AppBadge :tone="source.fresh ? 'accent' : 'ok'" dot>
        {{ source.fresh ? "ready" : "active" }}
      </AppBadge>
    </div>

    <div class="code" style="margin-top: 16px">
      <div class="code-head">
        <span class="lang">{{ source.label }}</span>
        <AppCopyBtn :text="source.endpoint" />
      </div>
      <div
        class="code-body mono"
        style="font-size: 12.5px; word-break: break-all"
      >
        <template v-if="source.endpointHighlight">
          {{ endpointBefore
          }}<span style="color: var(--accent-700)">{{
            source.endpointHighlight
          }}</span
          >{{ endpointAfter }}
        </template>
        <template v-else>{{ source.endpoint }}</template>
      </div>
    </div>

    <div
      class="row wrap mono gap-6"
      style="font-size: 11.5px; color: var(--ink-3); margin-top: 14px"
    >
      <span v-for="(meta, index) in source.meta" :key="index">{{ meta }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  source: {
    id: string;
    ic?: string;
    letter?: string;
    name: string;
    sub: string;
    label: string;
    endpoint: string;
    endpointHighlight?: string;
    meta: string[];
    fresh?: boolean;
    via?: string;
  };
}>();

const endpointBefore = computed(() => {
  if (!props.source.endpointHighlight) {
    return props.source.endpoint;
  }
  const index = props.source.endpoint.indexOf(props.source.endpointHighlight);
  return index >= 0
    ? props.source.endpoint.slice(0, index)
    : props.source.endpoint;
});

const endpointAfter = computed(() => {
  if (!props.source.endpointHighlight) {
    return "";
  }
  const index = props.source.endpoint.indexOf(props.source.endpointHighlight);
  return index >= 0
    ? props.source.endpoint.slice(index + props.source.endpointHighlight.length)
    : "";
});
</script>
