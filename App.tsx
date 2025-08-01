import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { BubbleProps, TailProps, BackgroundFilters, ExportFrame } from './types';
import { ShapeType, BorderStyle, TextAlign, TailType } from './types';
import { FONT_FAMILIES } from './constants';
import ControlPanel from './components/ControlPanel';
import BubblePreview from './components/BubblePreview';
import DownloadIcon from './components/icons/DownloadIcon';
import ResetIcon from './components/icons/ResetIcon';
import ZoomInIcon from './components/icons/ZoomInIcon';
import ZoomOutIcon from './components/icons/ZoomOutIcon';
import FitToScreenIcon from './components/icons/FitToScreenIcon';
import ArrowIcon from './components/icons/ArrowIcon';
import Dropdown from './components/Dropdown';
import VideoIcon from './components/icons/VideoIcon';
import PlayIcon from './components/icons/PlayIcon';
import PauseIcon from './components/icons/PauseIcon';
import VolumeUpIcon from './components/icons/VolumeUpIcon';
import VolumeOffIcon from './components/icons/VolumeOffIcon';
import GlobalSettingsPanel from './components/GlobalSettingsPanel';
import InfoPanel from './components/InfoPanel';

const INITIAL_CANVAS_DIMENSIONS = { width: 500, height: 350 };

const MIN_ZOOM_PERCENT = 10;
const MAX_ZOOM_PERCENT = 500;


