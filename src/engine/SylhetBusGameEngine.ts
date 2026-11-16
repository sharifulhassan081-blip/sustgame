import * as THREE from 'three';
import {
  BRTC_ROUTES,
  BusRoute,
  BusStopData,
  LandmarkData,
  LOWER_DECK_CAPACITY,
  RoadSegment,
  STUDENT_FARE_TK,
  SYLHET_BUS_STOPS,
  SYLHET_LANDMARKS,
  SYLHET_NODES,
  SYLHET_SEGMENTS,
  TOTAL_BUS_CAPACITY,
  UPPER_DECK_CAPACITY,
  worldToSylhetGPS,
} from '../data/sylhetWorldData';
import { SylhetAudioEngine } from './audioEngine';
import {
  buildLandmarkMesh,
  createBusStopShelter,
  createSylhetTree,
} from './landmarksBuilder';
import {
  createBuildingFacadeTexture,
  createRoadAsphaltTexture,
} from './textureFactory';
import {
  BRTCBusRig,
  createBRTCBus,
  createCNG,
  createRickshaw,
  createStudentFigure,
  StudentActor,
  TrafficRig,
} from './vehiclesBuilder';

export type CameraMode = 'chase' | 'cockpit' | 'upper_deck' | 'aerial';
export type WeatherMode = 'day' | 'sunset' | 'rain';

export interface FarePopupEvent {
  id: number;
  amount: number;
  studentNumber: number;
}

export interface GameHUDState {
  speedKmh: number;
  gear: 'R' | 'N' | 'D1' | 'D2' | 'D3' | 'D4';
  doorOpen: boolean;
  canBoardNow: boolean;
  boardingInProgress: boolean;
  waitingAtCurrentStop: number;
  lowerDeckCount: number;
  upperDeckCount: number;
  totalPassengers: number;
  totalFareTk: number;
  totalStudentsServed: number;
  safetyScore: number;
  routeId: string;
  routeCode: string;
  routeName: string;
  routeBnName: string;
  currentStopIndex: number;
  totalStops: number;
  nextStopName: string;
  nextStopBnName: string;
  nextStopArea: string;
  nextStopDistanceM: number;
  routeCompleted: boolean;
  busX: number;
  busZ: number;
  busHeading: number;
  lat: number;
  lng: number;
  currentStreetName: string;
  cameraMode: CameraMode;
  weatherMode: WeatherMode;
  headlightsOn: boolean;
  muted: boolean;
  conductorMessage: string;
  nearbyLandmark: LandmarkData | null;
  latestFarePopup: FarePopupEvent | null;
}

interface BuiltSegment {
  data: RoadSegment;
  curve: THREE.CatmullRomCurve3;
  length: number;
}

interface ActiveStopInstance {
  data: BusStopData;
  worldPos: THREE.Vector3;     // Boarding bay center on road
  shelterPos: THREE.Vector3;   // Footpath shelter pos
  forwardAngle: number;
  group: THREE.Group;
  bayGlowMesh: THREE.Mesh;
  beaconRing: THREE.Mesh;
  students: StudentActor[];
}

interface TrafficEntity {
  rig: TrafficRig;
  segmentId: string;
  t: number;
  dir: 1 | -1; // +1: from->to, -1: to->from
  baseSpeedMs: number;
  currentSpeedMs: number;
  baseLaneOffset: number; // meters to LEFT of travel direction
  currentLaneOffset: number;
  yieldTimer: number;
  collisionCooldown: number;
  wheelPhase: number;
}

