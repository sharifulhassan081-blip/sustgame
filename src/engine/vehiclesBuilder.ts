import * as THREE from 'three';
import {
  createLEDMatrixTexture,
  createRickshawArtTexture,
  createSignboardTexture,
  updateLEDMatrixCanvas,
} from './textureFactory';

export interface BRTCBusRig {
  root: THREE.Group;
  bodyGroup: THREE.Group; // pitches/rolls with suspension
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  allWheelMeshes: THREE.Object3D[];
  doorLeafA: THREE.Group;
  doorLeafB: THREE.Group;
  steeringWheel: THREE.Group;
  wiperLeft: THREE.Group;
  wiperRight: THREE.Group;
  brakeLightMat: THREE.MeshBasicMaterial;
  headlightMat: THREE.MeshBasicMaterial;
  headlightSpotL: THREE.SpotLight;
  headlightSpotR: THREE.SpotLight;
  indicatorLeftMat: THREE.MeshBasicMaterial;
  indicatorRightMat: THREE.MeshBasicMaterial;
  passengerMeshes: THREE.Object3D[];
  setLEDText: (text: string) => void;
}

function createWheel(radius: number, width: number): THREE.Group {
  const wheelGroup = new THREE.Group();
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 20);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.85 });
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  wheelGroup.add(tire);

  const rimGeo = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 14);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.65, roughness: 0.3 });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  wheelGroup.add(rim);

  // Lug nut bar so wheel rotation is visibly crisp
  const spokeGeo = new THREE.BoxGeometry(width + 0.035, radius * 0.9, radius * 0.16);
  const spokeMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4 });
  wheelGroup.add(new THREE.Mesh(spokeGeo, spokeMat));

  return wheelGroup;
}