// Path simplification utility, moved here to be used in handleUpdate
function getSqSegDist(p: {x:number, y:number}, p1: {x:number, y:number}, p2: {x:number, y:number}) {
    let x = p1.x;
    let y = p1.y;
    let dx = p2.x - x;
    let dy = p2.y - y;
    if (dx !== 0 || dy !== 0) {
        const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
        if (t > 1) {
            x = p2.x;
            y = p2.y;
        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }
    dx = p.x - x;
    dy = p.y - y;
    return dx * dx + dy * dy;
}
function simplifyRDP(points: {x:number, y:number}[], sqTolerance: number) {
    if (points.length < 2) return points;
    let len = points.length;
    let markers = new Uint8Array(len);
    let first = 0;
    let last = len - 1;
    let stack: number[] = [];
    let newPoints = [];
    let i, maxSqDist, sqDist, index;

    markers[first] = markers[last] = 1;

    while (last) {
        maxSqDist = 0;
        index = 0;
        for (i = first + 1; i < last; i++) {
            sqDist = getSqSegDist(points[i], points[first], points[last]);
            if (sqDist > maxSqDist) {
                index = i;
                maxSqDist = sqDist;
            }
        }
        if (maxSqDist > sqTolerance) {
            markers[index] = 1;
            stack.push(first, index, index, last);
        }
        
        const newLast = stack.pop();
        const newFirst = stack.pop();
        last = newLast !== undefined ? newLast : 0;
        first = newFirst !== undefined ? newFirst : 0;
    }

    for (i = 0; i < len; i++) {
        if (markers[i]) {
            newPoints.push(points[i]);
        }
    }
    return newPoints;
}


const INITIAL_PROPS: Omit<BubbleProps, 'id'> = {
  text: 'left panel: change text and bubble settings <br> right panel: add or delete balloon <br> add image or video. <br> have fun!',
  fontFamily: 'Bangers',
  fontSize: 24,
  textColor: '#000000',
  textAlign: TextAlign.CENTER,
  lineHeight: 1.3,
  shape: ShapeType.OVAL,
  fillColor: '#FFFFFF',
  borderColor: '#000000',
  borderWidth: 4,
  borderStyle: BorderStyle.SOLID,
  tails: [{
    id: 1,
    type: TailType.CURVED,
    p1: { x: 225, y: 285 },
    p2: { x: 275, y: 285 },
    p3: { x: 250, y: 340 },
    bend: 0,
    zigs: 7,
  }],
  width: 400,
  height: 250,
  x: 250,
  y: 175,
  tailVisible: true,
  rotation: 0,
  textRotation: 0,
  textScaleX: 1,
  textScaleY: 1,
  bubbleVisible: true,
  textShadow: false,
  textShadowColor: '#000000',
  textShadowBlur: 2,
  textShadowOffsetX: 2,
  textShadowOffsetY: 2,
  textOutline: false,
  textOutlineColor: '#000000',
  textOutlineWidth: 1,
  bubbleShadow: false,
  bubbleShadowColor: '#000000',
  bubbleShadowBlur: 5,
  bubbleShadowOffsetX: 3,
  bubbleShadowOffsetY: 3,
  shoutSpikes: 12,
  thoughtPuffs: 8,
  freehandRawPoints: [],
  freehandPoints: [],
  freehandSmoothness: 0.8,
  freehandSimplification: 1.5,
  isDrawingEnabled: false,
};

const INITIAL_FILTERS: BackgroundFilters = {
  contrast: 100,
  brightness: 100,
  saturate: 100,
  temperature: 0,
};

const App: React.FC = () => {
  const [bubbles, setBubbles] = useState<BubbleProps[]>([{ ...INITIAL_PROPS, id: 1 }]);
  const [activeBubbleId, setActiveBubbleId] = useState<number>(1);
  const nextId = useRef(2);
  const nextTailId = useRef(2);

  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundVideo, setBackgroundVideo] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [backgroundFilters, setBackgroundFilters] = useState<BackgroundFilters>(INITIAL_FILTERS);
  const [showExportFrame, setShowExportFrame] = useState<boolean>(true);
  const [exportFilename, setExportFilename] = useState<string>('comic-scene');
  const [exportFrame, setExportFrame] = useState<ExportFrame | null>(null);

  const [canvasDimensions, setCanvasDimensions] = useState(INITIAL_CANVAS_DIMENSIONS);
  const backgroundUrlRef = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [viewBox, setViewBox] = useState<string>(`0 0 ${INITIAL_CANVAS_DIMENSIONS.width} ${INITIAL_CANVAS_DIMENSIONS.height}`);

  const bubbleForPanel = bubbles.find(b => b.id === activeBubbleId) || bubbles[0];

  const handleUpdate = useCallback((updates: Partial<BubbleProps>) => {
    setBubbles(prevBubbles =>
      prevBubbles.map(b => {
        if (b.id !== activeBubbleId) return b;

        const updatedBubble = { ...b, ...updates };

        // Case 1: Switching to Freehand for the first time on a bubble. Enable drawing.
        if (updates.shape === ShapeType.FREEHAND && (!b.freehandRawPoints || b.freehandRawPoints.length === 0)) {
            updatedBubble.isDrawingEnabled = true;
        }

        // Case 2: Redraw button was clicked. `isDrawingEnabled` is set to true in the `updates` object.
        // We just need to clear the points.
        if (updates.isDrawingEnabled && updates.freehandRawPoints?.length === 0) {
            updatedBubble.freehandPoints = [];
            return updatedBubble; // Return early, no simplification needed.
        }

        const rawPoints = updatedBubble.freehandRawPoints;
        const needsSimplification = (updates.freehandSimplification !== undefined || updates.freehandRawPoints !== undefined) && rawPoints && rawPoints.length > 0;

        if (needsSimplification) {
          const simplified = simplifyRDP(rawPoints, updatedBubble.freehandSimplification ?? 1.5);
          updatedBubble.freehandPoints = simplified;

          // Case 3: A new drawing was completed (`updates.freehandRawPoints` is present).
          // Recalculate bounds and disable drawing mode.
          if (updates.freehandRawPoints && simplified.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of simplified) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }
            const width = maxX - minX;
            const height = maxY - minY;

            updatedBubble.width = Math.max(50, width);
            updatedBubble.height = Math.max(50, height);
            updatedBubble.x = minX + width / 2;
            updatedBubble.y = minY + height / 2;
            updatedBubble.isDrawingEnabled = false; // Disable drawing.
          }
        }
        
        return updatedBubble;
      })
    );
  }, [activeBubbleId]);
  
    const handleUpdateFilters = useCallback((updates: Partial<BackgroundFilters>) => {
        setBackgroundFilters(prev => ({ ...prev, ...updates }));
    }, []);

    const handleUpdateExportFrame = useCallback((updates: Partial<ExportFrame>) => {
      setExportFrame(prev => {
        if (!prev) return null;
        const newState = { ...prev, ...updates };

        // Constrain dimensions and position
        let { x, y, width, height } = newState;
        width = Math.max(50, Math.min(width, canvasDimensions.width));
        height = Math.max(50, Math.min(height, canvasDimensions.height));
        x = Math.max(0, Math.min(x, canvasDimensions.width - width));
        y = Math.max(0, Math.min(y, canvasDimensions.height - height));
        
        return { x, y, width, height };
      });
    }, [canvasDimensions]);

    const handleResetExportFrame = useCallback(() => {
        setExportFrame({ x: 0, y: 0, width: canvasDimensions.width, height: canvasDimensions.height });
    }, [canvasDimensions]);

  const handleAddBubble = () => {
    const currentActiveBubble = bubbles.find(b => b.id === activeBubbleId);
    if (!currentActiveBubble) return;

    const newTails: TailProps[] = currentActiveBubble.tails.map(tail => {
        const newTailId = nextTailId.current++;
        return {
          ...tail,
          id: newTailId,
          p1: { x: tail.p1.x + 30, y: tail.p1.y + 30 },
          p2: { x: tail.p2.x + 30, y: tail.p2.y + 30 },
          p3: { x: tail.p3.x + 30, y: tail.p3.y + 30 },
        };
    });

    const newBubble: BubbleProps = {
      ...currentActiveBubble,
      id: nextId.current,
      x: currentActiveBubble.x + 30,
      y: currentActiveBubble.y + 30,
      tails: newTails,
    };
    
    setBubbles(prev => [...prev, newBubble]);
    setActiveBubbleId(nextId.current);
    nextId.current++;
  };

  const handleDeleteBubble = () => {
    if (bubbles.length <= 1) return;

    const bubbleIndex = bubbles.findIndex(b => b.id === activeBubbleId);
    const newBubbles = bubbles.filter(b => b.id !== activeBubbleId);
    setBubbles(newBubbles);

    if (newBubbles.length > 0) {
      const newActiveIndex = Math.max(0, bubbleIndex - 1);
      setActiveBubbleId(newBubbles[newActiveIndex].id);
    }
  };

  const handleActivateBubble = (id: number) => {
    setActiveBubbleId(id);
  };

  const handleResetView = useCallback(() => {
    setViewBox(`0 0 ${canvasDimensions.width} ${canvasDimensions.height}`);
  }, [canvasDimensions]);

  const handleClearBackground = useCallback(() => {
    if (backgroundUrlRef.current) {
      URL.revokeObjectURL(backgroundUrlRef.current);
    }
    setBackgroundImage(null);
    setBackgroundVideo(null);
    setCanvasDimensions(INITIAL_CANVAS_DIMENSIONS);
    setExportFrame(null);
    setViewBox(`0 0 ${INITIAL_CANVAS_DIMENSIONS.width} ${INITIAL_CANVAS_DIMENSIONS.height}`);
    setVideoDuration(0);
    setVideoCurrentTime(0);
    setIsPlaying(false);
    backgroundUrlRef.current = null;
    setBackgroundFilters(INITIAL_FILTERS);
  }, []);
  
  const handleReset = () => {
    setBubbles([{ ...INITIAL_PROPS, id: 1 }]);
    setActiveBubbleId(1);
    nextId.current = 2;
    nextTailId.current = 2;
    handleClearBackground(); // This will reset view and dimensions
    setShowExportFrame(true);
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!file || !file.type.startsWith('image/')) {
        alert('Please select or drop a valid image file.');
        return;
    }
    handleClearBackground();
    
    const newUrl = URL.createObjectURL(file);

    const img = new Image();
    img.onload = () => {
      const newDims = { width: img.naturalWidth, height: img.naturalHeight };
      setCanvasDimensions(newDims);
      setExportFrame({ x: 0, y: 0, width: newDims.width, height: newDims.height });
      setViewBox(`0 0 ${newDims.width} ${newDims.height}`);
      setBackgroundImage(newUrl);
      backgroundUrlRef.current = newUrl;
    };
    img.onerror = () => {
      console.error("Failed to load image");
      alert("Sorry, there was an error loading the image.");
      URL.revokeObjectURL(newUrl);
    }
    img.src = newUrl;
  }, [handleClearBackground]);

  const handleVideoSelect = useCallback((file: File) => {
    if (!file || !file.type.startsWith('video/')) {
      alert('Please select or drop a valid video file.');
      return;
    }
    handleClearBackground();

    const newUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    
    video.onloadedmetadata = () => {
      const newDims = { width: video.videoWidth, height: video.videoHeight };
      setCanvasDimensions(newDims);
      setExportFrame({ x: 0, y: 0, width: newDims.width, height: newDims.height });
      setViewBox(`0 0 ${newDims.width} ${newDims.height}`);
      setVideoDuration(video.duration);
      setBackgroundVideo(newUrl);
      backgroundUrlRef.current = newUrl;
    };
     video.onerror = () => {
      console.error("Failed to load video");
      alert("Sorry, there was an error loading the video.");
      URL.revokeObjectURL(newUrl);
    }
    video.src = newUrl;
  }, [handleClearBackground]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  };
  
  const handleVideoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleVideoSelect(file);
    e.target.value = '';
  };

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      video.play();
    } else {
      video.pause();
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(prev => {
      const video = videoRef.current;
      if (video) video.muted = !prev;
      return !prev;
    });
  };
  
  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setVideoCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const handleTimeUpdate = () => setVideoCurrentTime(video.currentTime);
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handlePause);

      video.muted = isMuted;

      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handlePause);
      };
    }
  }, [backgroundVideo, isMuted]);

  useEffect(() => {
    return () => {
      if (backgroundUrlRef.current) {
        URL.revokeObjectURL(backgroundUrlRef.current);
      }
    };
  }, []);
  
  const triggerDownload = (href: string, filename: string) => {
      const link = document.createElement('a');
      link.href = href;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
  };

  const getCleanSvgString = useCallback(async (): Promise<string> => {
    if (!svgRef.current) return '';

    const svgNode = svgRef.current.cloneNode(true) as SVGSVGElement;
    
    // Remove interactive/temporary elements
    svgNode.querySelectorAll('.drag-handles')?.forEach(el => el.remove());
    svgNode.querySelector('#export-frame-guide')?.parentElement?.remove(); // Remove the <g> wrapper for the frame
    svgNode.querySelector('#default-canvas-guide')?.remove();
    
    // Always remove background elements. 
    // - For transparent PNG export, they are not needed.
    // - For scene export, they are drawn separately on the canvas.
    svgNode.querySelector('#background-image')?.remove();
    svgNode.querySelector('#background-video-container')?.remove();
    svgNode.querySelector('#background-sharpen')?.remove();
    svgNode.querySelector('#background-temperature')?.remove();

    const uniqueFonts = [...new Set(bubbles.map(b => b.fontFamily))];
    
    const foreignObjects = svgNode.querySelectorAll('foreignObject');
    foreignObjects.forEach((fo, index) => {
        // In this app, only bubble text uses foreignObjects, so this is safe.
        // If other foreignObjects are added, this query would need to be more specific.
        const bubble = bubbles[index];
        if (bubble) {
            const div = fo.querySelector('div');
            if(div) div.style.fontFamily = `'${bubble.fontFamily}', sans-serif`;
        }
    });

    const GOOGLE_FONTS = uniqueFonts.filter(f => !['Arial', 'Verdana'].includes(f));
    const fontFamilies = GOOGLE_FONTS.map(f => `family=${f.replace(/ /g, '+')}:wght@400;700`).join('&');
    const fontCssUrl = `https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`;
    
    let finalCss = '';
    
    try {
        if(GOOGLE_FONTS.length > 0) {
            const cssResponse = await fetch(fontCssUrl);
            if (!cssResponse.ok) throw new Error(`CSS fetch failed: ${cssResponse.status}`);
            let cssText = await cssResponse.text();

            const fontUrlMatches = Array.from(cssText.matchAll(/url\((https?:\/\/[^)]+)\)/g));
            const embeddedFontPromises = fontUrlMatches.map(async (match) => {
                const url = match[1];
                try {
                    const fontFileResponse = await fetch(url);
                    if (!fontFileResponse.ok) throw new Error(`Font file fetch failed`);
                    const buffer = await fontFileResponse.arrayBuffer();
                    const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
                    const mime = fontFileResponse.headers.get('content-type') || 'font/woff2';
                    return { originalUrl: url, dataUri: `data:${mime};base64,${base64}` };
                } catch {
                    return { originalUrl: url, dataUri: null };
                }
            });

            for (const { originalUrl, dataUri } of await Promise.all(await Promise.all(embeddedFontPromises))) {
                if (dataUri) cssText = cssText.replace(originalUrl, dataUri);
            }
            finalCss = cssText;
        }
    } catch (error) {
       console.error("Could not embed fonts, will proceed without them.", error);
    }
    
    if (finalCss) {
        const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleElement.textContent = finalCss;
        svgNode.querySelector('defs')?.prepend(styleElement);
    }

    return new XMLSerializer().serializeToString(svgNode);
  }, [bubbles]);


  const handleExportBubblesPNG = async () => {
    const svgData = await getCleanSvgString();
    if (!svgData) return;

    const hasBackground = !!backgroundImage || !!backgroundVideo;
    const exportWidth = hasBackground && exportFrame ? exportFrame.width : canvasDimensions.width;
    const exportHeight = hasBackground && exportFrame ? exportFrame.height : canvasDimensions.height;
    const exportViewBox = hasBackground && exportFrame 
      ? `${exportFrame.x} ${exportFrame.y} ${exportFrame.width} ${exportFrame.height}`
      : `0 0 ${canvasDimensions.width} ${canvasDimensions.height}`;

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgData, "image/svg+xml");
    const svgNode = svgDoc.documentElement;
    
    svgNode.setAttribute('viewBox', exportViewBox);
    svgNode.setAttribute('width', String(exportWidth));
    svgNode.setAttribute('height', String(exportHeight));
    
    const finalSvgData = new XMLSerializer().serializeToString(svgNode);

    const canvas = document.createElement('canvas');
    const scaleFactor = 1; // For higher resolution output
    canvas.width = exportWidth * scaleFactor;
    canvas.height = exportHeight * scaleFactor;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const svgImg = new Image();
    const svgPromise = new Promise<void>((resolve, reject) => {
        svgImg.onload = () => resolve();
        svgImg.onerror = () => reject(new Error('Failed to load bubble SVG for export.'));
        svgImg.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(finalSvgData)));
    });

    try {
        await svgPromise;
        ctx.drawImage(svgImg, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        triggerDownload(dataUrl, `${exportFilename || 'speech-bubbles'}.png`);
    } catch (error) {
        console.error(`Failed to load SVG for bubble export as PNG`, error);
        alert(`Sorry, there was an error exporting the bubble. ${error instanceof Error ? error.message : ''}`);
    }
  };

  const getFullSceneAsCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const { width: sceneWidth, height: sceneHeight } = canvasDimensions;
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = sceneWidth;
    fullCanvas.height = sceneHeight;
    const ctx = fullCanvas.getContext('2d');
    if (!ctx) return null;

    const hasBackground = backgroundImage || backgroundVideo;

    // 1. Draw filtered background if it exists
    if (hasBackground) {
        let sourceDataURL: string | null = null;
        try {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = sceneWidth;
            tempCanvas.height = sceneHeight;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) throw new Error("Could not create temp canvas context.");

            if (backgroundVideo && videoRef.current) {
                tempCtx.drawImage(videoRef.current, 0, 0, sceneWidth, sceneHeight);
                sourceDataURL = tempCanvas.toDataURL();
            } else if (backgroundImage) {
                const bgImg = new Image();
                await new Promise<void>((resolve, reject) => {
                    bgImg.onload = () => resolve();
                    bgImg.onerror = () => reject(new Error('Failed to load background image for filtering.'));
                    bgImg.crossOrigin = "anonymous";
                    bgImg.src = backgroundImage;
                });
                tempCtx.drawImage(bgImg, 0, 0, sceneWidth, sceneHeight);
                sourceDataURL = tempCanvas.toDataURL();
            }
        } catch (error) {
            console.error("Failed to load background media for export.", error);
            alert(`Could not load the background for export. ${error instanceof Error ? error.message : ''}`);
            return null;
        }

        if (sourceDataURL) {
            const { brightness, contrast, saturate, temperature } = backgroundFilters;
            const tempValue = temperature / 100; // range -1 to 1
            const tempR = 1 + 0.15 * tempValue;
            const tempB = 1 - 0.15 * tempValue;
            const tempMatrix = `${tempR} 0 0 0 0 0 1 0 0 0 0 0 ${tempB} 0 0 0 0 0 1 0`;

            const filterStyleString = [
                `brightness(${brightness}%)`,
                `contrast(${contrast}%)`,
                `saturate(${saturate}%)`,
                temperature !== 0 ? `url(#background-temperature-export)` : '',
            ].filter(Boolean).join(' ');

            const filterSvgString = `
                <svg width="${sceneWidth}" height="${sceneHeight}" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        ${temperature !== 0 ? `
                        <filter id="background-temperature-export">
                            <feColorMatrix type="matrix" values="${tempMatrix}" />
                        </filter>
                        ` : ''}
                    </defs>
                    <image href="${sourceDataURL}" width="100%" height="100%" style="filter: ${filterStyleString};" />
                </svg>
            `;

            const filteredBgImg = new Image();
            try {
                await new Promise<void>((resolve, reject) => {
                    filteredBgImg.onload = () => resolve();
                    filteredBgImg.onerror = () => reject(new Error('Failed to load filtered background SVG.'));
                    filteredBgImg.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(filterSvgString)));
                });
                ctx.drawImage(filteredBgImg, 0, 0, sceneWidth, sceneHeight);
            } catch (error) {
                console.error("Failed to apply filters via SVG.", error);
                alert("An error occurred while applying background effects for export.");
                return null;
            }
        }
    }

    // 2. Prepare and draw SVG overlay of bubbles
    const svgData = await getCleanSvgString();
    if (!svgData) {
        if (bubbles.length > 0) alert("Failed to prepare the speech bubbles for export.");
        return fullCanvas; 
    }

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgData, "image/svg+xml");
    const svgNode = svgDoc.documentElement;

    svgNode.setAttribute('width', String(sceneWidth));
    svgNode.setAttribute('height', String(sceneHeight));
    svgNode.setAttribute('viewBox', `0 0 ${sceneWidth} ${sceneHeight}`);

    const finalSvgData = new XMLSerializer().serializeToString(svgNode);

    const svgImg = new Image();
    try {
        await new Promise<void>((resolve, reject) => {
            svgImg.onload = () => resolve();
            svgImg.onerror = () => reject(new Error('Failed to load bubble SVG for export.'));
            svgImg.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(finalSvgData)));
        });
        ctx.drawImage(svgImg, 0, 0, sceneWidth, sceneHeight);
    } catch (error) {
        console.error("Failed to load SVG overlay for export.", error);
        alert(`Could not load the speech bubbles for export. ${error instanceof Error ? error.message : ''}`);
        return null;
    }

    return fullCanvas;
  }

  const exportSceneAsRaster = async (format: 'png' | 'jpeg' | 'webp') => {
    const hasBackground = backgroundImage || backgroundVideo;
    if (!hasBackground || !exportFrame) {
      alert("Please upload a background image or video first.");
      return;
    }

    const fullSceneCanvas = await getFullSceneAsCanvas();
    if (!fullSceneCanvas) return;

    // Create final cropped canvas
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = exportFrame.width;
    croppedCanvas.height = exportFrame.height;
    const ctxCropped = croppedCanvas.getContext('2d');
    if (!ctxCropped) return;

    // Copy the cropped region from the full scene canvas
    ctxCropped.drawImage(
      fullSceneCanvas,
      exportFrame.x,
      exportFrame.y,
      exportFrame.width,
      exportFrame.height,
      0,
      0,
      exportFrame.width,
      exportFrame.height
    );
    
    const mimeType = `image/${format}`;
    const dataUrl = croppedCanvas.toDataURL(mimeType, format !== 'png' ? 0.9 : undefined);
    triggerDownload(dataUrl, `${exportFilename || 'comic-scene'}.${format}`);
  };
  
  const MIN_VIEWBOX_WIDTH = canvasDimensions.width * (100 / MAX_ZOOM_PERCENT);
  const MAX_VIEWBOX_WIDTH = canvasDimensions.width * (100 / MIN_ZOOM_PERCENT);

  const handleZoom = (factor: number) => {
    const [x, y, w, h] = viewBox.split(' ').map(parseFloat);
    let newW = w * factor;

    // Clamp width to zoom limits
    newW = Math.max(MIN_VIEWBOX_WIDTH, Math.min(MAX_VIEWBOX_WIDTH, newW));
    
    const aspectRatio = h / w;
    const newH = newW * aspectRatio;

    const newX = x + (w - newW) / 2;
    const newY = y + (h - newH) / 2;
    setViewBox(`${newX} ${newY} ${newW} ${newH}`);
  };

  const handlePan = (direction: 'up' | 'down' | 'left' | 'right') => {
    const [x, y, w, h] = viewBox.split(' ').map(parseFloat);
    const panAmount = w * 0.1; // Pan by 10% of the current view width
    let newX = x, newY = y;
    switch (direction) {
      case 'up': newY -= panAmount; break;
      case 'down': newY += panAmount; break;
      case 'left': newX -= panAmount; break;
      case 'right': newX += panAmount; break;
    }
    setViewBox(`${newX} ${newY} ${w} ${h}`);
  };
  
  const currentViewBoxWidth = parseFloat(viewBox.split(' ')[2]);
  const zoomPercentage = Math.round((canvasDimensions.width / currentViewBoxWidth) * 100);

  const isAtMaxZoom = currentViewBoxWidth <= MIN_VIEWBOX_WIDTH;
  const isAtMinZoom = currentViewBoxWidth >= MAX_VIEWBOX_WIDTH;
  const hasBackground = !!backgroundImage || !!backgroundVideo;

  return (
    <div className="flex flex-col md:flex-row h-full bg-stone-800 text-white font-sans">
      <header className="md:hidden p-4 bg-stone-900 border-b border-stone-700 flex justify-between items-center">
        <h1 className="text-2xl flex items-center" style={{fontFamily: 'Bangers, cursive'}}>
        <img
          src="/logo.png"
          alt="Babbling Book Logo"
          className="max-w-full h-auto mr-2"
        />
        </h1>
      </header>
      
      <aside className="w-full md:w-96 lg:w-[400px] flex-shrink-0 bg-stone-900 h-auto md:h-full flex flex-col">
         {bubbleForPanel ? (
            <ControlPanel 
                bubbleProps={bubbleForPanel} 
                onUpdate={handleUpdate}
                nextTailId={nextTailId}
            />
         ) : (
            <div className="p-6 text-stone-400 flex items-center justify-center h-full">
                <p>Initializing...</p>
            </div>
         )}
      </aside>

      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden">
        <div className="flex-shrink-0 flex justify-between items-center mb-4">
          <h1 className="hidden md:flex items-center text-4xl text-white" style={{fontFamily: 'Bangers, cursive'}}>
          <img
            src="/logo.png"
            alt="Babbling Book Logo"
            className="max-w-full h-auto mr-2"
          />
          </h1>
          <div className="flex items-center space-x-2 flex-wrap gap-y-2 justify-end">
             <div className="flex-grow sm:flex-grow-0">
                <label htmlFor="filename-input" className="sr-only">File Name</label>
                <input
                    id="filename-input"
                    type="text"
                    value={exportFilename}
                    onChange={(e) => setExportFilename(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    placeholder="File Name"
                    className="w-full sm:w-40 px-3 py-2 bg-stone-700 border border-stone-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition placeholder-stone-400"
                    title="Set the name for exported files"
                />
            </div>
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 px-4 py-2 bg-stone-600 hover:bg-stone-500 rounded-md transition-colors"
              title="Reset to default"
            >
              <ResetIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            
            <button
                onClick={handleExportBubblesPNG}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors w-full sm:w-auto justify-center"
                title="Export bubbles only as a transparent PNG"
            >
                <DownloadIcon className="w-5 h-5"/>
                <span className="hidden sm:inline">Export Bubbles</span>
            </button>

            <Dropdown
                disabled={!hasBackground}
                trigger={
                    <button 
                        className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-md transition-colors disabled:bg-stone-500 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
                        disabled={!hasBackground}
                        title={!hasBackground ? "Upload a background to export the scene" : "Export scene"}
                    >
                        <DownloadIcon className="w-5 h-5"/>
                        <span className="hidden sm:inline">Export Scene</span>
                    </button>
                }
                options={[
                    { label: 'as PNG', onClick: () => exportSceneAsRaster('png') },
                    { label: 'as JPEG', onClick: () => exportSceneAsRaster('jpeg') },
                    { label: 'as WebP', onClick: () => exportSceneAsRaster('webp') },
                ]}
            />
          </div>
        </div>
        <div className="flex-grow min-h-0 relative flex flex-col">
          <BubblePreview 
              svgRef={svgRef} 
              bubbles={bubbles} 
              activeBubbleId={activeBubbleId}
              onUpdate={handleUpdate}
              onActivateBubble={handleActivateBubble}
              backgroundImage={backgroundImage}
              backgroundVideo={backgroundVideo}
              videoRef={videoRef}
              onFileDrop={handleFileSelect}
              onVideoFileDrop={handleVideoSelect}
              viewBox={viewBox}
              setViewBox={setViewBox}
              minViewBoxWidth={MIN_VIEWBOX_WIDTH}
              maxViewBoxWidth={MAX_VIEWBOX_WIDTH}
              backgroundFilters={backgroundFilters}
              showExportFrame={showExportFrame}
              canvasDimensions={canvasDimensions}
              exportFrame={exportFrame}
              onUpdateExportFrame={handleUpdateExportFrame}
          />
           <div className="absolute bottom-4 right-4 bg-stone-900 bg-opacity-80 rounded-lg p-1 flex flex-col items-center space-y-1 shadow-lg">
                <div className="flex space-x-1">
                    <button onClick={() => handleZoom(0.8)} className="p-2 hover:bg-stone-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Zoom In" disabled={isAtMaxZoom}><ZoomInIcon className="w-5 h-5"/></button>
                    <button onClick={() => handleZoom(1.25)} className="p-2 hover:bg-stone-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Zoom Out" disabled={isAtMinZoom}><ZoomOutIcon className="w-5 h-5"/></button>
                    <button onClick={handleResetView} className="p-2 hover:bg-stone-700 rounded-md transition-colors" title="Fit to Screen"><FitToScreenIcon className="w-5 h-5"/></button>
                </div>
                <div className="text-xs text-center text-stone-400 font-mono select-none px-2">
                  {zoomPercentage}%
                </div>
                <div className="grid grid-cols-3 gap-px w-full">
                    <div></div>
                    <button onClick={() => handlePan('up')} className="p-1 hover:bg-stone-700 rounded-md transition-colors flex justify-center" title="Pan Up"><ArrowIcon className="w-4 h-4"/></button>
                    <div></div>
                    <button onClick={() => handlePan('left')} className="p-1 hover:bg-stone-700 rounded-md transition-colors flex justify-center" title="Pan Left"><ArrowIcon className="w-4 h-4 transform -rotate-90"/></button>
                    <div></div>
                    <button onClick={() => handlePan('right')} className="p-1 hover:bg-stone-700 rounded-md transition-colors flex justify-center" title="Pan Right"><ArrowIcon className="w-4 h-4 transform rotate-90"/></button>
                    <div></div>
                    <button onClick={() => handlePan('down')} className="p-1 hover:bg-stone-700 rounded-md transition-colors flex justify-center" title="Pan Down"><ArrowIcon className="w-4 h-4 transform rotate-180"/></button>
                    <div></div>
                </div>
            </div>
            {backgroundVideo && (
                <div className="flex-shrink-0 pt-4 px-4 flex items-center justify-center space-x-4">
                    <button onClick={handlePlayPause} className="p-2 hover:bg-stone-700 rounded-md transition-colors" title={isPlaying ? 'Pause' : 'Play'}>
                        {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                    </button>
                    <button onClick={handleMuteToggle} className="p-2 hover:bg-stone-700 rounded-md transition-colors" title={isMuted ? 'Unmute' : 'Mute'}>
                        {isMuted ? <VolumeOffIcon className="w-5 h-5" /> : <VolumeUpIcon className="w-5 h-5" />}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max={videoDuration}
                        step="0.01"
                        value={videoCurrentTime}
                        onChange={handleScrubberChange}
                        className="w-full md:w-1/2 h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer"
                        title="Scrub video frame"
                    />
                    <span className="text-sm font-mono text-stone-400 whitespace-nowrap">
                        {new Date(videoCurrentTime * 1000).toISOString().substr(14, 5)} / {new Date(videoDuration * 1000).toISOString().substr(14, 5)}
                    </span>
                </div>
            )}
        </div>
        <div className="flex-shrink-0 flex justify-center items-center pt-2">
        </div>
      </main>

       <aside className="w-full md:w-64 flex-shrink-0 bg-stone-900 h-auto md:h-full flex flex-col">
         <div className="flex-grow min-h-0">
            <GlobalSettingsPanel 
                onImageUpload={handleFileInputChange}
                onVideoUpload={handleVideoInputChange}
                onClearBackground={handleClearBackground}
                hasImage={!!backgroundImage}
                hasVideo={!!backgroundVideo}
                onAddBubble={handleAddBubble}
                onDeleteBubble={handleDeleteBubble}
                bubbleCount={bubbles.length}
                backgroundFilters={backgroundFilters}
                onUpdateFilters={handleUpdateFilters}
                showExportFrame={showExportFrame}
                onSetShowExportFrame={setShowExportFrame}
                exportFrame={exportFrame}
                onUpdateExportFrame={handleUpdateExportFrame}
                onResetExportFrame={handleResetExportFrame}
                canvasDimensions={canvasDimensions}
            />
         </div>
         <div className="flex-shrink-0">
            <InfoPanel />
         </div>
      </aside>
    </div>
  );
};

export default App;
