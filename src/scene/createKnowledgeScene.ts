import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { modules } from "../data/modules";
import mentorImage from "../assets/xiaobaozi.png";

export interface PlanetMotion {
  y: number;
  scale: number;
}
export interface ScreenPlanet {
  x: number;
  y: number;
  radius: number;
  distance: number;
  occluded: boolean;
}
const WIDTH = 1440;
const HEIGHT = 660;

export function createKnowledgeScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf8faff, 1350, 2450);
  const target = new THREE.Vector3(0, 55, 0);
  const camera = new THREE.PerspectiveCamera(40, WIDTH / HEIGHT, 1, 4000);
  const distance = Math.hypot(335, 1150);
  const basePitch = Math.atan2(335, 1150);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  scene.environment = environment.texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb1b5d8, 1.5));
  const key = new THREE.DirectionalLight(0xfffaf0, 3);
  key.position.set(-400, 700, 600);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb9c7ff, 2.2);
  rim.position.set(500, 100, -300);
  scene.add(rim);
  const geometry = new THREE.SphereGeometry(1, 48, 32);
  const spheres = modules.map((item) => {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshPhysicalMaterial({
        color: item.color,
        roughness: 0.24,
        metalness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.18,
        envMapIntensity: 0.7,
      }),
    );
    mesh.position.set(item.world[0], item.world[1], item.world[2]);
    mesh.scale.setScalar(item.size);
    scene.add(mesh);
    return mesh;
  });

  // 轨道位于 XZ 空间，再分别倾斜；透视和遮挡统一交给相机与深度缓冲。
  for (let lane = 0; lane < 3; lane++) {
    const points: THREE.Vector3[] = [];
    const radiusX = 700 - lane * 100;
    const radiusZ = 430 - lane * 85;
    for (let step = 0; step <= 256; step++) {
      const t = (step / 256) * Math.PI * 2;
      points.push(
        new THREE.Vector3(Math.cos(t) * radiusX, 0, Math.sin(t) * radiusZ),
      );
    }
    const path = new THREE.BufferGeometry().setFromPoints(points);
    const ring = new THREE.Line(
      path,
      new THREE.LineBasicMaterial({
        color: lane === 0 ? 0xaab6ef : 0xc2caed,
        transparent: true,
        opacity: 0.56 - lane * 0.1,
      }),
    );
    ring.position.y = -100 + lane * 55;
    ring.rotation.z = [-0.1, 0.15, -0.2][lane]!;
    ring.rotation.x = [0.07, -0.21, 0.25][lane]!;
    scene.add(ring);
  }

  // 少量空间参照物：近景较大、远景较小且受雾影响，均为真实世界坐标。
  const satellites: THREE.Mesh[] = [];
  [
    [-540, 90, 310, 23],
    [510, 230, 360, 21],
    [-120, 320, -700, 14],
    [770, -110, -380, 19],
    [-390, 150, -600, 12],
    [80, -75, 350, 12],
    [-620, -170, -30, 15],
    [430, 270, -350, 9],
  ].forEach(([x, y, z, r], index) => {
    const moon = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: index % 2 ? 0xc1cbee : 0xcdd8ee,
        roughness: 0.35,
        metalness: 0.1,
      }),
    );
    moon.position.set(x!, y!, z!);
    moon.scale.setScalar(r!);
    scene.add(moon);
    satellites.push(moon);
  });

  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(106,115,166,.27)");
  gradient.addColorStop(0.4, "rgba(135,142,194,.13)");
  gradient.addColorStop(1, "rgba(135,142,194,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 420),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -166, 10);
  scene.add(shadow);

  let disposed = false;
  let mentorReady = false;
  let imagePixels: ImageData | undefined;
  let imageWidth = 0;
  let imageHeight = 0;
  const mentorMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    alphaTest: 0.12,
    side: THREE.DoubleSide,
    depthWrite: true,
    toneMapped: false,
  });
  const mentor = new THREE.Mesh(
    new THREE.PlaneGeometry(405, 540),
    mentorMaterial,
  );
  mentor.position.set(0, 105, 0);
  mentor.visible = false;
  scene.add(mentor);
  const mentorTexture = new THREE.TextureLoader().load(
    mentorImage,
    (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(
        8,
        renderer.capabilities.getMaxAnisotropy(),
      );
      mentorMaterial.map = texture;
      mentorMaterial.needsUpdate = true;
      mentor.visible = true;
      mentorReady = true;
      const source = texture.image as HTMLImageElement;
      imageWidth = source.naturalWidth;
      imageHeight = source.naturalHeight;
      const imageCanvas = document.createElement("canvas");
      imageCanvas.width = imageWidth;
      imageCanvas.height = imageHeight;
      const context = imageCanvas.getContext("2d", {
        willReadFrequently: true,
      })!;
      context.drawImage(source, 0, 0);
      imagePixels = context.getImageData(0, 0, imageWidth, imageHeight);
    },
  );

  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector3();
  const cameraRight = new THREE.Vector3();
  const edge = new THREE.Vector3();
  const occluderBounds = new THREE.Sphere();
  const intersection = new THREE.Vector3();
  function render(pointer: { x: number; y: number }, motion: PlanetMotion[]) {
    const yaw = pointer.x * 0.18;
    const pitch = basePitch + pointer.y * 0.055;
    camera.position.set(
      Math.sin(yaw) * Math.cos(pitch) * distance,
      target.y + Math.sin(pitch) * distance,
      Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
    spheres.forEach((sphere, index) => {
      const item = modules[index]!;
      sphere.position.set(
        item.world[0],
        item.world[1] + motion[index]!.y,
        item.world[2],
      );
      sphere.scale.setScalar(item.size * motion[index]!.scale);
    });
    scene.updateMatrixWorld(true);
    const layout: ScreenPlanet[] = spheres.map((sphere) => {
      center.copy(sphere.position).project(camera);
      edge
        .copy(sphere.position)
        .addScaledVector(cameraRight, sphere.scale.x)
        .project(camera);
      const dist = sphere.position.distanceTo(camera.position);
      raycaster.setFromCamera(new THREE.Vector2(center.x, center.y), camera);
      const hit = mentor.visible
        ? raycaster.intersectObject(mentor)[0]
        : undefined;
      let occluded = false;
      for (const other of [...spheres, ...satellites]) {
        if (other === sphere) continue;
        occluderBounds.set(other.position, other.scale.x);
        const point = raycaster.ray.intersectSphere(
          occluderBounds,
          intersection,
        );
        if (
          point &&
          point.distanceTo(camera.position) < dist - sphere.scale.x
        ) {
          occluded = true;
          break;
        }
      }
      if (
        hit &&
        hit.distance < dist - sphere.scale.x &&
        hit.uv &&
        imagePixels
      ) {
        const x = Math.min(
          imageWidth - 1,
          Math.max(0, Math.floor(hit.uv.x * imageWidth)),
        );
        const y = Math.min(
          imageHeight - 1,
          Math.max(0, Math.floor((1 - hit.uv.y) * imageHeight)),
        );
        occluded ||= imagePixels.data[(y * imageWidth + x) * 4 + 3]! > 40;
      }
      return {
        x: ((center.x + 1) * WIDTH) / 2,
        y: ((1 - center.y) * HEIGHT) / 2,
        radius: (Math.abs(edge.x - center.x) * WIDTH) / 2,
        distance: dist,
        occluded,
      };
    });
    renderer.render(scene, camera);
    return { layout, mentorReady };
  }
  function dispose() {
    disposed = true;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        geometries.add(object.geometry);
        (Array.isArray(object.material)
          ? object.material
          : [object.material]
        ).forEach((material) => materials.add(material));
      }
    });
    geometries.forEach((item) => item.dispose());
    materials.forEach((item) => item.dispose());
    shadowTexture.dispose();
    mentorTexture.dispose();
    environment.dispose();
    renderer.dispose();
  }
  return { render, dispose };
}
