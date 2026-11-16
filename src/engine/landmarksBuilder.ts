import * as THREE from 'three';
import { LandmarkData } from '../data/sylhetWorldData';
import {
  createBuildingFacadeTexture,
  createGlassCurtainTexture,
  createSignboardTexture,
} from './textureFactory';

function makeSignMesh(
  key: string,
  w: number,
  h: number,
  opts: Parameters<typeof createSignboardTexture>[1],
  doubleSided = false
): THREE.Group {
  const tex = createSignboardTexture(key, opts);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.FrontSide,
  });
  const holder = new THREE.Group();
  const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  holder.add(front);

  if (doubleSided) {
    const backPlate = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x0f172a })
    );
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    back.rotation.y = Math.PI;
    back.position.z = -0.05;
    front.position.z = 0.05;
    holder.add(backPlate, back);
  }
  return holder;
}

/** Roadside Pylon Sign right near the curb so drivers spot key landmarks from afar! */
function makeRoadsidePylon(
  key: string,
  title: string,
  bnText: string,
  bg: string,
  accent: string,
  badge?: 'hospital' | 'shwapno' | 'sust'
): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.16, 6.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 })
  );
  pole.position.y = 3.1;
  g.add(pole);

  const board = makeSignMesh(
    `pylon_${key}`,
    4.6,
    1.7,
    {
      bg,
      border: accent,
      bnText,
      title,
      accentColor: accent,
      badge,
      width: 640,
      height: 240,
    },
    true
  );
  board.position.y = 5.8;
  board.rotation.y = Math.PI / 2; // Readable when approaching from BOTH directions along the street!
  g.add(board);
  return g;
}