export function createBRTCBus(initialLEDText: string): BRTCBusRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const busW = 2.66;
  const busL = 11.4;

  // Materials — Iconic Bangladesh BRTC Crimson Red + Bottle Green + Gold/White Stripe
  const redPaint = new THREE.MeshStandardMaterial({
    color: 0xc81e1e,
    roughness: 0.32,
    metalness: 0.18,
  });
  const greenPaint = new THREE.MeshStandardMaterial({
    color: 0x065f46,
    roughness: 0.36,
    metalness: 0.15,
  });
  const creamStripe = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.4,
  });
  const darkTrim = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.65,
  });
  const interiorMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.85,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.36,
    roughness: 0.08,
    metalness: 0.1,
  });

  // Chassis base
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(busW, 0.48, busL), darkTrim);
  chassis.position.set(0, 0.56, 0);
  chassis.castShadow = true;
  bodyGroup.add(chassis);

  // Lower Deck Skirt (Red) — leave doorway cutout on Left (+X) front-mid!
  const lowerRightWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, busL - 0.2), redPaint);
  lowerRightWall.position.set(-busW / 2 + 0.06, 1.18, 0);
  lowerRightWall.castShadow = true;
  bodyGroup.add(lowerRightWall);

  // Left wall behind door (door sits at z = +2.35 .. +3.65 on +X side)
  const lowerLeftRear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 7.85), redPaint);
  lowerLeftRear.position.set(busW / 2 - 0.06, 1.18, -1.68);
  lowerLeftRear.castShadow = true;
  bodyGroup.add(lowerLeftRear);

  const lowerLeftFront = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 1.9), redPaint);
  lowerLeftFront.position.set(busW / 2 - 0.06, 1.18, 4.68);
  bodyGroup.add(lowerLeftFront);

  // Stepwell inside doorway (+X, z = 3.0)
  const stepWell = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.55, 1.42),
    new THREE.MeshStandardMaterial({ color: 0x1e293b })
  );
  stepWell.position.set(busW / 2 - 0.34, 0.62, 3.0);
  bodyGroup.add(stepWell);

  // Lower Deck Floor & Upper Deck Floor Slab
  const lowerFloor = new THREE.Mesh(new THREE.BoxGeometry(busW - 0.24, 0.1, busL - 0.3), interiorMat);
  lowerFloor.position.set(0, 0.82, 0);
  bodyGroup.add(lowerFloor);

  const midBandGreen = new THREE.Mesh(new THREE.BoxGeometry(busW + 0.03, 0.44, busL + 0.02), greenPaint);
  midBandGreen.position.set(0, 2.54, 0);
  midBandGreen.castShadow = true;
  bodyGroup.add(midBandGreen);

  const goldRibbon1 = new THREE.Mesh(new THREE.BoxGeometry(busW + 0.05, 0.07, busL + 0.04), creamStripe);
  goldRibbon1.position.set(0, 2.31, 0);
  bodyGroup.add(goldRibbon1);

  const goldRibbon2 = new THREE.Mesh(new THREE.BoxGeometry(busW + 0.05, 0.07, busL + 0.04), creamStripe);
  goldRibbon2.position.set(0, 2.78, 0);
  bodyGroup.add(goldRibbon2);

  // Upper Deck Skirt (Red) below upper windows
  const upperSkirt = new THREE.Mesh(new THREE.BoxGeometry(busW, 0.52, busL - 0.1), redPaint);
  upperSkirt.position.set(0, 3.04, 0);
  upperSkirt.castShadow = true;
  bodyGroup.add(upperSkirt);

  // Upper Deck Floor
  const upperFloor = new THREE.Mesh(new THREE.BoxGeometry(busW - 0.22, 0.1, busL - 0.3), interiorMat);
  upperFloor.position.set(0, 2.78, 0);
  bodyGroup.add(upperFloor);

  // Roof Cap (Red + Green crown + AC pods)
  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(busW - 0.06, 0.26, busL - 0.12), redPaint);
  roofCap.position.set(0, 4.32, 0);
  roofCap.castShadow = true;
  bodyGroup.add(roofCap);

  const roofCrown = new THREE.Mesh(new THREE.BoxGeometry(busW - 0.45, 0.12, busL - 1.2), greenPaint);
  roofCrown.position.set(0, 4.48, -0.1);
  bodyGroup.add(roofCrown);

  // Front & Rear Walls with Window Cutouts
  const rearLower = new THREE.Mesh(new THREE.BoxGeometry(busW, 1.9, 0.14), redPaint);
  rearLower.position.set(0, 1.55, -busL / 2 + 0.07);
  bodyGroup.add(rearLower);

  const rearUpper = new THREE.Mesh(new THREE.BoxGeometry(busW, 0.65, 0.14), redPaint);
  rearUpper.position.set(0, 4.02, -busL / 2 + 0.07);
  bodyGroup.add(rearUpper);

  // Front Bumper & Lower Apron
  const frontApron = new THREE.Mesh(new THREE.BoxGeometry(busW + 0.04, 0.92, 0.22), redPaint);
  frontApron.position.set(0, 1.02, busL / 2 - 0.08);
  bodyGroup.add(frontApron);

  const frontGrille = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.42, 0.26), darkTrim);
  frontGrille.position.set(0, 0.95, busL / 2 - 0.06);
  bodyGroup.add(frontGrille);

  // Window Pillars along Lower & Upper Decks
  const pillarPositions = [-5.55, -4.1, -2.65, -1.2, 0.25, 1.7, 3.85, 5.55];
  pillarPositions.forEach((pz) => {
    [-busW / 2 + 0.06, busW / 2 - 0.06].forEach((px) => {
      // Skip pillar inside boarding doorway on +X
      if (px > 0 && pz > 2.0 && pz < 3.7) return;
      const pLow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.92, 0.14), redPaint);
      pLow.position.set(px, 1.98, pz);
      bodyGroup.add(pLow);
    });
    [-busW / 2 + 0.06, busW / 2 - 0.06].forEach((px) => {
      const pUp = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.96, 0.14), redPaint);
      pUp.position.set(px, 3.74, pz);
      bodyGroup.add(pUp);
    });
  });

  // Tinted Glass Panes (Side & Front/Rear)
  const sideGlassLowR = new THREE.Mesh(new THREE.PlaneGeometry(busL - 0.4, 0.88), glassMat);
  sideGlassLowR.rotation.y = -Math.PI / 2;
  sideGlassLowR.position.set(-busW / 2 - 0.01, 1.96, 0);
  bodyGroup.add(sideGlassLowR);

  const sideGlassLowL = new THREE.Mesh(new THREE.PlaneGeometry(7.7, 0.88), glassMat);
  sideGlassLowL.rotation.y = Math.PI / 2;
  sideGlassLowL.position.set(busW / 2 + 0.01, 1.96, -1.7);
  bodyGroup.add(sideGlassLowL);

  const sideGlassUpR = new THREE.Mesh(new THREE.PlaneGeometry(busL - 0.3, 0.94), glassMat);
  sideGlassUpR.rotation.y = -Math.PI / 2;
  sideGlassUpR.position.set(-busW / 2 - 0.01, 3.74, 0);
  bodyGroup.add(sideGlassUpR);

  const sideGlassUpL = new THREE.Mesh(new THREE.PlaneGeometry(busL - 0.3, 0.94), glassMat);
  sideGlassUpL.rotation.y = Math.PI / 2;
  sideGlassUpL.position.set(busW / 2 + 0.01, 3.74, 0);
  bodyGroup.add(sideGlassUpL);

  // Front Windshields (Lower Cockpit + Upper Panoramic Deck!)
  const frontWindshieldLow = new THREE.Mesh(new THREE.PlaneGeometry(busW - 0.24, 0.98), glassMat);
  frontWindshieldLow.position.set(0, 1.96, busL / 2 + 0.01);
  bodyGroup.add(frontWindshieldLow);

  const frontWindshieldUp = new THREE.Mesh(new THREE.PlaneGeometry(busW - 0.24, 0.96), glassMat);
  frontWindshieldUp.position.set(0, 3.68, busL / 2 + 0.01);
  bodyGroup.add(frontWindshieldUp);

  // Warm Interior Cabin Glow (makes both decks look alive!)
  const cabinGlowLow = new THREE.PointLight(0xfef08a, 1.2, 7);
  cabinGlowLow.position.set(0, 2.15, 0);
  bodyGroup.add(cabinGlowLow);

  const cabinGlowUp = new THREE.PointLight(0xfef08a, 1.2, 7);
  cabinGlowUp.position.set(0, 4.05, 0.5);
  bodyGroup.add(cabinGlowUp);

  // Side BRTC Livery Signboards
  const sideBannerTex = createSignboardTexture('brtc_side_banner', {
    bg: '#065f46',
    bgBottom: '#047857',
    border: '#facc15',
    bnText: 'বিআরটিসি ডাবল ডেকার • শাবিপ্রবি - সিলেট সিটি সার্ভিস',
    title: 'BRTC SYLHET • STUDENT FARE 5 TK',
    textColor: '#ffffff',
    accentColor: '#fde047',
    width: 1024,
    height: 160,
  });
  const bannerMat = new THREE.MeshBasicMaterial({ map: sideBannerTex });

  const bannerLeft = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 0.42), bannerMat);
  bannerLeft.rotation.y = Math.PI / 2;
  bannerLeft.position.set(busW / 2 + 0.025, 2.54, -1.4);
  bodyGroup.add(bannerLeft);

  const bannerRight = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 0.42), bannerMat);
  bannerRight.rotation.y = -Math.PI / 2;
  bannerRight.position.set(-busW / 2 - 0.025, 2.54, 0);
  bodyGroup.add(bannerRight);

  // Rear BRTC Sign
  const rearSignTex = createSignboardTexture('brtc_rear_banner', {
    bg: '#991b1b',
    border: '#fde047',
    bnText: 'বিআরটিসি সিলেট • স্টুডেন্ট ভাড়া ৫ টাকা',
    title: 'KEEP SAFE DISTANCE • BRTC',
    width: 512,
    height: 180,
  });
  const rearBanner = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 0.58),
    new THREE.MeshBasicMaterial({ map: rearSignTex })
  );
  rearBanner.rotation.y = Math.PI;
  rearBanner.position.set(0, 2.55, -busL / 2 - 0.02);
  bodyGroup.add(rearBanner);

  // Dynamic Digital LED Destination Boards (Front Forehead + Left Boarding Side!)
  const ledTex = createLEDMatrixTexture(initialLEDText);
  const ledCanvas = ledTex.image as HTMLCanvasElement;
  const ledMat = new THREE.MeshBasicMaterial({ map: ledTex });

  const frontLED = new THREE.Mesh(new THREE.PlaneGeometry(2.28, 0.30), ledMat);
  frontLED.position.set(0, 4.26, busL / 2 + 0.02);
  bodyGroup.add(frontLED);

  const sideLED = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.26), ledMat);
  sideLED.rotation.y = Math.PI / 2;
  sideLED.position.set(busW / 2 + 0.03, 2.54, 4.35);
  bodyGroup.add(sideLED);

  // Left-Side (+X) Pneumatic Folding Passenger Door (z = 2.35 .. 3.65)
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
  const doorLeafA = new THREE.Group();
  doorLeafA.position.set(busW / 2 - 0.04, 1.56, 3.62);
  const leafMeshA = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.72, 0.62), doorMat);
  leafMeshA.position.set(0, 0, -0.31);
  doorLeafA.add(leafMeshA);
  bodyGroup.add(doorLeafA);

  const doorLeafB = new THREE.Group();
  doorLeafB.position.set(busW / 2 - 0.04, 1.56, 2.38);
  const leafMeshB = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.72, 0.62), doorMat);
  leafMeshB.position.set(0, 0, 0.31);
  doorLeafB.add(leafMeshB);
  bodyGroup.add(doorLeafB);

  // Right-Hand-Drive (-X) Driver Cockpit & Animated Steering Wheel
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.42, 0.58),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 })
  );
  dash.position.set(-0.66, 1.38, busL / 2 - 0.42);
  bodyGroup.add(dash);

  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(-0.72, 1.66, busL / 2 - 0.62);
  steeringWheel.rotation.x = -0.68;
  const wheelRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.025, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0x1e293b })
  );
  const wheelBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.03, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x475569 })
  );
  steeringWheel.add(wheelRing, wheelBar);
  bodyGroup.add(steeringWheel);

  // Side Mirrors
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.05), darkTrim);
    arm.position.set(side * (busW / 2 + 0.14), 2.18, busL / 2 - 0.15);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.18), darkTrim);
    mirror.position.set(side * (busW / 2 + 0.28), 2.08, busL / 2 - 0.12);
    bodyGroup.add(arm, mirror);
  });

  // Animated Windshield Wipers (for Sylhet Rain!)
  const wiperMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const wiperLeft = new THREE.Group();
  wiperLeft.position.set(0.55, 1.50, busL / 2 + 0.03);
  const bladeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.68, 0.02), wiperMat);
  bladeL.position.y = 0.34;
  wiperLeft.add(bladeL);
  bodyGroup.add(wiperLeft);

  const wiperRight = new THREE.Group();
  wiperRight.position.set(-0.55, 1.50, busL / 2 + 0.03);
  const bladeR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.68, 0.02), wiperMat);
  bladeR.position.y = 0.34;
  wiperRight.add(bladeR);
  bodyGroup.add(wiperRight);

  // Seats & Visible 3D Student Passengers on BOTH Lower & Upper Decks!
  const passengerMeshes: THREE.Object3D[] = [];
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.7 });
  const shirtColors = [0xef4444, 0x10b981, 0xf59e0b, 0x3b82f6, 0xa855f7, 0xec4899, 0x14b8a6, 0xf97316];
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd99b66, roughness: 0.7 });

  let colorIdx = 0;
  // Upper Deck rows (most iconic visible seats!) + Lower Deck rows
  [
    { deckY: 2.84, zRows: [4.6, 3.5, 2.4, 1.3, 0.2, -0.9, -2.0, -3.1, -4.2] },
    { deckY: 0.88, zRows: [1.3, 0.2, -0.9, -2.0, -3.1, -4.2] },
  ].forEach(({ deckY, zRows }) => {
    zRows.forEach((rz) => {
      [-0.86, 0.86].forEach((rx) => {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.48, 0.42), seatMat);
        seat.position.set(rx, deckY + 0.26, rz);
        bodyGroup.add(seat);

        // Seated miniature student figure
        const pGroup = new THREE.Group();
        pGroup.position.set(rx, deckY + 0.48, rz + 0.04);
        const torso = new THREE.Mesh(
          new THREE.BoxGeometry(0.36, 0.42, 0.24),
          new THREE.MeshStandardMaterial({ color: shirtColors[colorIdx % shirtColors.length] })
        );
        torso.position.y = 0.2;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), skinMat);
        head.position.y = 0.52;
        pGroup.add(torso, head);
        pGroup.visible = false;
        bodyGroup.add(pGroup);
        passengerMeshes.push(pGroup);
        colorIdx++;
      });
    });
  });

  // Headlights, Tail/Brake Lights & Turn Indicators
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });
  [-0.96, 0.96].forEach((hx) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.20, 0.06), headlightMat);
    hl.position.set(hx, 1.02, busL / 2 + 0.03);
    bodyGroup.add(hl);
  });

  const headlightSpotL = new THREE.SpotLight(0xfffbeb, 0, 52, Math.PI / 5, 0.45, 1.2);
  headlightSpotL.position.set(0.9, 1.1, busL / 2);
  headlightSpotL.target.position.set(0.9, 0.1, busL / 2 + 28);
  bodyGroup.add(headlightSpotL, headlightSpotL.target);

  const headlightSpotR = new THREE.SpotLight(0xfffbeb, 0, 52, Math.PI / 5, 0.45, 1.2);
  headlightSpotR.position.set(-0.9, 1.1, busL / 2);
  headlightSpotR.target.position.set(-0.9, 0.1, busL / 2 + 28);
  bodyGroup.add(headlightSpotR, headlightSpotR.target);

  const brakeLightMat = new THREE.MeshBasicMaterial({ color: 0x991b1b });
  [-1.02, 1.02].forEach((bx) => {
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.06), brakeLightMat);
    bl.position.set(bx, 1.12, -busL / 2 - 0.02);
    bodyGroup.add(bl);
  });

  const indicatorLeftMat = new THREE.MeshBasicMaterial({ color: 0x451a03 });
  const indicatorRightMat = new THREE.MeshBasicMaterial({ color: 0x451a03 });
  [busL / 2 + 0.03, -busL / 2 - 0.02].forEach((iz) => {
    const indL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.06), indicatorLeftMat);
    indL.position.set(1.16, 1.32, iz);
    const indR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.06), indicatorRightMat);
    indR.position.set(-1.16, 1.32, iz);
    bodyGroup.add(indL, indR);
  });

  // 6 Rotating Wheels (Front Steerable Axle + Dual Rear Axles)
  const allWheelMeshes: THREE.Object3D[] = [];
  const wheelRadius = 0.54;
  const wheelWidth = 0.32;

  const frontLeftWheel = new THREE.Group();
  frontLeftWheel.position.set(busW / 2 - 0.14, wheelRadius, 3.65);
  const flMesh = createWheel(wheelRadius, wheelWidth);
  frontLeftWheel.add(flMesh);
  root.add(frontLeftWheel);
  allWheelMeshes.push(flMesh);

  const frontRightWheel = new THREE.Group();
  frontRightWheel.position.set(-busW / 2 + 0.14, wheelRadius, 3.65);
  const frMesh = createWheel(wheelRadius, wheelWidth);
  frontRightWheel.add(frMesh);
  root.add(frontRightWheel);
  allWheelMeshes.push(frMesh);

  [-2.55, -3.85].forEach((rz) => {
    [busW / 2 - 0.14, -busW / 2 + 0.14].forEach((rx) => {
      const rw = createWheel(wheelRadius, wheelWidth);
      rw.position.set(rx, wheelRadius, rz);
      root.add(rw);
      allWheelMeshes.push(rw);
    });
  });

  return {
    root,
    bodyGroup,
    frontLeftWheel,
    frontRightWheel,
    allWheelMeshes,
    doorLeafA,
    doorLeafB,
    steeringWheel,
    wiperLeft,
    wiperRight,
    brakeLightMat,
    headlightMat,
    headlightSpotL,
    headlightSpotR,
    indicatorLeftMat,
    indicatorRightMat,
    passengerMeshes,
    setLEDText: (text: string) => {
      updateLEDMatrixCanvas(ledCanvas, text);
      ledTex.needsUpdate = true;
    },
  };
}

