import ms from "ms";
import { badgeCreateRecord } from "./models/records/badgeRecords";
import VrplBadgeDB, { VrplBadge } from "./models/vrplBadge";
import { v4 as uuidv4 } from "uuid";
import { recordType } from "./models/records";
import { storeAndBroadcastRecord } from "./records";
import { findPositions } from "../utils/bitFields";

const badgeCache = new Map<number, VrplBadge>();
let badgeCacheTimestamp = 0;

let fetchingBadges: undefined | Promise<any> | PromiseLike<any> = undefined;

function storeBadge(badge: VrplBadge): VrplBadge {
  const cleanBadge: VrplBadge = {
    bitPosition: badge.bitPosition,
    createdAt: badge.createdAt,
    description: badge.description,
    icon: badge.icon,
    name: badge.name,
  };
  badgeCache.set(badge.bitPosition, cleanBadge);
  return cleanBadge;
}

async function refreshBadges(): Promise<void> {
  if (fetchingBadges) await fetchingBadges;
  if (badgeCacheTimestamp + ms("30d") < Date.now()) {
    badgeCacheTimestamp = Date.now();
    fetchingBadges = new Promise<void>(async (resolve, reject) => {
      const badges = await VrplBadgeDB.find({});
      badgeCache.clear();
      badges.forEach((badge: VrplBadge) => storeBadge(badge));
      resolve();
      fetchingBadges = undefined;
    });
    await fetchingBadges;
  } else if (badgeCacheTimestamp + ms("12h") < Date.now()) {
    badgeCacheTimestamp = Date.now();
    VrplBadgeDB.find({}).then((badges: VrplBadge[]) => {
      badgeCache.clear();
      badges.forEach((badge: VrplBadge) => storeBadge(badge));
    });
  }
}

export async function getBadgeFromBitPosition(
  bitPosition: number
): Promise<VrplBadge | undefined> {
  await refreshBadges();
  return badgeCache.get(bitPosition);
}

export async function getBadgesFromBitField(bitField: number) {
  await refreshBadges();

  const positions = findPositions(bitField);
  const badges: VrplBadge[] = [];

  for (const position of positions) {
    const badge = badgeCache.get(position);

    if (badge) {
      badges.push(badge);
    } else {
      throw new Error(
        `BitField ${bitField} contains invalid bit position ${position}`
      );
    }
  }
  return badges;
}

export async function getBadgeFromName(badgeName: string) {
  const badges = await getAllBadges();
  const foundBadge = badges.find(
    (badge) =>
      badge.name.trim().toLowerCase() === badgeName.trim().toLowerCase()
  );
  return foundBadge;
}

export async function getAllBadges(): Promise<VrplBadge[]> {
  await refreshBadges();
  return Array.from(badgeCache.values());
}

export async function getFreeBadgePosition(): Promise<number> {
  const badges = await getAllBadges();
  const positions = badges.map((badge: VrplBadge) => badge.bitPosition);
  for (var i = 0; i <= positions.length + 1; i++) {
    if (positions.indexOf(i) == -1) return i;
  }
  throw new Error(`Free badge position not found. positions: ${positions}`);
}

export async function createNewBadge(
  badge: VrplBadge,
  performedBy: string
): Promise<VrplBadge> {
  const cleanedBadge = storeBadge(badge);
  const record: badgeCreateRecord = {
    v: 1,
    id: uuidv4(),
    userId: performedBy,
    type: recordType.badgeCreate,
    timestamp: new Date(),

    bitPosition: cleanedBadge.bitPosition,
    badge: cleanedBadge,
  };
  await Promise.all([
    VrplBadgeDB.create(cleanedBadge),
    storeAndBroadcastRecord(record),
  ]);
  return cleanedBadge;
}
