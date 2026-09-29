# Windows Offline SKU Model Import — Design

## User outcome and constraints

Store staff using the Windows-local app can attach a real, licensed `.glb` furniture model to a sellable SKU, place that SKU in a customer project, save a scene version, and reopen the same model offline. This is the next step toward realistic furniture visualization. A SKU without a model remains clearly marked as unavailable for 3D placement; the four bundled Khronos models remain labeled demonstrations. Model quality depends on the actual GLB supplied and is never invented by the app.

Runtime remains Windows 10/11, Edge, local Node loopback, C# bridge, SQLite, Three.js and the existing SceneModel protocol. No Mac, cloud API, PostgreSQL, Unity build, CAD conversion, AI layout, quotation or order is introduced here. Existing customer/project/scene/product records and immutable scene history must survive upgrades.

## Approaches considered

1. **Reference an arbitrary disk path:** small implementation but moving the source file or portable package breaks scenes; browser paths are unreliable and unsafe to serve. Rejected.
2. **Store GLB bytes in SQLite:** transactional with metadata but inflates backups and blocks ordinary DB reads when large models are imported. Rejected.
3. **Copy validated GLB into app data, store immutable asset metadata in SQLite:** recommended. A content-addressed file under `%LOCALAPPDATA%\ZhinengFamily\models` survives portable-package upgrades. Scene versions pin an asset UUID, so later SKU model changes do not silently change older scene visuals. Back up the entire app-data directory, including SQLite and models.

## Data and version semantics

SQLite v4 adds `local_model_assets` with workspace, asset UUID, product UUID, SHA-256, byte count and creation time. It adds a nullable active asset UUID to `local_products`, with workspace/product/asset foreign-key constraints. Asset metadata is append-only; replacing a product's active model creates a new asset row and retains old file/row while any history may reference it. All reads/writes are scoped to the local identity workspace. Linking an asset increments product revision with compare-and-swap, so stale editors get 409. v1–v3 upgrades create a unique pre-v4 online backup before an additive transaction; failed migrations roll back. The file copy happens before DB linking; a failed link may leave an unreferenced content-addressed file, never a broken committed pointer. There is no automatic deletion in this milestone.

The existing SceneModel `furniture_instances[*].asset_id` is used to pin the asset UUID when placing a sellable product. `product_id` remains the SKU record UUID; dimensions come from product millimeters. The server validates that both belong to the same workspace and that the asset belongs to the product before committing the scene. Immutable history JSON therefore preserves which model was selected. A later product edit does not rewrite older history.

## Import and delivery boundary

The product page offers a local file picker for `.glb`, shows file size and selected SKU, then uploads bytes only to the loopback server. A dedicated same-origin, HttpOnly-cookie-checked route accepts at most 30 MiB with a short timeout. The server streams to a new temp file, computes SHA-256, verifies GLB magic/version/declared length, parses its JSON chunk and rejects external URIs, malformed structures, nonfinite JSON, unsupported extensions needing external fetches and oversized input. The final name is a lowercase SHA-256 plus `.glb` inside the app-data `models` directory; no client-supplied path is used. Atomic rename ensures readers see whole files. The bridge verifies the file/hash and product revision before linking. No raw model bytes, local paths or secrets enter logs or browser storage.

Scene catalog merges bundled demos with only sellable products that have a valid active asset. Imported assets are served only through a UUID-shaped `/local-models/{asset_id}.glb` read route after workspace lookup; missing/corrupt files return a clear error rather than a fake rendered furniture count. Three.js GLTFLoader uses that route. The renderer resolves `asset_id` from each scene instance, so old scene versions continue to use the asset they originally pinned. The scene editor shows imported SKUs separately from demos and prevents placing a SKU whose model is absent.

## Errors and usability

Invalid/too-large/externally referenced GLB: Chinese explanation, no DB mutation. 409 stale product: retain selected file and form, explain reload required. Missing file after external deletion: show failed-load state and retain scene JSON. Failed upload must not clear the active model. Product revision updates keep normal SKU/price edits protected. A legitimate imported model stays available after service restart and portable-package upgrade. Demo models never masquerade as store SKUs.

## Verification

TDD with real SQLite and real Edge: v4 fresh/v1/v2/v3 migrations and rollback, asset workspace/product ownership, stale attach, model hash/file integrity, failed upload preservation, no path traversal/external URL, 30 MiB limit, import/scene placement/save/reopen/restart/history pinning, missing-file error, browser storage empty, 1024px UI, packaged executable and exact-source ZIP. Full offline core, Windows client suite, format/check, manifest/license/secret scan and exact-head GitHub Actions must pass. CI and local tests are recorded separately. Package remains a draft stacked PR until reviewed.