export interface TrafficRig {
  root: THREE.Group;
  kind: 'rickshaw' | 'cng';
  wheels: THREE.Object3D[];
  pedalLegL?: THREE.Object3D;
  pedalLegR?: THREE.Object3D;
}

/** Authentic Sylheti 3-Wheel Cycle Rickshaw with Colorful Folk Art Hood & Pedaling Puller */
export function createRickshaw(variant: number): TrafficRig {
  const root = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  const thinWheel = (r: number) => {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.032, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    tire.rotation.y = Math.PI / 2;
    const hub = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, r * 1.85, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.6 })
    );
    const hub2 = hub.clone();
    hub2.rotation.x = Math.PI / 2;
    g.add(tire, hub, hub2);
    return g;
  };

  const wFront = thinWheel(0.36);
  wFront.position.set(0, 0.36, 0.96);
  const wRearL = thinWheel(0.38);
  wRearL.position.set(0.52, 0.38, -0.62);
  const wRearR = thinWheel(0.38);
  wRearR.position.set(-0.52, 0.38, -0.62);
  root.add(wFront, wRearL, wRearR);
  wheels.push(wFront, wRearL, wRearR);

  // Frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, 1.55), frameMat);
  spine.position.set(0, 0.44, 0.15);
  root.add(spine);

  // Passenger carriage & folk-art hood
  const artTex = createRickshawArtTexture(variant);
  const hoodColors = [0xe11d48, 0x2563eb, 0xf59e0b, 0x9333ea];
  const hoodColor = hoodColors[variant % hoodColors.length];
  const hoodMat = new THREE.MeshStandardMaterial({ color: hoodColor, roughness: 0.45 });

  const seatBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.96, 0.22, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x0284c7 })
  );
  seatBase.position.set(0, 0.68, -0.58);
  seatBase.castShadow = true;
  root.add(seatBase);

  // Backrest with Rickshaw Folk Art!
  const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.98, 0.68, 0.08),
    new THREE.MeshBasicMaterial({ map: artTex })
  );
  backPanel.position.set(0, 1.08, -0.92);
  root.add(backPanel);

  // Arched Hood Canopy
  const hoodTop = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.98, 12, 1, false, 0, Math.PI), hoodMat);
  hoodTop.rotation.z = Math.PI / 2;
  hoodTop.position.set(0, 1.38, -0.58);
  hoodTop.castShadow = true;
  root.add(hoodTop);

  // Seated Passenger inside Rickshaw
  const passTorso = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.42, 0.24),
    new THREE.MeshStandardMaterial({ color: variant % 2 === 0 ? 0xfef08a : 0x38bdf8 })
  );
  passTorso.position.set(0, 1.0, -0.62);
  const passHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xd99b66 })
  );
  passHead.position.set(0, 1.32, -0.62);
  root.add(passTorso, passHead);

  // Rickshaw Puller (রিকশাওয়ালা) with animated pedaling legs!
  const pullerShirts = [0x10b981, 0xf97316, 0x3b82f6, 0xeab308];
  const pullerTorso = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.46, 0.22),
    new THREE.MeshStandardMaterial({ color: pullerShirts[variant % 4] })
  );
  pullerTorso.position.set(0, 1.12, 0.36);
  pullerTorso.rotation.x = 0.22;
  pullerTorso.castShadow = true;

  const pullerHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xc68642 })
  );
  pullerHead.position.set(0, 1.44, 0.42);

  // Handlebars
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.04), frameMat);
  handle.position.set(0, 1.06, 0.82);
  const fork = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.06), frameMat);
  fork.position.set(0, 0.72, 0.89);
  fork.rotation.x = -0.2;

  const lungiMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a });
  const pedalLegL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.14), lungiMat);
  pedalLegL.position.set(0.12, 0.72, 0.36);
  const pedalLegR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.14), lungiMat);
  pedalLegR.position.set(-0.12, 0.72, 0.36);

  root.add(pullerTorso, pullerHead, handle, fork, pedalLegL, pedalLegR);

  return {
    root,
    kind: 'rickshaw',
    wheels,
    pedalLegL,
    pedalLegR,
  };
}

