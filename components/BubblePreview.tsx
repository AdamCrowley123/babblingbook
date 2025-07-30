
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { ShapeType, BorderStyle, TailType } from '../types';
import type { BubbleProps, TailPosition, TailProps } from '../types';
import UploadIcon from './icons/UploadIcon';

interface BubblePreviewProps {
  bubbles: BubbleProps[];
  activeBubbleId: number;
  svgRef: React.RefObject<SVGSVGElement>;
  onUpdate: (updates: Partial<BubbleProps>) => void;
  onActivateBubble: (id: number) => void;
  backgroundImage: string | null;
  onFileDrop: (file: File) => void;
  viewBox: string;
  setViewBox: (viewBox: string) => void;
  minViewBoxWidth: number;
  maxViewBoxWidth: number;
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
    const cp2 = { x: mid23.x + perp23.x * bend, y: mid23.y + perp23.y * bend };
    
    const strokePath = `M ${p1.x} ${p1.y} Q ${cp1.x} ${cp1.y} ${p3.x} ${p3.y} Q ${cp2.x} ${cp2.y} ${p2.x} ${p2.y}`;
    const fillPath = `${strokePath} Z`;
    
    return { strokePath, fillPath };
};

const getLightningTailPath = (p1: TailPosition, p2: TailPosition, p3: TailPosition, zigs: number) => {
    const numZigs = Math.max(2, zigs);
    const midBase = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const baseWidth = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    const vector = { x: p3.x - midBase.x, y: p3.y - midBase.y };
    
    const leftContour = [];
    const rightContour = [];

    // Generate points for the jagged sides with a deterministic zig-zag
    for (let i = 1; i < numZigs; i++) {
        const progress = i / numZigs;
        const pointOnSpine = { x: midBase.x + vector.x * progress, y: midBase.y + vector.y * progress };

        // Perpendicular to the spine
        const normal = { x: -vector.y, y: vector.x };
        const nLength = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
        if (nLength > 0) {
            normal.x /= nLength;
            normal.y /= nLength;
        }

        const widthAtProgress = (baseWidth / 2) * (1 - progress); // Tapering width

        // Alternating offset for a sharp, uniform zig-zag instead of random
        const jitterMagnitude = widthAtProgress / 2;
        const jitterOffset = (i % 2 === 0) ? jitterMagnitude : -jitterMagnitude;

        const jitteredSpinePoint = {
            x: pointOnSpine.x + normal.x * jitterOffset,
            y: pointOnSpine.y + normal.y * jitterOffset
        };

        const sideWidth = widthAtProgress * 0.7; // Width on either side of the jittered spine

        leftContour.push({
            x: jitteredSpinePoint.x + normal.x * sideWidth,
            y: jitteredSpinePoint.y + normal.y * sideWidth
        });
        rightContour.push({
            x: jitteredSpinePoint.x - normal.x * sideWidth,
            y: jitteredSpinePoint.y - normal.y * sideWidth
        });
    }

    // Build the SVG path data string
    const pathSegments = [`M ${p1.x} ${p1.y}`];
    leftContour.forEach(p => pathSegments.push(`L ${p.x} ${p.y}`));
    pathSegments.push(`L ${p3.x} ${p3.y}`);
    rightContour.reverse().forEach(p => pathSegments.push(`L ${p.x} ${p.y}`));
    pathSegments.push(`L ${p2.x} ${p2.y}`);

    const strokePath = pathSegments.join(' ');
    const fillPath = strokePath + ' Z'; // Close the path for filling
    
    return { strokePath, fillPath };
};


