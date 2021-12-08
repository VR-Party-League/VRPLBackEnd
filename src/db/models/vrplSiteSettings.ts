import { Schema, model, Document } from "mongoose";
import { Permissions } from "../../utils/permissions";


export interface VrplSiteSetting {
  _id: string;
  key: string;
  value: any
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'buffer' | 'null' | 'undefined' | 'symbol' | 'function' | 'bigint' | 'decimal128' | 'objectid' | 'map' | 'set' | 'embedded';
  editPerms?: number;
  viewPerms?: number;
}

const SiteSettingsSchema = new Schema<VrplSiteSetting & Document>(
  {
    key: {
      type: String,
      required: true,
      unique: true
    },
    value: {
      type: Schema.Types.Mixed,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    editPerms: {
      type: Number,
      required: false
    },
    // editPermsExclusive: {
    //   type: Boolean,
    //   required: false
    // },
    viewPerms: {
      type: Number,
      required: false
    },
    // viewPermsExclusive: {
    //   type: Boolean,
    //   required: false
    // },
  },
  { collection: "siteSettings" }
);

const SiteSettingsModal = model<VrplSiteSetting & Document>("siteSettings", SiteSettingsSchema);
export { SiteSettingsModal as default };
