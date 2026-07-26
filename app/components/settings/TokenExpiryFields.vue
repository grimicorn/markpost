<template>
  <div class="col gap-3">
    <label class="row gap-2" style="align-items: center">
      <input
        :checked="wantsExpiry"
        type="checkbox"
        :disabled="disabled"
        @change="
          emit(
            'update:wantsExpiry',
            ($event.target as HTMLInputElement).checked,
          )
        "
      />
      <span style="font-size: 13px">Expire this token</span>
    </label>
    <label v-if="wantsExpiry" class="col gap-2">
      <span style="font-size: 13px; font-weight: 500"> Expires in (days) </span>
      <input
        class="input"
        type="number"
        :min="MIN_TOKEN_EXPIRY_DAYS"
        :max="MAX_TOKEN_EXPIRY_DAYS"
        :value="expiryDays"
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

withDefaults(
  defineProps<{
    wantsExpiry?: boolean;
    expiryDays?: number;
    disabled?: boolean;
  }>(),
  {
    wantsExpiry: false,
    expiryDays: DEFAULT_TOKEN_EXPIRY_DAYS,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:wantsExpiry": [value: boolean];
  "update:expiryDays": [value: number];
}>();

// valueAsNumber is NaN when the field is cleared or holds non-numeric text.
// Emitting NaN would round-trip back in as :value="NaN"; emit 0 instead so
// the parent's bounds check (isExpiryDaysValid) rejects it the same way it
// rejects any other value below MIN_TOKEN_EXPIRY_DAYS.
function onExpiryDaysInput(event: Event): void {
  const rawValue = (event.target as HTMLInputElement).valueAsNumber;
  emit("update:expiryDays", Number.isNaN(rawValue) ? 0 : rawValue);
}
</script>
