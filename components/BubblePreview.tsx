import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { ShapeType, BorderStyle } from '../types';
import type { BubbleProps, TailPosition } from '../types';
import UploadIcon from './icons/UploadIcon';

interface BubblePreviewProps {
  bubbles: BubbleProps[];
  activeBubbleId: number;
  svgRef: React.RefObject<SVGSVGElement>;
  onUpdate: (updates: Partial<BubbleProps>) => void;
  onActivateBubble: (id: number) => void;
  backgroundImage: string | null;
  onFileDrop: (file: File) => void;
}

const DraggableHandle: React.FC<{
  position: TailPosition;
  onMouseDown: (e: React.MouseEvent) => void;
}> = ({ position, onMouseDown }) => (
  <circle
    cx={position.x}
    cy={position.y}
    r="10"
    fill="rgba(59, 130, 246, 0.8)"
    stroke="white"
    strokeWidth="2"
    cursor="move"
    onMouseDown={onMouseDown}
  />
);

const ResizeHandle: React.FC<{
  x: number;
  y: number;
  cursor: string;
  onMouseDown: (e: React.MouseEvent) => void;
}> = ({ x, y, cursor, onMouseDown }) => (
  <rect
    x={x - 5}
    y={y - 5}
    width="10"
    height="10"
    fill="rgba(59, 130, 246, 0.8)"
    stroke="white"
    strokeWidth="1.5"
    cursor={cursor}
    onMouseDown={onMouseDown}
    rx="1"
  />
);

const getCurvedTailPath = (p1: TailPosition, p2: TailPosition, p3: TailPosition, bend: number) => {
    const mid13 = { x: (p1.x + p3.x) / 2, y: (p1.y + p3.y) / 2 };
    const perp13 = { x: -(p3.y - p1.y) * 0.5, y: (p3.x - p1.x) * 0.5 };
    const cp1 = { x: mid13.x + perp13.x * bend, y: mid13.y + perp13.y * bend };

    const mid23 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
    const perp23 = { x: -(p3.y - p2.y) * 0.5, y: (p3.x - p2.x) * 0.5 };
    // This sign flip is the crucial fix for the S-curve.
    const cp2 = { x: mid23.x + perp23.x * bend, y: mid23.y + perp23.y * bend };
    
    const strokePath = `M ${p1.x} ${p1.y} Q ${cp1.x} ${cp1.y} ${p3.x} ${p3.y} Q ${cp2.x} ${cp2.y} ${p2.x} ${p2.y}`;
    const fillPath = `${strokePath} Z`;
    
    return { strokePath, fillPath };
};

const getBubblePath = (bubbleProps: BubbleProps) => {
    const { shape, width, height, borderWidth, x: bubbleX, y: bubbleY } = bubbleProps;
    const w = width - borderWidth * 2;
    const h = height - borderWidth * 2;
    const bubbleLeft = bubbleX - width / 2;
    const bubbleTop = bubbleY - height / 2;
    const x = bubbleLeft + borderWidth;
    const y = bubbleTop + borderWidth;

    switch (shape) {
      case ShapeType.RECTANGLE:
        return `M${x + 20},${y} L${x + w - 20},${y} Q${x + w},${y} ${x + w},${y + 20} L${x + w},${y + h - 20} Q${x + w},${y + h} ${x + w - 20},${y + h} L${x + 20},${y + h} Q${x},${y + h} ${x},${y + h - 20} L${x},${y + 20} Q${x},${y} ${x + 20},${y} Z`;
      case ShapeType.RECTANGLE_SHARP:
        return `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`;
      case ShapeType.SHOUT: {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rx = w / 2;
        const ry = h / 2;

        let path = '';
        const numPoints = Math.floor(Math.max(w, h) / 15) * 2;
        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * 2 * Math.PI;
          const rFactor = i % 2 === 0 ? 1.0 : 0.8;
          const px = cx + Math.cos(angle) * rx * rFactor;
          const py = cy + Math.sin(angle) * ry * rFactor;
          path += (i === 0 ? 'M' : 'L') + `${px},${py} `;
        }
        return path + 'Z';
      }
      case ShapeType.THOUGHT: {
          const cx = x + w / 2;
          const cy = y + h / 2;
          const rx = w / 2;
          const ry = h / 2;
          let path = '';
          const numPuffs = Math.floor(Math.max(w, h) / 35) + 5;
          const puffRadius = Math.min(w,h) / numPuffs * 2.5;

          for (let i = 0; i < numPuffs; i++) {
            const angle1 = (i / numPuffs) * 2 * Math.PI;
            const angle2 = ((i + 1) / numPuffs) * 2 * Math.PI;
            const p1x = cx + Math.cos(angle1) * rx;
            const p1y = cy + Math.sin(angle1) * ry;
            if (i === 0) path += `M${p1x},${p1y} `;
            const p2x = cx + Math.cos(angle2) * rx;
            const p2y = cy + Math.sin(angle2) * ry;
            path += `A ${puffRadius} ${puffRadius} 0 0 1 ${p2x} ${p2y} `;
          }
          return path + 'Z';
      }
      case ShapeType.OVAL:
      default:
        return `M${x + w/2},${y} A${w/2},${h/2} 0 1 0 ${x + w/2},${y+h} A${w/2},${h/2} 0 1 0 ${x + w/2},${y} Z`;
    }
};
  
