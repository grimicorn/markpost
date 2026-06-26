<template>
  <div>
    <SetHead
      eyebrow="account"
      title="Account"
      desc="Manage how you sign in and how your name appears across markpost."
    />
    <div class="card card-pad">
      <div class="row gap-4" style="margin-bottom: 22px">
        <span
          style="
            width: 56px;
            height: 56px;
            border-radius: 12px;
            background: var(--accent-tint);
            color: var(--accent-700);
            display: grid;
            place-items: center;
            font-family: var(--mono);
            font-size: 22px;
            font-weight: 600;
            flex: none;
          "
        >
          D
        </span>
        <div class="col gap-2">
          <AppBtn size="sm">upload avatar</AppBtn>
          <span class="mono faint" style="font-size: 11px"
            >PNG or JPG · max 1MB</span
          >
        </div>
      </div>
      <div class="col gap-4">
        <InputText v-model="name" num="01" label="Full name" />
        <InputText
          v-model="email"
          num="02"
          label="Email"
          state="ok"
          msg="verified"
          lead-icon="at"
          type="email"
        />
      </div>
    </div>

    <h3 class="h3" style="margin-top: 30px; margin-bottom: 4px">Security</h3>
    <div class="card" style="margin-top: 14px; padding: 4px 22px">
      <div class="divide-y">
        <SetRow label="Password" hint="Last changed 3 months ago.">
          <AppBtn size="sm" icon="lock">change</AppBtn>
        </SetRow>
        <SetRow label="Two-factor auth" hint="Require a code at sign-in.">
          <InputToggle v-model="twoFactor" />
        </SetRow>
        <SetRow label="Active sessions" hint="2 devices currently signed in.">
          <AppBtn size="sm">manage</AppBtn>
        </SetRow>
      </div>
    </div>

    <h3
      class="h3"
      style="margin-top: 30px; margin-bottom: 4px; color: var(--err)"
    >
      Danger zone
    </h3>
    <div
      class="card"
      style="
        margin-top: 14px;
        padding: 4px 22px;
        border-color: color-mix(in oklab, var(--err) 26%, var(--line));
      "
    >
      <SetRow
        label="Delete account"
        hint="Permanently remove your account and all server-side records. Files already on your disk are untouched."
      >
        <AppBtn
          size="sm"
          icon="trash"
          :style="{
            color: 'var(--err)',
            borderColor: 'color-mix(in oklab, var(--err) 40%, var(--line))',
          }"
        >
          delete
        </AppBtn>
      </SetRow>
    </div>

    <div class="row gap-3" style="margin-top: 24px; justify-content: flex-end">
      <AppBtn variant="ghost">cancel</AppBtn>
      <AppBtn variant="accent" icon="check">save changes</AppBtn>
    </div>
  </div>
</template>

<script setup lang="ts">
import SetHead from "./SetHead.vue";
import SetRow from "./SetRow.vue";

const name = ref("Dan Holloran");
const email = ref("dan@markpost.io");
const twoFactor = ref(true);
</script>
