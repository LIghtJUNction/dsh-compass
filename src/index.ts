import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { readdir, realpath, lstat } from 'node:fs/promises';
import { extname } from 'node:path';
import { digest, lifetime, readText, safePath } from './local.js';
import { workspace } from './support.js';

export const name = 'dsh-compass';
export const inject = ['tools', 'workingDirectory'];
export const Config = Schema.object({ root: Schema.string() });
export type Config = ReturnType<typeof Config>;
const excluded = new Set(['node_modules', 'dist', 'build', 'target', 'coverage', 'vendor']);
const source = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h']);
const packageSchema = Schema.object({ name: Schema.string().default(''), scripts: Schema.dict(Schema.string()).default({}), dependencies: Schema.dict(Schema.string()).default({}), devDependencies: Schema.dict(Schema.string()).default({}) });
const mapSchema = {
  type: 'object', additionalProperties: false, properties: {
    root: { type: 'string', required: true }, revision: { type: 'string', required: true }, truncated: { type: 'boolean', required: true },
    files: { type: 'array', items: { type: 'string' }, required: true },
    packages: { type: 'array', items: { type: 'string' }, required: true },
    entryPoints: { type: 'array', items: { type: 'string' }, required: true },
  },
} satisfies import('@deepseek-ai/dsh-tools').ValueSchemaSpec;
async function map(root: string, signal: AbortSignal) {
  root = await realpath(root);
  const files: string[] = [], packages: string[] = [], stamps: string[] = [];
  let truncated = false, visited = 0;
  async function walk(path: string, depth: number): Promise<void> {
    signal.throwIfAborted();
    if (depth > 8) { truncated = true; return; }
    const dir = path ? await safePath(root, path) : root;
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      signal.throwIfAborted();
      if (++visited > 4000 || files.length >= 1000) { truncated = true; return; }
      if (entry.name.startsWith('.') || excluded.has(entry.name) || entry.isSymbolicLink()) continue;
      const child = path ? `${path}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(child, depth + 1);
      else if (entry.isFile()) {
        const stat = await lstat(await safePath(root, child));
        files.push(child);
        stamps.push(JSON.stringify([child, stat.size, stat.mtimeMs, stat.ctimeMs]));
        if (entry.name === 'package.json') {
          const text = await readText(root, child, signal);
          const data: unknown = JSON.parse(text);
          const pkg: ReturnType<typeof packageSchema> = Schema.resolve(data, packageSchema, {})[0];
          packages.push(JSON.stringify({ path: child, name: pkg.name, scripts: pkg.scripts, dependencies: Object.keys(pkg.dependencies), devDependencies: Object.keys(pkg.devDependencies) }));
          stamps.push(digest(text));
        }
      }
    }
  }
  await walk('', 0);
  signal.throwIfAborted();
  return { root, revision: digest(JSON.stringify(stamps)), truncated, files, packages, entryPoints: files.filter(f => /(^|\/)(index|main|app|server)\.[^.]+$/.test(f) || /(^|\/)(Cargo.toml|pyproject.toml|go.mod)$/.test(f)) };
}
export function apply(ctx: Context, config: Config) {
  const run = lifetime(ctx);
  ctx.tools.register(defineTool({
    name: 'codebase_map', description: 'Fresh bounded local repository map: files, package scripts/dependency names, candidate entry points. Skips hidden/generated/vendor paths and symlinks. No persistent cache.',
    parameters: { expectedRevision: { type: 'string' } },
    output: { schema: mapSchema, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    isConcurrencySafe: () => true,
    execute: (args, exec) => run(exec.signal, async signal => {
      const value = await map(workspace(ctx, exec, config.root), signal);
      if (args.expectedRevision !== undefined && value.revision !== args.expectedRevision) throw new Error('Stale map revision');
      return value;
    }),
  }));
  ctx.tools.register(defineTool({
    name: 'code_tour', description: 'Find source declaration lines in files whose path contains topic (literal case-insensitive). Bounded heuristic navigation, not an AST or semantic index.',
    parameters: { topic: { type: 'string', required: true }, expectedRevision: { type: 'string' } },
    output: { schema: { type: 'object', additionalProperties: false, properties: { revision: { type: 'string', required: true }, steps: { type: 'array', items: { type: 'string' }, required: true }, truncated: { type: 'boolean', required: true } } }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    isConcurrencySafe: () => true,
    execute: (args, exec) => run(exec.signal, async signal => {
      if (!args.topic.trim() || args.topic.length > 200) throw new Error('topic must contain 1-200 characters');
      const root = workspace(ctx, exec, config.root);
      const value = await map(root, signal);
      if (args.expectedRevision !== undefined && value.revision !== args.expectedRevision) throw new Error('Stale map revision');
      const candidates = value.files.filter(f => f.toLowerCase().includes(args.topic.toLowerCase()) && source.has(extname(f)));
      const steps: string[] = [];
      for (const path of candidates.slice(0, 20)) {
        const text = await readText(root, path, signal);
        let count = 0;
        for (const [index, line] of text.split('\n').entries()) {
          if (/^\s*(export\s+)?(default\s+)?(async\s+)?(pub\s+)?(function|class|interface|type|enum|def|fn|struct|trait|func)\s+/.test(line)) {
            steps.push(`${path}:${index + 1}: ${line.trim().slice(0, 240)}`);
            if (++count >= 15) break;
          }
        }
        if (!count) steps.push(`${path}:1: (no supported declarations detected)`);
      }
      const verified = await map(root, signal);
      if (verified.revision !== value.revision) throw new Error('Workspace changed during tour; retry');
      return { revision: value.revision, steps, truncated: value.truncated || candidates.length > 20 };
    }),
  }));
}
