import { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import BoatScene from './BoatScene';
import './App.css';

interface GameState {
  playerX: number;
  playerY: number;
  playerZ: number;
  direction: string;
}



const boatNames = [
  'Speed Boat E', 'Speed Boat A', 'Fishing Boat', 'Sailboat A', 'Row Boat',
  'Tug Boat', 'Small Ship', 'Cargo Ship', 'Large Ship', 'Ocean Liner'
];

// Smooth interpolation function
function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

// Easing function for smoother animation
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function App() {
  const [gameState, setGameState] = useState<GameState>({
    playerX: 0,
    playerY: 0,
    playerZ: 0,
    direction: 'N'
  });

  const [boatType, setBoatType] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0); // Add speed tracking
  const [moveQueue, setMoveQueue] = useState<string[]>([]);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startPositionRef = useRef({ x: 0, z: 0 });
  const targetPositionRef = useRef({ x: 0, z: 0 });
  const [boatTilt, setBoatTilt] = useState({ pitch: 0, roll: 0 }); // Add boat tilting
  
  const moveDistance = 2;
  const animationDuration = 600;

  const handleMove = useCallback((direction: string) => {
    // Add move to queue
    setMoveQueue(prev => [...prev, direction]);
    
    // Start processing if not already moving
    if (!isMoving) {
      setIsMoving(true);
      setTimeout(() => processNextMove(), 0);
    }
  }, [isMoving]); // Remove processNextMove from dependencies since it's defined later

  // Move processNextMove function before handleMove to fix dependency issues
  const processNextMove = useCallback(() => {
    if (moveQueue.length === 0) {
      setIsMoving(false);
      setCurrentSpeed(0);
      setBoatTilt({ pitch: 0, roll: 0 }); // Reset tilt when stopping
      return;
    }

    const direction = moveQueue[0];
    setMoveQueue(prev => prev.slice(1));
    setCurrentSpeed(moveQueue.length > 1 ? 2 : 1); // Higher speed for continuous movement

    const currentX = gameState.playerX;
    const currentZ = gameState.playerZ;
    let newX = currentX;
    let newZ = currentZ;
    let newDirection = gameState.direction;
    let tiltEffect = { pitch: 0, roll: 0 };
    
    switch (direction) {
      case 'up':
        newZ = Math.max(-50, currentZ - moveDistance);
        newDirection = 'N';
        tiltEffect = { pitch: -0.1, roll: 0 }; // Slight forward tilt
        break;
      case 'down':
        newZ = Math.min(50, currentZ + moveDistance);
        newDirection = 'S';
        tiltEffect = { pitch: 0.1, roll: 0 }; // Slight backward tilt
        break;
      case 'left':
        newX = Math.max(-50, currentX - moveDistance);
        newDirection = 'W';
        tiltEffect = { pitch: 0, roll: -0.15 }; // Left roll
        break;
      case 'right':
        newX = Math.min(50, currentX + moveDistance);
        newDirection = 'E';
        tiltEffect = { pitch: 0, roll: 0.15 }; // Right roll
        break;
    }
    
    // Set boat tilt for movement feedback
    setBoatTilt(tiltEffect);
    
    if (newX !== currentX || newZ !== currentZ) {
      startPositionRef.current = { x: currentX, z: currentZ };
      targetPositionRef.current = { x: newX, z: newZ };
      startTimeRef.current = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(elapsed / animationDuration, 1);
        const easedProgress = easeOutCubic(progress);
        
        const interpolatedX = lerp(startPositionRef.current.x, targetPositionRef.current.x, easedProgress);
        const interpolatedZ = lerp(startPositionRef.current.z, targetPositionRef.current.z, easedProgress);
        
        // Add subtle bobbing motion during movement
        const bobbing = Math.sin(elapsed * 0.01) * 0.05;
        
        setGameState(prevState => ({
          ...prevState,
          playerX: interpolatedX,
          playerY: bobbing, // Add bobbing effect
          playerZ: interpolatedZ,
          direction: newDirection
        }));
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setGameState(prevState => ({
            ...prevState,
            playerX: targetPositionRef.current.x,
            playerY: 0, // Reset Y position
            playerZ: targetPositionRef.current.z,
            direction: newDirection
          }));
          
          setTimeout(() => processNextMove(), 50);
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setGameState(prevState => ({
        ...prevState,
        direction: newDirection
      }));
      setTimeout(() => processNextMove(), 50);
    }
  }, [gameState, moveQueue, moveDistance, animationDuration]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Updated keyboard controls for continuous movement
  useEffect(() => {
    const pressedKeys = new Set<string>();
    let moveInterval: NodeJS.Timeout | null = null;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        event.preventDefault();
        
        if (!pressedKeys.has(key)) {
          pressedKeys.add(key);
          
          // Start continuous movement
          if (!moveInterval) {
            const moveFromKey = () => {
              if (pressedKeys.has('ArrowUp')) handleMove('up');
              if (pressedKeys.has('ArrowDown')) handleMove('down');
              if (pressedKeys.has('ArrowLeft')) handleMove('left');
              if (pressedKeys.has('ArrowRight')) handleMove('right');
            };
            
            moveFromKey(); // Immediate first move
            moveInterval = setInterval(moveFromKey, 200); // Continue every 200ms
          }
        }
      }
    };
    
    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        pressedKeys.delete(key);
        
        // Stop continuous movement if no keys pressed
        if (pressedKeys.size === 0 && moveInterval) {
          clearInterval(moveInterval);
          moveInterval = null;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (moveInterval) clearInterval(moveInterval);
    };
  }, [handleMove]);

  const getBoatRotation = (): [number, number, number] => {
    const baseRotation = {
      'N': [0, Math.PI, 0],
      'S': [0, 0, 0],
      'E': [0, Math.PI / 2, 0],
      'W': [0, -Math.PI / 2, 0]
    }[gameState.direction] || [0, 0, 0];
    
    // Apply tilt effects for movement feedback
    return [
      baseRotation[0] + boatTilt.pitch,
      baseRotation[1],
      baseRotation[2] + boatTilt.roll
    ] as [number, number, number];
  };

  return (
    <div className="game-container" style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      {/* 3D Scene */}
      <Canvas
        camera={{ position: [0, 12, 20], fov: 60 }}
        style={{ 
          width: '100vw', 
          height: '100vh',
          display: 'block',
          margin: 0,
          padding: 0,
          border: 'none',
          outline: 'none'
        }}
        shadows
      >
        <BoatScene 
          position={[gameState.playerX, gameState.playerY, gameState.playerZ]}
          rotation={getBoatRotation()}
          boatType={boatType}
        />
      </Canvas>
      
      {/* Boat Selection Panel - Hidden */}
      {false && (
        <div className="boat-selection" style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.8)',
          padding: '15px',
          borderRadius: '10px',
          color: 'white'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Boat Selection Panel</h3>
          <select 
            value={boatType} 
            onChange={(e) => setBoatType(Number(e.target.value))}
            style={{
              padding: '5px',
              borderRadius: '5px',
              border: 'none',
              background: '#333',
              color: 'white'
            }}
          >
            {boatNames.map((name, index) => (
              <option key={index} value={index}>{name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Control Buttons */}
      <div className="control-buttons" style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 60px)',
        gridTemplateRows: 'repeat(3, 60px)',
        gap: '5px'
      }}>
        <div></div>
        <button 
          onClick={() => handleMove('up')}
          disabled={isMoving}
          style={{
            backgroundColor: isMoving ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.8)',
            color: isMoving ? '#666' : 'white',
            border: '2px solid #fff',
            borderRadius: '25px',
            fontSize: '20px',
            cursor: isMoving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          ↑
        </button>
        <div></div>
        
        <button 
          onClick={() => handleMove('left')}
          disabled={isMoving}
          style={{
            backgroundColor: isMoving ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.8)',
            color: isMoving ? '#666' : 'white',
            border: '2px solid #fff',
            borderRadius: '25px',
            fontSize: '20px',
            cursor: isMoving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          ←
        </button>
        <div></div>
        <button 
          onClick={() => handleMove('right')}
          disabled={isMoving}
          style={{
            backgroundColor: isMoving ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.8)',
            color: isMoving ? '#666' : 'white',
            border: '2px solid #fff',
            borderRadius: '25px',
            fontSize: '20px',
            cursor: isMoving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          →
        </button>
        
        <div></div>
        <button 
          onClick={() => handleMove('down')}
          disabled={isMoving}
          style={{
            backgroundColor: isMoving ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.8)',
            color: isMoving ? '#666' : 'white',
            border: '2px solid #fff',
            borderRadius: '25px',
            fontSize: '20px',
            cursor: isMoving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          ↓
        </button>
        <div></div>
      </div>

      {/* Enhanced Status Display */}
      <div className="status-display" style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.8)',
        padding: '10px',
        borderRadius: '10px',
        color: 'white',
        fontSize: '12px',
        fontFamily: 'monospace',
        border: isMoving ? '2px solid #4FB3D9' : '2px solid transparent',
        transition: 'border-color 0.3s ease'
      }}>
        <div>Current Vessel: {boatNames[boatType]}</div>
        <div>Position: ({gameState.playerX.toFixed(1)}, {gameState.playerZ.toFixed(1)})</div>
        <div>Heading: {gameState.direction}</div>
        {isMoving && (
          <div style={{ color: '#4FB3D9', fontWeight: 'bold' }}>
            Status: Moving {currentSpeed > 1 ? '⚡ Fast' : '→ Normal'}
          </div>
        )}
        {moveQueue.length > 0 && (
          <div style={{ color: '#FFD700', fontSize: '10px' }}>
            Queue: {moveQueue.length} moves
          </div>
        )}
        <div style={{ 
          color: isMoving ? '#00FF00' : '#888888',
          fontSize: '10px',
          marginTop: '5px'
        }}>
          Engine: {isMoving ? 'RUNNING' : 'IDLE'}
        </div>
      </div>
    </div>
  );
}

export default App;