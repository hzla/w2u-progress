(function () {
  "use strict";

  const RAW_SAVE_LIMIT = 0x80000;
  const SAVE_MAGIC = 0x31053527;
  const SAVE_FOOTER_MAGIC_OFFSET = 0x9C;
  const SAVE_FOOTER_CHECKSUM_LEN = 0x94;
  const SAVE_FOOTER_CHECKSUM_OFFSET = 0xA2;
  const SAVE_FOOTER_OFFSET = 0x25F00;
  const MYPOKE_CRC_TABLE_INDEX = 26;
  const MYPOKE_CHECKSUM_OFFSET = 0x19336;
  const PARTY_MAX = 6;
  const PARTY_HEADER_SIZE = 8;
  const PARTY_SIZE = 1332;
  const POKEMON_SIZE = 220;
  const PARADATA_OFFSET = 8;
  const PARADATA_SIZE = 128;
  const PARTY_STATS_OFFSET = 0x88;
  const PARTY_LEVEL_OFFSET = 0x04;
  const PARTY_CURRENT_HP_OFFSET = 0x06;
  const PARTY_MAX_HP_OFFSET = 0x08;
  const PARTY_ATTACK_OFFSET = 0x0A;
  const PARTY_DEFENSE_OFFSET = 0x0C;
  const PARTY_SPEED_OFFSET = 0x0E;
  const PARTY_SP_ATTACK_OFFSET = 0x10;
  const PARTY_SP_DEFENSE_OFFSET = 0x12;
  const HELD_ITEM_OFFSET_IN_GROWTH_BLOCK = 2;
  const EXP_OFFSET_IN_GROWTH_BLOCK = 0x8;
  const EV_OFFSET_IN_GROWTH_BLOCK = 0x10;
  const ABILITY_BLOCK = 0;
  const ABILITY_OFFSET_IN_BLOCK0 = 0x15 - 0x08;
  const ATTACKS_BLOCK = 1;
  const MOVE_IDS_OFFSET_IN_ATTACKS_BLOCK = 0x0;
  const MOVE_PP_OFFSET_IN_ATTACKS_BLOCK = 0x8;
  const MOVE_PP_UPS_OFFSET_IN_ATTACKS_BLOCK = 0xC;
  const IV32_OFFSET_IN_ATTACKS_BLOCK = 0x10;
  const NATURE_OFFSET_IN_ATTACKS_BLOCK = 0x19;
  const NICKNAMED_FLAG_BLOCK = 1;
  const NICKNAMED_FLAG_OFFSET = 0x10;
  const ID32_OFFSET_IN_GROWTH_BLOCK = 0x0C - PARADATA_OFFSET;
  const LANGUAGE_OFFSET_IN_GROWTH_BLOCK = 0x17 - PARADATA_OFFSET;
  const VERSION_BLOCK = 2;
  const VERSION_OFFSET_IN_BLOCK2 = 0x5F - 0x48;
  const OT_BLOCK = 3;
  const OT_NAME_OFFSET_IN_BLOCK3 = 0x00;
  const OT_NAME_SIZE = 0x10;
  const OT_GENDER_OFFSET_IN_BLOCK3 = 0x84 - 0x68;
  const INVENTORY_BLOCK_INDEX = 25;
  const INVENTORY_BLOCK_OFFSET = 0x18400;
  const INVENTORY_BLOCK_SIZE = 0x09EC;
  const INVENTORY_LOCAL_CRC_OFFSET = 0x18DEE;
  const PLAYER_DATA_BLOCK_OFFSET = 0x19400;
  const PLAYER_DATA_BLOCK_SIZE = 0x00B0;
  const PLAYER_OT_OFFSET = 0x04;
  const PLAYER_ID32_OFFSET = 0x14;
  const PLAYER_LANGUAGE_OFFSET = 0x1E;
  const PLAYER_VERSION_OFFSET = 0x1F;
  const PLAYER_GENDER_OFFSET = 0x21;
  const MISC_BLOCK_INDEX = 52;
  const MISC_BLOCK_OFFSET = 0x21100;
  const MISC_BLOCK_SIZE = 0x00F0;
  const MISC_LOCAL_CRC_OFFSET = 0x211F2;
  const MISC_BADGES_OFFSET = 0x04;
  const ALL_BADGES = 0xFF;
  const ITEM_ENTRY_SIZE = 4;
  const SAVE_STORAGE_KEY = "white2Expansion.saveEditor.lastSave.v1";
  const BASE64_CHUNK_SIZE = 0x8000;
  const POUCHES = {
    items: { name: "Items", offset: 0x000, capacity: 310 },
    key: { name: "Key Items", offset: 0x4D8, capacity: 50 }
  };
  const STAT_LABELS = ["HP", "Atk", "Def", "Spe", "SpA", "SpD"];
  const NATURE_NAMES = [
    "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
    "Bold", "Docile", "Relaxed", "Impish", "Lax",
    "Timid", "Hasty", "Serious", "Jolly", "Naive",
    "Modest", "Mild", "Quiet", "Bashful", "Rash",
    "Calm", "Gentle", "Sassy", "Careful", "Quirky"
  ];
  const POKE_PARA_ADDR_TABLE = [
    [0, 32, 64, 96],
    [0, 32, 96, 64],
    [0, 64, 32, 96],
    [0, 96, 32, 64],
    [0, 64, 96, 32],
    [0, 96, 64, 32],
    [32, 0, 64, 96],
    [32, 0, 96, 64],
    [64, 0, 32, 96],
    [96, 0, 32, 64],
    [64, 0, 96, 32],
    [96, 0, 64, 32],
    [32, 64, 0, 96],
    [32, 96, 0, 64],
    [64, 32, 0, 96],
    [96, 32, 0, 64],
    [64, 96, 0, 32],
    [96, 64, 0, 32],
    [32, 64, 96, 0],
    [32, 96, 64, 0],
    [64, 32, 96, 0],
    [96, 32, 64, 0],
    [64, 96, 32, 0],
    [96, 64, 32, 0],
    [0, 32, 64, 96],
    [0, 32, 96, 64],
    [0, 64, 32, 96],
    [0, 96, 32, 64],
    [0, 64, 96, 32],
    [0, 96, 64, 32],
    [32, 0, 64, 96],
    [32, 0, 96, 64]
  ];

  const els = {
    section: document.getElementById("save-editor"),
    content: document.getElementById("save-editor-content"),
    toggle: document.getElementById("save-editor-toggle"),
    jumpLink: document.querySelector("[data-save-editor-link]"),
    file: document.getElementById("save-file"),
    download: document.getElementById("save-download"),
    reset: document.getElementById("save-reset"),
    status: document.getElementById("save-editor-status"),
    fileName: document.getElementById("save-file-name"),
    partyCount: document.getElementById("save-party-count"),
    partitions: document.getElementById("save-partition-count"),
    workspace: document.getElementById("save-editor-workspace"),
    party: document.getElementById("party-editor"),
    bagForm: document.getElementById("bag-form"),
    bagItem: document.getElementById("bag-item"),
    bagCount: document.getElementById("bag-count"),
    bagPouch: document.getElementById("bag-pouch"),
    speciesList: document.getElementById("species-options"),
    itemList: document.getElementById("item-options"),
    abilityList: document.getElementById("ability-options"),
    moveList: document.getElementById("move-options")
  };

  if (!els.section) {
    return;
  }

  const state = {
    catalog: null,
    indexes: null,
    save: null,
    fileName: "",
    rawLen: 0,
    partyBlocks: [],
    partitions: [],
    party: [],
    trainer: null,
    dirty: false,
    changeCount: 0,
    editorCollapsed: true
  };

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

  function putU32(data, offset, value) {
    const normalized = value >>> 0;
    data[offset] = normalized & 0xFF;
    data[offset + 1] = (normalized >>> 8) & 0xFF;
    data[offset + 2] = (normalized >>> 16) & 0xFF;
    data[offset + 3] = (normalized >>> 24) & 0xFF;
  }

  function getSaveStorage() {
    try {
      return typeof localStorage === "undefined" ? null : localStorage;
    } catch (error) {
      return null;
    }
  }

  function bytesToBase64(bytes) {
    if (typeof btoa !== "function") {
      throw new Error("Base64 encoding is unavailable");
    }

    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE));
    }
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    if (typeof atob !== "function") {
      throw new Error("Base64 decoding is unavailable");
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let offset = 0; offset < binary.length; offset += 1) {
      bytes[offset] = binary.charCodeAt(offset);
    }
    return bytes;
  }

  function persistLoadedSave() {
    if (!state.save) {
      return false;
    }

    const storage = getSaveStorage();
    if (!storage) {
      return false;
    }

    try {
      storage.setItem(SAVE_STORAGE_KEY, JSON.stringify({
        fileName: state.fileName || "White2Upgrade.dsv",
        savedAt: new Date().toISOString(),
        bytes: bytesToBase64(state.save)
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearStoredSave() {
    const storage = getSaveStorage();
    if (!storage) {
      return;
    }

    try {
      storage.removeItem(SAVE_STORAGE_KEY);
    } catch (error) {
      // Ignore storage cleanup failures; the editor can still load explicit files.
    }
  }

  function readStoredSave() {
    const storage = getSaveStorage();
    if (!storage) {
      return null;
    }

    const raw = storage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const payload = JSON.parse(raw);
    if (!payload || typeof payload.bytes !== "string") {
      throw new Error("Stored save data is invalid");
    }

    return {
      bytes: base64ToBytes(payload.bytes),
      fileName: typeof payload.fileName === "string" && payload.fileName
        ? payload.fileName
        : "White2Upgrade.dsv"
    };
  }

  function xorPoketool(data, key) {
    const out = new Uint8Array(data);
    let code = key >>> 0;
    for (let offset = 0; offset < out.length; offset += 2) {
      code = (Math.imul(code, 1103515245) + 24691) >>> 0;
      const mask = code >>> 16;
      const word = (out[offset] | (out[offset + 1] << 8)) ^ mask;
      out[offset] = word & 0xFF;
      out[offset + 1] = (word >>> 8) & 0xFF;
    }
    return out;
  }

  function pokemonChecksum(data) {
    let total = 0;
    for (let offset = 0; offset < data.length; offset += 2) {
      total = (total + u16(data, offset)) & 0xFFFF;
    }
    return total;
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

  function paramBlockOffset(personality, block) {
    const tableIndex = (personality & 0x0003E000) >>> 13;
    return POKE_PARA_ADDR_TABLE[tableIndex][block];
  }

  function decodeParadata(saveData, pokemonOffset) {
    const checksum = u16(saveData, pokemonOffset + 6);
    const encrypted = saveData.subarray(
      pokemonOffset + PARADATA_OFFSET,
      pokemonOffset + PARADATA_OFFSET + PARADATA_SIZE
    );
    const decrypted = xorPoketool(encrypted, checksum);
    return pokemonChecksum(decrypted) === checksum ? decrypted : null;
  }

  function readSpecies(saveData, pokemonOffset) {
    const decrypted = decodeParadata(saveData, pokemonOffset);
    if (!decrypted) {
      return null;
    }
    return u16(decrypted, paramBlockOffset(u32(saveData, pokemonOffset), 0));
  }

  function looksLikeParty(saveData, offset, slot) {
    if (offset + PARTY_SIZE > saveData.length) {
      return false;
    }
    if (u32(saveData, offset) !== PARTY_MAX) {
      return false;
    }

    const partyCount = u32(saveData, offset + 4);
    if (partyCount < 1 || partyCount > PARTY_MAX || slot >= partyCount) {
      return false;
    }

    let validMembers = 0;
    const maxSpecies = state.indexes?.species.maxId || 1184;
    for (let member = 0; member < partyCount; member += 1) {
      const species = readSpecies(saveData, offset + PARTY_HEADER_SIZE + member * POKEMON_SIZE);
      if (species != null && species >= 1 && species <= maxSpecies) {
        validMembers += 1;
      }
    }
    return validMembers === partyCount;
  }

  function findPartyBlocks(saveData, slot) {
    const blocks = [];
    const end = saveData.length - PARTY_SIZE;
    for (let offset = 0; offset < end; offset += 4) {
      if (looksLikeParty(saveData, offset, slot)) {
        blocks.push(offset);
      }
    }
    return blocks;
  }

  function findSaveFooterBase(saveData, partyOffset) {
    for (let offset = partyOffset; offset <= saveData.length - 4; offset += 1) {
      if (u32(saveData, offset) === SAVE_MAGIC) {
        const footerBase = offset - SAVE_FOOTER_MAGIC_OFFSET;
        return footerBase >= 0 ? footerBase : null;
      }
    }
    return null;
  }

  function refreshSaveFooterChecksum(saveData, footerBase) {
    const checksumOffset = footerBase + SAVE_FOOTER_CHECKSUM_OFFSET;
    const oldChecksum = u16(saveData, checksumOffset);
    const newChecksum = crc16Ccitt(saveData.subarray(footerBase, footerBase + SAVE_FOOTER_CHECKSUM_LEN));
    putU16(saveData, checksumOffset, newChecksum);
    return [oldChecksum, newChecksum];
  }

  function savePartitionBase(footerBase) {
    return footerBase - SAVE_FOOTER_OFFSET;
  }

  function pouchEntryOffset(partitionBase, pouch, slot) {
    return partitionBase + INVENTORY_BLOCK_OFFSET + pouch.offset + slot * ITEM_ENTRY_SIZE;
  }

  function readPouchEntry(saveData, partitionBase, pouch, slot) {
    const offset = pouchEntryOffset(partitionBase, pouch, slot);
    return [u16(saveData, offset), u16(saveData, offset + 2)];
  }

  function writePouchEntry(saveData, partitionBase, pouch, slot, itemId, count) {
    const offset = pouchEntryOffset(partitionBase, pouch, slot);
    putU16(saveData, offset, itemId);
    putU16(saveData, offset + 2, count);
  }

  function readTrainerInfo(saveData, partitionBase) {
    const playerBase = partitionBase + PLAYER_DATA_BLOCK_OFFSET;
    if (playerBase + PLAYER_DATA_BLOCK_SIZE > saveData.length) {
      throw new Error("Trainer block is outside the save data");
    }

    return {
      id32: u32(saveData, playerBase + PLAYER_ID32_OFFSET),
      language: saveData[playerBase + PLAYER_LANGUAGE_OFFSET],
      version: saveData[playerBase + PLAYER_VERSION_OFFSET],
      gender: saveData[playerBase + PLAYER_GENDER_OFFSET] & 1,
      otBytes: new Uint8Array(saveData.subarray(
        playerBase + PLAYER_OT_OFFSET,
        playerBase + PLAYER_OT_OFFSET + OT_NAME_SIZE
      ))
    };
  }

  function updateBlockCrc(saveData, blockOffset, blockSize, localCrcOffset, footerCrcOffset) {
    const oldLocal = u16(saveData, localCrcOffset);
    const oldFooter = u16(saveData, footerCrcOffset);
    if (oldLocal !== oldFooter) {
      throw new Error(`CRC mirror mismatch: local 0x${hex(oldLocal)}, footer 0x${hex(oldFooter)}`);
    }

    const newCrc = crc16Ccitt(saveData.subarray(blockOffset, blockOffset + blockSize));
    putU16(saveData, localCrcOffset, newCrc);
    putU16(saveData, footerCrcOffset, newCrc);
    return [oldLocal, newCrc];
  }

  function ensureAllBadges(saveData, partitionBase) {
    const badgeOffset = partitionBase + MISC_BLOCK_OFFSET + MISC_BADGES_OFFSET;
    if (badgeOffset >= saveData.length) {
      throw new Error("Badge flags are outside the save data");
    }
    if (saveData[badgeOffset] === ALL_BADGES) {
      return false;
    }

    saveData[badgeOffset] = ALL_BADGES;
    updateBlockCrc(
      saveData,
      partitionBase + MISC_BLOCK_OFFSET,
      MISC_BLOCK_SIZE,
      partitionBase + MISC_LOCAL_CRC_OFFSET,
      partitionBase + SAVE_FOOTER_OFFSET + MISC_BLOCK_INDEX * 2
    );
    return true;
  }

  function ensureAllBadgesAllPartitions() {
    if (!state.save) {
      return false;
    }

    const saveData = state.save.subarray(0, state.rawLen);
    let changed = false;
    for (const partition of state.partitions) {
      if (ensureAllBadges(saveData, partition.partitionBase)) {
        refreshSaveFooterChecksum(saveData, partition.footerBase);
        changed = true;
      }
    }
    if (changed) {
      state.dirty = true;
    }
    return changed;
  }

  function readPartyStats(saveData, pokemonOffset) {
    const personality = u32(saveData, pokemonOffset);
    const stats = xorPoketool(
      saveData.subarray(pokemonOffset + PARTY_STATS_OFFSET, pokemonOffset + POKEMON_SIZE),
      personality
    );
    return {
      raw: stats,
      level: stats[PARTY_LEVEL_OFFSET],
      currentHp: u16(stats, PARTY_CURRENT_HP_OFFSET),
      hp: u16(stats, PARTY_MAX_HP_OFFSET),
      attack: u16(stats, PARTY_ATTACK_OFFSET),
      defense: u16(stats, PARTY_DEFENSE_OFFSET),
      speed: u16(stats, PARTY_SPEED_OFFSET),
      spAttack: u16(stats, PARTY_SP_ATTACK_OFFSET),
      spDefense: u16(stats, PARTY_SP_DEFENSE_OFFSET)
    };
  }

  function readPokemon(saveData, pokemonOffset, slot) {
    const personality = u32(saveData, pokemonOffset);
    const decrypted = decodeParadata(saveData, pokemonOffset);
    if (!decrypted) {
      throw new Error(`Party slot ${slot + 1} has an invalid Pokemon checksum`);
    }

    const growthBlock = paramBlockOffset(personality, 0);
    const attacksBlock = paramBlockOffset(personality, ATTACKS_BLOCK);
    const abilityOffset = paramBlockOffset(personality, ABILITY_BLOCK) + ABILITY_OFFSET_IN_BLOCK0;
    const moves = [];
    for (let index = 0; index < 4; index += 1) {
      moves.push(u16(decrypted, attacksBlock + MOVE_IDS_OFFSET_IN_ATTACKS_BLOCK + index * 2));
    }

    const iv32 = u32(decrypted, attacksBlock + IV32_OFFSET_IN_ATTACKS_BLOCK);
    const stats = readPartyStats(saveData, pokemonOffset);
    return {
      slot,
      offset: pokemonOffset,
      personality,
      species: u16(decrypted, growthBlock),
      heldItem: u16(decrypted, growthBlock + HELD_ITEM_OFFSET_IN_GROWTH_BLOCK),
      ability: decrypted[abilityOffset],
      moves,
      ivs: ivsFromIv32(iv32),
      nature: decrypted[attacksBlock + NATURE_OFFSET_IN_ATTACKS_BLOCK],
      level: stats.level,
      currentHp: stats.currentHp,
      stats: [stats.hp, stats.attack, stats.defense, stats.speed, stats.spAttack, stats.spDefense]
    };
  }

  function readParty(saveData, partyOffset) {
    const partyCount = u32(saveData, partyOffset + 4);
    const party = [];
    for (let slot = 0; slot < partyCount; slot += 1) {
      const pokemonOffset = partyOffset + PARTY_HEADER_SIZE + slot * POKEMON_SIZE;
      party.push(readPokemon(saveData, pokemonOffset, slot));
    }
    return party;
  }

  function expForLevel(level, group) {
    const n = level;
    if (group === 0) {
      return n ** 3;
    }
    if (group === 1) {
      if (n <= 50) {
        return Math.floor((n ** 3 * (100 - n)) / 50);
      }
      if (n <= 68) {
        return Math.floor((n ** 3 * (150 - n)) / 100);
      }
      if (n <= 98) {
        return Math.floor((n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      }
      return Math.floor((n ** 3 * (160 - n)) / 100);
    }
    if (group === 2) {
      if (n <= 15) {
        return Math.floor((n ** 3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      }
      if (n <= 36) {
        return Math.floor((n ** 3 * (n + 14)) / 50);
      }
      return Math.floor((n ** 3 * (Math.floor(n / 2) + 32)) / 50);
    }
    if (group === 3) {
      return Math.floor((6 * n ** 3) / 5) - 15 * n ** 2 + 100 * n - 140;
    }
    if (group === 4) {
      return Math.floor((4 * n ** 3) / 5);
    }
    if (group === 5) {
      return Math.floor((5 * n ** 3) / 4);
    }
    throw new Error(`Unknown experience group ${group}`);
  }

  function ivsFromIv32(iv32) {
    return [0, 1, 2, 3, 4, 5].map((index) => (iv32 >>> (5 * index)) & 0x1F);
  }

  function calculateStats(baseStats, ivs, evs, nature, level) {
    const stats = [
      Math.floor(((2 * baseStats[0] + ivs[0] + Math.floor(evs[0] / 4)) * level) / 100) + level + 10
    ];
    const natureIncrease = Math.floor(nature / 5);
    const natureDecrease = nature % 5;
    for (let statIndex = 1; statIndex < 6; statIndex += 1) {
      let stat = Math.floor(((2 * baseStats[statIndex] + ivs[statIndex] + Math.floor(evs[statIndex] / 4)) * level) / 100) + 5;
      const natureIndex = statIndex - 1;
      if (natureIncrease !== natureDecrease) {
        if (natureIndex === natureIncrease) {
          stat = Math.floor((stat * 110) / 100);
        } else if (natureIndex === natureDecrease) {
          stat = Math.floor((stat * 90) / 100);
        }
      }
      stats.push(stat);
    }
    return stats;
  }

  function syncPokemonTrainer(mutable, personality, trainer) {
    const growthBlock = paramBlockOffset(personality, 0);
    const versionOffset = paramBlockOffset(personality, VERSION_BLOCK) + VERSION_OFFSET_IN_BLOCK2;
    const otBlock = paramBlockOffset(personality, OT_BLOCK);
    const otGenderOffset = otBlock + OT_GENDER_OFFSET_IN_BLOCK3;

    putU32(mutable, growthBlock + ID32_OFFSET_IN_GROWTH_BLOCK, trainer.id32);
    mutable[growthBlock + LANGUAGE_OFFSET_IN_GROWTH_BLOCK] = trainer.language;
    mutable[versionOffset] = trainer.version;
    mutable.set(trainer.otBytes, otBlock + OT_NAME_OFFSET_IN_BLOCK3);
    mutable[otGenderOffset] = (mutable[otGenderOffset] & 0x7F) | ((trainer.gender & 1) << 7);
  }

  function calculatePokemonStats(mutable, personality, species, level) {
    const growthBlock = paramBlockOffset(personality, 0);
    const attacksBlock = paramBlockOffset(personality, ATTACKS_BLOCK);
    const speciesRow = state.indexes.species.byId.get(species);
    if (!speciesRow) {
      throw new Error(`Species ${species} is missing personal data`);
    }

    const iv32 = u32(mutable, attacksBlock + IV32_OFFSET_IN_ATTACKS_BLOCK);
    const ivs = ivsFromIv32(iv32);
    const evs = Array.from(mutable.subarray(growthBlock + EV_OFFSET_IN_GROWTH_BLOCK, growthBlock + EV_OFFSET_IN_GROWTH_BLOCK + 6));
    const nature = mutable[attacksBlock + NATURE_OFFSET_IN_ATTACKS_BLOCK];
    return {
      stats: calculateStats(speciesRow.baseStats, ivs, evs, nature, level),
      expGroup: speciesRow.expGroup
    };
  }

  function patchPokemon(saveData, pokemonOffset, edit, trainer) {
    const personality = u32(saveData, pokemonOffset);
    const decrypted = decodeParadata(saveData, pokemonOffset);
    if (!decrypted) {
      throw new Error(`Slot data at 0x${pokemonOffset.toString(16).toUpperCase()} has an invalid checksum`);
    }

    const mutable = new Uint8Array(decrypted);
    const growthBlock = paramBlockOffset(personality, 0);
    const attacksBlock = paramBlockOffset(personality, ATTACKS_BLOCK);
    const abilityOffset = paramBlockOffset(personality, ABILITY_BLOCK) + ABILITY_OFFSET_IN_BLOCK0;
    const oldSpecies = u16(mutable, growthBlock);
    const oldStats = readPartyStats(saveData, pokemonOffset);
    const targetSpecies = edit.species ?? oldSpecies;
    const targetLevel = edit.level ?? oldStats.level;
    let recalculatedStats = null;

    if (edit.species != null) {
      putU16(mutable, growthBlock, edit.species);
      if (edit.species > 721) {
        const iv32Offset = paramBlockOffset(personality, NICKNAMED_FLAG_BLOCK) + NICKNAMED_FLAG_OFFSET;
        putU32(mutable, iv32Offset, u32(mutable, iv32Offset) | 0x80000000);
      }
    }

    if (edit.heldItem != null) {
      putU16(mutable, growthBlock + HELD_ITEM_OFFSET_IN_GROWTH_BLOCK, edit.heldItem);
    }

    if (edit.ability != null) {
      mutable[abilityOffset] = edit.ability;
    }

    if (edit.moves) {
      Object.entries(edit.moves).forEach(([moveSlotText, move]) => {
        const moveSlot = Number(moveSlotText);
        const moveRow = state.indexes.moves.byId.get(move);
        if (!moveRow) {
          throw new Error(`Move ${move} is missing PP data`);
        }
        putU16(mutable, attacksBlock + MOVE_IDS_OFFSET_IN_ATTACKS_BLOCK + moveSlot * 2, move);
        mutable[attacksBlock + MOVE_PP_OFFSET_IN_ATTACKS_BLOCK + moveSlot] = moveRow.pp;
        mutable[attacksBlock + MOVE_PP_UPS_OFFSET_IN_ATTACKS_BLOCK + moveSlot] = 0;
      });
    }

    if (trainer) {
      syncPokemonTrainer(mutable, personality, trainer);
    }

    if (edit.species != null || edit.level != null) {
      const calculated = calculatePokemonStats(mutable, personality, targetSpecies, targetLevel);
      recalculatedStats = calculated.stats;
      putU32(mutable, growthBlock + EXP_OFFSET_IN_GROWTH_BLOCK, expForLevel(targetLevel, calculated.expGroup));
    }

    if (recalculatedStats || edit.currentHp != null) {
      const nextStats = recalculatedStats || [
        oldStats.hp,
        oldStats.attack,
        oldStats.defense,
        oldStats.speed,
        oldStats.spAttack,
        oldStats.spDefense
      ];
      const partyStats = new Uint8Array(oldStats.raw);
      let newCurrentHp = oldStats.currentHp;
      if (edit.currentHp != null) {
        newCurrentHp = edit.currentHp;
      } else if (recalculatedStats) {
        const hpRatio = oldStats.hp > 0 ? oldStats.currentHp / oldStats.hp : 1;
        newCurrentHp = oldStats.currentHp <= 0 ? 0 : Math.floor(nextStats[0] * hpRatio);
        if (oldStats.currentHp > 0 && newCurrentHp === 0 && nextStats[0] > 0) {
          newCurrentHp = 1;
        }
      }
      newCurrentHp = Math.min(Math.max(newCurrentHp, 0), nextStats[0]);

      partyStats[PARTY_LEVEL_OFFSET] = targetLevel;
      putU16(partyStats, PARTY_CURRENT_HP_OFFSET, newCurrentHp);
      putU16(partyStats, PARTY_MAX_HP_OFFSET, nextStats[0]);
      putU16(partyStats, PARTY_ATTACK_OFFSET, nextStats[1]);
      putU16(partyStats, PARTY_DEFENSE_OFFSET, nextStats[2]);
      putU16(partyStats, PARTY_SPEED_OFFSET, nextStats[3]);
      putU16(partyStats, PARTY_SP_ATTACK_OFFSET, nextStats[4]);
      putU16(partyStats, PARTY_SP_DEFENSE_OFFSET, nextStats[5]);
      saveData.set(xorPoketool(partyStats, personality), pokemonOffset + PARTY_STATS_OFFSET);
    }

    const newChecksum = pokemonChecksum(mutable);
    putU16(saveData, pokemonOffset + 6, newChecksum);
    saveData.set(xorPoketool(mutable, newChecksum), pokemonOffset + PARADATA_OFFSET);
    return recalculatedStats;
  }

  function patchPartySlot(slot, edit) {
    if (!state.save) {
      throw new Error("No save is loaded");
    }

    const saveData = state.save.subarray(0, state.rawLen);
    for (const partyOffset of state.partyBlocks) {
      const oldBlockCrc = crc16Ccitt(saveData.subarray(partyOffset, partyOffset + PARTY_SIZE));
      const partyCount = u32(saveData, partyOffset + 4);
      if (slot >= partyCount) {
        throw new Error(`Party slot ${slot + 1} is outside a save mirror's party count`);
      }

      const footerBase = findSaveFooterBase(saveData, partyOffset);
      if (footerBase == null) {
        throw new Error(`Could not find save footer for party 0x${partyOffset.toString(16).toUpperCase()}`);
      }

      const partitionBase = savePartitionBase(footerBase);
      const trainer = readTrainerInfo(saveData, partitionBase);
      patchPokemon(saveData, partyOffset + PARTY_HEADER_SIZE + slot * POKEMON_SIZE, edit, trainer);
      const newBlockCrc = crc16Ccitt(saveData.subarray(partyOffset, partyOffset + PARTY_SIZE));
      const localCrcOffset = partitionBase + MYPOKE_CHECKSUM_OFFSET;
      const footerCrcOffset = footerBase + MYPOKE_CRC_TABLE_INDEX * 2;
      const storedLocalCrc = u16(saveData, localCrcOffset);
      const storedFooterCrc = u16(saveData, footerCrcOffset);
      if (storedLocalCrc !== oldBlockCrc || storedFooterCrc !== oldBlockCrc) {
        throw new Error(`Party CRC mismatch before write at 0x${partyOffset.toString(16).toUpperCase()}`);
      }

      putU16(saveData, localCrcOffset, newBlockCrc);
      putU16(saveData, footerCrcOffset, newBlockCrc);
      ensureAllBadges(saveData, partitionBase);
      refreshSaveFooterChecksum(saveData, footerBase);
    }

    state.party = readParty(saveData, state.partyBlocks[0]);
    state.dirty = true;
    state.changeCount += 1;
  }

  function addItemToPouch(saveData, partitionBase, pouch, itemId, count) {
    let emptySlot = null;
    let action = "";
    for (let slot = 0; slot < pouch.capacity; slot += 1) {
      const [existingItem, existingCount] = readPouchEntry(saveData, partitionBase, pouch, slot);
      if (existingItem === itemId) {
        const newCount = Math.max(existingCount, count);
        writePouchEntry(saveData, partitionBase, pouch, slot, itemId, newCount);
        action = `${pouch.name} slot ${slot + 1}: ${existingCount} -> ${newCount}`;
        break;
      }
      if (existingItem === 0 && existingCount === 0 && emptySlot == null) {
        emptySlot = slot;
      }
    }

    if (!action) {
      if (emptySlot == null) {
        throw new Error(`${pouch.name} pouch has no empty slots`);
      }
      writePouchEntry(saveData, partitionBase, pouch, emptySlot, itemId, count);
      action = `${pouch.name} slot ${emptySlot + 1}: added x${count}`;
    }

    updateBlockCrc(
      saveData,
      partitionBase + INVENTORY_BLOCK_OFFSET,
      INVENTORY_BLOCK_SIZE,
      partitionBase + INVENTORY_LOCAL_CRC_OFFSET,
      partitionBase + SAVE_FOOTER_OFFSET + INVENTORY_BLOCK_INDEX * 2
    );
    return action;
  }

  function addBagItem(itemId, count, pouchKey) {
    if (!state.save) {
      throw new Error("No save is loaded");
    }

    const pouch = POUCHES[pouchKey];
    if (!pouch) {
      throw new Error("Unknown bag pouch");
    }

    const saveData = state.save.subarray(0, state.rawLen);
    const actions = [];
    for (const partition of state.partitions) {
      const action = addItemToPouch(saveData, partition.partitionBase, pouch, itemId, count);
      ensureAllBadges(saveData, partition.partitionBase);
      refreshSaveFooterChecksum(saveData, partition.footerBase);
      actions.push(action);
    }

    state.dirty = true;
    state.changeCount += 1;
    return actions;
  }

  function makeIndex(rows) {
    const byId = new Map();
    const byConstant = new Map();
    const byName = new Map();
    let maxId = 0;

    rows.forEach((row) => {
      byId.set(row.id, row);
      byConstant.set(normalizeText(row.constant), row);
      byName.set(normalizeText(row.name), row);
      maxId = Math.max(maxId, row.id);
    });

    return { byId, byConstant, byName, maxId };
  }

  function buildIndexes(catalog) {
    return {
      species: makeIndex(catalog.species),
      moves: makeIndex(catalog.moves),
      items: makeIndex(catalog.items),
      abilities: makeIndex(catalog.abilities)
    };
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function parseCatalogValue(value, index, options = {}) {
    const text = String(value || "").trim();
    if (!text) {
      throw new Error("Choose a value");
    }

    const idMatch = text.match(/^#?\s*(\d+)\b/) || text.match(/\(#?\s*(\d+)\)/);
    if (idMatch) {
      const id = Number(idMatch[1]);
      if (options.min != null && id < options.min) {
        throw new Error(`Value must be at least ${options.min}`);
      }
      if (options.max != null && id > options.max) {
        throw new Error(`Value must be no more than ${options.max}`);
      }
      if (options.requireCatalog && !index.byId.has(id)) {
        throw new Error(`No catalog data for ID ${id}`);
      }
      return id;
    }

    const normalized = normalizeText(text);
    const prefixed = options.prefix && !normalized.startsWith(options.prefix)
      ? `${options.prefix}${normalized}`
      : normalized;
    const row = index.byConstant.get(prefixed) || index.byName.get(normalized);
    if (!row) {
      throw new Error(`Unknown value: ${text}`);
    }
    return row.id;
  }

  function parseIntegerField(value, label, min, max) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
      throw new Error(`${label} must be ${min}-${max}`);
    }
    return number;
  }

  function catalogLabel(index, id, fallbackPrefix) {
    const row = index.byId.get(id);
    if (row) {
      return row.name;
    }
    return `${fallbackPrefix} ${id}`;
  }

  function populateDatalist(element, rows) {
    const fragment = document.createDocumentFragment();
    rows.forEach((row) => {
      const option = document.createElement("option");
      option.value = row.name;
      option.label = row.name;
      fragment.append(option);
    });
    element.replaceChildren(fragment);
  }

  function showdownName(index, id, fallbackPrefix) {
    return index.byId.get(id)?.name || `${fallbackPrefix} ${id}`;
  }

  function formatShowdownText(pokemon) {
    const speciesName = showdownName(state.indexes.species, pokemon.species, "Species");
    const heldItem = state.indexes.items.byId.get(pokemon.heldItem);
    const header = heldItem && heldItem.id !== 0 && heldItem.name !== "None"
      ? `${speciesName} @ ${heldItem.name}`
      : speciesName;
    const abilityName = showdownName(state.indexes.abilities, pokemon.ability, "Ability");
    const natureName = NATURE_NAMES[pokemon.nature] || `Nature ${pokemon.nature}`;
    const ivs = pokemon.ivs || [31, 31, 31, 31, 31, 31];
    const ivLine = [
      `${ivs[0]} HP`,
      `${ivs[1]} Atk`,
      `${ivs[2]} Def`,
      `${ivs[4]} SpA`,
      `${ivs[5]} SpD`,
      `${ivs[3]} Spe`
    ].join(" / ");
    const moveLines = pokemon.moves
      .filter((move) => move !== 0)
      .map((move) => `- ${showdownName(state.indexes.moves, move, "Move")}`);

    return [
      header,
      `Level: ${pokemon.level}`,
      `${natureName} Nature`,
      `Ability: ${abilityName}`,
      `IVs: ${ivLine}`,
      ...moveLines
    ].join("\n");
  }

  async function copyTextToClipboard(text) {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) {
      throw new Error("Clipboard copy failed");
    }
  }

  async function copyPartyPokemon(slot) {
    const pokemon = state.party[slot];
    if (!pokemon) {
      throw new Error("Unknown party slot");
    }

    const text = formatShowdownText(pokemon);
    await copyTextToClipboard(text);
    setStatus(`Copied ${showdownName(state.indexes.species, pokemon.species, "Pokemon")} Showdown text.`);
  }

  function discoverPartitions(saveData, partyBlocks) {
    const partitions = [];
    const seen = new Set();
    partyBlocks.forEach((partyOffset) => {
      const footerBase = findSaveFooterBase(saveData, partyOffset);
      if (footerBase == null) {
        throw new Error(`Could not find save footer for party 0x${partyOffset.toString(16).toUpperCase()}`);
      }
      const partitionBase = savePartitionBase(footerBase);
      if (!seen.has(partitionBase)) {
        seen.add(partitionBase);
        partitions.push({ footerBase, partitionBase });
      }
    });
    return partitions;
  }

  function loadSave(bytes, fileName, options = {}) {
    state.save = new Uint8Array(bytes);
    state.fileName = fileName;
    state.rawLen = Math.min(state.save.length, RAW_SAVE_LIMIT);
    const saveData = state.save.subarray(0, state.rawLen);
    const partyBlocks = findPartyBlocks(saveData, 0);
    if (!partyBlocks.length) {
      throw new Error("Could not find valid BW2/W2U party blocks");
    }

    state.partyBlocks = partyBlocks;
    state.partitions = discoverPartitions(saveData, partyBlocks);
    state.trainer = readTrainerInfo(saveData, state.partitions[0].partitionBase);
    state.party = readParty(saveData, partyBlocks[0]);
    state.dirty = false;
    state.changeCount = 0;
    renderParty();
    updateSaveSummary();
    els.workspace.hidden = false;
    const persisted = options.persist === false ? true : persistLoadedSave();
    setStatus(`Loaded ${fileName}. Trainer ownership and all badges will be synced on edits.${storageStatusMessage(persisted)}`);
  }

  function restoreStoredSave() {
    try {
      const stored = readStoredSave();
      if (!stored) {
        return null;
      }

      loadSave(stored.bytes, stored.fileName, { persist: false });
      setStatus(`Restored ${stored.fileName}. Trainer ownership and all badges will be synced on edits.`);
      return true;
    } catch (error) {
      clearStoredSave();
      setStatus(`Stored save could not be restored: ${error.message}`, true);
      return false;
    }
  }

  function updateSaveSummary() {
    els.fileName.textContent = state.fileName || "No save loaded";
    els.partyCount.textContent = state.party.length ? `${state.party.length} Pokemon` : "0 Pokemon";
    els.partitions.textContent = state.partitions.length ? `${state.partitions.length} mirror${state.partitions.length === 1 ? "" : "s"}` : "0 mirrors";
    els.download.disabled = !state.save;
    els.reset.disabled = !state.save;
  }

  function renderParty() {
    if (!state.party.length) {
      els.party.innerHTML = "";
      return;
    }

    els.party.innerHTML = state.party.map((pokemon) => {
      const species = state.indexes.species.byId.get(pokemon.species);
      const speciesName = species?.name || `Species ${pokemon.species}`;
      const stats = pokemon.stats.map((value, index) => `<span><b>${STAT_LABELS[index]}</b>${value}</span>`).join("");
      const moves = pokemon.moves.map((move, index) => `
        <label class="save-field move-field">
          <span>Move ${index + 1}</span>
          <input data-slot="${pokemon.slot}" data-field="move" data-move-slot="${index}" list="move-options" value="${escapeHtml(catalogLabel(state.indexes.moves, move, "Move"))}">
        </label>
      `).join("");

      return `
        <article class="party-row">
          <div class="party-row-main">
            <div class="slot-badge">Slot ${pokemon.slot + 1}</div>
            <div class="party-title">
              <strong>${escapeHtml(speciesName)}</strong>
              <span>Lv. ${pokemon.level} · HP ${pokemon.currentHp}/${pokemon.stats[0]}</span>
            </div>
            <button class="copy-pokemon-button" type="button" data-copy-showdown="${pokemon.slot}" aria-label="Copy ${escapeHtml(speciesName)} Showdown text" title="Copy Showdown text">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 5a3 3 0 0 1 6 0h1.5A2.5 2.5 0 0 1 19 7.5v11A2.5 2.5 0 0 1 16.5 21h-9A2.5 2.5 0 0 1 5 18.5v-11A2.5 2.5 0 0 1 7.5 5H9Z"></path>
                <path d="M9 5h6v3H9V5Z"></path>
                <path d="M8.5 12h7M8.5 15h7"></path>
              </svg>
            </button>
          </div>
          <div class="save-fields primary-fields">
            <label class="save-field">
              <span>Species</span>
              <input data-slot="${pokemon.slot}" data-field="species" list="species-options" value="${escapeHtml(catalogLabel(state.indexes.species, pokemon.species, "Species"))}">
            </label>
            <label class="save-field">
              <span>Ability</span>
              <input data-slot="${pokemon.slot}" data-field="ability" list="ability-options" value="${escapeHtml(catalogLabel(state.indexes.abilities, pokemon.ability, "Ability"))}">
            </label>
            <label class="save-field">
              <span>Held Item</span>
              <input data-slot="${pokemon.slot}" data-field="heldItem" list="item-options" value="${escapeHtml(catalogLabel(state.indexes.items, pokemon.heldItem, "Item"))}">
            </label>
          </div>
          <div class="save-fields move-fields">
            ${moves}
          </div>
          <div class="party-stats-panel">
            <div class="save-fields stat-edit-fields">
              <label class="save-field">
                <span>Level</span>
                <input data-slot="${pokemon.slot}" data-field="level" type="number" min="1" max="100" value="${pokemon.level}">
              </label>
              <label class="save-field">
                <span>Current HP</span>
                <input data-slot="${pokemon.slot}" data-field="currentHp" type="number" min="0" max="${pokemon.stats[0]}" value="${pokemon.currentHp}">
              </label>
            </div>
            <div class="stat-strip" aria-label="Battle stats">
              ${stats}
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function handlePartyChange(target) {
    const slot = Number(target.dataset.slot);
    const field = target.dataset.field;
    const edit = {};

    if (!Number.isInteger(slot) || slot < 0 || slot >= state.party.length) {
      throw new Error("Unknown party slot");
    }
    const pokemon = state.party[slot];

    if (field === "species") {
      edit.species = parseCatalogValue(target.value, state.indexes.species, {
        min: 1,
        max: state.indexes.species.maxId,
        requireCatalog: true,
        prefix: "SPECIES_"
      });
    } else if (field === "heldItem") {
      edit.heldItem = parseCatalogValue(target.value, state.indexes.items, {
        min: 0,
        max: 0xFFFF,
        prefix: "ITEM_"
      });
    } else if (field === "ability") {
      edit.ability = parseCatalogValue(target.value, state.indexes.abilities, {
        min: 0,
        max: 0xFF,
        prefix: "ABIL_"
      });
    } else if (field === "move") {
      const moveSlot = Number(target.dataset.moveSlot);
      const move = parseCatalogValue(target.value, state.indexes.moves, {
        min: 0,
        max: state.indexes.moves.maxId,
        requireCatalog: true,
        prefix: "MOVE_"
      });
      edit.moves = { [moveSlot]: move };
    } else if (field === "level") {
      edit.level = parseIntegerField(target.value, "Level", 1, 100);
    } else if (field === "currentHp") {
      edit.currentHp = parseIntegerField(target.value, "Current HP", 0, pokemon.stats[0]);
    } else {
      throw new Error("Unknown edit field");
    }

    patchPartySlot(slot, edit);
    const persisted = persistLoadedSave();
    target.removeAttribute("aria-invalid");
    renderParty();
    updateSaveSummary();
    setStatus(`Updated slot ${slot + 1}. Trainer ownership synced and all badges enabled.${storageStatusMessage(persisted)}`);
  }

  function handleBagSubmit(event) {
    event.preventDefault();
    try {
      const itemId = parseCatalogValue(els.bagItem.value, state.indexes.items, {
        min: 1,
        max: 0xFFFF,
        prefix: "ITEM_"
      });
      const count = Number(els.bagCount.value);
      if (!Number.isInteger(count) || count < 1 || count > 999) {
        throw new Error("Bag count must be 1-999");
      }
      const item = state.indexes.items.byId.get(itemId);
      const actions = addBagItem(itemId, count, els.bagPouch.value);
      const persisted = persistLoadedSave();
      updateSaveSummary();
      setStatus(`Added ${item?.name || `item ${itemId}`} x${count}. All badges enabled across ${actions.length} mirror${actions.length === 1 ? "" : "s"}.${storageStatusMessage(persisted)}`);
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  function downloadSave() {
    if (!state.save) {
      return;
    }

    ensureAllBadgesAllPartitions();
    const persisted = persistLoadedSave();
    const blob = new Blob([state.save], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = editedFileName(state.fileName);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(`Downloaded ${link.download} with all badges enabled.${storageStatusMessage(persisted)}`);
  }

  function editedFileName(fileName) {
    const match = String(fileName || "White2Upgrade.dsv").match(/^(.*?)(\.[^.]*)?$/);
    return `${match[1] || "White2Upgrade"}.edited${match[2] || ".dsv"}`;
  }

  function resetLoadedSave() {
    if (els.file.files && els.file.files[0]) {
      void readSelectedFile(els.file.files[0]);
    }
  }

  async function readSelectedFile(file) {
    try {
      loadSave(await file.arrayBuffer(), file.name);
    } catch (error) {
      state.save = null;
      state.party = [];
      state.partyBlocks = [];
      state.partitions = [];
      state.trainer = null;
      els.workspace.hidden = true;
      updateSaveSummary();
      setStatus(error.message, true);
    }
  }

  function bindEvents() {
    els.toggle.addEventListener("click", () => {
      setEditorCollapsed(!state.editorCollapsed);
    });

    if (els.jumpLink) {
      els.jumpLink.addEventListener("click", () => {
        setEditorCollapsed(false);
      });
    }

    els.file.addEventListener("change", () => {
      const file = els.file.files && els.file.files[0];
      if (file) {
        void readSelectedFile(file);
      }
    });

    els.download.addEventListener("click", downloadSave);
    els.reset.addEventListener("click", resetLoadedSave);
    els.bagForm.addEventListener("submit", handleBagSubmit);
    els.party.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest("[data-copy-showdown]");
      if (!button) {
        return;
      }

      const slot = Number(button.getAttribute("data-copy-showdown"));
      if (!Number.isInteger(slot)) {
        setStatus("Unknown party slot", true);
        return;
      }

      void copyPartyPokemon(slot).catch((error) => {
        setStatus(error.message, true);
      });
    });
    els.party.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.dataset.field) {
        return;
      }
      try {
        handlePartyChange(target);
      } catch (error) {
        target.setAttribute("aria-invalid", "true");
        setStatus(error.message, true);
      }
    });
  }

  function setEditorCollapsed(collapsed) {
    state.editorCollapsed = collapsed;
    els.section.classList.toggle("is-collapsed", collapsed);
    els.content.hidden = collapsed;
    els.toggle.setAttribute("aria-expanded", String(!collapsed));
    els.toggle.textContent = collapsed ? "Expand" : "Collapse";
  }

  function setStatus(message, isError = false) {
    els.status.textContent = message;
    els.status.classList.toggle("is-error", isError);
  }

  function storageStatusMessage(persisted) {
    return persisted ? " Saved for refreshes." : " Browser storage is unavailable.";
  }

  function hex(value) {
    return value.toString(16).toUpperCase().padStart(4, "0");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function loadCatalog() {
    const response = await fetch("data/save-editor-data.json");
    if (!response.ok) {
      throw new Error("Failed to load save editor data");
    }
    state.catalog = await response.json();
    state.indexes = buildIndexes(state.catalog);
    populateDatalist(els.speciesList, state.catalog.species);
    populateDatalist(els.itemList, state.catalog.items);
    populateDatalist(els.abilityList, state.catalog.abilities);
    populateDatalist(els.moveList, state.catalog.moves);
    els.file.disabled = false;
    els.bagItem.value = catalogLabel(state.indexes.items, 1, "Item");
  }

  async function init() {
    els.file.disabled = true;
    els.download.disabled = true;
    els.reset.disabled = true;
    els.workspace.hidden = true;
    setEditorCollapsed(true);
    bindEvents();
    updateSaveSummary();
    try {
      await loadCatalog();
      if (restoreStoredSave() === null) {
        setStatus("Ready");
      }
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  init();
})();
