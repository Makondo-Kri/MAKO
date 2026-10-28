// The shared event hall: an isometric diorama with every participant's toy.
// Tap the floor to walk, tap a toy to see who it is.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { HALL, clampToHall } from '../../shared/content.ts';
import type { PublicParticipant, Spot } from '../../shared/protocol.ts';
import { Environment } from './Environment.tsx';
import { Toy, newMotion, type ToyMotion } from './Toy.tsx';

export interface Effect {
  id: string;
  target: string;
  emoji?: string;
  wave?: boolean;
  at: number;
}

interface Props {
  participants: PublicParticipant[];
  selfId: string;
  effects: Effect[];
  spots: Spot[];
  overview: boolean;
  focusId: string | null;
  onTapFloor: (x: number, z: number) => void;
  onTapToy: (id: string) => void;
}

const CAM_OFFSET = new THREE.Vector3(10, 11, 10);
const SPEED = 3.4;

// Positions of toys as they animate, shared with the camera rig.
type Live = Map<string, THREE.Vector3>;

function CameraRig({ live, selfId, overview, focusId }: { live: Live; selfId: string; overview: boolean; focusId: string | null }) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    const cam = camera as THREE.OrthographicCamera;
    const follow = live.get(focusId ?? selfId);
    const want = overview || !follow ? new THREE.Vector3(0, 0, 1.2) : follow;
    const k = 1 - Math.exp(-dt * 4);
    target.current.lerp(want, k);
    cam.position.copy(target.current).add(CAM_OFFSET);
    cam.lookAt(target.current);
    // How many world units fit across the shorter side of the screen.
    // Phones show ~10 units around you; big screens show more of the room.
    const wide = size.width > 700;
    const units = overview ? HALL.halfX * (wide ? 2.4 : 2.9) : wide ? 15 : 10;
    const zoom = (wide ? Math.min(size.width, size.height * 1.4) : Math.min(size.width, size.height * 1.1)) / units;
    cam.zoom += (zoom - cam.zoom) * k;
    cam.updateProjectionMatrix();
  });
  return null;
}

const HallToy = memo(function HallToy({
  p,
  isSelf,
  live,
  effects,
  onTap,
}: {
  p: PublicParticipant;
  isSelf: boolean;
  live: Live;
  effects: Effect[];
  onTap: (id: string) => void;
}) {
  const g = useRef<THREE.Group>(null);
  const motion = useRef<ToyMotion>(newMotion(isSelf));
  const pos = useMemo(() => new THREE.Vector3(p.x, 0, p.z), []); // eslint-disable-line react-hooks/exhaustive-deps
  const seen = useRef(new Set<string>());

  useEffect(() => {
    live.set(p.id, pos);
    return () => void live.delete(p.id);
  }, [live, p.id, pos]);

  useEffect(() => {
    for (const e of effects) {
      if (seen.current.has(e.id)) continue;
      seen.current.add(e.id);
      if (e.wave) {
        motion.current.waveUntil = performance.now() + 1500;
      }
    }
  }, [effects]);

  useFrame((_, dt) => {
    const grp = g.current;
    if (!grp) return;
    const dx = p.x - pos.x;
    const dz = p.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.04) {
      const step = Math.min(dist, SPEED * Math.min(dt, 0.1));
      pos.x += (dx / dist) * step;
      pos.z += (dz / dist) * step;
      const face = Math.atan2(dx, dz);
      let diff = face - grp.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      grp.rotation.y += diff * Math.min(1, dt * 12);
      motion.current.walking = true;
    } else {
      motion.current.walking = false;
      // Slowly turn back toward the camera when standing still.
      const face = Math.PI / 4;
      let diff = face - grp.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      grp.rotation.y += diff * Math.min(1, dt * 2.5);
    }
    grp.position.set(pos.x, 0, pos.z);
  });

  const handleTap = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onTap(p.id);
  };

  const emojis = effects.filter((e) => e.emoji);
  const away = p.status === 'away';

  return (
    <group ref={g} position={[p.x, 0, p.z]}>
      <Toy avatar={p.avatar} motion={motion} dim={away} happy={effects.some((e) => e.wave)} />
      {/* generous invisible hit area for fingers */}
      <mesh position-y={0.7} onClick={handleTap} visible={false}>
        <cylinderGeometry args={[0.6, 0.6, 1.6, 8]} />
      </mesh>
      {isSelf && (
        <mesh position-y={0.015} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.5, 0.62, 40]} />
          <meshBasicMaterial color="#1E1B2E" transparent opacity={0.55} />
        </mesh>
      )}
      <Html position={[0, 1.75, 0]} center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex flex-col items-center">
          {emojis.map((e) => (
            <span key={e.id} className="absolute -top-6 text-3xl animate-floatUp drop-shadow">
              {e.emoji}
            </span>
          ))}
          <div
            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-card ${
              isSelf ? 'bg-ink text-paper' : 'bg-paper/95 text-ink'
            } ${away ? 'opacity-60' : ''}`}
          >
            {isSelf ? 'You' : p.nickname}
            {p.isBot && <span className="ml-1 rounded-full bg-butter px-1.5 text-[9px] font-bold uppercase text-ink">demo</span>}
            {p.busy && !isSelf && <span className="ml-1">🎮</span>}
            {away && <span className="ml-1 font-normal text-ink-mute">· away</span>}
          </div>
        </div>
      </Html>
    </group>
  );
});

function Floor({ onTap }: { onTap: (x: number, z: number) => void }) {
  const [marker, setMarker] = useState<{ x: number; z: number; key: number } | null>(null);
  const ring = useRef<THREE.Mesh>(null);
  const born = useRef(0);
  useFrame(() => {
    if (!ring.current || !marker) return;
    const k = (performance.now() - born.current) / 700;
    ring.current.scale.setScalar(0.4 + k * 0.8);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 * (1 - k));
  });
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const c = clampToHall(e.point.x, e.point.z);
    born.current = performance.now();
    setMarker({ ...c, key: born.current });
    onTap(c.x, c.z);
  };
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03} onClick={onClick}>
        <planeGeometry args={[HALL.halfX * 2, HALL.halfZ * 2]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {marker && (
        <mesh key={marker.key} ref={ring} position={[marker.x, 0.05, marker.z]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.35, 0.5, 32]} />
          <meshBasicMaterial color="#1E1B2E" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

export function Hall({ participants, selfId, effects, spots, overview, focusId, onTapFloor, onTapToy }: Props) {
  const live = useMemo<Live>(() => new Map(), []);
  const byTarget = useMemo(() => {
    const m = new Map<string, Effect[]>();
    for (const e of effects) m.set(e.target, [...(m.get(e.target) ?? []), e]);
    return m;
  }, [effects]);
  const none = useMemo<Effect[]>(() => [], []);

  return (
    <Canvas
      orthographic
      dpr={[1, 1.75]}
      camera={{ position: [10, 11, 10], zoom: 40, near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#F2E8F7']} />
      <hemisphereLight args={['#FFF6EC', '#C9B8E8', 1.45]} />
      <directionalLight position={[6, 12, 8]} intensity={1.8} color="#FFF0DE" />
      <directionalLight position={[-8, 4, -2]} intensity={0.5} color="#B9C8FF" />
      <CameraRig live={live} selfId={selfId} overview={overview} focusId={focusId} />
      <Environment spots={spots} />
      <Floor onTap={onTapFloor} />
      {participants.map((p) => (
        <HallToy key={p.id} p={p} isSelf={p.id === selfId} live={live} effects={byTarget.get(p.id) ?? none} onTap={onTapToy} />
      ))}
    </Canvas>
  );
}
