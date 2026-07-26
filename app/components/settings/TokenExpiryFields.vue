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
        :min="1"
        :value="expiryDays"
        :disabled="disabled"
        @input="
          emit(
            'update:expiryDays',
            ($event.target as HTMLInputElement).valueAsNumber,
          )
        "
      />
    </label>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    wantsExpiry?: boolean;
    expiryDays?: number | string;
    disabled?: boolean;
  }>(),
  {
    wantsExpiry: false,
    expiryDays: 0,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:wantsExpiry": [value: boolean];
  "update:expiryDays": [value: number];
}>();
</script>
