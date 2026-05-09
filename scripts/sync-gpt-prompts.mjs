#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const defaultSourceDir = '/Users/imanarimari/projects/content/gpt';
const defaultPublicDir = '/Users/imanarimari/projects/work/handout/konmari-prompt';
const validCategories = new Set(['seasonal', 'product', 'advertising', 'craft']);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const options = parseArgs(process.argv.slice(2));
const sourceDir = path.resolve(options.source || defaultSourceDir);
const publicDir = options.publicDir ? path.resolve(options.publicDir) : defaultPublicDir;
const dryRun = options.dryRun;
const skipPublic = options.skipPublic;

const promptsPath = path.join(rootDir, 'prompts.json');
const uploadsDir = path.join(rootDir, 'images', 'uploads');

main();

function main() {
  if (!fs.existsSync(sourceDir)) {
    fail(`source directory not found: ${sourceDir}`);
  }
  if (!fs.existsSync(promptsPath)) {
    fail(`prompts.json not found: ${promptsPath}`);
  }

  const data = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));
  const markdownFiles = listMarkdownFiles(sourceDir);
  const entries = [];
  const skipped = [];

  for (const mdPath of markdownFiles) {
    const parsed = parsePublishedMarkdown(mdPath);
    if (!parsed) {
      skipped.push(path.relative(sourceDir, mdPath));
      continue;
    }
    entries.push(parsed);
  }

  if (entries.length === 0) {
    console.log('No published prompt Markdown files found.');
    console.log('Add frontmatter with publish: true to import a file.');
    return;
  }

  const existingById = new Map(data.prompts.map((prompt, index) => [prompt.id, { prompt, index }]));
  let added = 0;
  let updated = 0;

  if (!dryRun) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  for (const entry of entries) {
    if (!dryRun) {
      fs.copyFileSync(entry.sourceImagePath, path.join(rootDir, entry.prompt.image));
    }

    const current = existingById.get(entry.prompt.id);
    if (current) {
      data.prompts[current.index] = entry.prompt;
      updated += 1;
    } else {
      data.prompts.push(entry.prompt);
      added += 1;
    }
  }

  if (!dryRun) {
    fs.writeFileSync(promptsPath, JSON.stringify(data, null, 2) + '\n');
    if (!skipPublic) {
      syncPublic(entries);
    }
  }

  console.log(`${dryRun ? 'Dry run' : 'Synced'} ${entries.length} prompt(s): ${added} added, ${updated} updated.`);
  console.log(`Skipped ${skipped.length} unpublished Markdown file(s).`);
  for (const entry of entries) {
    console.log(`- ${entry.prompt.id}: ${localized(entry.prompt.title)} -> ${entry.prompt.image}`);
  }
}

function parsePublishedMarkdown(mdPath) {
  const source = fs.readFileSync(mdPath, 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const meta = parseFrontmatter(match[1]);
  if (!truthy(meta.publish)) return null;

  const id = required(meta.id, mdPath, 'id');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    fail(`${mdPath}: id must use lowercase letters, numbers, and hyphens only.`);
  }

  const category = required(meta.category || meta.tag, mdPath, 'category');
  if (!validCategories.has(category)) {
    fail(`${mdPath}: category must be one of ${[...validCategories].join(', ')}.`);
  }

  const imageValue = required(meta.image, mdPath, 'image');
  const sourceImagePath = path.resolve(path.dirname(mdPath), imageValue);
  if (!fs.existsSync(sourceImagePath)) {
    fail(`${mdPath}: image not found: ${sourceImagePath}`);
  }
  const ext = path.extname(sourceImagePath).toLowerCase();
  if (!imageExtensions.has(ext)) {
    fail(`${mdPath}: image must be one of ${[...imageExtensions].join(', ')}.`);
  }

  const promptText = match[2].trim();
  if (!promptText) {
    fail(`${mdPath}: prompt body is empty.`);
  }

  const prompt = {
    id,
    tag: category,
    title: localizedObject(meta, 'title', mdPath),
    subtitle: localizedObject(meta, 'subtitle', mdPath),
    image: `images/uploads/${id}${ext}`,
    prompt: promptText
  };

  const badge = optionalLocalizedObject(meta, 'badge');
  if (badge) prompt.badge = badge;
  if (meta.occasion) prompt.occasion = meta.occasion;

  return { mdPath, sourceImagePath, prompt };
}

function syncPublic(entries) {
  if (!fs.existsSync(publicDir)) {
    console.warn(`Public directory not found, skipped public sync: ${publicDir}`);
    return;
  }

  const publicUploadsDir = path.join(publicDir, 'images', 'uploads');
  fs.mkdirSync(publicUploadsDir, { recursive: true });
  fs.copyFileSync(path.join(rootDir, 'index.html'), path.join(publicDir, 'index.html'));
  fs.copyFileSync(path.join(rootDir, 'prompts.json'), path.join(publicDir, 'prompts.json'));

  for (const entry of entries) {
    fs.copyFileSync(
      path.join(rootDir, entry.prompt.image),
      path.join(publicDir, entry.prompt.image)
    );
  }
}

function parseFrontmatter(text) {
  const meta = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf(':');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value === 'true') value = true;
    if (value === 'false') value = false;
    meta[key] = value;
  }
  return meta;
}

function localizedObject(meta, key, mdPath) {
  const ja = meta[`${key}_ja`] || meta[key];
  if (!ja) fail(`${mdPath}: ${key} is required.`);
  return {
    ja,
    en: meta[`${key}_en`] || ja,
    zh: meta[`${key}_zh`] || ja
  };
}

function optionalLocalizedObject(meta, key) {
  const ja = meta[`${key}_ja`] || meta[key];
  if (!ja) return null;
  return {
    ja,
    en: meta[`${key}_en`] || ja,
    zh: meta[`${key}_zh`] || ja
  };
}

function listMarkdownFiles(dir) {
  const files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...listMarkdownFiles(fullPath));
    } else if (item.isFile() && item.name.toLowerCase().endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function parseArgs(args) {
  const parsed = { dryRun: false, skipPublic: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dry-run') parsed.dryRun = true;
    else if (arg === '--no-public') parsed.skipPublic = true;
    else if (arg === '--source') parsed.source = args[++i];
    else if (arg === '--public-dir') parsed.publicDir = args[++i];
    else fail(`unknown option: ${arg}`);
  }
  return parsed;
}

function required(value, mdPath, key) {
  if (!value) fail(`${mdPath}: ${key} is required.`);
  return String(value);
}

function truthy(value) {
  return value === true || value === 'true' || value === 'yes' || value === '1';
}

function localized(value) {
  return typeof value === 'string' ? value : value.ja;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