const getBorderStyleArray = (style: BorderStyle, width: number) => {
    if (width === 0) return "none";
    switch (style) {
        case BorderStyle.DASHED: return `${width * 2} ${width * 1.5}`;
        case BorderStyle.DOTTED: return `${width} ${width}`;
        case BorderStyle.SOLID: default: return 'none';
    }
};

interface BubbleGraphicProps {
  bubble: BubbleProps;
  isActive: boolean;
  showHandles: boolean;
  onActivate: (id: number) => void;
  onInteractionStart: (e: React.MouseEvent, type: 'tail' | 'bubble' | 'resize', payload: any) => void;
}

const BubbleGraphic: React.FC<BubbleGraphicProps> = ({ bubble, isActive, showHandles, onActivate, onInteractionStart }) => {
  const bubblePath = useMemo(() => getBubblePath(bubble), [bubble]);
  
  const { tailP1, tailP2, tailP3, tailBend, tailVisible, shape, fillColor, borderColor, borderWidth, bubbleShadow, id } = bubble;
  
  const tailPathData = useMemo(() => {
    if (!tailVisible || shape === ShapeType.THOUGHT) return { strokePath: '', fillPath: '' };
    return getCurvedTailPath(tailP1, tailP2, tailP3, tailBend);
  }, [tailVisible, shape, tailP1, tailP2, tailP3, tailBend]);
  
  const thoughtTailPoints = useMemo(() => {
    if (shape !== ShapeType.THOUGHT || !tailVisible) return [];
    const points = [];
    const numBubbles = 5;
    for (let i = 0; i < numBubbles; i++) {
        const t = i / (numBubbles - 1);
        const x = Math.pow(1 - t, 2) * tailP1.x + 2 * (1 - t) * t * tailP2.x + Math.pow(t, 2) * tailP3.x;
        const y = Math.pow(1 - t, 2) * tailP1.y + 2 * (1 - t) * t * tailP2.y + Math.pow(t, 2) * tailP3.y;
        points.push({x, y});
    }
    return points.reverse();
  }, [shape, tailVisible, tailP1, tailP2, tailP3]);

  const textStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '20px',
    boxSizing: 'border-box',
    color: bubble.textColor,
    fontSize: `${bubble.fontSize}px`,
    textAlign: bubble.textAlign,
    lineHeight: bubble.lineHeight,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    pointerEvents: 'none',
  };

  if (bubble.textShadow) {
    textStyle.textShadow = `${bubble.textShadowOffsetX}px ${bubble.textShadowOffsetY}px ${bubble.textShadowBlur}px ${bubble.textShadowColor}`;
  }
  if (bubble.textOutline) {
    (textStyle as any).WebkitTextStroke = `${bubble.textOutlineWidth}px ${bubble.textOutlineColor}`;
  }

  const borderDashArray = getBorderStyleArray(bubble.borderStyle, borderWidth);

  return (
    <g transform={`rotate(${bubble.rotation} ${bubble.x} ${bubble.y})`}>
      <g
        onMouseDown={() => { if (!isActive) onActivate(bubble.id); }}
        style={{ fontFamily: bubble.fontFamily, cursor: isActive ? 'default' : 'pointer' }}
      >
        {bubble.bubbleVisible && (
          <g filter={bubbleShadow ? `url(#bubble-shadow-${id})` : 'none'}>
            {/* The main bubble shape with its border */}
            <path
              d={bubblePath}
              fill={fillColor}
              stroke={borderColor}
              strokeWidth={borderWidth}
              strokeDasharray={borderDashArray}
              strokeLinejoin="round"
            />
            
            {/* The tail, drawn on top to create a seamless union */}
            {tailVisible && shape !== ShapeType.THOUGHT && (
              <>
                {/* Tail Fill (to cover the bubble border) */}
                <path d={tailPathData.fillPath} fill={fillColor} stroke="none" />
                {/* Tail Stroke for the sides */}
                <path
                  d={tailPathData.strokePath}
                  fill="none"
                  stroke={borderColor}
                  strokeWidth={borderWidth}
                  strokeDasharray={borderDashArray}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </>
            )}

            {/* Thought tail, which is a series of separate circles */}
            {tailVisible && shape === ShapeType.THOUGHT && (
              <g>
                {thoughtTailPoints.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={15 * ((i + 1) / (thoughtTailPoints.length + 1))}
                    fill={fillColor}
                    stroke={borderColor}
                    strokeWidth={borderWidth / 2}
                  />
                ))}
              </g>
            )}
          </g>
        )}

        {!bubble.bubbleVisible && (
          <rect
            x={bubble.x - bubble.width / 2}
            y={bubble.y - bubble.height / 2}
            width={bubble.width}
            height={bubble.height}
            fill="transparent"
          />
        )}

        <foreignObject 
          x={bubble.x - bubble.width / 2 + borderWidth} 
          y={bubble.y - bubble.height / 2 + borderWidth} 
          width={bubble.width - borderWidth * 2} 
          height={bubble.height - borderWidth * 2} 
          clipPath={`url(#bubble-clip-${bubble.id})`}
          style={{pointerEvents: 'none'}}
        >
          <div style={textStyle} dangerouslySetInnerHTML={{ __html: bubble.text }} />
        </foreignObject>
      </g>

      {isActive && (
        <g className="drag-handles">
            <circle
                cx={bubble.x}
                cy={bubble.y}
                r="8"
                fill="rgba(239, 68, 68, 0.9)"
                stroke="white"
                strokeWidth="2"
                cursor="move"
                onMouseDown={(e) => onInteractionStart(e, 'bubble', null)}
              />
          {bubble.tailVisible && (
            <>
              <DraggableHandle position={bubble.tailP1} onMouseDown={(e) => onInteractionStart(e, 'tail', 'tailP1')} />
              <DraggableHandle position={bubble.tailP2} onMouseDown={(e) => onInteractionStart(e, 'tail', 'tailP2')} />
              <DraggableHandle position={bubble.tailP3} onMouseDown={(e) => onInteractionStart(e, 'tail', 'tailP3')} />
            </>
          )}

          {showHandles && (
            <>
              <ResizeHandle x={bubble.x - bubble.width / 2} y={bubble.y - bubble.height / 2} cursor="nwse-resize" onMouseDown={(e) => onInteractionStart(e, 'resize', 'nw')} />
              <ResizeHandle x={bubble.x + bubble.width / 2} y={bubble.y - bubble.height / 2} cursor="nesw-resize" onMouseDown={(e) => onInteractionStart(e, 'resize', 'ne')} />
              <ResizeHandle x={bubble.x - bubble.width / 2} y={bubble.y + bubble.height / 2} cursor="nesw-resize" onMouseDown={(e) => onInteractionStart(e, 'resize', 'sw')} />
              <ResizeHandle x={bubble.x + bubble.width / 2} y={bubble.y + bubble.height / 2} cursor="nwse-resize" onMouseDown={(e) => onInteractionStart(e, 'resize', 'se')} />
              <ResizeHandle x={bubble.x} y={bubble.y - bubble.height / 2} cursor="ns-resize" onMouseDown={(e) => onInteractionStart(e, 'resize', 'n')} />
              <ResizeHandle x={bubble.x} y={bubble.y + bubble.height / 2} cursor="ns-resize" onMouseDown={(e) => onInteractionStart(e, 'resize', 's')} />
              <ResizeHandle x={bubble.x - bubble.width / 2} y={bubble.y} cursor="ew-resize" onMouseDown={(e) => onInteractionStart(e, 'resize', 'w')} />
              <ResizeHandle x={bubble.x + bubble.width / 2} y={bubble.y} cursor="ew-resize" onMouseDown={(e) => onInteractionStart(e, 'resize', 'e')} />
            </>
          )}
        </g>
      )}
    </g>
  );
};

