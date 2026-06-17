import { getCachedActivityTypes } from "@/lib/queries";
import { SettingsContent } from "@/components/settings-content";

export default async function UstawieniaPage() {
  const activityTypes = await getCachedActivityTypes();

  return <SettingsContent activityTypes={activityTypes} />;
}
