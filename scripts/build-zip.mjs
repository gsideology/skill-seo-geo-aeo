#!/usr/bin/env node
// Builds dist/seo-geo-aeo.zip for claude.ai (Customize → Skills → upload): the skill folder at the
// root of the archive, forward-slash paths, UTF-8 names. Node 18+, no dependencies.
//
//   node scripts/build-zip.mjs            build and print the listing
//   node scripts/build-zip.mjs --list F   print the entries of an existing zip (read back from F)

import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = "seo-geo-aeo";
const skillDir = join(root, "skills", SKILL);
const out = join(root, "dist", `${SKILL}.zip`);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/** Files and folders under dir, sorted, as zip names with forward slashes ("seo-geo-aeo/SKILL.md"). */
function collect(dir) {
  const entries = [];
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      if (name === ".DS_Store" || name === "Thumbs.db") continue;
      const p = join(d, name);
      const zipName = `${SKILL}/${relative(skillDir, p).split(/[\\/]/).join("/")}`;
      if (statSync(p).isDirectory()) {
        entries.push({ name: `${zipName}/`, dir: true, mtime: statSync(p).mtime });
        walk(p);
      } else entries.push({ name: zipName, dir: false, path: p, mtime: statSync(p).mtime });
    }
  };
  entries.push({ name: `${SKILL}/`, dir: true, mtime: statSync(dir).mtime });
  walk(dir);
  return entries;
}

export function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const data = e.dir ? Buffer.alloc(0) : readFileSync(e.path);
    const deflated = e.dir ? data : deflateRawSync(data, { level: 9 });
    const useDeflate = !e.dir && deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data);
    const { time, date } = dosTime(e.mtime);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // made by Unix, so permissions below apply
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE((((e.dir ? 0o40755 : 0o100644) << 16) | (e.dir ? 0x10 : 0)) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/** Reads the central directory back: [{ name, method, size, compressed, crc }]. */
export function listZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file (no end of central directory)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const list = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`bad central directory entry ${i}`);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    list.push({
      name: buf.toString("utf8", p + 46, p + 46 + nameLen),
      method: buf.readUInt16LE(p + 10),
      crc: buf.readUInt32LE(p + 16),
      compressed: buf.readUInt32LE(p + 20),
      size: buf.readUInt32LE(p + 24),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return list;
}

function printList(list) {
  for (const e of list) console.log(`${String(e.size).padStart(8)}  ${e.name}`);
  const files = list.filter((e) => !e.name.endsWith("/"));
  console.log(`${files.length} files, ${list.length - files.length} folders, ${files.reduce((s, e) => s + e.size, 0)} bytes uncompressed`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--list");
  if (i >= 0) {
    printList(listZip(readFileSync(process.argv[i + 1] ?? out)));
  } else {
    const zip = buildZip(collect(skillDir));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, zip);
    console.log(`${relative(root, out).split(/[\\/]/).join("/")} (${zip.length} bytes)`);
    printList(listZip(zip));
  }
}
