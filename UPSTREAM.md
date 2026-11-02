# Upstream provenance

Source: [packages/pi-compass](https://github.com/MattDevy/pi-extensions/tree/86cbbbb1d65eeca88ce2f820dd958301625e394c/packages/pi-compass)
Reviewed commit: `86cbbbb1d65eeca88ce2f820dd958301625e394c`
License: MIT; copyright (c) 2026 Matt Devy.

Actual source files reviewed before implementing the DSH tools:

- [src/onboard-tools.ts](https://github.com/MattDevy/pi-extensions/blob/86cbbbb1d65eeca88ce2f820dd958301625e394c/packages/pi-compass/src/onboard-tools.ts)
- [src/codemap-generator.ts](https://github.com/MattDevy/pi-extensions/blob/86cbbbb1d65eeca88ce2f820dd958301625e394c/packages/pi-compass/src/codemap-generator.ts)
- [src/analyzers/directory-tree.ts](https://github.com/MattDevy/pi-extensions/blob/86cbbbb1d65eeca88ce2f820dd958301625e394c/packages/pi-compass/src/analyzers/directory-tree.ts)

The source and license were retrieved using the GitHub contents API at the pinned commit. This is an independent implementation based on those behaviors, not a runtime adapter. See NOTICE for full upstream attribution and MIT terms.

## Migration differences

- Upstream provides cached code maps, package/framework/build/convention detectors, topic tours, project identity, Pi onboarding commands and automatic prompt injection.
- This first DSH version implements `codebase_map` and `code_tour` as native DSH tools. Maps contain a bounded file list, Node package script/dependency names and candidate entry points. Tours use literal path filtering and declaration-line heuristics.
- Maps are freshly scanned; revisions use file metadata and package content hashes. There is no persistent cache, inferred architectural narrative, framework detector, semantic/AST symbol resolver or automatic context injection.
- Pi menus and commands are not ported. Node package scripts are displayed as data and never executed.

All filesystem access uses host-local Node APIs. Neither upstream Pi execution-world semantics nor DSH remote/sandbox filesystem support is claimed.