export function buildLandmarkMesh(lm: LandmarkData): THREE.Group {
  const group = new THREE.Group();
  group.position.set(lm.x, 0, lm.z);
  group.rotation.y = lm.rotationY;

  switch (lm.kind) {
    case 'mount_adora': {
      // Iconic 11-Story White & Sky-Blue Glass Hospital Complex in Akhalia!
      const glassTex = createGlassCurtainTexture('#0369a1', '#e0f2fe');
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
      const tealAccent = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });

      const mainTower = new THREE.Mesh(
        new THREE.BoxGeometry(28, 34, 18),
        new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.2, metalness: 0.25 })
      );
      mainTower.position.set(0, 17, -4);
      mainTower.castShadow = true;
      group.add(mainTower);

      // White architectural vertical fins & side wing
      [-14.1, 0, 14.1].forEach((fx) => {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 34.6, 18.6), whiteMat);
        fin.position.set(fx, 17.3, -4);
        group.add(fin);
      });

      const crown = new THREE.Mesh(new THREE.BoxGeometry(29.2, 2.2, 19.2), tealAccent);
      crown.position.set(0, 34.8, -4);
      group.add(crown);

      // Huge Rooftop + Front Facade Signboard: MOUNT ADORA HOSPITAL
      const roofSign = makeSignMesh(
        'sign_mount_adora_main',
        26,
        4.6,
        {
          bg: '#0f172a',
          bgBottom: '#0c4a6e',
          border: '#38bdf8',
          bnText: 'মাউন্ট অ্যাডোরা হাসপাতাল, আখালিয়া, সিলেট',
          title: 'MOUNT ADORA HOSPITAL',
          subtitle: '24/7 EMERGENCY • ICU • DIAGNOSTIC & SPECIALIST CENTER',
          accentColor: '#38bdf8',
          badge: 'hospital',
        },
        true
      );
      roofSign.position.set(0, 38.2, 4.5);
      group.add(roofSign);

      // Emergency Canopy & Red Cross
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(13, 1.1, 6.5),
        new THREE.MeshStandardMaterial({ color: 0xdc2626 })
      );
      canopy.position.set(0, 4.6, 7.5);
      group.add(canopy);

      const emergSign = makeSignMesh('sign_adora_emerg', 11.5, 1.3, {
        bg: '#b91c1c',
        border: '#fef08a',
        title: 'EMERGENCY 24/7 • জরুরি বিভাগ',
        accentColor: '#ffffff',
      });
      emergSign.position.set(0, 5.4, 10.8);
      group.add(emergSign);

      // Parked Hospital Ambulance out front!
      const amb = new THREE.Group();
      amb.position.set(8.5, 0, 11.5);
      amb.rotation.y = 0.35;
      const ambBody = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 2.1, 4.6),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      ambBody.position.y = 1.3;
      const ambStripe = new THREE.Mesh(
        new THREE.BoxGeometry(2.14, 0.38, 4.62),
        new THREE.MeshBasicMaterial({ color: 0xe11d48 })
      );
      ambStripe.position.y = 1.15;
      const siren = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.22, 0.35),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      siren.position.set(0, 2.45, 1.4);
      amb.add(ambBody, ambStripe, siren);
      group.add(amb);

      // Curbside Hospital Pylon Sign
      const pylon = makeRoadsidePylon(
        'adora_curb',
        'MOUNT ADORA HOSPITAL',
        'মাউন্ট অ্যাডোরা হাসপাতাল',
        '#0c4a6e',
        '#38bdf8',
        'hospital'
      );
      pylon.position.set(-15, 0, 17);
      group.add(pylon);
      break;
    }

    case 'shwapno_tower':
    case 'shwapno_outlet': {
      const isTower = lm.kind === 'shwapno_tower';
      const towerH = isTower ? 27 : 12;
      const towerW = isTower ? 24 : 18;

      // Sunrise Tower / Commercial Building above Shwapno Super Shop
      const facadeTex = createBuildingFacadeTexture(77, isTower ? '#e2e8f0' : '#fef2f2');
      const upperBlock = new THREE.Mesh(
        new THREE.BoxGeometry(towerW, towerH - 5.5, 15),
        new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.55 })
      );
      upperBlock.position.set(0, 5.5 + (towerH - 5.5) / 2, -2);
      upperBlock.castShadow = true;
      group.add(upperBlock);

      if (isTower) {
        const towerTopSign = makeSignMesh(
          'sunrise_tower_sign',
          18,
          2.6,
          {
            bg: '#1e293b',
            border: '#facc15',
            bnText: 'সানরাইজ টাওয়ার • পাঠানটুলা, সিলেট',
            title: 'SUNRISE TOWER',
            accentColor: '#fde047',
          },
          true
        );
        towerTopSign.position.set(0, towerH + 1.4, 5.2);
        group.add(towerTopSign);
      }

      // Ground + Mezzanine Bright Red SHWAPNO Super Shop Storefront!
      const shwapnoRed = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.3 });
      const baseStore = new THREE.Mesh(new THREE.BoxGeometry(towerW + 0.6, 5.6, 16.2), shwapnoRed);
      baseStore.position.set(0, 2.8, -1.5);
      group.add(baseStore);

      // Lit Grocery Storefront Glass Display Windows
      const displayGlass = new THREE.Mesh(
        new THREE.PlaneGeometry(towerW - 2.4, 3.2),
        new THREE.MeshBasicMaterial({ color: 0xfef9c3 })
      );
      displayGlass.position.set(0, 1.9, 6.65);
      group.add(displayGlass);

      // Colorful Grocery Aisles visible inside!
      [-6, -2, 2, 6].forEach((ax, i) => {
        if (Math.abs(ax) > towerW / 2 - 2) return;
        const shelf = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 2.1, 0.4),
          new THREE.MeshBasicMaterial({
            color: [0x16a34a, 0xf97316, 0x0284c7, 0x9333ea][i % 4],
          })
        );
        shelf.position.set(ax, 1.5, 6.55);
        group.add(shelf);
      });

      // Signature Crimson & Yellow SHWAPNO Fascia Banner!
      const shwapnoSign = makeSignMesh(
        `shwapno_fascia_${lm.id}`,
        towerW + 0.8,
        2.5,
        {
          bg: '#dc2626',
          bgBottom: '#b91c1c',
          border: '#facc15',
          bnText: 'স্বপ্ন সুপার শপ • ফ্যামিলি গ্রোসারি ও ডিপার্টমেন্টাল স্টোর',
          title: 'SHWAPNO SUPER SHOP',
          subtitle: isTower
            ? 'SUNRISE TOWER • PATHANTULA, SYLHET'
            : 'FRESH GROCERY • DAILY NEEDS • SYLHET OUTLET',
          accentColor: '#fde047',
          badge: 'shwapno',
        },
        true
      );
      shwapnoSign.position.set(0, 5.4, 6.72);
      group.add(shwapnoSign);

      // Perpendicular Roadside Pylon Sign so drivers clearly see SHWAPNO approaching along the road!
      const pylon = makeRoadsidePylon(
        `shwapno_${lm.id}`,
        'SHWAPNO • স্বপ্ন',
        'স্বপ্ন সুপার শপ',
        '#dc2626',
        '#facc15',
        'shwapno'
      );
      pylon.position.set(towerW / 2 - 1, 0, 12.5);
      group.add(pylon);
      break;
    }

    case 'sust_campus': {
      // SUST Gol Chattar Island + Iconic Chetona '71 Sculpture + Red-Brick Academic Buildings!
      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(9.5, 10.5, 0.9, 24),
        new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7 })
      );
      plinth.position.y = 0.45;
      group.add(plinth);

      const grass = new THREE.Mesh(
        new THREE.CylinderGeometry(8.8, 8.8, 0.25, 24),
        new THREE.MeshStandardMaterial({ color: 0x15803d })
      );
      grass.position.y = 0.95;
      group.add(grass);

      // Chetona '71 Pedestal & Heroic Bronze Figures holding Flag
      const ped = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 3.8, 3.6),
        new THREE.MeshStandardMaterial({ color: 0x7f1d1d })
      );
      ped.position.y = 2.8;
      group.add(ped);

      const bronzeMat = new THREE.MeshStandardMaterial({
        color: 0x78350f,
        metalness: 0.55,
        roughness: 0.35,
      });
      const fig1 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 3.6, 10), bronzeMat);
      fig1.position.set(-0.45, 6.2, 0);
      const fig2 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 3.3, 10), bronzeMat);
      fig2.position.set(0.55, 6.0, 0.15);
      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.8, 8), bronzeMat);
      flagPole.position.set(-0.1, 7.8, 0);
      const bdFlag = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 1.15),
        new THREE.MeshBasicMaterial({ color: 0x047857, side: THREE.DoubleSide })
      );
      bdFlag.position.set(0.85, 9.5, 0);
      group.add(fig1, fig2, flagPole, bdFlag);

      // Red-Brick SUST Academic Buildings behind Gol Chattar!
      [-34, 0, 34].forEach((bx, idx) => {
        const brick = new THREE.Mesh(
          new THREE.BoxGeometry(24, 15, 14),
          new THREE.MeshStandardMaterial({
            map: createBuildingFacadeTexture(200 + idx, '#9a3412'),
            roughness: 0.7,
          })
        );
        brick.position.set(bx, 7.5, -38);
        brick.castShadow = true;
        group.add(brick);
      });

      const sustBanner = makeSignMesh(
        'sust_campus_sign',
        26,
        3.6,
        {
          bg: '#064e3b',
          border: '#facc15',
          bnText: 'শাহজালাল বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়, সিলেট',
          title: 'SUST CAMPUS • CHETONA \'71 SQUARE',
          subtitle: 'STARTING TERMINAL • BRTC STUDENT DOUBLE-DECKER (5 TK)',
          badge: 'sust',
        },
        true
      );
      sustBanner.position.set(0, 17.2, -30.5);
      group.add(sustBanner);
      break;
    }

    case 'sust_gate': {
      // Iconic SUST Main Gate Arch at the entrance of 1-Km Road on Sylhet-Sunamganj Hwy!
      const whitePillarMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
      const brickAccentMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.55 });

      [-10.5, 10.5].forEach((px) => {
        const col = new THREE.Mesh(new THREE.BoxGeometry(2.6, 10.5, 2.8), whitePillarMat);
        col.position.set(px, 5.25, -4);
        col.castShadow = true;
        const innerBrick = new THREE.Mesh(new THREE.BoxGeometry(1.1, 9.2, 3.1), brickAccentMat);
        innerBrick.position.set(px * 0.88, 4.6, -4);
        group.add(col, innerBrick);
      });

      // Overhead Arch Beam spanning across Kilo Road!
      const archBeam = new THREE.Mesh(new THREE.BoxGeometry(25.5, 2.8, 3.0), whitePillarMat);
      archBeam.position.set(0, 10.2, -4);
      archBeam.castShadow = true;
      group.add(archBeam);

      const gateSignFront = makeSignMesh(
        'sust_main_gate_arch',
        23.5,
        2.3,
        {
          bg: '#065f46',
          bgBottom: '#047857',
          border: '#fde047',
          bnText: 'শাহজালাল বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়, সিলেট',
          title: 'SHAHJALAL UNIVERSITY OF SCIENCE & TECHNOLOGY',
          badge: 'sust',
        },
        true
      );
      gateSignFront.position.set(0, 10.25, -4);
      group.add(gateSignFront);
      break;
    }

    case 'bgb_gate': {
      // BGB Sector Headquarters Gate & Boundary Wall in Akhalia
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.65 });
      const wall = new THREE.Mesh(new THREE.BoxGeometry(36, 3.2, 0.8), wallMat);
      wall.position.set(0, 1.6, 6);
      group.add(wall);

      const gateArch = new THREE.Mesh(new THREE.BoxGeometry(12, 7.2, 2.2), wallMat);
      gateArch.position.set(0, 3.6, 5.5);
      group.add(gateArch);

      const bgbSign = makeSignMesh('bgb_akhalia_sign', 11.4, 2.1, {
        bg: '#14532d',
        border: '#facc15',
        bnText: 'বর্ডার গার্ড বাংলাদেশ (বিজিবি) সিলেট সেক্টর, আখালিয়া',
        title: 'BGB SYLHET SECTOR • AKHALIA',
      });
      bgbSign.position.set(0, 6.2, 6.68);
      group.add(bgbSign);
      break;
    }

    case 'madina_market': {
      // Bustling Multi-Building Madina Market Complex + Walton Showroom + Islami Bank + Bazaar!
      const b1 = new THREE.Mesh(
        new THREE.BoxGeometry(20, 18, 14),
        new THREE.MeshStandardMaterial({
          map: createBuildingFacadeTexture(31, '#fed7aa', {
            name: 'মদিনা মার্কেট কমপ্লেক্স • MADINA MARKET',
            bg: '#b45309',
            text: '#ffffff',
          }),
        })
      );
      b1.position.set(-10, 9, -2);
      b1.castShadow = true;

      const b2 = new THREE.Mesh(
        new THREE.BoxGeometry(17, 15, 14),
        new THREE.MeshStandardMaterial({
          map: createBuildingFacadeTexture(32, '#dbeafe', {
            name: 'WALTON PLAZA • ওয়ালটন শোরুম',
            bg: '#1d4ed8',
            text: '#ffffff',
          }),
        })
      );
      b2.position.set(11, 7.5, -2);
      b2.castShadow = true;
      group.add(b1, b2);

      const mainSign = makeSignMesh(
        'madina_mkt_roof',
        26,
        3.6,
        {
          bg: '#78350f',
          bgBottom: '#92400e',
          border: '#fde047',
          bnText: 'মদিনা মার্কেট পয়েন্ট, সিলেট',
          title: 'MADINA MARKET POINT',
          subtitle: 'WALTON • ISLAMI BANK • BAZAAR & STUDENT HUB',
        },
        true
      );
      mainSign.position.set(0, 19.8, 5.2);
      group.add(mainSign);

      // Colorful Fruit & Fish Bazaar Tarpaulin Stalls out front!
      [-12, -6, 0, 6, 12].forEach((sx, idx) => {
        const tarp = new THREE.Mesh(
          new THREE.ConeGeometry(2.3, 1.3, 4),
          new THREE.MeshStandardMaterial({
            color: [0xef4444, 0x2563eb, 0x16a34a, 0xeab308, 0xf97316][idx],
          })
        );
        tarp.position.set(sx, 2.8, 8.5);
        tarp.rotation.y = Math.PI / 4;
        group.add(tarp);
      });
      break;
    }

    case 'ragib_rabeya_sign': {
      // Highway directional gantry to Ragib-Rabeya Medical College Road
      const sign = makeRoadsidePylon(
        'ragib_rabeya',
        '← RAGIB-RABEYA MEDICAL RD',
        'রাগীব-রাবেয়া মেডিকেল কলেজ রোড →',
        '#065f46',
        '#fde047',
        'hospital'
      );
      group.add(sign);
      break;
    }

    case 'tea_garden': {
      // Rolling Lush Emerald Sylhet Tea Garden Terraced Hillocks (টিলা ও চা বাগান)!
      const teaGreen1 = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
      const teaGreen2 = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.85 });

      [
        { x: -28, z: -18, r: 28, h: 14 },
        { x: 6, z: -24, r: 34, h: 18 },
        { x: 38, z: -16, r: 26, h: 13 },
      ].forEach((hill, idx) => {
        const mound = new THREE.Mesh(
          new THREE.SphereGeometry(hill.r, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
          idx % 2 === 0 ? teaGreen1 : teaGreen2
        );
        mound.scale.y = hill.h / hill.r;
        mound.position.set(hill.x, -0.5, hill.z);
        group.add(mound);

        // Tea bush terrace rings & shade trees
        for (let b = 0; b < 14; b++) {
          const angle = (b / 14) * Math.PI * 2;
          const dist = hill.r * (0.35 + (b % 3) * 0.18);
          const bush = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), teaGreen2);
          bush.scale.y = 0.55;
          bush.position.set(
            hill.x + Math.cos(angle) * dist,
            hill.h * 0.42,
            hill.z + Math.sin(angle) * dist
          );
          group.add(bush);
        }
      });

      const teaSign = makeSignMesh(
        'lakkatura_tea_sign',
        16,
        2.6,
        {
          bg: '#14532d',
          border: '#86efac',
          bnText: 'তারাপুর ও লাক্কাতুরা চা বাগান, সিলেট',
          title: 'SYLHET TEA ESTATE HILLS',
          accentColor: '#bbf7d0',
        },
        true
      );
      teaSign.position.set(0, 4.2, 8);
      group.add(teaSign);
      break;
    }

    case 'subidbazar_plaza': {
      const bld = new THREE.Mesh(
        new THREE.BoxGeometry(20, 16, 13),
        new THREE.MeshStandardMaterial({
          map: createBuildingFacadeTexture(45, '#ede9fe', {
            name: 'সুবিদবাজার কর্নার মার্কেট • SUBIDBAZAR',
            bg: '#6d28d9',
            text: '#ffffff',
          }),
        })
      );
      bld.position.set(0, 8, -2);
      group.add(bld);
      break;
    }

    case 'dorshon_dewri': {
      // Ornate Green & White Islamic Pointed Arch Gate to Shrine of Hazrat Shahjalal (R.)!
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
      const greenDomeMat = new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.3 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.25 });

      [-7.5, 7.5].forEach((px) => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 10.5, 2.4), whiteMat);
        pillar.position.set(px, 5.25, 0);
        const minaret = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 5.5, 12), whiteMat);
        minaret.position.set(px, 12.8, 0);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 10), greenDomeMat);
        dome.position.set(px, 15.8, 0);
        const finial = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 8), goldMat);
        finial.position.set(px, 17.0, 0);
        group.add(pillar, minaret, dome, finial);
      });

      const header = new THREE.Mesh(new THREE.BoxGeometry(17.6, 2.8, 2.5), greenDomeMat);
      header.position.set(0, 9.6, 0);
      const centerDome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), greenDomeMat);
      centerDome.position.set(0, 11.5, 0);
      group.add(header, centerDome);

      const mazarSign = makeSignMesh(
        'dorshon_dewri_sign',
        16.8,
        2.3,
        {
          bg: '#064e3b',
          border: '#facc15',
          bnText: 'হযরত শাহজালাল (রহ.) মাজার শরীফ তোরণ — দর্শন দেউড়ি',
          title: 'DORSHON DEWRI • SHAHJALAL MAZAR GATE',
        },
        true
      );
      mazarSign.position.set(0, 9.6, 1.32);
      group.add(mazarSign);
      break;
    }

    case 'ambarkhana_point': {
      // Arcadia Shopping Mall + Unimart + 7-Layer Tea + Overhead Highway Gantry!
      const glassTex = createGlassCurtainTexture('#0f766e', '#99f6e4');
      const arcadia = new THREE.Mesh(
        new THREE.BoxGeometry(22, 24, 16),
        new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.25 })
      );
      arcadia.position.set(0, 12, -4);
      arcadia.castShadow = true;
      group.add(arcadia);

      const ambSign = makeSignMesh(
        'ambarkhana_arcadia_sign',
        21,
        3.8,
        {
          bg: '#134e4a',
          border: '#facc15',
          bnText: 'আম্বরখানা পয়েন্ট • আর্কেডিয়া ও ইউনিমার্ট',
          title: 'AMBARKHANA POINT • ARCADIA',
          subtitle: 'AIRPORT RD • SUST RD • ZINDABAZAR • SHAHI EIDGAH',
        },
        true
      );
      ambSign.position.set(0, 25.8, 4.2);
      group.add(ambSign);
      break;
    }

    case 'shaheed_minar': {
      // Authentic Sylhet Central Shaheed Minar (Chouhatta): Elevated Stepped Terrace + Red Sun + 5 White Columns!
      const brickMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.75 });
      const whiteMarble = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });

      for (let s = 0; s < 5; s++) {
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(22 - s * 1.8, 0.55, 14 - s * 1.4),
          s % 2 === 0 ? brickMat : whiteMarble
        );
        step.position.set(0, 0.28 + s * 0.55, 0);
        group.add(step);
      }

      // Glowing Crimson Sun Circle behind columns
      const redSun = new THREE.Mesh(
        new THREE.CylinderGeometry(4.2, 4.2, 0.28, 32),
        new THREE.MeshBasicMaterial({ color: 0xdc2626 })
      );
      redSun.rotation.x = Math.PI / 2;
      redSun.position.set(0, 6.8, -1.8);
      group.add(redSun);

      // Central Mother Column (bent top!) + 4 Flanking Columns
      const colSpecs = [
        { x: -5.2, h: 5.4, angle: 0.22 },
        { x: -2.7, h: 6.8, angle: 0.12 },
        { x: 0, h: 8.8, angle: 0 },
        { x: 2.7, h: 6.8, angle: -0.12 },
        { x: 5.2, h: 5.4, angle: -0.22 },
      ];
      colSpecs.forEach((c) => {
        const frame = new THREE.Group();
        frame.position.set(c.x, 2.75, 0);
        frame.rotation.y = c.angle;

        [-0.55, 0.55].forEach((lx) => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, c.h, 0.24), whiteMarble);
          post.position.set(lx, c.h / 2, 0);
          frame.add(post);
        });
        const topBar = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.24, 0.24), whiteMarble);
        topBar.position.set(0, c.h, 0);
        frame.add(topBar);

        if (c.x === 0) {
          // Characteristic forward-bent upper frame of Central Shaheed Minar!
          const bentTop = new THREE.Mesh(new THREE.BoxGeometry(1.34, 2.2, 0.22), whiteMarble);
          bentTop.position.set(0, c.h + 0.85, 0.55);
          bentTop.rotation.x = 0.52;
          frame.add(bentTop);
        }
        group.add(frame);
      });

      const minarSign = makeSignMesh(
        'chouhatta_shaheed_minar_sign',
        16,
        2.3,
        {
          bg: '#7f1d1d',
          border: '#fde047',
          bnText: 'সিলেট কেন্দ্রীয় শহীদ মিনার, চৌহাট্টা',
          title: 'SYLHET CENTRAL SHAHEED MINAR',
        },
        true
      );
      minarSign.position.set(0, 1.6, 8.2);
      group.add(minarSign);
      break;
    }

    case 'al_hamra': {
      // Iconic Al-Hamra Shopping City at Zindabazar (Curved Glass Cylindrical Corner Tower + Wing!)
      const goldGlass = createGlassCurtainTexture('#92400e', '#fde68a');
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(22, 26, 15),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.45 })
      );
      wing.position.set(-3, 13, -3);
      wing.castShadow = true;

      const rotunda = new THREE.Mesh(
        new THREE.CylinderGeometry(7.2, 7.2, 29, 24),
        new THREE.MeshStandardMaterial({ map: goldGlass, roughness: 0.2, metalness: 0.35 })
      );
      rotunda.position.set(7.5, 14.5, 3);
      rotunda.castShadow = true;
      group.add(wing, rotunda);

      const sign = makeSignMesh(
        'al_hamra_sign',
        22,
        3.6,
        {
          bg: '#78350f',
          border: '#facc15',
          bnText: 'আল-হামরা শপিং সিটি, জিন্দাবাজার, সিলেট',
          title: 'AL-HAMRA SHOPPING CITY',
          subtitle: 'ZINDABAZAR COMMERCIAL HUB',
        },
        true
      );
      sign.position.set(2, 30.8, 4.5);
      group.add(sign);
      break;
    }

    case 'blue_water': {
      // Iconic Blue Water Shopping City at Zindabazar (Deep Cobalt Reflective Glass Mall!)
      const blueGlass = createGlassCurtainTexture('#1d4ed8', '#93c5fd');
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(22, 28, 16),
        new THREE.MeshStandardMaterial({ map: blueGlass, roughness: 0.15, metalness: 0.35 })
      );
      tower.position.set(0, 14, -2);
      tower.castShadow = true;
      group.add(tower);

      const sign = makeSignMesh(
        'blue_water_sign',
        21,
        3.6,
        {
          bg: '#1e3a8a',
          border: '#38bdf8',
          bnText: 'ব্লু ওয়াটার শপিং সিটি, জিন্দাবাজার',
          title: 'BLUE WATER SHOPPING CITY',
          accentColor: '#7dd3fc',
        },
        true
      );
      sign.position.set(0, 29.8, 6.2);
      group.add(sign);
      break;
    }

    case 'panshi': {
      const bld = new THREE.Mesh(
        new THREE.BoxGeometry(16, 12, 12),
        new THREE.MeshStandardMaterial({
          map: createBuildingFacadeTexture(88, '#ffedd5', {
            name: 'পানশি রেস্টুরেন্ট • PANSHI RESTAURANT',
            bg: '#c2410c',
            text: '#fef08a',
          }),
        })
      );
      bld.position.set(0, 6, -2);
      group.add(bld);

      const roofSign = makeSignMesh(
        'panshi_roof',
        15,
        2.5,
        {
          bg: '#9a3412',
          border: '#fde047',
          bnText: 'পানশি রেস্টুরেন্ট, জিন্দাবাজার — ঐতিহ্যবাহী সাতকরা ও ভর্তা',
          title: 'PANSHI RESTAURANT • ZINDABAZAR',
        },
        true
      );
      roofSign.position.set(0, 13.4, 4.2);
      group.add(roofSign);
      break;
    }

    case 'scc_bhaban': {
      // Sylhet City Corporation Modern Stepped Nagar Bhaban at Bondor Bazar!
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 });
      const glassTex = createGlassCurtainTexture('#0f766e', '#ccfbf1');

      const base = new THREE.Mesh(new THREE.BoxGeometry(26, 10, 16), whiteMat);
      base.position.set(0, 5, -2);
      const mid = new THREE.Mesh(
        new THREE.BoxGeometry(20, 14, 13),
        new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.2 })
      );
      mid.position.set(0, 17, -2);
      group.add(base, mid);

      const sccSign = makeSignMesh(
        'scc_nagar_bhaban_sign',
        23,
        3.4,
        {
          bg: '#115e59',
          border: '#fde047',
          bnText: 'সিলেট সিটি কর্পোরেশন নগর ভবন — বন্দর বাজার',
          title: 'SYLHET CITY CORPORATION',
          subtitle: 'NAGAR BHABAN • BANDAR BAZAR, SYLHET',
        },
        true
      );
      sccSign.position.set(0, 25.8, 4.8);
      group.add(sccSign);
      break;
    }

    case 'hasan_market': {
      // Historic Hasan Market + Bandar Bazar Central Jame Masjid Minaret & Green Dome!
      const mkt = new THREE.Mesh(
        new THREE.BoxGeometry(22, 9, 14),
        new THREE.MeshStandardMaterial({
          map: createBuildingFacadeTexture(94, '#fef9c3', {
            name: 'ঐতিহ্যবাহী হাসান মার্কেট • HASAN MARKET',
            bg: '#15803d',
            text: '#ffffff',
          }),
        })
      );
      mkt.position.set(-4, 4.5, -2);
      group.add(mkt);

      // Tall Mosque Minaret & Grand Dome beside Hasan Market
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const greenMat = new THREE.MeshStandardMaterial({ color: 0x059669 });
      const minaret = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 28, 14), whiteMat);
      minaret.position.set(11, 14, -3);
      const mTop = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4.2, 14), greenMat);
      mTop.position.set(11, 30, -3);
      const bigDome = new THREE.Mesh(new THREE.SphereGeometry(5.2, 18, 12), greenMat);
      bigDome.position.set(4, 10.5, -4);
      group.add(minaret, mTop, bigDome);
      break;
    }

    case 'ali_amjad_clock': {
      // Historic 1872 Ali Amjad's Clock Tower on Surma Riverbank!
      const terracotta = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.6 });
      const cream = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.45 });
      const ironRoof = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5 });

      const base = new THREE.Mesh(new THREE.BoxGeometry(6.4, 5.2, 6.4), terracotta);
      base.position.y = 2.6;
      const upper = new THREE.Mesh(new THREE.BoxGeometry(4.6, 5.4, 4.6), cream);
      upper.position.y = 7.9;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 3.8, 4), ironRoof);
      roof.position.y = 12.5;
      roof.rotation.y = Math.PI / 4;
      group.add(base, upper, roof);

      // 4 White Clock Dials on all 4 sides!
      [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach((rot) => {
        const dialGroup = new THREE.Group();
        dialGroup.rotation.y = rot;
        const dial = new THREE.Mesh(
          new THREE.CircleGeometry(1.25, 20),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        dial.position.set(0, 8.2, 2.34);
        const hand1 = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.85, 0.04),
          new THREE.MeshBasicMaterial({ color: 0x0f172a })
        );
        hand1.position.set(0, 8.5, 2.36);
        const hand2 = new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 0.12, 0.04),
          new THREE.MeshBasicMaterial({ color: 0x0f172a })
        );
        hand2.position.set(0.28, 8.2, 2.36);
        dialGroup.add(dial, hand1, hand2);
        group.add(dialGroup);
      });

      const clockSign = makeSignMesh(
        'ali_amjad_sign',
        9.5,
        1.8,
        {
          bg: '#7c2d12',
          border: '#fde047',
          bnText: 'ঐতিহাসিক আলী আমজাদের ঘড়িঘর (১৮৭২)',
          title: 'ALI AMJAD\'S CLOCK • 1872',
        },
        true
      );
      clockSign.position.set(0, 15.4, 0);
      group.add(clockSign);
      break;
    }

    case 'keane_bridge': {
      // Shimmering Surma River + Iconic Silver Steel Bowstring Arch Keane Bridge (1936)!
      const riverWater = new THREE.Mesh(
        new THREE.PlaneGeometry(900, 165),
        new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          roughness: 0.18,
          metalness: 0.35,
        })
      );
      riverWater.rotation.x = -Math.PI / 2;
      riverWater.position.set(80, 0.06, 38);
      group.add(riverWater);

      // Riverbank promenade wall
      const bankWall = new THREE.Mesh(
        new THREE.BoxGeometry(900, 1.2, 2.2),
        new THREE.MeshStandardMaterial({ color: 0x64748b })
      );
      bankWall.position.set(80, 0.5, -45);
      group.add(bankWall);

      // Steel Truss Keane Bridge Deck & 3 Bowstring Arch Spans!
      const steelMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.72,
        roughness: 0.32,
      });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.9, 145), steelMat);
      deck.position.set(0, 3.2, 26);
      group.add(deck);

      // 3 Iconic Bowstring Steel Arches along Keane Bridge!
      [-22, 26, 74].forEach((spanZ) => {
        [-5.3, 5.3].forEach((sideX) => {
          const arch = new THREE.Mesh(
            new THREE.TorusGeometry(22, 0.42, 8, 24, Math.PI),
            steelMat
          );
          arch.rotation.y = Math.PI / 2;
          arch.position.set(sideX, 3.4, spanZ);
          group.add(arch);

          // Vertical steel hanger cables/struts
          for (let h = -16; h <= 16; h += 6.4) {
            const hangerH = Math.sqrt(Math.max(0, 22 * 22 - h * h));
            const strut = new THREE.Mesh(
              new THREE.CylinderGeometry(0.10, 0.10, hangerH, 6),
              steelMat
            );
            strut.position.set(sideX, 3.4 + hangerH / 2, spanZ + h);
            group.add(strut);
          }
        });

        // Overhead cross-bracing
        const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.45, 0.45), steelMat);
        crossBeam.position.set(0, 25.2, spanZ);
        group.add(crossBeam);
      });

      const bridgePortalSign = makeSignMesh(
        'keane_bridge_portal',
        11.2,
        2.2,
        {
          bg: '#1e293b',
          border: '#38bdf8',
          bnText: 'ঐতিহাসিক ক্বীন ব্রিজ (১৯৩৬) ও সুরমা নদী — বন্দর বাজার',
          title: 'HISTORIC KEANE BRIDGE • SURMA RIVER',
        },
        true
      );
      bridgePortalSign.position.set(0, 9.5, -43);
      group.add(bridgePortalSign);
      break;
    }

    case 'shahi_eidgah': {
      // Historic 17th-Century Mughal Shahi Eidgah: Green Tila + Monumental White Stairway + Minarets!
      const hill = new THREE.Mesh(
        new THREE.BoxGeometry(44, 7.5, 24),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 })
      );
      hill.position.set(0, 3.75, -8);
      group.add(hill);

      const whitePlaster = new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.4 });
      for (let st = 0; st < 10; st++) {
        const stair = new THREE.Mesh(
          new THREE.BoxGeometry(26, 0.75, 1.4),
          whitePlaster
        );
        stair.position.set(0, 0.38 + st * 0.75, 10 - st * 1.3);
        group.add(stair);
      }

      // Eidgah Mughal Wall & Tall Ornamental Minarets
      const eidgahWall = new THREE.Mesh(new THREE.BoxGeometry(34, 5.5, 1.4), whitePlaster);
      eidgahWall.position.set(0, 10.2, -5);
      group.add(eidgahWall);

      [-15, -6, 6, 15].forEach((mx, idx) => {
        const h = idx === 0 || idx === 3 ? 16 : 11;
        const min = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.1, h, 12), whitePlaster);
        min.position.set(mx, 7.5 + h / 2, -5);
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(1.05, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0x059669 })
        );
        dome.position.set(mx, 7.5 + h + 0.6, -5);
        group.add(min, dome);
      });

      const eidgahSign = makeSignMesh(
        'shahi_eidgah_sign',
        20,
        2.6,
        {
          bg: '#065f46',
          border: '#fde047',
          bnText: 'ঐতিহাসিক শাহী ঈদগাহ ময়দান, সিলেট (১৭শ শতাব্দী)',
          title: 'HISTORIC SHAHI EIDGAH • SYLHET',
        },
        true
      );
      eidgahSign.position.set(0, 3.2, 12.2);
      group.add(eidgahSign);
      break;
    }

    case 'mc_college': {
      // Historic Murari Chand (MC) College Tilagor (Est. 1892): Assam-Type Heritage Yellow/Timber Bungalow & Gate!
      const hillMound = new THREE.Mesh(
        new THREE.SphereGeometry(32, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.9 })
      );
      hillMound.scale.y = 0.42;
      hillMound.position.set(0, -0.5, -24);
      group.add(hillMound);

      // Assam-type Heritage Bungalow Building
      const creamWall = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.55 });
      const timberMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 });
      const redTinRoof = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.45 });

      const mainHall = new THREE.Mesh(new THREE.BoxGeometry(28, 7.2, 12), creamWall);
      mainHall.position.set(0, 3.6, -12);
      const pitchedRoof = new THREE.Mesh(new THREE.ConeGeometry(18, 5.2, 4), redTinRoof);
      pitchedRoof.scale.set(1.25, 1, 0.72);
      pitchedRoof.rotation.y = Math.PI / 4;
      pitchedRoof.position.set(0, 9.8, -12);
      group.add(mainHall, pitchedRoof);

      // Timber heritage posts along veranda
      for (let vx = -12; vx <= 12; vx += 4) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 7.2, 0.32), timberMat);
        post.position.set(vx, 3.6, -5.8);
        group.add(post);
      }

      // MC College Heritage Gate Arch
      [-7.5, 7.5].forEach((gx) => {
        const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 8.8, 2.2), creamWall);
        p.position.set(gx, 4.4, 6);
        group.add(p);
      });
      const gateTop = new THREE.Mesh(new THREE.BoxGeometry(18.5, 2.5, 2.4), redTinRoof);
      gateTop.position.set(0, 8.6, 6);
      group.add(gateTop);

      const mcSign = makeSignMesh(
        'mc_college_gate_sign',
        17.8,
        2.2,
        {
          bg: '#78350f',
          border: '#fde047',
          bnText: 'মুরারিচাঁদ (এমসি) কলেজ, টিলাগড়, সিলেট • প্রতিষ্ঠিত ১৮৯২',
          title: 'MURARI CHAND (MC) COLLEGE • TILAGOR',
        },
        true
      );
      mcSign.position.set(0, 8.6, 7.3);
      group.add(mcSign);
      break;
    }

    case 'tilagor_ecopark': {
      const sign = makeRoadsidePylon(
        'tilagor_eco',
        'TILAGOR POINT & ECO PARK →',
        'টিলাগড় পয়েন্ট ও ইকোপার্ক সড়ক',
        '#14532d',
        '#fde047'
      );
      group.add(sign);
      break;
    }
  }

  return group;
}

