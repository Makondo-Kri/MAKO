// The miniature venue: floor, walls, coffee corner, play zone, stage and
// meetup pins. Static geometry only, so it costs almost nothing per frame.
import { memo, useMemo } from 'react';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { HALL, SPOT_SLOTS, ZONES } from '../../shared/content.ts';
import type { Spot } from '../../shared/protocol.ts';
import { vinyl } from './Toy.tsx';

const C = {
  floor: '#F3E9DA',
  floorEdge: '#E2D3BE',
  wall: '#EADFF5',
  wallTrim: '#D9C9EE',
  wood: '#D9A877',
  woodDark: '#B98559',
  ink: '#3A3550',
  white: '#FFFDF9',
  mainRug: '#E4DBFF',
  coffeeRug: '#FFE9B8',
  playRug: '#CFF2E2',
  leaf: '#5DBB86',
  leafDark: '#3E9A69',
  pot: '#F08A6B',
};

function Rug({ x, z, r, color }: { x: number; z: number; r: number; color: string }) {
  return (
    <mesh position={[x, 0.02, z]} material={vinyl(color, 0.95)}>
      <cylinderGeometry args={[r, r, 0.04, 56]} />
    </mesh>
  );
}

function Plant({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position-y={0.25} material={vinyl(C.pot, 0.6)}>
        <cylinderGeometry args={[0.28, 0.22, 0.5, 20]} />
      </mesh>
      <mesh position-y={0.85} material={vinyl(C.leaf, 0.7)} scale={[0.5, 0.6, 0.5]}>
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
      <mesh position={[0.22, 1.15, 0.1]} material={vinyl(C.leafDark, 0.7)} scale={0.3}>
        <sphereGeometry args={[1, 12, 10]} />
      </mesh>
    </group>
  );
}

function ZoneLabel({ x, z, text, tone }: { x: number; z: number; text: string; tone: string }) {
  return (
    <Html position={[x, 0.05, z]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] shadow-card" style={{ background: tone, color: '#1E1B2E' }}>
        {text}
      </div>
    </Html>
  );
}

function CoffeeCorner({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* counter */}
      <RoundedBox args={[3.2, 1, 0.9]} radius={0.12} position={[0, 0.5, -1.5]} material={vinyl(C.wood, 0.55)} />
      <RoundedBox args={[3.3, 0.12, 1]} radius={0.05} position={[0, 1.04, -1.5]} material={vinyl(C.white, 0.4)} />
      {/* espresso machine */}
      <RoundedBox args={[0.8, 0.7, 0.55]} radius={0.1} position={[-0.8, 1.45, -1.6]} material={vinyl('#C9C2D6', 0.3)} />
      <mesh position={[-0.8, 1.55, -1.3]} material={vinyl(C.ink, 0.3)} scale={[0.08, 0.2, 0.08]}>
        <cylinderGeometry args={[1, 1, 1, 12]} />
      </mesh>
      {/* cups */}
      {[0.3, 0.7, 1.1].map((cx, i) => (
        <group key={i} position={[cx, 1.2, -1.4]}>
          <mesh material={vinyl(['#FF7A5C', '#5BB8F5', '#F7D154'][i], 0.4)}>
            <cylinderGeometry args={[0.11, 0.09, 0.2, 16]} />
          </mesh>
        </group>
      ))}
      {/* stools + little table */}
      <mesh position={[0.4, 0.38, 0.4]} material={vinyl(C.white, 0.5)}>
        <cylinderGeometry args={[0.55, 0.55, 0.08, 28]} />
      </mesh>
      <mesh position={[0.4, 0.18, 0.4]} material={vinyl(C.ink, 0.4)}>
        <cylinderGeometry args={[0.06, 0.12, 0.36, 12]} />
      </mesh>
      {[
        [-0.5, 0.6],
        [1.2, -0.1],
      ].map(([sx, sz], i) => (
        <mesh key={i} position={[0.4 + sx, 0.2, 0.4 + sz]} material={vinyl('#FFA23A', 0.5)}>
          <cylinderGeometry args={[0.25, 0.22, 0.4, 20]} />
        </mesh>
      ))}
    </group>
  );
}

function PlayZone({ x, z }: { x: number; z: number }) {
  const blocks = useMemo(
    () => [
      { p: [-1.2, 0.3, -1.3], c: '#FF7A5C', r: 0.2 },
      { p: [-0.6, 0.3, -1.4], c: '#5BB8F5', r: -0.1 },
      { p: [-0.9, 0.9, -1.35], c: '#F7D154', r: 0.35 },
      { p: [1.4, 0.3, -0.2], c: '#A88BF5', r: 0.5 },
    ],
    [],
  );
  return (
    <group position={[x, 0, z]}>
      {blocks.map((b, i) => (
        <RoundedBox key={i} args={[0.6, 0.6, 0.6]} radius={0.1} position={b.p as [number, number, number]} rotation-y={b.r} material={vinyl(b.c, 0.45)} />
      ))}
      {/* ball pit balls */}
      {[
        [0.9, 0.22, -1.3, '#FF7A5C'],
        [1.25, 0.22, -1.05, '#5FD3A5'],
        [0.6, 0.22, -0.95, '#F58BB8'],
        [-1.6, 0.22, 0.4, '#5BB8F5'],
      ].map(([bx, by, bz, c], i) => (
        <mesh key={i} position={[bx as number, by as number, bz as number]} material={vinyl(c as string, 0.35)} scale={0.22}>
          <sphereGeometry args={[1, 16, 12]} />
        </mesh>
      ))}
      {/* tiny arcade cabinet */}
      <group position={[0.2, 0, -1.8]}>
        <RoundedBox args={[0.9, 1.6, 0.7]} radius={0.1} position-y={0.8} material={vinyl('#5A3FC0', 0.45)} />
        <mesh position={[0, 1.15, 0.36]} material={vinyl('#9FF5D3', 0.2)}>
          <boxGeometry args={[0.6, 0.42, 0.02]} />
        </mesh>
        <mesh position={[-0.15, 0.78, 0.4]} material={vinyl('#FF6B4A', 0.3)} scale={0.06}>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
      </group>
    </group>
  );
}