const getBubblePath = (bubbleProps: BubbleProps) => {
    const { shape, width, height, borderWidth, x: bubbleX, y: bubbleY, shoutSpikes, thoughtPuffs } = bubbleProps;
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
        const numPoints = shoutSpikes * 2;
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
          const numPuffs = thoughtPuffs;
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

const getThoughtTailPoints = (tail: TailProps) => {
    const points = [];
    const numBubbles = 5;
    for (let i = 0; i < numBubbles; i++) {
        const t = i / (numBubbles - 1);
        const {p1, p2, p3} = tail;
        const x = Math.pow(1 - t, 2) * p1.x + 2 * (1 - t) * t * p2.x + Math.pow(t, 2) * p3.x;
        const y = Math.pow(1 - t, 2) * p1.y + 2 * (1 - t) * t * p2.y + Math.pow(t, 2) * p3.y;
        points.push({x, y});
    }
    return points.reverse();
};

interface BubbleGraphicProps {
  bubble: BubbleProps;
  isActive: boolean;
  showHandles: boolean;
  onActivate: (id: number) => void;
  onInteractionStart: (e: React.MouseEvent, type: 'tail' | 'bubble' | 'resize', payload: any) => void;
}

const BubbleGraphic: React.FC<BubbleGraphicProps> = React.memo(({ bubble, isActive, showHandles, onActivate, onInteractionStart }) => {
  const bubblePath = useMemo(() => getBubblePath(bubble), [bubble]);
  const { tailVisible, shape, fillColor, borderColor, borderWidth, bubbleShadow, id, tails } = bubble;
  
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

  const textShadows: string[] = [];

  // Create outline using multiple text-shadows. This technique creates a stroke
  // that expands outwards, unlike -webkit-text-stroke which is centered.
  if (bubble.textOutline && bubble.textOutlineWidth > 0) {
    const w = bubble.textOutlineWidth;
    const c = bubble.textOutlineColor;
    // Using 8 points for a solid outline effect.
    textShadows.push(`${-w}px ${-w}px 0 ${c}`);
    textShadows.push(`0px ${-w}px 0 ${c}`);
    textShadows.push(`${w}px ${-w}px 0 ${c}`);
    textShadows.push(`${-w}px 0px 0 ${c}`);
    textShadows.push(`${w}px 0px 0 ${c}`);
    textShadows.push(`${-w}px ${w}px 0 ${c}`);
    textShadows.push(`0px ${w}px 0 ${c}`);
    textShadows.push(`${w}px ${w}px 0 ${c}`);
  }

  // Add the regular drop shadow, it will be layered on top of the outline.
  if (bubble.textShadow) {
    textShadows.push(`${bubble.textShadowOffsetX}px ${bubble.textShadowOffsetY}px ${bubble.textShadowBlur}px ${bubble.textShadowColor}`);
  }

  if (textShadows.length > 0) {
    textStyle.textShadow = textShadows.join(', ');
  }

  const borderDashArray = getBorderStyleArray(bubble.borderStyle, borderWidth);

  return (
    <g transform={`rotate(${bubble.rotation} ${bubble.x} ${bubble.y})`}>
      <g
        onMouseDown={(e) => { if (e.button === 0 && !isActive) onActivate(bubble.id); }}
        style={{ fontFamily: bubble.fontFamily, cursor: isActive ? 'default' : 'pointer' }}
      >
        {bubble.bubbleVisible && (
          <g filter={bubbleShadow ? `url(#bubble-shadow-${id})` : 'none'}>
            <path
              d={bubblePath}
              fill={fillColor}
              stroke={borderColor}
              strokeWidth={borderWidth}
              strokeDasharray={borderDashArray}
              strokeLinejoin="round"
            />
            
            {tailVisible && shape !== ShapeType.THOUGHT && tails.map(tail => {
                const pathData = tail.type === TailType.LIGHTNING
                    ? getLightningTailPath(tail.p1, tail.p2, tail.p3, tail.zigs)
                    : getCurvedTailPath(tail.p1, tail.p2, tail.p3, tail.bend);
                return (
                    <g key={tail.id}>
                        <path d={pathData.fillPath} fill={fillColor} stroke="none" />
                        <path
                            d={pathData.strokePath}
                            fill="none"
                            stroke={borderColor}
                            strokeWidth={borderWidth}
                            strokeDasharray={borderDashArray}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                    </g>
                );
            })}

            {tailVisible && shape === ShapeType.THOUGHT && tails.map(tail => (
              <g key={tail.id}>
                {getThoughtTailPoints(tail).map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={15 * ((i + 1) / 6)}
                    fill={fillColor}
                    stroke={borderColor}
                    strokeWidth={borderWidth / 2}
                  />
                ))}
              </g>
            ))}
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
            {bubble.tailVisible && tails.map(tail => (
                <g key={`handle-${tail.id}`}>
                    <DraggableHandle position={tail.p1} onMouseDown={(e) => onInteractionStart(e, 'tail', {id: tail.id, handle: 'p1'})} />
                    <DraggableHandle position={tail.p2} onMouseDown={(e) => onInteractionStart(e, 'tail', {id: tail.id, handle: 'p2'})} />
                    <DraggableHandle position={tail.p3} onMouseDown={(e) => onInteractionStart(e, 'tail', {id: tail.id, handle: 'p3'})} />
                </g>
            ))}

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
});

const BubblePreview: React.FC<BubblePreviewProps> = ({ bubbles, activeBubbleId, svgRef, onUpdate, onActivateBubble, backgroundImage, onFileDrop, viewBox, setViewBox, minViewBoxWidth, maxViewBoxWidth }) => {
  const [draggingTailHandle, setDraggingTailHandle] = useState<{ id: number; handle: 'p1' | 'p2' | 'p3' } | null>(null);
  const [isDraggingBubble, setIsDraggingBubble] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [initialBubbleState, setInitialBubbleState] = useState<BubbleProps | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isInteractingWithBubble = !!draggingTailHandle || isDraggingBubble || !!resizeDirection;
  const panningState = useRef<{ startX: number; startY: number; viewBoxX: number; viewBoxY: number; } | null>(null);

  const activeBubble = useMemo(() => bubbles.find(b => b.id === activeBubbleId), [bubbles, activeBubbleId]);

  const getSvgCoordinates = useCallback((e: MouseEvent | React.MouseEvent): {x: number, y: number} => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const CTM = svg.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    let pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    pt = pt.matrixTransform(CTM.inverse());
    return { x: pt.x, y: pt.y };
  }, [svgRef]);
  
  const handleInteractionStart = (e: React.MouseEvent, type: 'tail' | 'bubble' | 'resize', payload: any) => {
    if (e.button !== 0) return; // Only allow left click for bubble interactions
    e.preventDefault();
    e.stopPropagation();
    if (!activeBubble) return;

    const startPos = getSvgCoordinates(e);
    setDragStart(startPos);
    setInitialBubbleState(activeBubble);

    if (type === 'tail') setDraggingTailHandle(payload);
    else if (type === 'bubble') setIsDraggingBubble(true);
    else if (type === 'resize') setResizeDirection(payload as string);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isInteractingWithBubble || !dragStart || !initialBubbleState) return;
    const currentPos = getSvgCoordinates(e);
    const dx = currentPos.x - dragStart.x;
    const dy = currentPos.y - dragStart.y;

    if (draggingTailHandle) {
        const { id, handle } = draggingTailHandle;
        const tailToUpdate = initialBubbleState.tails.find(t => t.id === id);
        if (!tailToUpdate) return;
        
        const initialHandlePos = tailToUpdate[handle as 'p1'|'p2'|'p3'];
        const newTails = initialBubbleState.tails.map(t => {
            if (t.id === id) {
                return { ...t, [handle]: { x: initialHandlePos.x + dx, y: initialHandlePos.y + dy } };
            }
            return t;
        });
        onUpdate({ tails: newTails });
    } 
    else if (isDraggingBubble) {
        const { x, y, tails } = initialBubbleState;
        const newTails = tails.map(tail => ({
            ...tail,
            p1: { x: tail.p1.x + dx, y: tail.p1.y + dy },
            p2: { x: tail.p2.x + dx, y: tail.p2.y + dy },
            p3: { x: tail.p3.x + dx, y: tail.p3.y + dy },
        }));
        onUpdate({
            x: x + dx,
            y: y + dy,
            tails: newTails,
        });
    } 
    else if (resizeDirection) {
        const { x: iX, y: iY, width: iWidth, height: iHeight, rotation: iRotation, tails: iTails } = initialBubbleState;
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
            tails: iTails.map(t => ({
                ...t,
                p1: { x: t.p1.x + deltaX, y: t.p1.y + deltaY },
                p2: { x: t.p2.x + deltaX, y: t.p2.y + deltaY },
                p3: { x: t.p3.x + deltaX, y: t.p3.y + deltaY },
            })),
        });
    }
  }, [isInteractingWithBubble, dragStart, initialBubbleState, draggingTailHandle, isDraggingBubble, resizeDirection, getSvgCoordinates, onUpdate]);
  
  const handleMouseUp = useCallback(() => {
    setDraggingTailHandle(null);
    setIsDraggingBubble(false);
    setResizeDirection(null);
    setDragStart(null);
    setInitialBubbleState(null);
  }, []);

  useEffect(() => {
    if (isInteractingWithBubble) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mouseleave', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [isInteractingWithBubble, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (initialBubbleState) {
        const isInteractingBubbleStillPresent = bubbles.some(b => b.id === initialBubbleState.id);
        if (!isInteractingBubbleStillPresent) {
            handleMouseUp();
        }
    }
  }, [bubbles, initialBubbleState, handleMouseUp]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFileDrop(e.dataTransfer.files[0]);
        e.dataTransfer.clearData();
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isInteractingWithBubble) return;
    e.preventDefault();
    const [x, y, w, h] = viewBox.split(' ').map(parseFloat);
    const zoomFactor = e.deltaY < 0 ? 0.8 : 1.25;
    const mousePos = getSvgCoordinates(e);

    let newW = w * zoomFactor;

    // Clamp width to zoom limits
    newW = Math.max(minViewBoxWidth, Math.min(newW, maxViewBoxWidth));

    const actualZoomFactor = newW / w;

    const newH = h * actualZoomFactor;
    const newX = mousePos.x - (mousePos.x - x) * actualZoomFactor;
    const newY = mousePos.y - (mousePos.y - y) * actualZoomFactor;

    setViewBox(`${newX} ${newY} ${newW} ${newH}`);
  };
  
  const handlePanMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 1 || isInteractingWithBubble) return; // Middle mouse button
    e.preventDefault();
    const [viewBoxX, viewBoxY] = viewBox.split(' ').map(parseFloat);
    panningState.current = { startX: e.clientX, startY: e.clientY, viewBoxX, viewBoxY };
    if(containerRef.current) containerRef.current.style.cursor = 'grabbing';
    window.addEventListener('mousemove', handlePanMouseMove);
    window.addEventListener('mouseup', handlePanMouseUp);
  };

  const handlePanMouseMove = (e: MouseEvent) => {
    if (!panningState.current) return;
    e.preventDefault();
    const [,, w] = viewBox.split(' ').map(parseFloat);
    const svg = svgRef.current;
    if (!svg) return;
    
    const clientWidth = svg.clientWidth;
    const scale = w / clientWidth;

    const dx = e.clientX - panningState.current.startX;
    const dy = e.clientY - panningState.current.startY;
    
    const newViewBoxX = panningState.current.viewBoxX - dx * scale;
    const newViewBoxY = panningState.current.viewBoxY - dy * scale;
    setViewBox(`${newViewBoxX} ${newViewBoxY} ${viewBox.split(' ')[2]} ${viewBox.split(' ')[3]}`);
  };

  const handlePanMouseUp = (e: MouseEvent) => {
    if (e.button !== 1) return;
    panningState.current = null;
    if(containerRef.current) containerRef.current.style.cursor = 'default';
    window.removeEventListener('mousemove', handlePanMouseMove);
    window.removeEventListener('mouseup', handlePanMouseUp);
  };
  
  const showHandles = !isInteractingWithBubble && !panningState.current;

  return (
    <div 
        ref={containerRef} 
        className="w-full h-full p-4 flex items-center justify-center bg-gray-700 rounded-lg shadow-inner relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onWheel={handleWheel}
        onMouseDown={handlePanMouseDown}
    >
      <svg ref={svgRef} viewBox={viewBox} xmlns="http://www.w3.org/2000/svg" className="max-w-full max-h-full bg-gray-600">
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
