import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");
const savePath = path.join(siteRoot, "downloads", "demosave.dsv");
const itemDataPath = path.join(siteRoot, "data", "items.gen6.json");
const checkOnly = process.argv.includes("--check");

const RAW_SAVE_LIMIT = 0x80000;
const SAVE_MAGIC = 0x31053527;
const SAVE_FOOTER_MAGIC_OFFSET = 0x9C;
const SAVE_FOOTER_CHECKSUM_LEN = 0x94;
const SAVE_FOOTER_CHECKSUM_OFFSET = 0xA2;
const SAVE_FOOTER_OFFSET = 0x25F00;
const INVENTORY_BLOCK_INDEX = 25;
const INVENTORY_BLOCK_OFFSET = 0x18400;
const INVENTORY_BLOCK_SIZE = 0x09EC;
const INVENTORY_LOCAL_CRC_OFFSET = 0x18DEE;
const ITEM_ENTRY_SIZE = 4;
const ITEM_POUCH_OFFSET = 0;
const ITEM_POUCH_CAPACITY = 261;
const ITEM_COUNT = 1;

const BUNDLED_ITEM_CONSTANTS = [
  "ITEM_PROTECTIVE_PADS",
  "ITEM_TERRAIN_EXTENDER",
  "ITEM_ELECTRIC_SEED",
  "ITEM_GRASSY_SEED",
  "ITEM_PSYCHIC_SEED",
  "ITEM_MISTY_SEED"
];

function u16(data, offset) {
  return data[offset] | (data[offset + 1] << 8);
}

function u32(data, offset) {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}

function putU16(data, offset, value) {
  data[offset] = value & 0xFF;
  data[offset + 1] = (value >>> 8) & 0xFF;
}

function crc16Ccitt(data, init = 0xFFFF) {
  let crc = init;
  for (const value of data) {
    crc ^= value << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000
        ? ((crc << 1) ^ 0x1021) & 0xFFFF
        : (crc << 1) & 0xFFFF;
    }
  }
  return crc;
}

function locatePartitions(data) {
  const partitions = [];
  const seen = new Set();
  for (let offset = 0; offset <= data.length - 4; offset += 1) {
    if (u32(data, offset) !== SAVE_MAGIC) {
      continue;
    }
    const footerBase = offset - SAVE_FOOTER_MAGIC_OFFSET;
    const partitionBase = footerBase - SAVE_FOOTER_OFFSET;
    if (
      partitionBase < 0 ||
      partitionBase + INVENTORY_LOCAL_CRC_OFFSET + 2 > data.length ||
      footerBase + SAVE_FOOTER_CHECKSUM_OFFSET + 2 > data.length ||
      seen.has(partitionBase)
    ) {
      continue;
    }
    seen.add(partitionBase);
    partitions.push({ partitionBase, footerBase });
  }
  return partitions.sort((a, b) => a.partitionBase - b.partitionBase);
}

function itemEntryOffset(partitionBase, slot) {
  return partitionBase + INVENTORY_BLOCK_OFFSET + ITEM_POUCH_OFFSET + slot * ITEM_ENTRY_SIZE;
}

function findItemSlot(data, partitionBase, itemId) {
  let emptySlot = null;
  for (let slot = 0; slot < ITEM_POUCH_CAPACITY; slot += 1) {
    const offset = itemEntryOffset(partitionBase, slot);
    const existingItem = u16(data, offset);
    const existingCount = u16(data, offset + 2);
    if (existingItem === itemId) {
      return { slot, count: existingCount };
    }
    if (existingItem === 0 && existingCount === 0 && emptySlot == null) {
      emptySlot = slot;
    }
  }
  return { slot: null, count: 0, emptySlot };
}

