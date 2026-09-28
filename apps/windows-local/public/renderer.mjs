import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { renderPosition, wallSegments } from "./scene-tools.mjs";
export class RoomRenderer {
  constructor(host, status) {
    this.host = host;
    this.status = status;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#e8e7df");
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    host.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 30;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.frame = 0;
    this.disposed = false;
    this.onControlsChange = () => this.scheduleFrame();
    this.controls.addEventListener("change", this.onControlsChange);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.environment.texture;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xfff5df, 0x869e98, 1.25));
    const sun = new THREE.DirectionalLight(0xfff2dc, 3.2);
    sun.position.set(4, 10, -7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -12,
      right: 12,
      top: 12,
      bottom: -12,
      near: 1,
      far: 40,
    });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.015;
    sun.target.position.set(4, 0, -4);
    this.scene.add(sun, sun.target);
    this.content = new THREE.Group();
    this.scene.add(this.content);
    this.resources = [];
    this.renderSerial = 0;
    this.modelPromise = new GLTFLoader()
      .loadAsync("/assets/sofa.glb")
      .then((g) => g.scene);
    this.modelPromise.catch(() => {});
    this.resize = new ResizeObserver(() => this.size());
    this.resize.observe(host);
    this.interior();
    this.size();
  }
  scheduleFrame() {
    if (this.frame || this.disposed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }
  size() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.scheduleFrame();
  }
  interior() {
    this.camera.position.set(7, 2.15, -0.5);
    this.controls.target.set(4, 0.8, -2);
    this.controls.update();
    this.scheduleFrame();
  }
  overview() {
    this.camera.position.set(13, 12, 9);
    this.controls.target.set(4, 0, -4);
    this.controls.update();
    this.scheduleFrame();
  }
  box(w, h, d, material, x, y, z) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    this.resources.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  clear() {
    this.renderSerial++;
    this.content.clear();
    for (const r of this.resources) r.dispose();
    this.resources = [];
    this.renderer.domElement.dataset.modelLoaded = "false";
    this.status.textContent = "家具模型尚未加载";
    this.scheduleFrame();
  }
  async show(document) {
    this.clear();
    const serial = this.renderSerial;
    this.status.textContent = "正在加载真实家具材质…";
    this.renderer.domElement.dataset.modelLoaded = "false";
    this.content.clear();
    for (const r of this.resources) r.dispose();
    this.resources = [];
    const floors = new Map(document.floors.map((f) => [f.id, f.elevation_mm]));
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0ede2,
      roughness: 0.87,
    });
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8a086,
      roughness: 0.68,
    });
    this.resources.push(wallMaterial, floorMaterial);
    for (const room of document.rooms) {
      const shape = new THREE.Shape();
      room.boundary.forEach((p, i) =>
        i
          ? shape.lineTo(p.x / 1000, p.y / 1000)
          : shape.moveTo(p.x / 1000, p.y / 1000),
      );
      shape.closePath();
      const geometry = new THREE.ShapeGeometry(shape);
      this.resources.push(geometry);
      const floor = new THREE.Mesh(geometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = (floors.get(room.floor_id) ?? 0) / 1000;
      floor.receiveShadow = true;
      this.content.add(floor);
    }
    for (const wall of document.walls) {
      const total = Math.hypot(
          wall.end.x - wall.start.x,
          wall.end.y - wall.start.y,
        ),
        angle = Math.atan2(
          wall.end.y - wall.start.y,
          wall.end.x - wall.start.x,
        ),
        elevation = (floors.get(wall.floor_id) ?? 0) / 1000;
      for (const piece of wallSegments(wall, [
        ...document.doors,
        ...document.windows,
      ])) {
        const mid = (piece.start + piece.end) / 2,
          mesh = this.box(
            (piece.end - piece.start) / 1000,
            (piece.top - piece.bottom) / 1000,
            wall.thickness_mm / 1000,
            wallMaterial,
            (wall.start.x + Math.cos(angle) * mid) / 1000,
            elevation + (piece.top + piece.bottom) / 2000,
            -(wall.start.y + Math.sin(angle) * mid) / 1000,
          );
        mesh.rotation.y = angle;
        this.content.add(mesh);
      }
    }
    // Window panes keep real openings visible; clear, light transmission is deliberate.
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xe5f0eb,
      roughness: 0.03,
      transparent: true,
      opacity: 0.18,
      metalness: 0,
    });
    this.resources.push(glass);
    for (const opening of document.windows) {
      const wall = document.walls.find((w) => w.id === opening.wall_id);
      if (!wall) continue;
      const angle = Math.atan2(
          wall.end.y - wall.start.y,
          wall.end.x - wall.start.x,
        ),
        mid = opening.offset_mm + opening.width_mm / 2;
      const pane = this.box(
        opening.width_mm / 1000,
        opening.height_mm / 1000,
        0.01,
        glass,
        (wall.start.x + Math.cos(angle) * mid) / 1000,
        ((floors.get(wall.floor_id) ?? 0) +
          opening.sill_height_mm +
          opening.height_mm / 2) /
          1000,
        -(wall.start.y + Math.sin(angle) * mid) / 1000,
      );
      pane.rotation.y = angle;
      pane.castShadow = false;
      this.content.add(pane);
    }
    this.scheduleFrame();
    try {
      const source = await this.modelPromise;
      if (serial !== this.renderSerial) return;
      for (const item of document.furniture_instances) {
        const model = source.clone(true),
          bounds = new THREE.Box3().setFromObject(model),
          size = bounds.getSize(new THREE.Vector3()),
          center = bounds.getCenter(new THREE.Vector3());
        model.position.set(-center.x, -bounds.min.y, -center.z);
        const normalized = new THREE.Group();
        normalized.add(model);
        normalized.scale.set(
          item.width_mm / 1000 / size.x,
          item.height_mm / 1000 / size.y,
          item.depth_mm / 1000 / size.z,
        );
        const placed = new THREE.Group();
        placed.add(normalized);
        placed.position.fromArray(
          renderPosition(item.position, floors.get(item.floor_id) ?? 0),
        );
        placed.rotation.y = THREE.MathUtils.degToRad(item.rotation_deg);
        placed.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        this.content.add(placed);
      }
      this.renderer.domElement.dataset.modelLoaded = "true";
      this.status.textContent = "真实沙发模型 · PBR 材质 · 本地渲染";
      this.scheduleFrame();
    } catch {
      if (serial === this.renderSerial)
        this.status.textContent =
          "家具模型无法加载，请检查本地模型文件；未使用方块冒充家具。";
    }
  }
  capture() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }
  dispose() {
    this.renderSerial++;
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.controls.removeEventListener("change", this.onControlsChange);
    this.controls.dispose();
    this.renderer.dispose();
    this.environment.dispose();
    for (const r of this.resources) r.dispose();
    this.modelPromise
      .then((model) =>
        model.traverse((o) => {
          if (o.isMesh) {
            o.geometry.dispose();
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material]) {
              for (const value of Object.values(m))
                if (value?.isTexture) value.dispose();
              m.dispose();
            }
          }
        }),
      )
      .catch(() => {});
  }
}
