#!/usr/bin/env node
// Validates skills/seo-geo-aeo: SKILL.md frontmatter (rules from the Agent Skills docs, checked
// 2026-11-03), body length, relative links and file references between the skill's files, files no
// document mentions, line endings; and relative links in the repository's own Markdown files.
// Node 18+, no dependencies. Exit code 1 on failure.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "skills", "seo-geo-aeo");
const errors = [];
const warnings = [];
const fail = (s) => errors.push(s);
const warn = (s) => warnings.push(s);
const rel = (p) => relative(root, p).split(/[\\/]/).join("/");

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === "node_modules" || n === ".git" || n === "dist") return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/* ---------------------------------------------------------------- frontmatter */

const skillMd = readFileSync(join(skillDir, "SKILL.md"), "utf8");
const fm = skillMd.match(/^---\n([\s\S]*?)\n---\n/);
if (!fm) fail("SKILL.md: no YAML frontmatter at the very start (--- … ---)");
const fields = {};
for (const line of (fm?.[1] ?? "").split("\n")) {
  if (!line.trim()) continue;
  const m = line.match(/^([A-Za-z_-]+):\s?(.*)$/);
  if (!m) {
    fail(`SKILL.md frontmatter: line not in "key: value" form (keep every value on one line): ${line.slice(0, 60)}`);
    continue;
  }
  fields[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
}
// Keys claude.ai and the Skills API accept (others are Claude Code only and make uploads fail).
const ALLOWED = ["name", "description", "license", "compatibility", "metadata", "allowed-tools"];
for (const k of Object.keys(fields)) if (!ALLOWED.includes(k)) fail(`SKILL.md frontmatter: key "${k}" is not accepted by claude.ai uploads (allowed: ${ALLOWED.join(", ")})`);
const name = fields.name ?? "";
const description = fields.description ?? "";
if (!name) fail("SKILL.md: name is missing");
if (name.length > 64) fail(`SKILL.md: name is ${name.length} characters (max 64)`);
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) fail(`SKILL.md: name "${name}" must be lowercase letters, digits and single hyphens`);
if (/anthropic|claude/.test(name)) fail(`SKILL.md: name "${name}" contains a reserved word (anthropic, claude)`);
if (name !== basename(skillDir)) fail(`SKILL.md: name "${name}" differs from the folder name "${basename(skillDir)}" (claude.ai rejects the upload)`);
if (!description) fail("SKILL.md: description is missing");
if (description.length > 1024) fail(`SKILL.md: description is ${description.length} characters (max 1024)`);
if (/[<>]/.test(description) || /[<>]/.test(name)) fail("SKILL.md: name and description cannot contain XML tags (< or >)");
if (description.length > 200) warn(`SKILL.md: description is ${description.length} characters; the claude.ai help article mentions 200 as a maximum (the Agent Skills docs say 1024): if an upload fails, try a shorter one`);

const body = skillMd.slice(fm?.[0].length ?? 0);
const bodyLines = body.split("\n").length;
if (bodyLines > 500) fail(`SKILL.md body is ${bodyLines} lines (keep it under 500; move detail into references/)`);

/* ---------------------------------------------------------------- files, links, references */

const skillFiles = walk(skillDir);
const mdFiles = [...skillFiles.filter((p) => p.endsWith(".md")), join(root, "README.md"), join(root, "CLAUDE.md")].filter(existsSync);
const mentioned = new Set();
for (const file of mdFiles) {
  const text = readFileSync(file, "utf8");
  // Markdown links to local files: [text](path) — outside code; skip URLs, anchors, mailto and placeholders.
  const prose = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  for (const m of prose.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#|\{\{)/.test(target) || target.includes("{{")) continue;
    const p = resolve(dirname(file), target.split("#")[0]);
    if (!existsSync(p)) fail(`${rel(file)}: link to a missing file: ${target}`);
    else mentioned.add(p);
  }
  // Code-span references to the skill's own files: `references/x.md`, `templates/y`, `scripts/z.mjs`.
  const inSkill = file.startsWith(skillDir);
  for (const m of text.matchAll(/`((?:references|templates|scripts)\/[A-Za-z0-9._/-]+?)`/g)) {
    const ref = m[1];
    const candidates = inSkill ? [join(skillDir, ref)] : [join(skillDir, ref), join(root, ref)];
    const hit = candidates.find(existsSync);
    if (!hit) fail(`${rel(file)}: refers to a missing file: ${ref}`);
    else mentioned.add(resolve(hit));
  }
}
for (const p of skillFiles) {
  if (p === join(skillDir, "SKILL.md")) continue;
  if (!mentioned.has(resolve(p))) warn(`${rel(p)} is not mentioned by SKILL.md or any reference`);
}

/* ---------------------------------------------------------------- hygiene */

for (const p of walk(root)) {
  if (!/\.(md|mjs|js|ts|json|php|conf|txt|csv)$/.test(p) && basename(p) !== ".gitignore" && basename(p) !== ".gitattributes") continue;
  const buf = readFileSync(p);
  if (buf.includes(Buffer.from("\r\n"))) fail(`${rel(p)}: CRLF line endings (use LF)`);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) fail(`${rel(p)}: UTF-8 BOM`);
}

console.log(`name: ${name} (${name.length} chars) · description: ${description.length} chars · SKILL.md body: ${bodyLines} lines · ${skillFiles.length} files · ${mdFiles.length} Markdown files checked`);
for (const w of warnings) console.log(`WARN ${w}`);
for (const e of errors) console.log(`FAIL ${e}`);
console.log(errors.length ? `\n${errors.length} problem(s)` : "\nOK");
process.exitCode = errors.length ? 1 : 0;
