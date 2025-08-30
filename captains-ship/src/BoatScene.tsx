import React, { Suspense, useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface BoatModelProps {
  position: [number, number, number];
  rotation: [number, number, number];
  modelPath: string;
  materialPath: string;
}


function BoatModel({ position, rotation, modelPath, materialPath }: BoatModelProps) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const meshRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();

    // Load materials first
    mtlLoader.load(
      materialPath,
      (materials) => {
        materials.preload();
        objLoader.setMaterials(materials);
        
        // Then load the OBJ model
        objLoader.load(
          modelPath,
          (object) => {
            setModel(object);
          },
          undefined,
          (error) => {
            console.warn('Error loading OBJ model:', error);
            // Create a simple fallback geometry
            const geometry = new THREE.BoxGeometry(2, 0.5, 4);
            const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const fallbackMesh = new THREE.Mesh(geometry, material);
            const fallbackGroup = new THREE.Group();
            fallbackGroup.add(fallbackMesh);
            setModel(fallbackGroup);
          }
        );
      },
      undefined,
      (error) => {
        console.warn('Error loading MTL materials:', error);
        // Load OBJ without materials
        objLoader.load(
          modelPath,
          (object) => {
            setModel(object);
          },
          undefined,
          (error) => {
            console.warn('Error loading OBJ model without materials:', error);
            // Create a simple fallback geometry
            const geometry = new THREE.BoxGeometry(2, 0.5, 4);
            const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const fallbackMesh = new THREE.Mesh(geometry, material);
            const fallbackGroup = new THREE.Group();
            fallbackGroup.add(fallbackMesh);
            setModel(fallbackGroup);
          }
        );
      }
    );
  }, [modelPath, materialPath]);

  useFrame((state) => {
    if (meshRef.current) {
      // Keep boat at fixed position without wave movement
      meshRef.current.position.set(
        position[0],
        position[1], // No wave height added
        position[2]
      );
      
      // Keep boat level without wave-based tilting
      meshRef.current.rotation.set(
        rotation[0], // No pitch from waves
        rotation[1], // Yaw (left/right rotation)
        rotation[2]  // No roll from waves
      );
    }
  });

  if (!model) {
    return (
      <group position={position} rotation={rotation}>
        <mesh>
          <boxGeometry args={[2, 0.5, 4]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={meshRef}>
      <primitive object={model} scale={[0.5, 0.5, 0.5]} />
    </group>
  );
}

function Ocean() {
  const oceanRef = useRef<THREE.Mesh>(null);
  
  const oceanMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        deepColor: { value: new THREE.Color('#0099CC') }, // Light blue for deep areas
        shallowColor: { value: new THREE.Color('#87CEEB') }, // Sky blue for shallow areas
        midColor: { value: new THREE.Color('#4FC3F7') }, // Medium light blue
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vPosition;
        varying float vDistance;
        
        void main() {
          vUv = uv;
          vec3 pos = position;
          
          // Create gentle wave motion
          pos.z += sin(pos.x * 0.1 + time * 0.5) * 0.1;
          pos.z += cos(pos.y * 0.1 + time * 0.3) * 0.05;
          
          vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
          vPosition = worldPosition.xyz;
          vDistance = length(worldPosition.xyz);
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 deepColor;
        uniform vec3 shallowColor;
        uniform vec3 midColor;
        uniform float time;
        varying vec2 vUv;
        varying vec3 vPosition;
        varying float vDistance;
        
        void main() {
          // Create distance-based color mixing for depth effect
          float normalizedDistance = clamp(vDistance / 1000.0, 0.0, 1.0);
          
          vec3 color;
          if (normalizedDistance < 0.5) {
            // Close to camera: light blue to medium blue
            color = mix(shallowColor, midColor, normalizedDistance * 2.0);
          } else {
            // Far from camera: medium blue to deep blue
            color = mix(midColor, deepColor, (normalizedDistance - 0.5) * 2.0);
          }
          
          // Add depth shading based on distance
          float depthShading = 1.0 - normalizedDistance * 0.2;
          color *= depthShading;
          
          // Enhanced lighting effects
          vec3 lightDir1 = normalize(vec3(1.0, 1.0, 0.5));
          vec3 lightDir2 = normalize(vec3(-0.5, 0.8, -1.0));
          vec3 normal = normalize(cross(dFdx(vPosition), dFdy(vPosition)));
          
          float light1 = max(dot(normal, lightDir1), 0.0) * 0.6;
          float light2 = max(dot(normal, lightDir2), 0.0) * 0.3;
          
          color += light1 + light2;
          
          // Add subtle wave-like depth variation
          float waveDepth = sin(vPosition.x * 0.01 + time * 0.2) * 0.1 + 
                           cos(vPosition.z * 0.01 + time * 0.15) * 0.05;
          color *= (1.0 + waveDepth);
          
          gl_FragColor = vec4(color, 0.7);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }, []);

  useFrame((state) => {
    if (oceanMaterial) {
      oceanMaterial.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  return (
    <>
      {/* Main ocean surface */}
      <mesh ref={oceanRef} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8000, 8000, 100, 100]} />
        <primitive object={oceanMaterial} />
      </mesh>
    </>
  );
}

// Remove the entire Obstacles component - delete lines 209-308

interface BoatSceneProps {
  position: [number, number, number];
  rotation: [number, number, number];
  boatType: number;
}

const boatModels = [
  { obj: '/obj/boat-speed-e.obj', mtl: '/obj/boat-speed-e.mtl', name: 'Speed Boat E' },
  { obj: '/obj/boat-speed-a.obj', mtl: '/obj/boat-speed-a.mtl', name: 'Speed Boat A' },
  { obj: '/obj/boat-fishing-small.obj', mtl: '/obj/boat-fishing-small.mtl', name: 'Fishing Boat' },
  { obj: '/obj/boat-sail-a.obj', mtl: '/obj/boat-sail-a.mtl', name: 'Sailboat A' },
  { obj: '/obj/boat-row-large.obj', mtl: '/obj/boat-row-large.mtl', name: 'Row Boat' },
  { obj: '/obj/boat-tug-a.obj', mtl: '/obj/boat-tug-a.mtl', name: 'Tug Boat' },
  { obj: '/obj/ship-small.obj', mtl: '/obj/ship-small.mtl', name: 'Small Ship' },
  { obj: '/obj/ship-cargo-a.obj', mtl: '/obj/ship-cargo-a.mtl', name: 'Cargo Ship' },
  { obj: '/obj/ship-large.obj', mtl: '/obj/ship-large.mtl', name: 'Large Ship' },
  { obj: '/obj/ship-ocean-liner.obj', mtl: '/obj/ship-ocean-liner.mtl', name: 'Ocean Liner' }
];

export default function BoatScene({ position, rotation, boatType }: BoatSceneProps) {
  const selectedBoat = boatModels[boatType] || boatModels[0];
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame(() => {
    if (cameraRef.current) {
      // Smooth camera following
      const targetX = position[0];
      const targetY = position[1] + 5;
      const targetZ = position[2] + 8;
      
      cameraRef.current.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.1);
      cameraRef.current.lookAt(position[0], position[1], position[2]);
    }
  });

  return (
    <Suspense fallback={null}>
      {/* Sky background */}
      <color attach="background" args={['#87CEEB']} />
      <fog attach="fog" args={['#87CEEB', 300, 1200]} />
      
      {/* Sky sphere for horizon */}
      <mesh>
        <sphereGeometry args={[5000, 32, 32]} />
        <meshBasicMaterial 
          color="#87CEEB" 
          side={THREE.BackSide} 
          fog={false}
        />
      </mesh>
      
      <PerspectiveCamera 
        ref={cameraRef}
        makeDefault 
        position={[position[0], position[1] + 5, position[2] + 8]}
        fov={75}
      />
      
      <ambientLight intensity={0.8} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1.2} 
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      {/* Add secondary light for better ocean depth visibility */}
      <directionalLight 
        position={[-5, 8, -10]} 
        intensity={0.4} 
        color="#B0E0E6"
      />
      
      <Ocean />
      <BoatModel 
        position={position} 
        rotation={rotation}
        modelPath={selectedBoat.obj}
        materialPath={selectedBoat.mtl}
      />
    </Suspense>
  );
}