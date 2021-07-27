import { baseRecord, recordType } from ".";
import { ApiToken } from "../ApiTokens";

export interface apiTokenCreateRecord extends baseRecord {
  v: 1;
  type: recordType.apiTokenCreate;
  token: ApiToken;
}
export interface apiTokenDeleteRecord extends baseRecord {
  v: 1;
  type: recordType.apiTokenDelete;
  token: ApiToken;
}

export type authenticationRecords = apiTokenCreateRecord;
