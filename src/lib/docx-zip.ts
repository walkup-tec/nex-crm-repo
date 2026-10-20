import { deflateRawSync, inflateRawSync } from "node:zlib";

export type ZipEntry = { name: string; data: Uint8Array };

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (~crc) >>> 0;
}

export function readZip(bytes: Uint8Array): ZipEntry[] {
  const view = Buffer.from(bytes);
  const eocd = view.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Arquivo compactado inválido.");
  const count = view.readUInt16LE(eocd + 10);
  let cursor = view.readUInt32LE(eocd + 16);
  const files: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (view.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Arquivo compactado inválido.");
    const method = view.readUInt16LE(cursor + 10);
    const compressedSize = view.readUInt32LE(cursor + 20);
    const nameLength = view.readUInt16LE(cursor + 28);
    const extraLength = view.readUInt16LE(cursor + 30);
    const commentLength = view.readUInt16LE(cursor + 32);
    const localOffset = view.readUInt32LE(cursor + 42);
    const name = view.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    const localNameLength = view.readUInt16LE(localOffset + 26);
    const localExtraLength = view.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = view.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? Uint8Array.from(compressed) : Uint8Array.from(inflateRawSync(compressed));
    files.push({ name, data });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

export function writeZip(files: ZipEntry[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const compressed = deflateRawSync(file.data);
    const stored = compressed.length >= file.data.length;
    const payload = stored ? Buffer.from(file.data) : compressed;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const header = Buffer.concat([local, name, payload]);
    locals.push(header);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));
    offset += header.length;
  }
  const directory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, eocd]);
}