function Stage() {
  return (
    <group position={[0, 0, -3.4]}>
      <RoundedBox args={[4.2, 0.3, 1.4]} radius={0.1} position-y={0.15} material={vinyl(C.white, 0.5)} />
      <RoundedBox args={[3.4, 1.4, 0.15]} radius={0.06} position={[0, 1.2, -0.55]} material={vinyl(C.ink, 0.45)} />
      <mesh position={[0, 1.2, -0.47]} material={vinyl('#FF7A5C', 0.4)}>
        <boxGeometry args={[3.0, 1.0, 0.02]} />
      </mesh>
      <mesh position={[0, 0.65, 0.1]} material={vinyl(C.ink, 0.4)} scale={[0.04, 0.7, 0.04]}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
      </mesh>
    </group>
  );
}

function SpotPin({ x, z, index, spot }: { x: number; z: number; index: number; spot: Spot }) {
  const color = ['#FF7A5C', '#8C6CF0', '#3FBF8F', '#FFA23A', '#5BB8F5', '#F58BB8'][index % 6];
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.03} material={vinyl(color, 0.7)}>
        <cylinderGeometry args={[0.85, 0.85, 0.04, 40]} />
      </mesh>
      <mesh position-y={0.05} material={vinyl(C.white, 0.7)}>
        <cylinderGeometry args={[0.65, 0.65, 0.04, 40]} />
      </mesh>
      <mesh position-y={0.7} material={vinyl(C.ink, 0.4)} scale={[0.04, 1.3, 0.04]}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
      </mesh>
      <mesh position-y={1.45} material={vinyl(color, 0.35)} scale={0.24}>
        <sphereGeometry args={[1, 18, 14]} />
      </mesh>
      <Html position={[0, 1.95, 0]} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-paper/95 pl-1 pr-2.5 py-1 text-[11px] font-semibold text-ink shadow-card">
          <span className="grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: color }}>
            {index + 1}
          </span>
          {spot.name}
        </div>
      </Html>
    </group>
  );
}

export const Environment = memo(function Environment({ spots }: { spots: Spot[] }) {
  const floorShape = useMemo(() => new THREE.BoxGeometry(HALL.halfX * 2 + 1, 0.6, HALL.halfZ * 2 + 1), []);
  const zone = (id: string) => ZONES.find((z) => z.id === id)!;
  const coffee = zone('coffee');
  const play = zone('play');
  const W = HALL.halfX + 0.5;
  return (
    <group>
      {/* floor slab */}
      <mesh geometry={floorShape} position-y={-0.3} material={vinyl(C.floorEdge, 0.8)} />
      <mesh position-y={0.001} rotation-x={-Math.PI / 2} material={vinyl(C.floor, 0.9)}>
        <planeGeometry args={[W * 2 - 0.2, W * 2 - 0.2]} />
      </mesh>
      {/* back walls (the camera looks from the front-right, so walls sit at -x and -z) */}
      <mesh position={[0, 1.1, -W - 0.15]} material={vinyl(C.wall, 0.85)}>
        <boxGeometry args={[W * 2 + 0.3, 2.8, 0.3]} />
      </mesh>
      <mesh position={[-W - 0.15, 1.1, 0]} material={vinyl(C.wall, 0.85)}>
        <boxGeometry args={[0.3, 2.8, W * 2 + 0.6]} />
      </mesh>
      {/* windows */}
      {[-6, -1.5, 3, 7.5].map((wx) => (
        <mesh key={'w' + wx} position={[wx, 1.5, -W + 0.02]} material={vinyl('#CFE6FF', 0.2)}>
          <boxGeometry args={[2.4, 1.3, 0.04]} />
        </mesh>
      ))}
      {[-3, 4].map((wz) => (
        <mesh key={'s' + wz} position={[-W + 0.02, 1.5, wz]} material={vinyl('#CFE6FF', 0.2)}>
          <boxGeometry args={[0.04, 1.3, 2.4]} />
        </mesh>
      ))}

      <Rug x={0} z={0} r={3.6} color={C.mainRug} />
      <Rug x={coffee.x} z={coffee.z} r={coffee.radius} color={C.coffeeRug} />
      <Rug x={play.x} z={play.z} r={play.radius} color={C.playRug} />

      <Stage />
      <CoffeeCorner x={coffee.x} z={coffee.z} />
      <PlayZone x={play.x} z={play.z} />

      <Plant x={-10} z={-10} s={1.2} />
      <Plant x={10.1} z={-10} />
      <Plant x={-10.1} z={10.1} />
      <Plant x={10} z={10} s={0.9} />
      <Plant x={-2.8} z={-10.1} s={0.8} />
      <Plant x={-10.1} z={-1} s={0.85} />

      <ZoneLabel x={0} z={2.2} text="Main Hall" tone="#E4DBFF" />
      <ZoneLabel x={coffee.x + 0.4} z={coffee.z + 1.9} text="Coffee Corner" tone="#FFE9B8" />
      <ZoneLabel x={play.x} z={play.z + 1.9} text="Play Zone" tone="#CFF2E2" />

      {spots.slice(0, SPOT_SLOTS.length).map((s, i) => (
        <SpotPin key={s.id} spot={s} index={i} x={SPOT_SLOTS[i].x} z={SPOT_SLOTS[i].z} />
      ))}
    </group>
  );
});
