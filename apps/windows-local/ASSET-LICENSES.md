# Bundled furniture model attribution

Sheen Wood Leather Sofa, source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/4995a638c96dbc94376d3d6164e70fee3ac7f7a2/Models/SheenWoodLeatherSofa

Original asset: Fran Calvente / Poly Haven, 2021, CC0-1.0.
Improvements: Eric Chadwick / Darmstadt Graphics Group GmbH, 2024, CC-BY-4.0.
License: https://creativecommons.org/licenses/by/4.0/ and https://creativecommons.org/publicdomain/zero/1.0/
Redistributed model and license are bundled in public/assets. Renderer normalizes the unmodified model to SceneModel furniture dimensions; the file itself is unchanged.
GLB size: 10107912 bytes. SHA256: 5349e042ad41e695e89f1110230c4ee0c75b2bc62ef830c7016be6ecf665bfb6.

Sheen Chair, source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/4995a638c96dbc94376d3d6164e70fee3ac7f7a2/Models/SheenChair
Wayfair, LLC, 2020. Model and textures: CC0-1.0. Bundled license: `public/assets/CHAIR-LICENSE.md`.
GLB size: 4125648 bytes. SHA256: f0af2a2b102d28d540236306ae19f8fb36842df76bd38cf76f063f9bd2853399.

Glam Velvet Sofa, source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/4995a638c96dbc94376d3d6164e70fee3ac7f7a2/Models/GlamVelvetSofa
© 2021 Wayfair, LLC; Eric Chadwick created the model and textures. CC-BY-4.0. Bundled license: `public/assets/VELVET-SOFA-LICENSE.md`. [Official attribution](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/4995a638c96dbc94376d3d6164e70fee3ac7f7a2/Models/GlamVelvetSofa/README.md#legal).
GLB size: 3149844 bytes. SHA256: 67202c74a1a33377771f162dc7fad612a6c9bd51ee15124c488e9851d9ac5266.

Commercial Refrigerator, source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/4995a638c96dbc94376d3d6164e70fee3ac7f7a2/Models/CommercialRefrigerator
© 2025 Sean Thomas and Darmstadt Graphics Group GmbH; original work by Sean Thomas, model and textures by Eric Chadwick. CC-BY-4.0. Bundled license: `public/assets/REFRIGERATOR-LICENSE.md`. [Official attribution](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/4995a638c96dbc94376d3d6164e70fee3ac7f7a2/Models/CommercialRefrigerator/README.md#legal).
GLB size: 10131180 bytes. SHA256: ef8da8b144e650c277ac953e6d9e50ac1689ff1ee88c2c5bd9551ae8bccb6065.

The four assets are explicitly marked as demo models. They do not imply that a merchant stocks or sells the depicted products. All models are redistributed unmodified; the renderer scales instances to demonstration dimensions in SceneModel.
Room surface textures: Wood Floor by Dimitrios Savva and White Plaster 02 by Rob Tuytel, from Poly Haven, CC0 1.0. Bundled 1K JPG diffuse, OpenGL normal and roughness maps for the floor, and normal and roughness maps for the wall, are documented with SHA256 in `public/assets/room/README.md`. Source: https://polyhaven.com/a/wood_floor and https://polyhaven.com/a/white_plaster_02. These textures do not represent a merchant's sellable materials.
Three.js0.180.0: MIT, license included by npm/package delivery.


## Bundled local GLB decoders

The application uses the unmodified decoder resources distributed with the pinned Three.js 0.180.0 npm package. They load from the application's loopback server and require no online CDN. The portable bundle carries the license texts below in `licenses/`.

- Draco geometry decoder: Apache-2.0, Google / Draco contributors. `Draco-LICENSE.txt`; source: https://github.com/google/draco. Files: `examples/jsm/libs/draco/gltf/draco_decoder.js`, `draco_wasm_wrapper.js`, `draco_decoder.wasm`.
- Basis Universal KTX2 texture transcoder: Apache-2.0, Binomial LLC. `BasisUniversal-LICENSE.txt`; source: https://github.com/BinomialLLC/basis_universal. Files: `examples/jsm/libs/basis/basis_transcoder.js`, `basis_transcoder.wasm`.
- Meshoptimizer 0.22 decoder: MIT, Copyright (c) 2016-2024 Arseny Kapoulkine. `Meshoptimizer-LICENSE.txt`; source: https://github.com/zeux/meshoptimizer/tree/v0.22. File: `examples/jsm/libs/meshopt_decoder.module.js`, including its embedded WASM.
- KTX-Parse: MIT, Copyright (c) 2020 Don McCurdy. `KtxParse-LICENSE.txt`; source: https://github.com/donmccurdy/KTX-Parse. File: `examples/jsm/libs/ktx-parse.module.js`.
- ZSTD decoder: MIT wrapper by Don McCurdy and BSD-3-Clause Zstandard code by Yann Collet / Facebook. `Zstddec-LICENSE.txt`; source: https://github.com/donmccurdy/zstddec-wasm. File: `examples/jsm/libs/zstddec.module.js`, including its embedded WASM.

The small Draco regression fixture is an original four-vertex tetrahedron created for this repository with the bundled encoder. It contains no third-party product model or customer artwork. Its encoding settings and vertices are documented in `tests/glb-fixtures.mjs`.
