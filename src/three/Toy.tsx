// A procedural vinyl-toy character. Built from a handful of simple shapes with
// shared geometries and materials so dozens can render smoothly on a phone.
import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { colorHex, type Avatar } from '../../shared/content.ts';

export interface ToyMotion {
  walking: boolean;
  waveUntil: number;
  jumpUntil: number;
  /** Time the toy appeared, for the landing bounce. 0 = no landing. */
  dropAt: number;
}

export const newMotion = (drop = false): ToyMotion => ({
  walking: false,
  waveUntil: 0,
  jumpUntil: 0,
  dropAt: drop ? performance.now() : 0,
});

// ---------- shared resources ----------
const geo = {
  sphere: new THREE.SphereGeometry(1, 28, 20),
  sphereLo: new THREE.SphereGeometry(1, 14, 10),
  capsule: new THREE.CapsuleGeometry(1, 1, 8, 20),
  cone: new THREE.ConeGeometry(1, 1, 18),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
  torus: new THREE.TorusGeometry(1, 0.22, 10, 28, Math.PI),
  torusFull: new THREE.TorusGeometry(1, 0.18, 10, 28),
  box: new THREE.BoxGeometry(1, 1, 1),
  disc: new THREE.CircleGeometry(1, 24),
};

const matCache = new Map<string, THREE.Material>();
export function vinyl(hex: string, rough = 0.38): THREE.MeshStandardMaterial {
  const key = `v${hex}${rough}`;
  let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0 });
    matCache.set(key, m);
  }
  return m;
}
const flat = (hex: string, opacity = 1) => {
  const key = `f${hex}${opacity}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: hex, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    matCache.set(key, m);
  }
  return m;
};

const INK = '#231F33';

// Respect the OS "reduce motion" setting: no idle bobbing, no drop-in bounce.
const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let shadowTex: THREE.Texture | null = null;
function blobShadow() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(40,30,60,0.35)');
  grd.addColorStop(1, 'rgba(40,30,60,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}
let shadowMat: THREE.Material | null = null;
const getShadowMat = () =>
  (shadowMat ??= new THREE.MeshBasicMaterial({ map: blobShadow(), transparent: true, depthWrite: false }));

// Head geometry per body type: [center y, radius]
const HEAD: Record<Avatar['body'], { y: number; r: number }> = {
  bean: { y: 0.78, r: 0.44 },
  bear: { y: 0.86, r: 0.46 },
  cat: { y: 0.86, r: 0.45 },
  bot: { y: 0.88, r: 0.44 },
  sprout: { y: 0.84, r: 0.46 },
};

export function Toy({
  avatar,
  motion,
  happy = false,
  dim = false,
}: {
  avatar: Avatar;
  motion?: MutableRefObject<ToyMotion>;
  happy?: boolean;
  dim?: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const seed = useMemo(() => Math.random() * 10, []);

  const main = colorHex(avatar.color);
  const accent = colorHex(avatar.accent);
  const mMain = vinyl(main);
  const mAccent = vinyl(accent);
  const mInk = vinyl(INK, 0.25);
  const h = HEAD[avatar.body];

  useFrame((state) => {
    const t = state.clock.elapsedTime + seed;
    const now = performance.now();
    const m = motion?.current;
    const g = bodyRef.current;
    if (!g) return;

    let y = 0;
    let squash = 1;
    let tilt = 0;
    const walking = m?.walking;
    if (walking) {
      const p = Math.abs(Math.sin(t * 9));
      y = p * 0.16;
      squash = 1 - (1 - p) * 0.06;
      tilt = Math.sin(t * 9) * 0.08;
    } else if (!reduceMotion) {
      y = Math.sin(t * 2) * 0.025;
      squash = 1 + Math.sin(t * 2) * 0.012;
    }
    if (m && now < m.jumpUntil) {
      const k = 1 - (m.jumpUntil - now) / 600;
      y += Math.sin(k * Math.PI) * 0.6;
    }
    if (m?.dropAt && !reduceMotion) {
      const k = (now - m.dropAt) / 900;
      if (k < 1) {
        // fall from above with a little bounce
        const fall = k < 0.55 ? (1 - k / 0.55) ** 2 * 5 : Math.abs(Math.sin(((k - 0.55) / 0.45) * Math.PI)) * 0.35 * (1 - k);
        y += fall;
        squash = k > 0.5 && k < 0.65 ? 0.85 : squash;
      }
    }
    g.position.y = y;
    g.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    g.rotation.z = tilt;

    const waving = m && now < m.waveUntil;
    if (armR.current) {
      const target = waving ? -2.5 + Math.sin(t * 16) * 0.45 : walking ? Math.sin(t * 9) * 0.5 : 0.15;
      armR.current.rotation.z += (target - armR.current.rotation.z) * 0.3;
    }
    if (armL.current) {
      const target = walking ? -Math.sin(t * 9) * 0.5 : -0.15;
      armL.current.rotation.z += (target - armL.current.rotation.z) * 0.3;
    }
    // Blink every few seconds
    if (eyes.current) {
      const blink = (t % 4.2) < 0.12 ? 0.15 : 1;
      eyes.current.scale.y = waving || happy ? 1 : blink;
    }
  });

  const isHappy = happy;

  return (
    <group ref={root}>
      <mesh geometry={geo.disc} material={getShadowMat()} rotation-x={-Math.PI / 2} position-y={0.01} scale={0.55} />
      <group ref={bodyRef}>
        {/* feet */}
        <mesh geometry={geo.sphereLo} material={mAccent} position={[-0.15, 0.07, 0.04]} scale={[0.13, 0.08, 0.16]} />
        <mesh geometry={geo.sphereLo} material={mAccent} position={[0.15, 0.07, 0.04]} scale={[0.13, 0.08, 0.16]} />

        {/* torso */}
        {avatar.body === 'bean' ? (
          <mesh geometry={geo.capsule} material={mMain} position-y={0.62} scale={[0.44, 0.24, 0.42]} />
        ) : avatar.body === 'bot' ? (
          <mesh geometry={geo.capsule} material={mMain} position-y={0.32} scale={[0.25, 0.1, 0.22]} />
        ) : (
          <mesh geometry={geo.sphere} material={mMain} position-y={0.3} scale={[0.27, 0.24, 0.24]} />
        )}

        {/* arms */}
        <group ref={armL} position={[-0.27, 0.36, 0]}>
          <mesh geometry={geo.capsule} material={mMain} position-y={-0.08} scale={[0.07, 0.07, 0.07]} />
        </group>
        <group ref={armR} position={[0.27, 0.36, 0]}>
          <mesh geometry={geo.capsule} material={mMain} position-y={-0.08} scale={[0.07, 0.07, 0.07]} />
        </group>

        {/* head */}
        <group position-y={h.y}>
          {avatar.body === 'bot' ? (
            <>
              <mesh geometry={geo.box} material={mMain} scale={[0.86, 0.72, 0.76]} />
              <mesh geometry={geo.sphere} material={mMain} scale={[0.44, 0.37, 0.39]} />
              <mesh geometry={geo.box} material={mInk} position={[0, 0, 0.385]} scale={[0.66, 0.42, 0.02]} />
              <mesh geometry={geo.cyl} material={mInk} position={[0, 0.45, 0]} scale={[0.025, 0.2, 0.025]} />
              <mesh geometry={geo.sphereLo} material={mAccent} position={[0, 0.58, 0]} scale={0.08} />
              <mesh geometry={geo.cyl} material={mAccent} position={[-0.44, 0, 0]} rotation-z={Math.PI / 2} scale={[0.12, 0.05, 0.12]} />
              <mesh geometry={geo.cyl} material={mAccent} position={[0.44, 0, 0]} rotation-z={Math.PI / 2} scale={[0.12, 0.05, 0.12]} />
            </>
          ) : avatar.body === 'bean' ? null : (
            <mesh geometry={geo.sphere} material={mMain} scale={[h.r * 1.06, h.r * 0.94, h.r]} />
          )}

          {avatar.body === 'bear' && (
            <>
              {[-1, 1].map((s) => (
                <group key={s} position={[s * 0.3, 0.33, -0.02]}>
                  <mesh geometry={geo.sphereLo} material={mMain} scale={[0.14, 0.14, 0.09]} />
                  <mesh geometry={geo.sphereLo} material={mAccent} position-z={0.05} scale={[0.08, 0.08, 0.05]} />
                </group>
              ))}
            </>
          )}
          {avatar.body === 'cat' && (
            <>
              {[-1, 1].map((s) => (
                <mesh key={s} geometry={geo.cone} material={mMain} position={[s * 0.26, 0.4, 0]} rotation-z={-s * 0.35} scale={[0.14, 0.28, 0.1]} />
              ))}
              {[-1, 1].map((s) => (
                <mesh key={'i' + s} geometry={geo.cone} material={mAccent} position={[s * 0.255, 0.38, 0.05]} rotation-z={-s * 0.35} scale={[0.07, 0.16, 0.04]} />
              ))}
            </>
          )}
          {avatar.body === 'sprout' && (
            <group position-y={h.r * 0.92}>
              <mesh geometry={geo.cyl} material={vinyl('#3FA56F')} position-y={0.08} scale={[0.025, 0.16, 0.025]} />
              <mesh geometry={geo.sphereLo} material={mAccent} position={[-0.11, 0.17, 0]} rotation-z={0.6} scale={[0.13, 0.05, 0.08]} />
              <mesh geometry={geo.sphereLo} material={mAccent} position={[0.11, 0.19, 0]} rotation-z={-0.6} scale={[0.13, 0.05, 0.08]} />
            </group>
          )}

          {/* face */}
          <Face z={avatar.body === 'bot' ? 0.4 : h.r * 0.95} eyesRef={eyes} happy={isHappy} onScreen={avatar.body === 'bot'} />

          <Accessory kind={avatar.accessory} r={h.r} accent={accent} isBot={avatar.body === 'bot'} />
        </group>
      </group>
      {dim && <mesh geometry={geo.sphereLo} material={flat('#F7F2EA', 0.45)} position-y={0.65} scale={[0.62, 0.75, 0.62]} />}
    </group>
  );
}

function Face({
  z,
  eyesRef,
  happy,
  onScreen,
}: {
  z: number;
  eyesRef: MutableRefObject<THREE.Group | null>;
  happy: boolean;
  onScreen: boolean;
}) {
  const eyeMat = onScreen ? flat('#9FF5D3') : vinyl(INK, 0.2);
  return (
    <group position={[0, -0.02, z]}>
      <group ref={eyesRef}>
        {[-1, 1].map((s) =>
          happy ? (
            <mesh key={s} geometry={geo.torus} material={eyeMat} position={[s * 0.15, 0.04, 0]} scale={[0.055, 0.055, 0.04]} />
          ) : (
            <group key={s} position={[s * 0.15, 0.03, 0]}>
              <mesh geometry={geo.sphereLo} material={eyeMat} scale={[0.058, 0.075, 0.03]} />
              {!onScreen && <mesh geometry={geo.sphereLo} material={flat('#FFFFFF')} position={[0.018, 0.025, 0.022]} scale={0.018} />}
            </group>
          ),
        )}
      </group>
      {!onScreen && (
        <>
          <mesh geometry={geo.disc} material={flat('#FF8FA3', 0.55)} position={[-0.25, -0.07, -0.04]} rotation-y={-0.5} scale={[0.07, 0.045, 1]} />
          <mesh geometry={geo.disc} material={flat('#FF8FA3', 0.55)} position={[0.25, -0.07, -0.04]} rotation-y={0.5} scale={[0.07, 0.045, 1]} />
        </>
      )}
      <mesh
        geometry={geo.torus}
        material={eyeMat}
        position={[0, -0.08, 0.005]}
        rotation-z={Math.PI}
        scale={happy ? [0.06, 0.06, 0.04] : [0.04, 0.035, 0.03]}
      />
    </group>
  );
}

function Accessory({ kind, r, accent, isBot }: { kind: Avatar['accessory']; r: number; accent: string; isBot: boolean }) {
  const top = isBot ? 0.37 : r * 0.9;
  switch (kind) {
    case 'headphones':
      return (
        <group>
          <mesh geometry={geo.torusFull} material={vinyl(INK, 0.3)} position-y={0.02} scale={[r * 1.08, r * 1.02, 0.25]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo.cyl} material={vinyl(accent)} position={[s * (isBot ? 0.47 : r * 1.03), 0, 0]} rotation-z={Math.PI / 2} scale={[0.14, 0.1, 0.14]} />
          ))}
        </group>
      );
    case 'glasses':
      return (
        <group position={[0, 0.02, isBot ? 0.41 : r * 0.98]}>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo.torusFull} material={vinyl(INK, 0.3)} position-x={s * 0.15} scale={[0.1, 0.1, 0.1]} />
          ))}
          <mesh geometry={geo.box} material={vinyl(INK, 0.3)} scale={[0.08, 0.02, 0.02]} />
        </group>
      );
    case 'beanie':
      return (
        <group position-y={top - 0.12}>
          <mesh geometry={geo.sphere} material={vinyl(accent, 0.75)} scale={[r * 1.08, r * 0.62, r * 1.04]} position-y={0.06} />
          <mesh geometry={geo.cyl} material={vinyl(accent, 0.75)} scale={[r * 1.1, 0.09, r * 1.06]} />
          <mesh geometry={geo.sphereLo} material={vinyl('#FFFDF9', 0.9)} position-y={0.36} scale={0.09} />
        </group>
      );
    case 'partyhat':
      return (
        <group position={[0.08, top + 0.12, 0]} rotation-z={-0.2}>
          <mesh geometry={geo.cone} material={vinyl(accent)} scale={[0.15, 0.34, 0.15]} />
          <mesh geometry={geo.sphereLo} material={vinyl('#FFFDF9')} position-y={0.19} scale={0.05} />
        </group>
      );
    case 'flower':
      return (
        <group position={[r * 0.6, top - 0.05, r * 0.3]} rotation-z={-0.4}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh
              key={i}
              geometry={geo.sphereLo}
              material={vinyl(accent)}
              position={[Math.cos((i / 5) * Math.PI * 2) * 0.07, Math.sin((i / 5) * Math.PI * 2) * 0.07, 0]}
              scale={[0.055, 0.055, 0.03]}
            />
          ))}
          <mesh geometry={geo.sphereLo} material={vinyl('#F7D154')} scale={[0.045, 0.045, 0.04]} position-z={0.02} />
        </group>
      );
    case 'scarf':
      return (
        <group position-y={-r * 0.82}>
          <mesh geometry={geo.torusFull} material={vinyl(accent, 0.8)} rotation-x={Math.PI / 2} scale={[0.26, 0.26, 0.5]} />
          <mesh geometry={geo.capsule} material={vinyl(accent, 0.8)} position={[0.12, -0.12, 0.2]} rotation-z={0.2} scale={[0.05, 0.08, 0.03]} />
        </group>
      );
    default:
      return null;
  }
}
