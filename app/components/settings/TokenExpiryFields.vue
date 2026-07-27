<template>
  <div class="col gap-3">
    <label class="row gap-2" style="align-items: center">
      <input
        :checked="wantsExpiry"
        type="checkbox"
        :disabled="disabled"
        :aria-describedby="wantsExpiry ? undefined : hintId"
        @change="onWantsExpiryChange"
      />
      <span style="font-size: 13px">Expire this token</span>
    </label>
    <p
      v-if="!wantsExpiry"
      :id="hintId"
      class="faint"
      style="font-size: 12px; margin: 0"
    >
      This token will never expire.
    </p>
    <label v-else class="col gap-2">
      <span style="font-size: 13px; font-weight: 500"> Expires in (days) </span>
      <input
        class="input"
        type="number"
        :min="MIN_TOKEN_EXPIRY_DAYS"
        :max="MAX_TOKEN_EXPIRY_DAYS"
        :value="displayExpiryDays"
        :disabled="disabled"
        @input="onExpiryDaysInput"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import {
  DEFAULT_TOKEN_EXPIRY_DAYS,
  MAX_TOKEN_EXPIRY_DAYS,
  MIN_TOKEN_EXPIRY_DAYS,
} from "#shared/utils/tokens";

const props = withDefaults(
  defineProps<{
    wantsExpiry?: boolean;
    expiryDays?: number;
    disabled?: boolean;
  }>(),
  {
    wantsExpiry: true,
    expiryDays: DEFAULT_TOKEN_EXPIRY_DAYS,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:wantsExpiry": [value: boolean];
  "update:expiryDays": [value: number];
}>();

// Per-instance so two mints of this component on one page (unlikely today,
// but the component doesn't guard against it) don't collide on a hardcoded
// DOM id and break aria-describedby's reference.
const hintId = useId();

function onWantsExpiryChange(event: Event): void {
  emit("update:wantsExpiry", (event.target as HTMLInputElement).checked);
}

// NaN (a cleared or non-numeric field) must not be bound back into :value —
// Vue would coerce it to the literal string "NaN". Falling back to "" instead
// of a sentinel like 0 keeps the field genuinely empty while the user is
// mid-edit (e.g. clearing "90" to type "30"); a 0 round-tripped through
// :value would show up as a leading digit the user never typed.
const displayExpiryDays = computed(() =>
  Number.isFinite(props.expiryDays) ? props.expiryDays : "",
);

// valueAsNumber is NaN when the field is cleared or holds non-numeric text.
// Emit it as-is rather than substituting a sentinel — the parent's bounds
// check (isExpiryDaysValid) already rejects NaN via Number.isInteger, same
// as any other out-of-range value.
function onExpiryDaysInput(event: Event): void {
  const rawValue = (event.target as HTMLInputElement).valueAsNumber;
  emit("update:expiryDays", rawValue);
}
</script>
