import { baseRecord, recordType } from ".";
import { VrplApiToken } from "../ApiTokens";

export interface apiTokenCreateRecord extends baseRecord {
  v: 1;
  type: recordType.apiTokenCreate;
  token: VrplApiToken;
}

export interface apiTokenDeleteRecord extends baseRecord {
  v: 1;
  type: recordType.apiTokenDelete;
  token: VrplApiToken;
}

export type authenticationRecords = apiTokenCreateRecord | apiTokenDeleteRecord;
