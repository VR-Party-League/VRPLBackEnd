import { baseRecord, recordType } from ".";
import { VrplBadge } from "../vrplBadge";

export interface badgeCreateRecord extends baseRecord {
  v: 1;
  type: recordType.badgeCreate;
  bitPosition: number;
  badge: VrplBadge;
}
export interface badgeUpdateRecord extends baseRecord {
  v: 1;
  type: recordType.badgeUpdate;
  bitPosition: number;
  valueChanged: keyof VrplBadge;
  old: any;
  new: any;
}
export interface badgeDeleteRecord extends baseRecord {
  v: 1;
  type: recordType.badgeDelete;
  bitPosition: number;
  badge: VrplBadge;
}
export type badgeRecords =
  | badgeCreateRecord
  | badgeUpdateRecord
  | badgeDeleteRecord;