function refreshPartitionChecksums(data, partition) {
  const { partitionBase, footerBase } = partition;
  const inventoryCrc = crc16Ccitt(data.subarray(
    partitionBase + INVENTORY_BLOCK_OFFSET,
    partitionBase + INVENTORY_BLOCK_OFFSET + INVENTORY_BLOCK_SIZE
  ));
  putU16(data, partitionBase + INVENTORY_LOCAL_CRC_OFFSET, inventoryCrc);
  putU16(data, footerBase + INVENTORY_BLOCK_INDEX * 2, inventoryCrc);

  const footerCrc = crc16Ccitt(data.subarray(
    footerBase,
    footerBase + SAVE_FOOTER_CHECKSUM_LEN
  ));
  putU16(data, footerBase + SAVE_FOOTER_CHECKSUM_OFFSET, footerCrc);
}

function validatePartition(data, partition, items) {
  const { partitionBase, footerBase } = partition;
  const expectedInventoryCrc = crc16Ccitt(data.subarray(
    partitionBase + INVENTORY_BLOCK_OFFSET,
    partitionBase + INVENTORY_BLOCK_OFFSET + INVENTORY_BLOCK_SIZE
  ));
  const localInventoryCrc = u16(data, partitionBase + INVENTORY_LOCAL_CRC_OFFSET);
  const footerInventoryCrc = u16(data, footerBase + INVENTORY_BLOCK_INDEX * 2);
  if (localInventoryCrc !== expectedInventoryCrc || footerInventoryCrc !== expectedInventoryCrc) {
    throw new Error(`Inventory CRC mismatch in partition 0x${partitionBase.toString(16).toUpperCase()}`);
  }

  const expectedFooterCrc = crc16Ccitt(data.subarray(
    footerBase,
    footerBase + SAVE_FOOTER_CHECKSUM_LEN
  ));
  const storedFooterCrc = u16(data, footerBase + SAVE_FOOTER_CHECKSUM_OFFSET);
  if (storedFooterCrc !== expectedFooterCrc) {
    throw new Error(`Footer CRC mismatch in partition 0x${partitionBase.toString(16).toUpperCase()}`);
  }

  for (const item of items) {
    const entry = findItemSlot(data, partitionBase, item.id);
    if (entry.slot == null || entry.count < ITEM_COUNT) {
      throw new Error(`${item.name} is missing from partition 0x${partitionBase.toString(16).toUpperCase()}`);
    }
  }
}

const save = new Uint8Array(await readFile(savePath));
const rawSave = save.subarray(0, Math.min(save.length, RAW_SAVE_LIMIT));
const itemRows = JSON.parse(await readFile(itemDataPath, "utf8"));
const itemByConstant = new Map(itemRows.map((item) => [item.constant, item]));
const items = BUNDLED_ITEM_CONSTANTS.map((constant) => {
  const item = itemByConstant.get(constant);
  if (!item || !Number.isInteger(item.id)) {
    throw new Error(`${constant} is missing from data/items.gen6.json`);
  }
  return item;
});
const partitions = locatePartitions(rawSave);
if (partitions.length !== 2) {
  throw new Error(`Expected two save partitions, found ${partitions.length}`);
}

if (!checkOnly) {
  for (const partition of partitions) {
    for (const item of items) {
      const entry = findItemSlot(rawSave, partition.partitionBase, item.id);
      if (entry.slot != null) {
        if (entry.count < ITEM_COUNT) {
          putU16(rawSave, itemEntryOffset(partition.partitionBase, entry.slot) + 2, ITEM_COUNT);
        }
        continue;
      }
      if (entry.emptySlot == null) {
        throw new Error(`Items pocket is full in partition 0x${partition.partitionBase.toString(16).toUpperCase()}`);
      }
      const offset = itemEntryOffset(partition.partitionBase, entry.emptySlot);
      putU16(rawSave, offset, item.id);
      putU16(rawSave, offset + 2, ITEM_COUNT);
    }
    refreshPartitionChecksums(rawSave, partition);
  }
  await writeFile(savePath, save);
}

for (const partition of partitions) {
  validatePartition(rawSave, partition, items);
}

console.log(`${checkOnly ? "Verified" : "Synchronized"} ${items.length} bundled items across ${partitions.length} save partitions.`);
