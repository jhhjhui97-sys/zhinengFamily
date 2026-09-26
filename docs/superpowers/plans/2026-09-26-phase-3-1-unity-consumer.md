# Phase 3-1 Implementation Plan

> For agentic workers: use superpowers:executing-plans inline, task by task, with TDD and one whole-branch independent review.

Goal: consume authoritative SceneModel JSON in a minimal Unity viewer without a second schema.
Architecture: raw document preservation, pure C# math, Unity presentation components.
Tech Stack: Unity6.3 LTS, Newtonsoft official Unity package, system csc/local .NET; CI .NET8/Python3.12.
Spec: ../specs/2026-09-26-phase-3-1-unity-consumer-design.md

Global constraints: no backend/admin business changes; no token/API in Unity; no CAD/AI/VR/quotation/uploads; mm/RH_Z_UP is authoritative; absent Unity and iPad execution must be stated.

Review focus: floor elevation double counting; rotation handedness; bottom-center vs mesh center; dropping unseen JSON fields; treating offline product UUID as real merchant catalog. Tests below exercise each boundary.

## Task 1: coordinate conversion
- [x] Write runnable C# tests in apps/unity-client/Tests/CoordinatesTests.cs; execute to observe missing adapter compilation failure.
- [x] Add Assets/SceneConsumer/Core/SceneCoordinates.cs for position/inverse/size/basis conversion and finite guards; run actual csc executable suite.
- [x] Commit test and implementation in small steps.

## Task 2: protocol consumer and demo
- [x] Add Python generation/validation regressions and Unity EditMode tests before implementation (Unity execution unavailable, explicitly record).
- [x] Generate canonical two-bedroom sample with offline furniture through existing SceneModel in tools/export_unity_sample.py.
- [x] Add SceneDocument raw JSON reader/export; SceneRenderer room outlines/walls/furniture; DemoBootstrap StreamingAssets loader; OrbitCamera; Editor menu scene generation. Unity UI/runtime checks remain pending actual Editor.
- [x] Run Python tests/sample drift and pure C# tests; document protocol consumer is not full authoritative validator.

## Task 3: verification and handoff
- [x] Add Unity project manifest, asmdefs, .NET console CI harness and workflow; README start/Editor tests/iPad prerequisites.
- [x] Full applicable checks, independent whole-branch review; fix Important findings, record actual/unrun evidence.
- [x] Push Phase3 branch; create stacked PR targeting unmerged Phase2 branch; exact-SHA Actions evidence, no merge.