export class SylhetBusGameEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private audio: SylhetAudioEngine;

  private segmentsMap = new Map<string, BuiltSegment>();
  private roadMat!: THREE.MeshStandardMaterial;
  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private rainPoints: THREE.Points | null = null;

  private busRig!: BRTCBusRig;
  private busPos = new THREE.Vector3(-1280, 0, -340);
  private busHeading = 0; // radians, 0 = facing +Z (South), Math.PI/2 = facing +X (East)
  private busSpeedMs = 0;
  private steerAngle = 0;
  private doorOpen = false;
  private doorAnim = 0;
  private headlightsOn = false;

  private currentRoute: BusRoute = BRTC_ROUTES[0];
  private activeStopInstances: ActiveStopInstance[] = [];
  private routeChevronGroup = new THREE.Group();
  private routeChevrons: { mesh: THREE.Mesh; baseScale: number; phase: number }[] = [];
  private stopWorldGroup = new THREE.Group();

  private currentStopIndex = 0;
  private routeCompleted = false;
  private boardingTimer = 0;
  private lowerDeckCount = 0;
  private upperDeckCount = 0;
  private totalFareTk = 0;
  private totalStudentsServed = 0;
  private safetyScore = 100;
  private farePopupCounter = 0;
  private latestFarePopup: FarePopupEvent | null = null;

  private conductorMessage =
    'বিসমিল্লাহ! শাবিপ্রবি ১ কিলো রোড থেকে বিআরটিসি ডাবল ডেকার ছাড়লো — ভাড়া ৫ টাকা!';
  private nearbyLandmark: LandmarkData | null = null;
  private visitedLandmarks = new Set<string>();

  private trafficList: TrafficEntity[] = [];
  private trafficGroup = new THREE.Group();

  private cameraMode: CameraMode = 'chase';
  private weatherMode: WeatherMode = 'day';
  private camCurrentPos = new THREE.Vector3(-1280, 7, -356);
  private camCurrentLook = new THREE.Vector3(-1280, 2.5, -320);

  // Input state (Keyboard + Touch)
  private keys = new Set<string>();
  public touchControls = {
    throttle: 0, // -1 .. 1
    steer: 0,    // -1 .. 1 (-1 left, +1 right)
    brake: false,
  };

  private animFrameId = 0;
  private lastTime = performance.now();
  private hudEmitTimer = 0;
  private elapsedTime = 0;
  private onHUDUpdate: (state: GameHUDState) => void;
  private isMenuPreview = true;

  constructor(container: HTMLElement, onHUDUpdate: (state: GameHUDState) => void) {
    this.container = container;
    this.onHUDUpdate = onHUDUpdate;
    this.audio = new SylhetAudioEngine();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7dd3fc);
    this.scene.fog = new THREE.FogExp2(0xbae6fd, 0.0022);

    this.camera = new THREE.PerspectiveCamera(
      58,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.25,
      550
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    this.setupLightingAndSky();
    this.buildSylhetGroundAndRoads();
    this.buildLandmarksAndStreetscape();
    this.buildRainSystem();

    this.scene.add(this.stopWorldGroup);
    this.scene.add(this.routeChevronGroup);
    this.scene.add(this.trafficGroup);

    this.busRig = createBRTCBus(this.currentRoute.ledText);
    this.scene.add(this.busRig.root);

    this.spawnTrafficFleet();
    this.loadRoute(this.currentRoute.id);

    this.bindEvents();
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public setMenuPreview(preview: boolean): void {
    this.isMenuPreview = preview;
    if (!preview) {
      this.audio.unlock();
    }
  }

  private setupLightingAndSky(): void {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x3f6212, 0.65);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.55);
    this.sunLight.position.set(-180, 240, -120);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 520;
    const d = 95;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Distant lush Sylhet & Meghalaya border hills along northern horizon!
    const meghalayaMat = new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      roughness: 0.95,
    });
    for (let i = 0; i < 16; i++) {
      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(160 + (i % 4) * 45, 75 + (i % 3) * 32, 7),
        meghalayaMat
      );
      hill.position.set(-1550 + i * 210, 30, -560 - (i % 2) * 60);
      this.scene.add(hill);
    }
  }

  private buildSylhetGroundAndRoads(): void {
    // Lush green Bengal plain ground
    const groundGeo = new THREE.PlaneGeometry(3800, 2600);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.94,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // SUST 1-Km Road Famous Twin Water Canals & Lush Ponds!
    const canalMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.2,
      metalness: 0.35,
    });
    [-1295.5, -1264.5].forEach((cx) => {
      const canal = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 255), canalMat);
      canal.rotation.x = -Math.PI / 2;
      canal.position.set(cx, 0.03, -235);
      this.scene.add(canal);
    });

    const roadTex = createRoadAsphaltTexture();
    this.roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.78,
      metalness: 0.08,
    });

    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.85,
    });

    // Build all road segments as smooth ribbon meshes
    SYLHET_SEGMENTS.forEach((seg) => {
      const nFrom = SYLHET_NODES[seg.from];
      const nTo = SYLHET_NODES[seg.to];
      const pts: THREE.Vector3[] = [new THREE.Vector3(nFrom.x, 0.04, nFrom.z)];
      if (seg.via) {
        seg.via.forEach((v) => pts.push(new THREE.Vector3(v.x, 0.04, v.z)));
      }
      pts.push(new THREE.Vector3(nTo.x, 0.04, nTo.z));

      const curve = new THREE.CatmullRomCurve3(pts);
      const length = curve.getLength();
      this.segmentsMap.set(seg.id, { data: seg, curve, length });

      const divisions = Math.max(24, Math.ceil(length / 5));
      const halfW = seg.width / 2;

      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      for (let i = 0; i <= divisions; i++) {
        const u = i / divisions;
        const p = curve.getPointAt(u);
        const tan = curve.getTangentAt(u).normalize();
        // Left perpendicular in XZ: (tan.z, 0, -tan.x)
        const leftX = tan.z;
        const leftZ = -tan.x;

        positions.push(p.x + leftX * halfW, 0.04, p.z + leftZ * halfW);
        positions.push(p.x - leftX * halfW, 0.04, p.z - leftZ * halfW);

        normals.push(0, 1, 0, 0, 1, 0);
        const vCoord = (u * length) / 14;
        uvs.push(0, vCoord, 1, vCoord);

        if (i < divisions) {
          const base = i * 2;
          indices.push(base, base + 1, base + 2);
          indices.push(base + 1, base + 3, base + 2);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);

      const roadMesh = new THREE.Mesh(geo, this.roadMat);
      roadMesh.receiveShadow = true;
      this.scene.add(roadMesh);

      // Raised Sidewalks outside road edges (trimmed near intersections so cross-traffic is clear!)
      const trimStart = Math.min(0.2, ((nFrom.radius ?? 16) + 5) / length);
      const trimEnd = 1 - Math.min(0.2, ((nTo.radius ?? 16) + 5) / length);
      if (trimEnd > trimStart + 0.1) {
        [-1, 1].forEach((side) => {
          const swPositions: number[] = [];
          const swNormals: number[] = [];
          const swIndices: number[] = [];
          const swSteps = Math.max(12, Math.ceil((length * (trimEnd - trimStart)) / 8));

          for (let i = 0; i <= swSteps; i++) {
            const u = trimStart + (i / swSteps) * (trimEnd - trimStart);
            const p = curve.getPointAt(u);
            const tan = curve.getTangentAt(u).normalize();
            const nx = tan.z * side;
            const nz = -tan.x * side;

            const inner = halfW + 0.1;
            const outer = halfW + 2.5;
            swPositions.push(p.x + nx * inner, 0.14, p.z + nz * inner);
            swPositions.push(p.x + nx * outer, 0.14, p.z + nz * outer);
            swNormals.push(0, 1, 0, 0, 1, 0);

            if (i < swSteps) {
              const b = i * 2;
              if (side > 0) {
                swIndices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
              } else {
                swIndices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
              }
            }
          }
          const swGeo = new THREE.BufferGeometry();
          swGeo.setAttribute('position', new THREE.Float32BufferAttribute(swPositions, 3));
          swGeo.setAttribute('normal', new THREE.Float32BufferAttribute(swNormals, 3));
          swGeo.setIndex(swIndices);
          const swMesh = new THREE.Mesh(swGeo, sidewalkMat);
          swMesh.receiveShadow = true;
          this.scene.add(swMesh);
        });
      }
    });

    // Intersection Plazas & Sylheti Traffic Police Roundabout Islands!
    const junctionMat = new THREE.MeshStandardMaterial({
      color: 0x242931,
      roughness: 0.82,
    });
    Object.values(SYLHET_NODES).forEach((node) => {
      const r = node.radius ?? 16;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 32), junctionMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(node.x, 0.046, node.z);
      disc.receiveShadow = true;
      this.scene.add(disc);

      // Add Sylhet Traffic Police Roundabout Island (skip sust_campus since Chetona '71 stands there)
      if (node.isRoundabout && node.id !== 'sust_campus') {
        const island = new THREE.Mesh(
          new THREE.CylinderGeometry(2.8, 3.1, 0.36, 20),
          new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 })
        );
        island.position.set(node.x, 0.2, node.z);
        this.scene.add(island);

        // Blue & White Sylhet Traffic Police Box Umbrella!
        const booth = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 0.9, 2.2, 12),
          new THREE.MeshStandardMaterial({ color: 0x1d4ed8 })
        );
        booth.position.set(node.x, 1.4, node.z);
        const umbrella = new THREE.Mesh(
          new THREE.ConeGeometry(2.1, 0.95, 12),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc })
        );
        umbrella.position.set(node.x, 2.9, node.z);
        this.scene.add(booth, umbrella);
      }
    });
  }

  private isNearNodeOrLandmark(x: number, z: number, padNode = 23, padLandmark = 26): boolean {
    for (const node of Object.values(SYLHET_NODES)) {
      const r = (node.radius ?? 16) + padNode;
      const dx = x - node.x;
      const dz = z - node.z;
      if (dx * dx + dz * dz < r * r) return true;
    }
    for (const lm of SYLHET_LANDMARKS) {
      const dx = x - lm.x;
      const dz = z - lm.z;
      if (dx * dx + dz * dz < padLandmark * padLandmark) return true;
    }
    return false;
  }

  private buildLandmarksAndStreetscape(): void {
    // 1. Place all 24 signature Sylhet landmarks!
    SYLHET_LANDMARKS.forEach((lm) => {
      const mesh = buildLandmarkMesh(lm);
      this.scene.add(mesh);
    });

    // 2. Populate authentic Sylhet shopfronts, tea tongs, trees & streetlamps along every road!
    const sylhetiShops = [
      { name: 'বনফুল এন্ড কোং • BONOFUL SWEETS', bg: '#b91c1c', text: '#fef08a' },
      { name: 'ফুলকলি সুইটস • FULKOLI SYLHET', bg: '#ea580c', text: '#ffffff' },
      { name: 'বিকাশ / নগদ এজেন্ট • bKash Point', bg: '#db2777', text: '#ffffff' },
      { name: 'লাজ ফার্মা • LAZZ PHARMA 24H', bg: '#0284c7', text: '#ffffff' },
      { name: 'সাতকরা রেস্তোরাঁ ও চায়ের টং', bg: '#15803d', text: '#fef08a' },
      { name: 'শাবিপ্রবি ফটোকপি ও বুক হাউস', bg: '#1e3a8a', text: '#ffffff' },
      { name: 'সিলেট টি হাউস • SYLHET TEA MART', bg: '#065f46', text: '#fde047' },
      { name: 'মডেল ফার্মেসি ও ডায়াগনস্টিক', bg: '#0f766e', text: '#ffffff' },
    ];
    const wallColors = ['#f8fafc', '#fef3c7', '#e0f2fe', '#ffedd5', '#f1f5f9', '#dcfce7'];

    const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 });
    const lampBulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    let seed = 1;
    this.segmentsMap.forEach((seg, segId) => {
      const isKiloRoad = segId === 'seg_kilo_road';
      const stepM = isKiloRoad ? 18 : 28;
      const count = Math.floor(seg.length / stepM);

      for (let i = 1; i < count; i++) {
        const u = i / count;
        const p = seg.curve.getPointAt(u);
        const tan = seg.curve.getTangentAt(u).normalize();
        const leftX = tan.z;
        const leftZ = -tan.x;
        const roadAngle = Math.atan2(tan.x, tan.z);

        // Streetlamps every ~56m
        if (i % 2 === 0) {
          [-1, 1].forEach((side) => {
            const lx = p.x + leftX * side * (seg.data.width / 2 + 0.6);
            const lz = p.z + leftZ * side * (seg.data.width / 2 + 0.6);
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 7.2, 6), lampPoleMat);
            pole.position.set(lx, 3.6, lz);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), lampPoleMat);
            arm.position.set(lx - leftX * side * 0.6, 7.1, lz - leftZ * side * 0.6);
            arm.rotation.y = roadAngle;
            const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.24), lampBulbMat);
            bulb.position.set(lx - leftX * side * 1.1, 7.02, lz - leftZ * side * 1.1);
            this.scene.add(pole, arm, bulb);
          });
        }

        // SUST Kilo Road gets double rows of lush trees along the canals instead of urban blocks!
        if (isKiloRoad) {
          [-1, 1].forEach((side) => {
            const tx = p.x + leftX * side * 9.8;
            const tz = p.z + leftZ * side * 9.8;
            const tree = createSylhetTree(seed++);
            tree.position.set(tx, 0, tz);
            this.scene.add(tree);
          });
          continue;
        }

        // Urban & Semi-urban Sylheti Streetscape
        [-1, 1].forEach((side) => {
          seed++;
          const distFromCenter = seg.data.width / 2 + 10.5;
          const bx = p.x + leftX * side * distFromCenter;
          const bz = p.z + leftZ * side * distFromCenter;

          // Keep Bondor Surma Riverbank open on the south side
          if (bz > 672) return;
          if (this.isNearNodeOrLandmark(bx, bz, 22, 26)) return;

          // Check we don't accidentally sit on top of another road segment!
          let tooCloseToOtherRoad = false;
          this.segmentsMap.forEach((otherSeg, otherId) => {
            if (otherId === segId || tooCloseToOtherRoad) return;
            for (let s = 0.1; s <= 0.9; s += 0.2) {
              const op = otherSeg.curve.getPointAt(s);
              if ((bx - op.x) ** 2 + (bz - op.z) ** 2 < 20 * 20) {
                tooCloseToOtherRoad = true;
                break;
              }
            }
          });
          if (tooCloseToOtherRoad) return;

          if (seed % 3 === 0 || segId === 'seg_eidgah_baluchor' || segId === 'seg_baluchor_tilagor') {
            const tree = createSylhetTree(seed);
            tree.position.set(
              p.x + leftX * side * (seg.data.width / 2 + 4.2),
              0,
              p.z + leftZ * side * (seg.data.width / 2 + 4.2)
            );
            this.scene.add(tree);
          } else {
            const bW = 12 + (seed % 5) * 2;
            const bH = 10 + (seed % 4) * 3.8;
            const bD = 11;
            const shop = sylhetiShops[seed % sylhetiShops.length];
            const wall = wallColors[seed % wallColors.length];
            const tex = createBuildingFacadeTexture(seed % 24, wall, shop);

            const bld = new THREE.Mesh(
              new THREE.BoxGeometry(bW, bH, bD),
              new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65 })
            );
            bld.position.set(bx, bH / 2, bz);
            // Face the road!
            const faceVec = new THREE.Vector3(-leftX * side, 0, -leftZ * side);
            bld.rotation.y = Math.atan2(faceVec.x, faceVec.z);
            bld.castShadow = true;
            bld.receiveShadow = true;
            this.scene.add(bld);
          }
        });
      }
    });
  }

  private buildRainSystem(): void {
    const count = 1600;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 110;
      positions[i * 3 + 1] = Math.random() * 42;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 110;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.24,
      transparent: true,
      opacity: 0.68,
    });
    this.rainPoints = new THREE.Points(geo, mat);
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);
  }

  private findDirectedSegmentBetween(nodeA: string, nodeB: string): { seg: BuiltSegment; forward: boolean } | null {
    for (const built of this.segmentsMap.values()) {
      if (built.data.from === nodeA && built.data.to === nodeB) {
        return { seg: built, forward: true };
      }
      if (built.data.from === nodeB && built.data.to === nodeA) {
        return { seg: built, forward: false };
      }
    }
    return null;
  }

  public loadRoute(routeId: string): void {
    const found = BRTC_ROUTES.find((r) => r.id === routeId) ?? BRTC_ROUTES[0];
    this.currentRoute = found;
    this.busRig.setLEDText(found.ledText);

    this.currentStopIndex = 0;
    this.routeCompleted = false;
    this.doorOpen = false;
    this.doorAnim = 0;
    this.lowerDeckCount = 0;
    this.upperDeckCount = 0;
    this.updateVisiblePassengers();

    // Clear previous stop meshes & GPS chevrons
    this.stopWorldGroup.clear();
    this.routeChevronGroup.clear();
    this.activeStopInstances = [];
    this.routeChevrons = [];

    // Build route's directed segment map so we know travel direction at every stop!
    const segmentDirMap = new Map<string, boolean>();
    const chevronMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < found.nodePath.length - 1; i++) {
      const link = this.findDirectedSegmentBetween(found.nodePath[i], found.nodePath[i + 1]);
      if (!link) continue;
      segmentDirMap.set(link.seg.data.id, link.forward);

      // Add glowing green GPS direction chevrons along the route!
      const chevronCount = Math.max(4, Math.floor(link.seg.length / 32));
      for (let c = 1; c < chevronCount; c++) {
        const rawU = c / chevronCount;
        const u = link.forward ? rawU : 1 - rawU;
        const p = link.seg.curve.getPointAt(u);
        const tan = link.seg.curve.getTangentAt(u).normalize();
        if (!link.forward) tan.negate();

        // Offset to left-hand driving lane!
        const leftX = tan.z;
        const leftZ = -tan.x;
        const heading = Math.atan2(tan.x, tan.z);

        const holder = new THREE.Group();
        holder.position.set(p.x + leftX * 3.4, 0.08, p.z + leftZ * 3.4);
        holder.rotation.y = heading;

        const flatArrow = new THREE.Mesh(
          new THREE.ConeGeometry(0.95, 2.1, 3),
          chevronMat
        );
        flatArrow.rotation.x = Math.PI / 2;
        flatArrow.scale.set(1, 1, 0.08);
        holder.add(flatArrow);

        this.routeChevronGroup.add(holder);
        this.routeChevrons.push({ mesh: flatArrow, baseScale: 1, phase: c * 0.5 });
      }
    }

    // Build Active Bus Stops + Waiting SUST & College Students!
    found.stopIds.forEach((stopId, idx) => {
      const stopData = SYLHET_BUS_STOPS.find((s) => s.id === stopId);
      if (!stopData) return;
      const segBuilt = this.segmentsMap.get(stopData.segmentId);
      if (!segBuilt) return;

      const forward = segmentDirMap.get(stopData.segmentId) ?? true;
      const p = segBuilt.curve.getPointAt(stopData.t);
      const tan = segBuilt.curve.getTangentAt(stopData.t).normalize();
      if (!forward) tan.negate();

      // Left-hand curb relative to travel direction: (tan.z, 0, -tan.x)
      const leftX = tan.z;
      const leftZ = -tan.x;
      const forwardAngle = Math.atan2(tan.x, tan.z);

      const bayOffset = segBuilt.data.width * 0.31;
      const shelterOffset = segBuilt.data.width * 0.5 + 2.05;

      const worldPos = new THREE.Vector3(p.x + leftX * bayOffset, 0.07, p.z + leftZ * bayOffset);
      const shelterPos = new THREE.Vector3(p.x + leftX * shelterOffset, 0, p.z + leftZ * shelterOffset);

      const group = new THREE.Group();

      // Shelter facing the road
      const shelter = createBusStopShelter(stopData.id, stopData.name, stopData.bnName);
      shelter.position.copy(shelterPos);
      shelter.rotation.y = Math.atan2(-leftX, -leftZ);
      group.add(shelter);

      // Glowing Green Boarding Zone Box on Road
      const bayHolder = new THREE.Group();
      bayHolder.position.copy(worldPos);
      bayHolder.rotation.y = forwardAngle;

      const bayGlowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(4.0, 14.5),
        new THREE.MeshBasicMaterial({
          color: idx === 0 ? 0x22c55e : 0x0ea5e9,
          transparent: true,
          opacity: idx === 0 ? 0.42 : 0.18,
          side: THREE.DoubleSide,
        })
      );
      bayGlowMesh.rotation.x = -Math.PI / 2;
      bayHolder.add(bayGlowMesh);
      group.add(bayHolder);

      // Tall Sky Beacon Ring for the Current Target Stop!
      const beaconRing = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4, 2.4, 16, 20, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x22c55e,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
        })
      );
      beaconRing.position.set(worldPos.x, 8, worldPos.z);
      beaconRing.visible = idx === 0;
      group.add(beaconRing);

      // Spawn Waiting Students at this Stop!
      const students: StudentActor[] = [];
      const count = stopData.initialStudents;
      for (let s = 0; s < count; s++) {
        const actor = createStudentFigure(idx * 17 + s);
        const along = (s % 6 - 2.5) * 1.15;
        const depth = Math.floor(s / 6) * 0.95 - 0.55;
        const sx = shelterPos.x + tan.x * along - leftX * depth;
        const sz = shelterPos.z + tan.z * along - leftZ * depth;
        actor.root.position.set(sx, 0.14, sz);
        actor.root.rotation.y = Math.atan2(-leftX, -leftZ);
        group.add(actor.root);
        students.push(actor);
      }

      this.stopWorldGroup.add(group);
      this.activeStopInstances.push({
        data: stopData,
        worldPos,
        shelterPos,
        forwardAngle,
        group,
        bayGlowMesh,
        beaconRing,
        students,
      });
    });

    // Place Bus cleanly just before the first stop of the route!
    const firstNodeId = found.nodePath[0];
    const secondNodeId = found.nodePath[1];
    const startLink = this.findDirectedSegmentBetween(firstNodeId, secondNodeId);
    if (startLink) {
      const startT = startLink.forward ? 0.05 : 0.95;
      const p = startLink.seg.curve.getPointAt(startT);
      const tan = startLink.seg.curve.getTangentAt(startT).normalize();
      if (!startLink.forward) tan.negate();
      const leftX = tan.z;
      const leftZ = -tan.x;

      this.busPos.set(p.x + leftX * 3.5, 0, p.z + leftZ * 3.5);
      this.busHeading = Math.atan2(tan.x, tan.z);
      this.busSpeedMs = 0;
      this.steerAngle = 0;

      // Snap camera smoothly behind bus
      const backX = Math.sin(this.busHeading);
      const backZ = Math.cos(this.busHeading);
      this.camCurrentPos.set(
        this.busPos.x - backX * 16,
        this.busPos.y + 6.8,
        this.busPos.z - backZ * 16
      );
      this.camCurrentLook.set(
        this.busPos.x + backX * 10,
        2.6,
        this.busPos.z + backZ * 10
      );
    }

    this.conductorMessage = this.activeStopInstances[0]?.data.conductorCall ??
      'চলেন ওস্তাদ! স্টুডেন্ট ভাড়া ৫ টাকা!';
    this.emitHUD();
  }

  public teleportToStop(stopIndex: number): void {
    const inst = this.activeStopInstances[stopIndex];
    if (!inst) return;
    this.currentStopIndex = stopIndex;
    this.updateStopBeaconVisibility();

    const backX = Math.sin(inst.forwardAngle);
    const backZ = Math.cos(inst.forwardAngle);
    this.busPos.set(
      inst.worldPos.x - backX * 8,
      0,
      inst.worldPos.z - backZ * 8
    );
    this.busHeading = inst.forwardAngle;
    this.busSpeedMs = 0;
    this.doorOpen = false;
    this.conductorMessage = inst.data.conductorCall;
    this.emitHUD();
  }

  public resetBusToNearestRoad(): void {
    let bestDistSq = Infinity;
    let bestPoint = new THREE.Vector3();
    let bestTan = new THREE.Vector3(0, 0, 1);

    this.segmentsMap.forEach((seg) => {
      for (let i = 0; i <= 25; i++) {
        const u = i / 25;
        const p = seg.curve.getPointAt(u);
        const dSq = (p.x - this.busPos.x) ** 2 + (p.z - this.busPos.z) ** 2;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestPoint = p;
          bestTan = seg.curve.getTangentAt(u).normalize();
        }
      }
    });

    // Preserve approximate travel direction along that road
    const curFwd = new THREE.Vector3(Math.sin(this.busHeading), 0, Math.cos(this.busHeading));
    if (curFwd.dot(bestTan) < 0) bestTan.negate();

    const leftX = bestTan.z;
    const leftZ = -bestTan.x;
    this.busPos.set(bestPoint.x + leftX * 3.4, 0, bestPoint.z + leftZ * 3.4);
    this.busHeading = Math.atan2(bestTan.x, bestTan.z);
    this.busSpeedMs = 0;
    this.steerAngle = 0;
    this.doorOpen = false;
    this.conductorMessage = 'ওস্তাদ বাস আবার মেইন রোডে সেট করা হয়েছে! সাবধানে চালান!';
  }

  private updateStopBeaconVisibility(): void {
    this.activeStopInstances.forEach((st, idx) => {
      const isNext = idx === this.currentStopIndex && !this.routeCompleted;
      st.beaconRing.visible = isNext;
      const mat = st.bayGlowMesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(isNext ? 0x22c55e : 0x0ea5e9);
      mat.opacity = isNext ? 0.45 : 0.14;
    });
  }

  private spawnTrafficFleet(): void {
    const segIds = SYLHET_SEGMENTS.map((s) => s.id);
    const totalVehicles = 46;

    for (let i = 0; i < totalVehicles; i++) {
      const isRickshaw = i < 25;
      const rig = isRickshaw ? createRickshaw(i) : createCNG();
      this.trafficGroup.add(rig.root);

      const segId = segIds[i % segIds.length];
      const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
      const baseSpeedMs = isRickshaw
        ? 3.1 + (i % 4) * 0.45  // ~11 - 17 km/h Rickshaw
        : 6.8 + (i % 5) * 0.75; // ~24 - 38 km/h Green CNG
      const baseLaneOffset = isRickshaw ? 4.75 : 2.65;

      this.trafficList.push({
        rig,
        segmentId: segId,
        t: (i * 0.19) % 0.92 + 0.04,
        dir,
        baseSpeedMs,
        currentSpeedMs: baseSpeedMs,
        baseLaneOffset,
        currentLaneOffset: baseLaneOffset,
        yieldTimer: 0,
        collisionCooldown: 0,
        wheelPhase: i,
      });
    }
  }

  public toggleDoor(): void {
    this.audio.unlock();
    if (Math.abs(this.busSpeedMs * 3.6) > 8 && !this.doorOpen) {
      this.conductorMessage = 'ওস্তাদ আগে বাস থামান! চলন্ত বাসে দরজা খোলা যাবে না!';
      return;
    }
    this.doorOpen = !this.doorOpen;
    this.audio.playDoorPneumatic(this.doorOpen);

    if (this.doorOpen) {
      const curStop = this.activeStopInstances[this.currentStopIndex];
      if (curStop && this.busPos.distanceTo(curStop.worldPos) < 18.5 && !this.routeCompleted) {
        // First let some existing passengers alight at intermediate stops (or all at final stop!)
        const isFinalStop = this.currentStopIndex === this.activeStopInstances.length - 1;
        const totalNow = this.lowerDeckCount + this.upperDeckCount;
        if (totalNow > 0) {
          const dropCount = isFinalStop ? totalNow : Math.min(totalNow, Math.floor(totalNow * 0.28) + 2);
          let rem = dropCount;
          while (rem > 0 && (this.lowerDeckCount > 0 || this.upperDeckCount > 0)) {
            if (this.lowerDeckCount >= this.upperDeckCount && this.lowerDeckCount > 0) {
              this.lowerDeckCount--;
            } else if (this.upperDeckCount > 0) {
              this.upperDeckCount--;
            }
            rem--;
          }
          this.updateVisiblePassengers();
        }
        this.conductorMessage = 'দরজা খোলা হয়েছে! এই লাইনে দাঁড়ান মামা, ভাড়া ৫ টাকা দেন!';
      }
    } else {
      this.conductorMessage = 'দরজা বন্ধ! ডানে-বামে রিকশা-সিএনজি দেইখা টান দেন ওস্তাদ!';
    }
  }

  public honkHorn(): void {
    this.audio.playBusHorn();

    // Nearby Rickshaws & CNGs ahead politely pull toward the left curb & ring their bell!
    const busFwd = new THREE.Vector3(Math.sin(this.busHeading), 0, Math.cos(this.busHeading));
    let alertedRickshaw = false;

    this.trafficList.forEach((tv) => {
      const toVeh = tv.rig.root.position.clone().sub(this.busPos);
      const dist = toVeh.length();
      if (dist < 45 && toVeh.normalize().dot(busFwd) > 0.45) {
        tv.yieldTimer = 4.0;
        if (tv.rig.kind === 'rickshaw' && !alertedRickshaw) {
          alertedRickshaw = true;
          setTimeout(() => this.audio.playRickshawBell(), 180);
        }
      }
    });
  }

  public cycleCamera(): void {
    const order: CameraMode[] = ['chase', 'cockpit', 'upper_deck', 'aerial'];
    const idx = order.indexOf(this.cameraMode);
    this.cameraMode = order[(idx + 1) % order.length];
  }

  public setWeather(mode: WeatherMode): void {
    this.weatherMode = mode;
    this.audio.setRain(mode === 'rain');

    if (mode === 'day') {
      this.scene.background = new THREE.Color(0x7dd3fc);
      this.scene.fog = new THREE.FogExp2(0xbae6fd, 0.0021);
      this.sunLight.color.setHex(0xfffbeb);
      this.sunLight.intensity = 1.55;
      this.ambientLight.intensity = 0.56;
      this.roadMat.roughness = 0.78;
      this.roadMat.metalness = 0.08;
      if (this.rainPoints) this.rainPoints.visible = false;
      this.setHeadlights(false);
    } else if (mode === 'sunset') {
      this.scene.background = new THREE.Color(0xfb923c);
      this.scene.fog = new THREE.FogExp2(0xfdba74, 0.0026);
      this.sunLight.color.setHex(0xf97316);
      this.sunLight.intensity = 1.25;
      this.ambientLight.intensity = 0.44;
      this.roadMat.roughness = 0.52;
      this.roadMat.metalness = 0.22;
      if (this.rainPoints) this.rainPoints.visible = false;
      this.setHeadlights(true);
    } else {
      // Famous Sylhet Monsoon Rain!
      this.scene.background = new THREE.Color(0x475569);
      this.scene.fog = new THREE.FogExp2(0x64748b, 0.0036);
      this.sunLight.color.setHex(0xcbd5e1);
      this.sunLight.intensity = 0.65;
      this.ambientLight.intensity = 0.42;
      this.roadMat.roughness = 0.22; // Wet glossy Sylhet asphalt!
      this.roadMat.metalness = 0.48;
      if (this.rainPoints) this.rainPoints.visible = true;
      this.setHeadlights(true);
      this.conductorMessage = 'সিলেটের ঝুম বৃষ্টি নামছে ওস্তাদ! হেডলাইট ও ওয়াইপার চালু!';
    }
  }

  public toggleHeadlights(): void {
    this.setHeadlights(!this.headlightsOn);
  }

  private setHeadlights(on: boolean): void {
    this.headlightsOn = on;
    this.busRig.headlightSpotL.intensity = on ? 65 : 0;
    this.busRig.headlightSpotR.intensity = on ? 65 : 0;
    this.busRig.headlightMat.color.setHex(on ? 0xffffff : 0xd1d5db);
  }

  public toggleMute(): boolean {
    const next = !this.audio.isMuted();
    this.audio.setMuted(next);
    return next;
  }

  private updateVisiblePassengers(): void {
    const total = this.lowerDeckCount + this.upperDeckCount;
    // Scale 85 logical capacity across our 32 visible 3D passenger figures
    const visibleCount = Math.min(
      this.busRig.passengerMeshes.length,
      Math.ceil((total / TOTAL_BUS_CAPACITY) * this.busRig.passengerMeshes.length)
    );
    this.busRig.passengerMeshes.forEach((m, idx) => {
      m.visible = idx < visibleCount;
    });
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('resize', this.handleResize);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.isMenuPreview) return;
    const code = e.code;
    this.keys.add(code);
    this.audio.unlock();

    if (code === 'KeyO' || code === 'KeyE') {
      e.preventDefault();
      this.toggleDoor();
    } else if (code === 'KeyH') {
      e.preventDefault();
      this.honkHorn();
    } else if (code === 'KeyC') {
      e.preventDefault();
      this.cycleCamera();
    } else if (code === 'KeyL') {
      e.preventDefault();
      this.toggleHeadlights();
    } else if (code === 'KeyR') {
      e.preventDefault();
      this.resetBusToNearestRoad();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private handleResize = (): void => {
    if (!this.container) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private loop = (now: number): void => {
    this.animFrameId = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.elapsedTime += dt;

    if (this.isMenuPreview) {
      this.updateTraffic(dt);
      this.updateMenuPreviewCamera(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.updateBusPhysics(dt);
    this.updateTraffic(dt);
    this.updateStopBoarding(dt);
    this.updateLandmarksAndAnimations(dt);
    this.updateCamera(dt);

    // Keep shadow frustum centered on player's BRTC bus for crisp shadows everywhere in Sylhet!
    this.sunLight.position.set(this.busPos.x - 90, 150, this.busPos.z - 70);
    this.sunLight.target.position.copy(this.busPos);

    this.renderer.render(this.scene, this.camera);

    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.08) {
      this.hudEmitTimer = 0;
      this.emitHUD();
    }
  };

  private updateMenuPreviewCamera(dt: number): void {
    // Scenic orbiting camera around the BRTC Double-Decker Bus at SUST Kilo Road!
    this.busRig.root.position.copy(this.busPos);
    this.busRig.root.rotation.y = this.busHeading;
    const angle = this.elapsedTime * 0.28;
    this.camera.position.set(
      this.busPos.x + Math.cos(angle) * 15.5,
      5.8 + Math.sin(this.elapsedTime * 0.6) * 0.8,
      this.busPos.z + Math.sin(angle) * 15.5
    );
    this.camera.lookAt(this.busPos.x, 2.4, this.busPos.z);
    void dt;
  }

  private updateBusPhysics(dt: number): void {
    let throttleInput = this.touchControls.throttle;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) throttleInput = 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) throttleInput = -1;

    const handbrake = this.keys.has('Space') || this.touchControls.brake;

    let steerInput = this.touchControls.steer; // -1 = left, +1 = right
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) steerInput = -1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) steerInput = 1;

    // Prevent driving fast with passenger door open!
    if (this.doorOpen && throttleInput > 0) {
      throttleInput = 0;
      this.conductorMessage = 'ওস্তাদ আগে [O] চেপে দরজা বন্ধ করেন, তারপর বাস টানেন!';
    }

    const maxForwardMs = 17.8; // ~64 km/h realistic city double-decker top speed
    const maxReverseMs = -5.5;
    const accel = 7.4;
    const brakeDecel = 16.5;
    const drag = 2.1;

    let isBraking = false;
    if (handbrake) {
      isBraking = true;
      if (Math.abs(this.busSpeedMs) < 0.25) {
        this.busSpeedMs = 0;
      } else {
        this.busSpeedMs -= Math.sign(this.busSpeedMs) * brakeDecel * 1.25 * dt;
      }
    } else if (throttleInput > 0) {
      if (this.busSpeedMs < -0.2) {
        isBraking = true;
        this.busSpeedMs += brakeDecel * dt;
      } else {
        this.busSpeedMs = Math.min(maxForwardMs, this.busSpeedMs + accel * throttleInput * dt);
      }
    } else if (throttleInput < 0) {
      if (this.busSpeedMs > 0.2) {
        isBraking = true;
        this.busSpeedMs -= brakeDecel * dt;
      } else {
        this.busSpeedMs = Math.max(maxReverseMs, this.busSpeedMs + accel * 0.65 * throttleInput * dt);
      }
    } else {
      // Natural rolling resistance
      if (Math.abs(this.busSpeedMs) < 0.12) {
        this.busSpeedMs = 0;
      } else {
        this.busSpeedMs -= Math.sign(this.busSpeedMs) * drag * dt;
      }
    }

    // Speed-sensitive Ackermann steering (nimble at roundabouts, stable at highway speed!)
    const speedFactor = Math.min(1, Math.abs(this.busSpeedMs) / 16);
    const maxSteerRad = THREE.MathUtils.lerp(0.50, 0.24, speedFactor);
    // In Three.js: turning LEFT increases rotation.y (+), turning RIGHT decreases rotation.y (-)
    const targetSteer = -steerInput * maxSteerRad;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, Math.min(1, dt * 8.5));

    // Bicycle kinematics model (wheelbase = 6.4m)
    if (Math.abs(this.busSpeedMs) > 0.05) {
      const wheelBase = 6.4;
      const angularVel = (this.busSpeedMs / wheelBase) * Math.tan(this.steerAngle);
      this.busHeading += angularVel * dt;

      this.busPos.x += Math.sin(this.busHeading) * this.busSpeedMs * dt;
      this.busPos.z += Math.cos(this.busHeading) * this.busSpeedMs * dt;
    }

    // Keep bus out of Surma River water at Bondor Bazar!
    if (this.busPos.z > 688) {
      this.busPos.z = 688;
      this.busSpeedMs = Math.min(0, this.busSpeedMs);
    }

    // Update Bus Transform & Realistic Double-Decker Body Roll / Pitch!
    this.busRig.root.position.copy(this.busPos);
    this.busRig.root.rotation.y = this.busHeading;

    const lateralG = this.steerAngle * (this.busSpeedMs / 12);
    const targetRoll = THREE.MathUtils.clamp(lateralG * 0.09, -0.055, 0.055);
    const targetPitch = isBraking
      ? 0.024
      : throttleInput > 0 && this.busSpeedMs > 0.5
        ? -0.015
        : 0;
    this.busRig.bodyGroup.rotation.z = THREE.MathUtils.lerp(
      this.busRig.bodyGroup.rotation.z,
      targetRoll,
      dt * 7
    );
    this.busRig.bodyGroup.rotation.x = THREE.MathUtils.lerp(
      this.busRig.bodyGroup.rotation.x,
      targetPitch,
      dt * 7
    );

    // Wheel spin & front wheel steering visual
    this.busRig.frontLeftWheel.rotation.y = this.steerAngle;
    this.busRig.frontRightWheel.rotation.y = this.steerAngle;
    const wheelSpin = (this.busSpeedMs * dt) / 0.54;
    this.busRig.allWheelMeshes.forEach((w) => {
      w.rotation.x += wheelSpin;
    });

    // Cockpit steering wheel & brake lights & turn indicators
    this.busRig.steeringWheel.rotation.z = -this.steerAngle * 3.8;
    this.busRig.brakeLightMat.color.setHex(isBraking ? 0xff1e1e : 0x7f1d1d);

    const blinkOn = Math.floor(this.elapsedTime * 3.5) % 2 === 0;
    this.busRig.indicatorLeftMat.color.setHex(
      (steerInput < -0.25 || this.doorOpen) && blinkOn ? 0xfbbf24 : 0x451a03
    );
    this.busRig.indicatorRightMat.color.setHex(
      (steerInput > 0.25 || this.doorOpen) && blinkOn ? 0xfbbf24 : 0x451a03
    );

    // Pneumatic Door Animation
    const targetDoor = this.doorOpen ? 1 : 0;
    this.doorAnim = THREE.MathUtils.lerp(this.doorAnim, targetDoor, Math.min(1, dt * 7));
    this.busRig.doorLeafA.rotation.y = -this.doorAnim * 1.42;
    this.busRig.doorLeafB.rotation.y = this.doorAnim * 1.42;

    // Windshield wipers in Sylhet Rain!
    if (this.weatherMode === 'rain') {
      const wipe = Math.sin(this.elapsedTime * 6.5) * 0.65;
      this.busRig.wiperLeft.rotation.z = wipe;
      this.busRig.wiperRight.rotation.z = wipe;
    } else {
      this.busRig.wiperLeft.rotation.z = -0.6;
      this.busRig.wiperRight.rotation.z = -0.6;
    }

    this.audio.updateEngine(this.busSpeedMs * 3.6, throttleInput);
  }

  private pickConnectedSegment(nodeId: string, excludeSegId: string): { segId: string; dir: 1 | -1 } {
    const candidates: { segId: string; dir: 1 | -1 }[] = [];
    SYLHET_SEGMENTS.forEach((s) => {
      if (s.id === excludeSegId) return;
      if (s.from === nodeId) candidates.push({ segId: s.id, dir: 1 });
      else if (s.to === nodeId) candidates.push({ segId: s.id, dir: -1 });
    });
    if (candidates.length === 0) {
      // Turn around cleanly on terminal segment
      const cur = SYLHET_SEGMENTS.find((s) => s.id === excludeSegId)!;
      return { segId: cur.id, dir: cur.from === nodeId ? 1 : -1 };
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private updateTraffic(dt: number): void {
    const busFwd = new THREE.Vector3(Math.sin(this.busHeading), 0, Math.cos(this.busHeading));

    this.trafficList.forEach((tv, idx) => {
      const seg = this.segmentsMap.get(tv.segmentId);
      if (!seg) return;

      if (tv.collisionCooldown > 0) tv.collisionCooldown -= dt;

      // Yield to BRTC Horn by pulling closer to the outer-left curb!
      if (tv.yieldTimer > 0) {
        tv.yieldTimer -= dt;
        tv.currentLaneOffset = THREE.MathUtils.lerp(tv.currentLaneOffset, 5.85, dt * 4);
      } else {
        tv.currentLaneOffset = THREE.MathUtils.lerp(tv.currentLaneOffset, tv.baseLaneOffset, dt * 2.5);
      }

      // Check distance to player's bus so traffic pauses politely if bus is directly ahead in lane!
      const posNow = tv.rig.root.position;
      const toBus = this.busPos.clone().sub(posNow);
      const distToBus = toBus.length();

      // Recycle far-away traffic onto road segments near the player so streets stay vibrant everywhere!
      if (!this.isMenuPreview && distToBus > 340) {
        const nearSegments: BuiltSegment[] = [];
        this.segmentsMap.forEach((candidate) => {
          const mid = candidate.curve.getPointAt(0.5);
          const d = mid.distanceTo(this.busPos);
          if (d < 250) nearSegments.push(candidate);
        });
        if (nearSegments.length > 0) {
          const chosen = nearSegments[(idx + Math.floor(this.elapsedTime)) % nearSegments.length];
          tv.segmentId = chosen.data.id;
          tv.t = 0.15 + Math.random() * 0.7;
          tv.dir = Math.random() < 0.55 ? 1 : -1;
          const newP = chosen.curve.getPointAt(tv.t);
          if (newP.distanceTo(this.busPos) < 32) {
            tv.t = (tv.t + 0.45) % 0.9 + 0.05;
          }
        }
      }

      const activeSeg = this.segmentsMap.get(tv.segmentId)!;
      const tan = activeSeg.curve.getTangentAt(THREE.MathUtils.clamp(tv.t, 0, 1)).normalize();
      if (tv.dir === -1) tan.negate();

      // Slow down if our BRTC bus is right in front of this rickshaw/CNG
      let targetSpeed = tv.baseSpeedMs;
      if (distToBus < 14 && toBus.clone().normalize().dot(tan) > 0.72) {
        targetSpeed = 0;
      }
      tv.currentSpeedMs = THREE.MathUtils.lerp(tv.currentSpeedMs, targetSpeed, dt * 4);

      // Advance along curve
      tv.t += (tv.dir * tv.currentSpeedMs * dt) / activeSeg.length;
      if (tv.t >= 0.98) {
        const next = this.pickConnectedSegment(activeSeg.data.to, activeSeg.data.id);
        tv.segmentId = next.segId;
        tv.dir = next.dir;
        tv.t = next.dir === 1 ? 0.03 : 0.97;
      } else if (tv.t <= 0.02) {
        const next = this.pickConnectedSegment(activeSeg.data.from, activeSeg.data.id);
        tv.segmentId = next.segId;
        tv.dir = next.dir;
        tv.t = next.dir === 1 ? 0.03 : 0.97;
      }

      const finalSeg = this.segmentsMap.get(tv.segmentId)!;
      const clampedT = THREE.MathUtils.clamp(tv.t, 0.01, 0.99);
      const p = finalSeg.curve.getPointAt(clampedT);
      const finalTan = finalSeg.curve.getTangentAt(clampedT).normalize();
      if (tv.dir === -1) finalTan.negate();

      // Left-hand traffic lane offset: (finalTan.z, 0, -finalTan.x)
      const leftX = finalTan.z;
      const leftZ = -finalTan.x;
      tv.rig.root.position.set(
        p.x + leftX * tv.currentLaneOffset,
        0,
        p.z + leftZ * tv.currentLaneOffset
      );
      tv.rig.root.rotation.y = Math.atan2(finalTan.x, finalTan.z);

      // Spin wheels & animate Rickshaw Puller's pedaling legs!
      tv.wheelPhase += tv.currentSpeedMs * dt * 2.8;
      tv.rig.wheels.forEach((w) => {
        w.rotation.x = tv.wheelPhase;
      });
      if (tv.rig.pedalLegL && tv.rig.pedalLegR) {
        tv.rig.pedalLegL.position.y = 0.72 + Math.sin(tv.wheelPhase * 1.4) * 0.09;
        tv.rig.pedalLegR.position.y = 0.72 - Math.sin(tv.wheelPhase * 1.4) * 0.09;
      }

      // Gentle collision check with Player's BRTC Double-Decker Bus
      if (!this.isMenuPreview && tv.collisionCooldown <= 0) {
        const rel = tv.rig.root.position.clone().sub(this.busPos);
        const fwdDist = rel.dot(busFwd);
        const sideVec = new THREE.Vector3(busFwd.z, 0, -busFwd.x);
        const sideDist = rel.dot(sideVec);

        if (Math.abs(fwdDist) < 6.4 && Math.abs(sideDist) < 2.05) {
          tv.collisionCooldown = 1.6;
          this.safetyScore = Math.max(0, this.safetyScore - 4);
          this.busSpeedMs *= -0.25;
          // Nudge rickshaw/CNG safely outward so they never get stuck inside the bus
          const pushDir = rel.lengthSq() > 0.01 ? rel.normalize() : sideVec;
          tv.currentLaneOffset = Math.min(6.3, tv.currentLaneOffset + 1.4);
          tv.rig.root.position.addScaledVector(pushDir, 1.8);
          this.audio.playBump();
          if (tv.rig.kind === 'rickshaw') {
            this.audio.playRickshawBell();
            this.conductorMessage = 'হায় হায় ওস্তাদ! রিকশায় ধাক্কা লাগছে — হর্ন [H] বাজায়ে সাইড নেন!';
          } else {
            this.conductorMessage = 'ওস্তাদ দেখে চালান! সিলেটি সিএনজি অটোরিকশা একদম সামনে!';
          }
        }
      }
    });
  }

  private updateStopBoarding(dt: number): void {
    const curStop = this.activeStopInstances[this.currentStopIndex];
    if (!curStop || this.routeCompleted) return;

    const dist = this.busPos.distanceTo(curStop.worldPos);
    const stoppedNearBay = dist < 18.5 && Math.abs(this.busSpeedMs * 3.6) < 6.5;

    // World position of the bus's front-left passenger boarding door (+1.35, 0, +3.0 in bus local)
    const busFwd = new THREE.Vector3(Math.sin(this.busHeading), 0, Math.cos(this.busHeading));
    const busLeft = new THREE.Vector3(busFwd.z, 0, -busFwd.x);
    const doorWorldPos = this.busPos
      .clone()
      .addScaledVector(busLeft, 1.42)
      .addScaledVector(busFwd, 3.0);

    // Animate waiting students waving at the bus, or walking to the open door!
    curStop.students.forEach((student, idx) => {
      if (stoppedNearBay && this.doorOpen && idx < 4) {
        // Walk briskly toward the open BRTC Double-Decker door!
        const toDoor = doorWorldPos.clone().sub(student.root.position);
        toDoor.y = 0;
        if (toDoor.length() > 0.35) {
          toDoor.normalize();
          student.root.position.addScaledVector(toDoor, dt * 4.4);
          student.root.rotation.y = Math.atan2(toDoor.x, toDoor.z);
        }
        const walkSwing = Math.sin(this.elapsedTime * 12 + student.phase) * 0.55;
        student.legL.rotation.x = walkSwing;
        student.legR.rotation.x = -walkSwing;
        student.armR.rotation.x = -walkSwing * 0.6;
      } else {
        // Idle & wave hand excitedly as the BRTC bus approaches!
        student.legL.rotation.x = 0;
        student.legR.rotation.x = 0;
        if (dist < 55 && idx % 2 === 0) {
          student.armR.rotation.x = -2.4 + Math.sin(this.elapsedTime * 7 + student.phase) * 0.35;
        } else {
          student.armR.rotation.x = 0;
        }
      }
    });

    if (stoppedNearBay && this.doorOpen) {
      const currentTotal = this.lowerDeckCount + this.upperDeckCount;
      if (curStop.students.length > 0 && currentTotal < TOTAL_BUS_CAPACITY) {
        this.boardingTimer += dt;
        if (this.boardingTimer >= 0.28) {
          this.boardingTimer = 0;
          const boarded = curStop.students.shift();
          if (boarded) {
            curStop.group.remove(boarded.root);

            // Distribute students across both Lower Deck & iconic Upper Deck!
            if (
              this.upperDeckCount < UPPER_DECK_CAPACITY &&
              (this.totalStudentsServed % 2 === 0 || this.lowerDeckCount >= LOWER_DECK_CAPACITY)
            ) {
              this.upperDeckCount++;
            } else {
              this.lowerDeckCount++;
            }

            this.totalStudentsServed++;
            this.totalFareTk += STUDENT_FARE_TK; // +5 Tk Fare!
            this.updateVisiblePassengers();
            this.audio.playFareChime(curStop.data.initialStudents - curStop.students.length);

            this.farePopupCounter++;
            this.latestFarePopup = {
              id: this.farePopupCounter,
              amount: STUDENT_FARE_TK,
              studentNumber: this.totalStudentsServed,
            };
          }
        }
      } else {
        // Stop completed! Advance to next stop on the Sylhet route!
        if (this.currentStopIndex < this.activeStopInstances.length - 1) {
          this.currentStopIndex++;
          this.updateStopBeaconVisibility();
          const nextSt = this.activeStopInstances[this.currentStopIndex];
          this.conductorMessage = `সব স্টুডেন্ট উঠছে (ভাড়া ৫ টাকা)! দরজা বন্ধ করে চলেন: ${nextSt.data.bnName}!`;
        } else {
          this.routeCompleted = true;
          this.updateStopBeaconVisibility();
          this.audio.playRouteComplete();
          this.conductorMessage =
            'আলহামদুলিল্লাহ! রুট সম্পন্ন হয়েছে ওস্তাদ! সব স্টুডেন্ট গন্তব্যে পৌঁছে গেছে!';
        }
      }
    }
  }

  private updateLandmarksAndAnimations(dt: number): void {
    // Pulse GPS chevrons along the route
    this.routeChevrons.forEach((ch) => {
      const s = 0.88 + Math.sin(this.elapsedTime * 4.5 - ch.phase) * 0.18;
      ch.mesh.scale.set(s, s, 0.08);
    });

    // Spin/pulse current bus stop sky beacon
    const curStop = this.activeStopInstances[this.currentStopIndex];
    if (curStop && curStop.beaconRing.visible) {
      curStop.beaconRing.rotation.y += dt * 1.2;
      const pulse = 1 + Math.sin(this.elapsedTime * 4) * 0.08;
      curStop.beaconRing.scale.set(pulse, 1, pulse);
    }

    // Animate Sylhet Monsoon Rain streaks around the bus
    if (this.rainPoints && this.rainPoints.visible) {
      this.rainPoints.position.set(this.busPos.x, 0, this.busPos.z);
      const attr = this.rainPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < attr.count; i++) {
        let y = attr.getY(i) - dt * 36;
        if (y < 0) y = 40;
        attr.setY(i, y);
      }
      attr.needsUpdate = true;
    }

    // Detect closest recognizable Sylhet landmark for Street-View HUD card!
    let closest: LandmarkData | null = null;
    let closestDist = Infinity;
    for (const lm of SYLHET_LANDMARKS) {
      const d = Math.hypot(this.busPos.x - lm.x, this.busPos.z - lm.z);
      if (d < lm.triggerRadius && d < closestDist) {
        closest = lm;
        closestDist = d;
      }
    }
    if (closest) {
      this.visitedLandmarks.add(closest.id);
    }
    this.nearbyLandmark = closest;
  }

  private updateCamera(dt: number): void {
    const fwdX = Math.sin(this.busHeading);
    const fwdZ = Math.cos(this.busHeading);
    const leftX = fwdZ;
    const leftZ = -fwdX;

    if (this.cameraMode === 'cockpit') {
      // 1st-Person Right-Hand-Drive BRTC Driver Cabin View!
      this.camera.position.set(
        this.busPos.x - leftX * 0.72 + fwdX * 4.75,
        this.busPos.y + 2.12,
        this.busPos.z - leftZ * 0.72 + fwdZ * 4.75
      );
      this.camera.lookAt(
        this.busPos.x - leftX * 0.55 + fwdX * 28,
        this.busPos.y + 1.92,
        this.busPos.z - leftZ * 0.55 + fwdZ * 28
      );
      return;
    }

    if (this.cameraMode === 'upper_deck') {
      // Iconic Panoramic 2nd-Floor Student Front Seat View!
      this.camera.position.set(
        this.busPos.x + leftX * 0.65 + fwdX * 5.05,
        this.busPos.y + 3.82,
        this.busPos.z + leftZ * 0.65 + fwdZ * 5.05
      );
      this.camera.lookAt(
        this.busPos.x + fwdX * 34,
        this.busPos.y + 2.6,
        this.busPos.z + fwdZ * 34
      );
      return;
    }

    const desiredPos = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();

    if (this.cameraMode === 'aerial') {
      desiredPos.set(
        this.busPos.x - fwdX * 28,
        this.busPos.y + 26,
        this.busPos.z - fwdZ * 28
      );
      desiredLook.set(
        this.busPos.x + fwdX * 14,
        this.busPos.y + 2,
        this.busPos.z + fwdZ * 14
      );
    } else {
      // Smooth 3rd-Person Bus Simulator Chase Cam
      desiredPos.set(
        this.busPos.x - fwdX * 15.8,
        this.busPos.y + 6.7,
        this.busPos.z - fwdZ * 15.8
      );
      desiredLook.set(
        this.busPos.x + fwdX * 11,
        this.busPos.y + 2.8,
        this.busPos.z + fwdZ * 11
      );
    }

    this.camCurrentPos.lerp(desiredPos, Math.min(1, dt * 6.5));
    this.camCurrentLook.lerp(desiredLook, Math.min(1, dt * 9));
    this.camera.position.copy(this.camCurrentPos);
    this.camera.lookAt(this.camCurrentLook);
  }

  private getCurrentStreetName(): string {
    let bestName = 'Sylhet City Road';
    let bestDist = Infinity;
    this.segmentsMap.forEach((seg) => {
      for (let t = 0.1; t <= 0.9; t += 0.2) {
        const p = seg.curve.getPointAt(t);
        const d = (p.x - this.busPos.x) ** 2 + (p.z - this.busPos.z) ** 2;
        if (d < bestDist) {
          bestDist = d;
          bestName = seg.data.name;
        }
      }
    });
    return bestName;
  }

  private emitHUD(): void {
    const speedKmh = Math.round(this.busSpeedMs * 3.6);
    const absKmh = Math.abs(speedKmh);
    let gear: GameHUDState['gear'] = 'N';
    if (this.busSpeedMs < -0.25) gear = 'R';
    else if (absKmh >= 42) gear = 'D4';
    else if (absKmh >= 26) gear = 'D3';
    else if (absKmh >= 12) gear = 'D2';
    else if (absKmh >= 1) gear = 'D1';

    const curStop = this.activeStopInstances[this.currentStopIndex];
    const distToStop = curStop ? Math.round(this.busPos.distanceTo(curStop.worldPos)) : 0;
    const canBoardNow = Boolean(
      curStop &&
        !this.routeCompleted &&
        distToStop < 18.5 &&
        absKmh < 7
    );

    const gps = worldToSylhetGPS(this.busPos.x, this.busPos.z);

    this.onHUDUpdate({
      speedKmh,
      gear,
      doorOpen: this.doorOpen,
      canBoardNow,
      boardingInProgress: canBoardNow && this.doorOpen && (curStop?.students.length ?? 0) > 0,
      waitingAtCurrentStop: curStop?.students.length ?? 0,
      lowerDeckCount: this.lowerDeckCount,
      upperDeckCount: this.upperDeckCount,
      totalPassengers: this.lowerDeckCount + this.upperDeckCount,
      totalFareTk: this.totalFareTk,
      totalStudentsServed: this.totalStudentsServed,
      safetyScore: this.safetyScore,
      routeId: this.currentRoute.id,
      routeCode: this.currentRoute.code,
      routeName: this.currentRoute.name,
      routeBnName: this.currentRoute.bnName,
      currentStopIndex: this.currentStopIndex,
      totalStops: this.activeStopInstances.length,
      nextStopName: curStop?.data.name ?? 'Terminal Reached',
      nextStopBnName: curStop?.data.bnName ?? 'গন্তব্যে পৌঁছেছেন',
      nextStopArea: curStop?.data.area ?? 'Sylhet',
      nextStopDistanceM: distToStop,
      routeCompleted: this.routeCompleted,
      busX: this.busPos.x,
      busZ: this.busPos.z,
      busHeading: this.busHeading,
      lat: gps.lat,
      lng: gps.lng,
      currentStreetName: this.getCurrentStreetName(),
      cameraMode: this.cameraMode,
      weatherMode: this.weatherMode,
      headlightsOn: this.headlightsOn,
      muted: this.audio.isMuted(),
      conductorMessage: this.conductorMessage,
      nearbyLandmark: this.nearbyLandmark,
      latestFarePopup: this.latestFarePopup,
    });
  }

  public dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
  }
}
