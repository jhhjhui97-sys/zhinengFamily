# Windows Runtime Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; test behavior before production changes.

**Goal:** Verify the existing offline Unity app in its real Windows engine and Player.
**Architecture:** Retain the SceneModel consumer, SQLite session and UI Toolkit. Install the pinned official engine, establish actual acceptance evidence, then undertake a separately bounded rendering plan.
**Tech Stack:** Unity 6000.3.0f1, C#, native Windows SQLite, Windows x64 Mono.
**Spec:** docs/superpowers/specs/2026-09-28-windows-runtime-design.md

## Global Constraints
- Windows local operation; preserve previous branches/PRs and user data.
- No paid tools, credential collection, license bypass, or additional merges.
- No rendered-quality claims without actual runtime capture.
- Generated installers, caches, test logs and builds are excluded from Git.
- User delegated decisions; no repeated implementation-document approval menus.

## Review Focus
- Low system-disk space: use D: for downloads, engine and acceptance project cache.
- License unavailable: preserve explicit NOT RUN evidence, request only account action.
- Engine API incompatibility: actual Editor import and seven Editor tests.
- Packaging/native SQLite: actual Player save/restore and restart.
- Existing user scenes: no destructive cache/data reset or identity replacement.

### Task 1: Official Windows toolchain
**Files:** docs/windows-runtime-verification.md; ignored local installer/signature records.
**Interfaces:** Produces pinned Unity.exe path and eligible active license; consumes official release manifest.
- [ ] Download Hub and pinned Editor; verify official source, size, digest and Authenticode signer before installation.
- [ ] Install to D:; verify executable versions. Expected: Unity 6000.3.0f1.
- [ ] Obtain user sign-in/license if needed without collecting credentials. Expected: license recognized, or explicit account blocker.

### Task 2: Real Editor acceptance
**Files:** existing apps/unity-client/Assets/Tests/Editor/LocalSceneViewTests.cs and affected runtime files only if actual failures require fixes; docs/windows-runtime-verification.md.
**Interfaces:** Consumes Task 1 Unity.exe; produces NUnit XML and successful engine import.
- [ ] Copy only existing Unity project source to an ignored D: acceptance directory, retaining source digest provenance and avoiding overwrite of user data.
- [ ] Run Editor EditMode tests with XML and file log. Expected: all existing seven tests pass; actual compile failures are diagnosed before production changes.
- [ ] For each genuine defect add/execute failing regression, fix minimally, rerun complete engine and console suites.
- [ ] Commit verified fixes separately. No mock engine acceptance.

### Task 3: Windows packaging and runtime
**Files:** apps/unity-client/Assets/Editor/WindowsBuild.cs; apps/unity-client/Assets/Tests/Editor/WindowsBuildTests.cs if a noninteractive builder is required; docs/windows-runtime-verification.md.
**Interfaces:** Produces Windows x64 executable; consumes existing DemoSceneMenu/runtime bootstrap and offline session.
- [ ] Add failing builder tests first if needed: enabled scene, x64 target, failed build yields nonzero process outcome.
- [ ] Implement minimal noninteractive build entry; run tests and build. Expected: succeeded BuildReport and executable.
- [ ] Launch Player, exercise sample/save/edit/history/restore, restart and verify persisted latest revision. Expected: actual runtime evidence with no backend.
- [ ] Record precise results, paths and limitations; commit. Request one fresh final code review when this stage completes.

Follow-up after runtime gate: prepare licensed model/PBR and lighting rendering plan with actual image acceptance, then complete local furniture placement and Windows delivery. Do not silently label proxy cubes as realistic furniture.
