import {
  computed,
  ref,
  reactive,
  watch,
  watchEffect,
  onMounted,
  onUnmounted,
  onBeforeUnmount,
  nextTick,
  defineComponent,
  defineProps,
  defineEmits,
  withDefaults,
  useAttrs,
  useSlots,
} from "vue";
import { useSyncSettings } from "../app/composables/useSyncSettings";
import { useApiTokens } from "../app/composables/useApiTokens";

Object.assign(globalThis, {
  computed,
  ref,
  reactive,
  watch,
  watchEffect,
  onMounted,
  onUnmounted,
  onBeforeUnmount,
  nextTick,
  defineComponent,
  defineProps,
  defineEmits,
  withDefaults,
  useAttrs,
  useSlots,
  useSyncSettings,
  useApiTokens,
});
