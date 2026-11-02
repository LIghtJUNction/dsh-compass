# dsh-compass

DSH 0.2.1-rc.2 plugin. Node >=24; developed and tested locally with Node 26 / TypeScript 5.9.3. Release CI is configured for Node 24; that CI run is separate from local verification.

## Install from a GitHub Release

After a release is published, install its built archive into your DSH profile:

```sh
dsh plugin --profile headless add https://github.com/LIghtJUNction/dsh-compass/releases/download/v0.1.0/lightjunction-dsh-compass-0.1.0.tgz
dsh headless --dump-config
```

The release URL is the expected v0.1.0 asset location, not a claim that it has already been published. Use the archive and SHA256SUMS attached to the same GitHub Release. The package includes a DSH bundle patch and built JavaScript; no Pi dependency is needed. Restart DSH after installation. Substitute your existing profile for `headless` if needed.

## Configuration

The default bundle config is `{}`: each tool uses the invoking agent's working directory. A host call without an agent requires an explicit `root`. To pin a host-local workspace, add an override in your profile's `cordis.patch.yml`:

```yaml
- id: dsh-compass
  config:
    root: /absolute/local/project
```

The root must already exist. It is interpreted on the DSH host, using Node filesystem APIs. A remote DSH world or sandbox does not redirect these operations: only enable this plugin for a host-local project. This is not a remote-world adapter or a security sandbox.

## Tools and examples

- `codebase_map({})` returns `files`, `packages` (JSON-encoded package summaries), candidate `entryPoints`, `revision`, canonical `root` and `truncated`.
- `codebase_map({expectedRevision:"<previous revision>"})` rejects a stale map.
- `code_tour({topic:"auth",expectedRevision:"<map revision>"})` returns declaration lines from supported source files whose path contains `auth` literally, ignoring case. Results include path and line number, and the map revision.

Ask DSH: “Map this repository, then show a tour of files under src.” Package metadata reports Node package names, scripts, and dependency names; scripts are never run. Candidate entry points include index/main/app/server files and Cargo.toml, pyproject.toml and go.mod. Candidates are heuristics, not proven executable entry points.

## Limits and behavior

Every call scans fresh host-local files. Hidden entries, symlinks, node_modules, dist, build, target, coverage and vendor directories are skipped. Scans stop at 1,000 files, 4,000 visited entries, or directory depth eight and report truncation. This is not a Git-ignore parser. Malformed/unreadable package.json fails the operation instead of silently inventing package data. Reads reject traversal and symlink ancestors and are bounded to 256 KiB per file.

Map revisions fingerprint file paths, size, mtime/ctime and package.json text; they are not a content hash of every source file or an atomic filesystem snapshot. A tour verifies the map again after reading and asks for retry if it changed. It visits at most 20 matching files, returning up to 15 declaration lines per file (240 characters per line), and marks excess candidate files as truncated. Invalid UTF-8, binary, oversized or unreadable selected files fail explicitly.

Supported declaration heuristics cover common JS/TS, Python, Rust, Go, Java and C-family extensions. This is not an AST index, reference search, import graph or compiler. Tours do not infer architecture. There is no persistent cache, automatic prompt injection, Pi TUI onboarding menu, framework/convention detection or semantic tour generation. Concurrent reads are supported; disposal aborts/drains work and unregisters tools.

## Filesystem boundary and verification

Path checks reject ordinary symlink redirection; regular-file opens use no-follow flags and inode checks, bounded reads and cancellation. These checks are not a sandbox against a malicious process concurrently replacing ancestor directories; use a trusted local workspace. Linux/macOS-style filesystem semantics are the intended target; Windows behavior has not been verified.

```sh
npm run check
```

The suite uses real Cordis, DSH ToolRuntime, agent-loop and an offline scripted model; it verifies actual model tool dispatch and results in the following model request, plus limits, revision/path checks, cancellation and unregistration. It requires no live model credentials. `check` includes TypeScript checks for source/tests, behavior tests and a build. See [UPSTREAM.md](UPSTREAM.md) for pinned source and migration differences and [NOTICE](NOTICE) for upstream MIT attribution.