/** Creates a Tropical Sylheti Tree (Krishnochura orange-red blossom or Lush Rain Tree) */
export function createSylhetTree(seed: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.38, 4.2, 7),
    new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
  );
  trunk.position.y = 2.1;
  g.add(trunk);

  const isKrishnochura = seed % 7 === 0; // Iconic fiery orange-red Krishnochura blossoms!
  const crownColor = isKrishnochura
    ? 0xea580c
    : [0x15803d, 0x166534, 0x16a34a, 0x047857][seed % 4];

  const foliageMat = new THREE.MeshStandardMaterial({ color: crownColor, roughness: 0.8 });
  const mainCrown = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 1), foliageMat);
  mainCrown.position.y = 5.4;
  mainCrown.scale.y = 0.78;
  g.add(mainCrown);

  const sideCrown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8, 1), foliageMat);
  sideCrown.position.set(1.2, 4.8, 0.6);
  g.add(sideCrown);

  return g;
}

/** Creates a Recognizable BRTC / Sylhet Student Bus Stop Shelter */
export function createBusStopShelter(stopId: string, name: string, bnName: string): THREE.Group {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x065f46, metalness: 0.4 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.4 });

  [-2.1, 2.1].forEach((px) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.1, 8), frameMat);
    post.position.set(px, 1.55, -0.8);
    g.add(post);
  });

  const backGlass = new THREE.Mesh(
    new THREE.BoxGeometry(4.3, 2.1, 0.08),
    new THREE.MeshPhysicalMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.35 })
  );
  backGlass.position.set(0, 1.45, -0.82);
  g.add(backGlass);

  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.12, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xfacc15 })
  );
  bench.position.set(0, 0.62, -0.52);
  g.add(bench);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.22, 2.1), roofMat);
  roof.position.set(0, 3.15, -0.2);
  g.add(roof);

  const sign = makeSignMesh(
    `stop_shelter_${stopId}`,
    4.7,
    0.95,
    {
      bg: '#064e3b',
      border: '#facc15',
      bnText: `${bnName} • ভাড়া ৫ টাকা`,
      title: `${name.toUpperCase()}`,
      accentColor: '#fde047',
      width: 640,
      height: 140,
    },
    true
  );
  sign.position.set(0, 3.75, 0.72);
  g.add(sign);

  return g;
}
