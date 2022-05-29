import { baseRecord, recordType } from "./index";
import { OAuthClient } from "../OAuthModels";

// TODO: IMPLEMENT THESE
interface OAuthClientBaseRecord extends baseRecord {
  clientId: string;
  client: OAuthClient;
}

export interface OAuthClientCreateRecord extends OAuthClientBaseRecord {
  v: 1;
  type: recordType.OAuthClientCreate;
}

export interface OAuthClientUpdateRecord extends OAuthClientBaseRecord {
  v: 1;
  type: recordType.OAuthClientUpdate;
  valueChanged: keyof OAuthClient;
  old: any;
  new: any;
}

export interface OAuthClientDeleteRecord extends OAuthClientBaseRecord {
  v: 1;
  type: recordType.OAuthClientDelete;
}

export type OAuthClientRecord =
  | OAuthClientCreateRecord
  | OAuthClientUpdateRecord
  | OAuthClientDeleteRecord;
