# Windows browser-engine local delivery

Windows is the first delivery target. Preserve Unity and backend/admin source. The pinned Unity 6000.3.0f1 official URL redirects to a China CDN returning 404 on this machine (2026-09-28); signed Hub 3.15.2 installed successfully, but no Editor/license/test/Player acceptance exists. Do not bypass licensing or claim engine success.

Ruling under user delegated decisions: deliver an independent local browser-engine client using Three.js, Node loopback HTTP, and the EXISTING authoritative C# SceneModel validator + SQLite LocalSceneStore via a narrow subprocess bridge. Edge app-window supplies the desktop surface. This is a local software architecture, not a published website; runtime assets are bundled and no remote API/login is required. Earlier Unity source remains available.

Stage deliverable: real textured sofa rendered with PBR/shadows, room geometry, orbit/room camera, furniture position/rotation editing, local library, explicit save, immutable version viewing/restore, and double-click Windows launcher. Price/customer/product business workflows remain the existing admin app until local integration is separately verified. No claim of whole-product completion at this stage.

Bridge consumes JSON on stdin, never executable commands; server owns database path/identity. Reuse full SceneModel validation and product catalog checks. Prevent cross-origin writes/DNS rebinding, bind only 127.0.0.1, bound body/timeouts, safe Chinese errors, no file browsing or arbitrary external model URLs. Save includes base revision; stale save keeps draft and returns409.

Models must have explicit redistribution licenses and attribution bundled in-app. Use selected Khronos SheenWoodLeatherSofa (original Fran Calvente/Poly Haven CC0; enhancements Eric Chadwick/Darmstadt Graphics Group CC-BY4.0), pinned source/hash. Do not use its preview render as app evidence. Actual screenshots must be captured from this client.
