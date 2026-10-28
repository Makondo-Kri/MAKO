// A small stage that shows one toy up close (welcome screen, creator, profile card).
import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { Avatar } from '../../shared/content.ts';
import { Toy, newMotion, vinyl } from './Toy.tsx';

function Turntable({ avatar, waveKey }: { avatar: Avatar; waveKey?: number }) {
  const g = useRef<THREE.Group>(null);
  const motion = useRef(newMotion());
  const lastWave = useRef(waveKey);
  useFrame((s) => {
    if (waveKey !== lastWave.current) {
      lastWave.current = waveKey;
      motion.current.waveUntil = performance.now() + 1400;
      motion.current.jumpUntil = performance.now() + 600;
    }
    if (g.current) g.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.6) * 0.45;
  });
  return (
    <group ref={g} onClick={() => (motion.current.waveUntil = performance.now() + 1400)}>
      <Toy avatar={avatar} motion={motion} />
    </group>
  );
}

export function ToyPreview({
  avatar,
  className = '',
  pedestal = true,
  waveKey,
  zoom = 1,
}: {
  avatar: Avatar;
  className?: string;
  pedestal?: boolean;
  waveKey?: number;
  zoom?: number;
}) {
  return (
    <div className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 1.2, 4.2 / zoom], fov: 30 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        onCreated={({ camera }) => camera.lookAt(0, 0.62, 0)}
      >
        <hemisphereLight args={['#FFF6EC', '#C9B8E8', 1.5]} />
        <directionalLight position={[3, 5, 4]} intensity={1.9} color="#FFF1E0" />
        <directionalLight position={[-4, 2, -2]} intensity={0.6} color="#B9C8FF" />
        <Suspense fallback={null}>
          <Turntable avatar={avatar} waveKey={waveKey} />
          {pedestal && (
            <mesh position-y={-0.08} material={vinyl('#FFFDF9', 0.6)}>
              <cylinderGeometry args={[0.85, 0.92, 0.14, 48]} />
            </mesh>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}

function Bobbing({ avatar, x, delay }: { avatar: Avatar; x: number; delay: number }) {
  const g = useRef<THREE.Group>(null);
  const motion = useRef(newMotion());
  useFrame((s) => {
    const t = s.clock.elapsedTime + delay;
    if (g.current) g.current.rotation.y = -x * 0.25 + Math.sin(t * 0.7) * 0.2;
    // every so often, someone waves
    if (Math.floor(t) % 6 === 0 && performance.now() > motion.current.waveUntil + 4000) motion.current.waveUntil = performance.now() + 1300;
  });
  return (
    <group ref={g} position={[x, 0, Math.abs(x) * -0.4]}>
      <Toy avatar={avatar} motion={motion} />
    </group>
  );
}

/** Three toys hanging out — used on the landing page. */
export function ToyTrio({ avatars, className = '' }: { avatars: [Avatar, Avatar, Avatar]; className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 1.3, 6], fov: 30 }} gl={{ alpha: true, powerPreference: 'low-power' }} onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}>
        <hemisphereLight args={['#FFF6EC', '#C9B8E8', 1.5]} />
        <directionalLight position={[3, 5, 4]} intensity={1.9} color="#FFF1E0" />
        <directionalLight position={[-4, 2, -2]} intensity={0.6} color="#B9C8FF" />
        <Bobbing avatar={avatars[0]} x={-1.25} delay={0} />
        <Bobbing avatar={avatars[1]} x={0} delay={2} />
        <Bobbing avatar={avatars[2]} x={1.25} delay={4} />
      </Canvas>
    </div>
  );
}
