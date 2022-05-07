import SiteSettingsModal, { VrplSiteSetting } from "./models/vrplSiteSettings";
import { InternalServerError } from "../utils/errors";

export async function getSiteSettingFromKey(
  key: string
): Promise<VrplSiteSetting | null> {
  const siteSettings = await SiteSettingsModal.findOne({ key });
  if (!siteSettings) return null;
  return siteSettings;
}

export async function updateSiteSettingValue(
  key: string,
  value: string
): Promise<VrplSiteSetting> {
  try {
    const siteSettings = await SiteSettingsModal.findOneAndUpdate(
      { key },
      { value },
      { new: true }
    );
    if (!siteSettings) throw new InternalServerError("Site setting not found");
    return siteSettings;
  } catch (e) {
    throw new Error(`Error updating setting '${key}' to '${value}':\n${e}`);
  }
}