/** Authentic Sylheti Emerald-Green CNG Auto-Rickshaw with Protective Grill Doors */
export function createCNG(): TrafficRig {
  const root = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  const cngGreen = new THREE.MeshStandardMaterial({
    color: 0x047857,
    roughness: 0.35,
    metalness: 0.2,
  });
  const canvasRoofMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
  });
  const grillMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    metalness: 0.7,
    roughness: 0.3,
  });

  const makeSmallWheel = () => {
    const w = createWheel(0.26, 0.14);
    return w;
  };

  const wf = makeSmallWheel();
  wf.position.set(0, 0.26, 1.05);
  const wrL = makeSmallWheel();
  wrL.position.set(0.58, 0.26, -0.82);
  const wrR = makeSmallWheel();
  wrR.position.set(-0.58, 0.26, -0.82);
  root.add(wf, wrL, wrR);
  wheels.push(wf, wrL, wrR);

  // Lower Green Tub & Front Cowl
  const rearTub = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.66, 1.55), cngGreen);
  rearTub.position.set(0, 0.58, -0.35);
  rearTub.castShadow = true;
  root.add(rearTub);

  const frontCowl = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.68, 0.72), cngGreen);
  frontCowl.position.set(0, 0.60, 0.68);
  frontCowl.castShadow = true;
  root.add(frontCowl);

  // Front mudguard + round headlight
  const fender = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.42), cngGreen);
  fender.position.set(0, 0.48, 1.05);
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14),
    new THREE.MeshBasicMaterial({ color: 0xfef08a })
  );
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(0, 0.74, 1.06);
  root.add(fender, lamp);

  // Windshield
  const ws = new THREE.Mesh(
    new THREE.BoxGeometry(0.94, 0.56, 0.05),
    new THREE.MeshPhysicalMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.45 })
  );
  ws.position.set(0, 1.18, 0.86);
  ws.rotation.x = -0.22;
  root.add(ws);

  // Black Canvas Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.16, 2.02), canvasRoofMat);
  roof.position.set(0, 1.62, -0.05);
  roof.castShadow = true;
  root.add(roof);

  const rearBack = new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.78, 0.10), canvasRoofMat);
  rearBack.position.set(0, 1.22, -1.06);
  root.add(rearBack);

  // Yellow Commercial Sylhet Number Plate on Rear
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  plate.rotation.y = Math.PI;
  plate.position.set(0, 0.62, -1.14);
  root.add(plate);

  // Iconic Metal Safety Cage Grills on Both Sides!
  [-0.64, 0.64].forEach((gx) => {
    for (let z = -0.85; z <= 0.65; z += 0.36) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.72, 0.03), grillMat);
      bar.position.set(gx, 1.24, z);
      root.add(bar);
    }
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 1.62), grillMat);
    hBar.position.set(gx, 1.18, -0.1);
    root.add(hBar);
  });

  return {
    root,
    kind: 'cng',
    wheels,
  };
}

