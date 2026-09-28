# Windows local furniture catalog implementation plan

Goal: move the Windows experience beyond a single sofa by bundling several licensed, realistic furniture/appliance models and allowing the user to place them in the existing SceneModel plan. Keep all scene persistence offline and preserve the current immutable-version behavior.

1. Pin official Khronos sample assets (chair, velvet sofa, refrigerator), record hashes, creators, and license files. Reject incomplete downloads and keep the existing model intact.
2. Add a single bundled catalog manifest with stable local product IDs, display names, sample dimensions, room category, and model paths. Add bridge tests first: catalog registration allows listed products; unknown IDs still fail; scene save/restore remains valid. Implement a read-only catalog action that registers only those bundled entries in the local workspace.
3. Add pure furniture-placement tests before implementation. Place a chosen catalog entry in an existing room with a fresh instance ID and valid SceneModel fields. Add a minimal Chinese catalog/room picker, add action, selection, and save flow. Typed edits and conflict handling remain protected.
4. Refactor renderer to load the model for each product ID, cache GLBs, preserve source dimensions and PBR materials, and display a clear missing-model error instead of substituting a fake box. Extend browser tests to add a chair and refrigerator, save and reload, and verify multiple model assets load.
5. Extend portable package/license/hash checks and docs. Run full packaged Windows tests, offline core, syntax/format, real visible-app smoke, then push and verify CI for the exact SHA. Update the draft PR after verified CI; do not merge existing Phase 3 PRs.
