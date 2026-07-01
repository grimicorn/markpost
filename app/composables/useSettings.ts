const SETTINGS_ENDPOINT = "/api/settings";
const SETTINGS_RESOURCE_TYPE = "user_settings";

type AppearanceAttributes = {
  theme?: string;
  accentColor?: string;
};

type SettingsAttributes = {
  theme: string;
  accentColor: string;
};

type SettingsApiResponse = {
  data?: {
    attributes?: SettingsAttributes;
  };
};

export function useSettings() {
  const theme = ref<string | null>(null);
  const accentColor = ref<string | null>(null);

  async function fetchSettings(): Promise<void> {
    const response = await $fetch<SettingsApiResponse>(SETTINGS_ENDPOINT);
    const attributes = response?.data?.attributes;
    if (attributes) {
      theme.value = attributes.theme ?? null;
      accentColor.value = attributes.accentColor ?? null;
    }
  }

  async function updateAppearance(
    attributes: AppearanceAttributes,
  ): Promise<void> {
    await $fetch(SETTINGS_ENDPOINT, {
      method: "PUT",
      body: {
        data: {
          type: SETTINGS_RESOURCE_TYPE,
          attributes,
        },
      },
    });
  }

  return { theme, accentColor, fetchSettings, updateAppearance };
}