const BubblePreview: React.FC<BubblePreviewProps> = ({ bubbles, activeBubbleId, svgRef, onUpdate, onActivateBubble, backgroundImage, onFileDrop }) => {
  const [draggingHandle, setDraggingHandle] = useState<keyof BubbleProps | null>(null);
  const [isDraggingBubble, setIsDraggingBubble] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [initialBubbleState, setInitialBubbleState] = useState<BubbleProps | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isInteracting = !!draggingHandle || isDraggingBubble || !!resizeDirection;
  
  const activeBubble = useMemo(() => bubbles.find(b => b.id === activeBubbleId), [bubbles, activeBubbleId]);

  const getSvgCoordinates = useCallback((e: MouseEvent | React.MouseEvent): {x: number, y: number} => {
    if (!containerRef.current) return {x: 0, y: 0};
    const svgRect = containerRef.current.getBoundingClientRect();
    const scaleX = 500 / svgRect.width;
    const scaleY = 350 / svgRect.height;
    return {
        x: (e.clientX - svgRect.left) * scaleX,
        y: (e.clientY - svgRect.top) * scaleY,
    };
  }, []);
  
  const handleInteractionStart = (e: React.MouseEvent, type: 'tail' | 'bubble' | 'resize', payload: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeBubble) return;

    const startPos = getSvgCoordinates(e);
    setDragStart(startPos);
    setInitialBubbleState(activeBubble);

    if (type === 'tail') setDraggingHandle(payload as keyof BubbleProps);
    else if (type === 'bubble') setIsDraggingBubble(true);
    else if (type === 'resize') setResizeDirection(payload as string);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isInteracting || !dragStart || !initialBubbleState) return;
    const currentPos = getSvgCoordinates(e);
    const dx = currentPos.x - dragStart.x;
    const dy = currentPos.y - dragStart.y;

    if (draggingHandle) {
        const initialHandlePos = initialBubbleState[draggingHandle] as TailPosition;
        onUpdate({ [draggingHandle]: { x: initialHandlePos.x + dx, y: initialHandlePos.y + dy } });
    } 
    else if (isDraggingBubble) {
        const { x, y, tailP1, tailP2, tailP3 } = initialBubbleState;
        onUpdate({
            x: x + dx,
            y: y + dy,
            tailP1: { x: tailP1.x + dx, y: tailP1.y + dy },
            tailP2: { x: tailP2.x + dx, y: tailP2.y + dy },
            tailP3: { x: tailP3.x + dx, y: tailP3.y + dy },
        });
    } 
    else if (resizeDirection) {
        const { x: iX, y: iY, width: iWidth, height: iHeight, rotation: iRotation, tailP1: iTailP1, tailP2: iTailP2, tailP3: iTailP3 } = initialBubbleState;
        let newX = iX, newY = iY, newWidth = iWidth, newHeight = iHeight;
        const minSize = 50;
        
        const angleRad = iRotation * (Math.PI / 180);
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        const dx_local = dx * cosA + dy * sinA;
        const dy_local = -dx * sinA + dy * cosA;
        
        let dw = 0;
        let dh = 0;

        if (resizeDirection.includes('e')) dw = dx_local;
        if (resizeDirection.includes('w')) dw = -dx_local;
        if (resizeDirection.includes('s')) dh = dy_local;
        if (resizeDirection.includes('n')) dh = -dy_local;

        newWidth = Math.max(minSize, iWidth + dw);
        newHeight = Math.max(minSize, iHeight + dh);

        let center_dx_local = 0;
        let center_dy_local = 0;

        if (resizeDirection.includes('e')) center_dx_local = (newWidth - iWidth) / 2;
        if (resizeDirection.includes('w')) center_dx_local = -(newWidth - iWidth) / 2;
        if (resizeDirection.includes('s')) center_dy_local = (newHeight - iHeight) / 2;
        if (resizeDirection.includes('n')) center_dy_local = -(newHeight - iHeight) / 2;
        
        const dx_world = center_dx_local * cosA - center_dy_local * sinA;
        const dy_world = center_dx_local * sinA + center_dy_local * cosA;
        
        newX = iX + dx_world;
        newY = iY + dy_world;

        const deltaX = newX - iX;
        const deltaY = newY - iY;

        onUpdate({
            width: Math.round(newWidth),
            height: Math.round(newHeight),
            x: Math.round(newX),
            y: Math.round(newY),
            tailP1: { x: iTailP1.x + deltaX, y: iTailP1.y + deltaY },
            tailP2: { x: iTailP2.x + deltaX, y: iTailP2.y + deltaY },
            tailP3: { x: iTailP3.x + deltaX, y: iTailP3.y + deltaY },
        });
    }
  }, [isInteracting, dragStart, initialBubbleState, draggingHandle, isDraggingBubble, resizeDirection, getSvgCoordinates, onUpdate]);
  
  const handleMouseUp = useCallback(() => {
    setDraggingHandle(null);
    setIsDraggingBubble(false);
    setResizeDirection(null);
    setDragStart(null);
    setInitialBubbleState(null);
  }, []);

  useEffect(() => {
    if (isInteracting) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mouseleave', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [isInteracting, handleMouseMove, handleMouseUp]);

  // Safeguard effect to prevent crashes when deleting the bubble being interacted with.
  useEffect(() => {
    if (initialBubbleState) {
        const isInteractingBubbleStillPresent = bubbles.some(b => b.id === initialBubbleState.id);
        if (!isInteractingBubbleStillPresent) {
            handleMouseUp();
        }
    }
  }, [bubbles, initialBubbleState, handleMouseUp]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
        return;
    }
    setIsDraggingOver(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFileDrop(e.dataTransfer.files[0]);
        e.dataTransfer.clearData();
    }
  };
  
  const showHandles = !draggingHandle && !isDraggingBubble;

  return (
    <div 
        ref={containerRef} 
        className="w-full h-full p-4 flex items-center justify-center bg-gray-700 rounded-lg shadow-inner relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
    >
      <svg ref={svgRef} viewBox="0 0 500 350" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {bubbles.map(bubble => (
            <React.Fragment key={`defs-${bubble.id}`}>
              <clipPath id={`bubble-clip-${bubble.id}`}>
                  <path d={getBubblePath(bubble)} />
              </clipPath>
              {bubble.bubbleShadow && (
                <filter id={`bubble-shadow-${bubble.id}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow 
                    dx={bubble.bubbleShadowOffsetX} 
                    dy={bubble.bubbleShadowOffsetY} 
                    stdDeviation={bubble.bubbleShadowBlur / 2} 
                    floodColor={bubble.bubbleShadowColor}
                    floodOpacity="1"
                  />
                </filter>
              )}
            </React.Fragment>
          ))}
        </defs>
        
        {backgroundImage && (
            <image
                id="background-image"
                href={backgroundImage}
                x="0"
                y="0"
                width="500"
                height="350"
                preserveAspectRatio="xMidYMid meet"
            />
        )}

        {bubbles.map(bubble => (
            <BubbleGraphic
              key={bubble.id}
              bubble={bubble}
              isActive={bubble.id === activeBubbleId}
              showHandles={showHandles}
              onActivate={onActivateBubble}
              onInteractionStart={handleInteractionStart}
            />
        ))}
      </svg>
      {isDraggingOver && (
        <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center border-4 border-dashed border-gray-400 rounded-lg pointer-events-none z-10 transition-opacity">
            <UploadIcon className="w-16 h-16 text-white mb-4" />
            <p className="text-white text-xl font-bold">Drop Image to Upload</p>
        </div>
      )}
    </div>
  );
};

export default BubblePreview;