export interface StudentActor {
  root: THREE.Group;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armR: THREE.Object3D;
  phase: number;
  targetBoarding: boolean;
}

/** Animated SUST / Sylhet College Student with Backpack & ID Card */
export function createStudentFigure(seed: number): StudentActor {
  const root = new THREE.Group();

  const outfits = [
    { top: 0xdc2626, bottom: 0x1e293b, bag: 0x0f172a }, // SUST red hoodie
    { top: 0x059669, bottom: 0x1e3a8a, bag: 0x334155 }, // Green t-shirt + jeans
    { top: 0x2563eb, bottom: 0x0f172a, bag: 0xb45309 }, // Blue shirt
    { top: 0xdb2777, bottom: 0xfef08a, bag: 0x4c1d95 }, // Salwar kameez
    { top: 0x7c3aed, bottom: 0xf8fafc, bag: 0x1e293b }, // Purple kurti/shirt
    { top: 0xea580c, bottom: 0x1e293b, bag: 0x064e3b }, // Orange polo
  ];
  const style = outfits[seed % outfits.length];
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd29564, roughness: 0.7 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });

  const legMat = new THREE.MeshStandardMaterial({ color: style.bottom });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.15), legMat);
  legL.position.set(0.09, 0.28, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.15), legMat);
  legR.position.set(-0.09, 0.28, 0);

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.52, 0.22),
    new THREE.MeshStandardMaterial({ color: style.top })
  );
  torso.position.set(0, 0.82, 0);
  torso.castShadow = true;

  // White SUST / College Student ID Lanyard on chest!
  const idCard = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.11),
    new THREE.MeshBasicMaterial({ color: 0xf8fafc })
  );
  idCard.position.set(0, 0.78, 0.12);

  // Backpack
  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.38, 0.16),
    new THREE.MeshStandardMaterial({ color: style.bag })
  );
  backpack.position.set(0, 0.84, -0.17);

  // Head + Hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), skinMat);
  head.position.set(0, 1.24, 0);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.146, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
  hair.position.set(0, 1.25, -0.01);

  // Waving right arm
  const armR = new THREE.Group();
  armR.position.set(-0.23, 1.02, 0);
  const armMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.42, 0.10),
    new THREE.MeshStandardMaterial({ color: style.top })
  );
  armMesh.position.y = -0.18;
  armR.add(armMesh);

  const armL = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.42, 0.10),
    new THREE.MeshStandardMaterial({ color: style.top })
  );
  armL.position.set(0.23, 0.84, 0);

  root.add(legL, legR, torso, idCard, backpack, head, hair, armR, armL);

  return {
    root,
    legL,
    legR,
    armR,
    phase: (seed * 1.37) % (Math.PI * 2),
    targetBoarding: false,
  };
}
