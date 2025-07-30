import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { BubbleProps, TailProps, BackgroundFilters } from './types';
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
  text: 'Type <b>something</b> <i>here!</i>',
  fontFamily: 'Comic Neue',
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
  const [backgroundFilters, setBackgroundFilters] = useState<BackgroundFilters>(INITIAL_FILTERS);
  const [showExportFrame, setShowExportFrame] = useState<boolean>(true);
  const [exportFilename, setExportFilename] = useState<string>('comic-scene');

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
    setViewBox(`0 0 ${INITIAL_CANVAS_DIMENSIONS.width} ${INITIAL_CANVAS_DIMENSIONS.height}`);
    setVideoDuration(0);
    setVideoCurrentTime(0);
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

  useEffect(() => {
    if (videoRef.current) {
        videoRef.current.currentTime = videoCurrentTime;
    }
  }, [videoCurrentTime]);

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
    svgNode.querySelector('#export-frame-guide')?.remove();
    
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
    
    // Since getCleanSvgString doesn't set a viewBox, we parse and set it here
    // to ensure the export is framed correctly.
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgData, "image/svg+xml");
    const svgNode = svgDoc.documentElement;
    svgNode.setAttribute('viewBox', `0 0 ${canvasDimensions.width} ${canvasDimensions.height}`);
    const finalSvgData = new XMLSerializer().serializeToString(svgNode);

    const canvas = document.createElement('canvas');
    const scaleFactor = 3;
    canvas.width = canvasDimensions.width * scaleFactor;
    canvas.height = canvasDimensions.height * scaleFactor;

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
        // Draw image on transparent canvas
        ctx.drawImage(svgImg, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        triggerDownload(dataUrl, `${exportFilename || 'speech-bubbles'}.png`);
    } catch (error) {
        console.error(`Failed to load SVG for bubble export as PNG`, error);
        alert(`Sorry, there was an error exporting the bubble. ${error instanceof Error ? error.message : ''}`);
    }
  };

  const getTransformedSvgStringForScene = useCallback(async (): Promise<string> => {
      const baseSvgString = await getCleanSvgString();
      if (!baseSvgString) return '';
  
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(baseSvgString, "image/svg+xml");
      const svgNode = svgDoc.documentElement;
      if (svgNode.querySelector('parsererror')) {
          console.error("SVG parsing error", svgNode.querySelector('parsererror')?.textContent);
          return '';
      }
  
      const { width: imageWidth, height: imageHeight } = canvasDimensions;
      const { width: svgPreviewWidth, height: svgPreviewHeight } = canvasDimensions;
  
      const scale = Math.min(svgPreviewWidth / imageWidth, svgPreviewHeight / imageHeight);
      const offsetXInPreview = (svgPreviewWidth - (imageWidth * scale)) / 2;
      const offsetYInPreview = (svgPreviewHeight - (imageHeight * scale)) / 2;
      
      const finalScale = 1 / scale;
      const finalTranslateX = -offsetXInPreview;
      const finalTranslateY = -offsetYInPreview;
      
      const g = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `scale(${finalScale}) translate(${finalTranslateX} ${finalTranslateY})`);
  
      const visualElements = Array.from(svgNode.children).filter(
          child => child.tagName.toLowerCase() !== 'defs'
      );
      
      visualElements.forEach(el => g.appendChild(el));
      svgNode.appendChild(g);
  
      svgNode.setAttribute('width', String(imageWidth));
      svgNode.setAttribute('height', String(imageHeight));
      svgNode.setAttribute('viewBox', `0 0 ${imageWidth} ${imageHeight}`);
      
      return new XMLSerializer().serializeToString(svgNode);
  }, [getCleanSvgString, canvasDimensions]);

  const exportSceneAsRaster = async (format: 'png' | 'jpeg' | 'webp') => {
    const hasBackground = backgroundImage || backgroundVideo;
    if (!hasBackground) {
      alert("Please upload a background image or video first.");
      return;
    }

    const { width: imageWidth, height: imageHeight } = canvasDimensions;
    const canvas = document.createElement('canvas');
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Apply filters directly to the canvas context
    const { contrast, brightness, saturate, temperature } = backgroundFilters;
    const tempValue = temperature / 100;
    const rTemp = 1 + 0.15 * tempValue;
    const bTemp = 1 - 0.15 * tempValue;
    const tempMatrix = `${rTemp} 0 0 0 0 0 1 0 0 0 0 0 ${bTemp} 0 0 0 0 0 1 0`;
    
    // Note: SVG filters like convolve (sharpness) and colormatrix (temperature)
    // are not directly available on 2D canvas context. We will apply what we can.
    // For a full solution, one would need to draw to a temporary canvas, apply pixel-by-pixel effects,
    // or draw the background into an intermediate SVG with filters applied.
    // Here, we apply the CSS-compatible filters. Sharpness and Temperature will be ignored in the export.
    ctx.filter = [
        `brightness(${brightness}%)`,
        `contrast(${contrast}%)`,
        `saturate(${saturate}%)`,
    ].join(' ');


    // Prepare SVG overlay first
    const svgData = await getTransformedSvgStringForScene();
    if (!svgData) {
      alert("Failed to prepare the speech bubble for export.");
      return;
    }

    const svgImg = new Image();
    const svgPromise = new Promise<void>((resolve, reject) => {
      svgImg.onload = () => resolve();
      svgImg.onerror = () => reject(new Error('Failed to load bubble SVG for export.'));
      svgImg.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    });

    try {
        // Draw background (image or video frame)
        if (backgroundVideo && videoRef.current) {
            ctx.drawImage(videoRef.current, 0, 0, imageWidth, imageHeight);
        } else if (backgroundImage) {
            const bgImg = new Image();
            await new Promise<void>((resolve, reject) => {
                bgImg.onload = () => resolve();
                bgImg.onerror = () => reject(new Error('Failed to load background image for export.'));
                bgImg.crossOrigin = "anonymous";
                bgImg.src = backgroundImage;
            });
            ctx.drawImage(bgImg, 0, 0, imageWidth, imageHeight);
        }
        
        // Reset filter before drawing SVG overlay so it's not affected
        ctx.filter = 'none';

        // Draw SVG overlay on top
        await svgPromise;
        ctx.drawImage(svgImg, 0, 0, imageWidth, imageHeight);

        const mimeType = `image/${format}`;
        const dataUrl = canvas.toDataURL(mimeType, format !== 'png' ? 0.9 : undefined);
        triggerDownload(dataUrl, `${exportFilename || 'comic-scene'}.${format}`);
    } catch (error) {
      console.error("Failed to load media for scene export", error);
      alert(`Sorry, there was an error exporting the scene. ${error instanceof Error ? error.message : ''}`);
    }
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
    <div className="flex flex-col md:flex-row h-full bg-gray-800 text-white font-sans">
      <header className="md:hidden p-4 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
        <h1 className="text-2xl flex items-center" style={{fontFamily: 'Bangers, cursive'}}>
          <img src="/logo.png" alt="Babbling Book Logo" className="h-8 mr-2" />
          <span>Babbling Book</span>
        </h1>
      </header>
      
      <aside className="w-full md:w-96 lg:w-[450px] flex-shrink-0 bg-gray-900 h-auto md:h-full flex flex-col">
         {bubbleForPanel ? (
            <ControlPanel 
                bubbleProps={bubbleForPanel} 
                onUpdate={handleUpdate}
                onImageUpload={handleFileInputChange}
                onVideoUpload={handleVideoInputChange}
                onClearBackground={handleClearBackground}
                hasImage={!!backgroundImage}
                hasVideo={!!backgroundVideo}
                onAddBubble={handleAddBubble}
                onDeleteBubble={handleDeleteBubble}
                bubbleCount={bubbles.length}
                nextTailId={nextTailId}
                backgroundFilters={backgroundFilters}
                onUpdateFilters={handleUpdateFilters}
                showExportFrame={showExportFrame}
                onSetShowExportFrame={setShowExportFrame}
            />
         ) : (
            <div className="p-6 text-gray-400 flex items-center justify-center h-full">
                <p>Initializing...</p>
            </div>
         )}
      </aside>

      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden">
        <div className="flex-shrink-0 flex justify-between items-center mb-4">
          <h1 className="hidden md:flex items-center text-4xl text-white" style={{fontFamily: 'Bangers, cursive'}}>
            <img src="/logo.png" alt="Babbling Book Logo" className="h-10 mr-3" />
            <span>Babbling Book</span>
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
                    className="w-full sm:w-40 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition placeholder-gray-400"
                    title="Set the name for exported files"
                />
            </div>
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors"
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
                <span className="hidden sm:inline">Export as PNG</span>
            </button>

            <Dropdown
                disabled={!hasBackground}
                trigger={
                    <button 
                        className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
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
          />
           <div className="absolute bottom-4 right-4 bg-gray-900 bg-opacity-80 rounded-lg p-1 flex flex-col items-center space-y-1 shadow-lg">
                <div className="flex space-x-1">
                    <button onClick={() => handleZoom(0.8)} className="p-2 hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Zoom In" disabled={isAtMaxZoom}><ZoomInIcon className="w-5 h-5"/></button>
                    <button onClick={() => handleZoom(1.25)} className="p-2 hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Zoom Out" disabled={isAtMinZoom}><ZoomOutIcon className="w-5 h-5"/></button>
                    <button onClick={handleResetView} className="p-2 hover:bg-gray-700 rounded-md transition-colors" title="Fit to Screen"><FitToScreenIcon className="w-5 h-5"/></button>
                </div>
                <div className="text-xs text-center text-gray-400 font-mono select-none px-2">
                  {zoomPercentage}%
                </div>
                <div className="grid grid-cols-3 gap-px w-full">
                    <div></div>
                    <button onClick={() => handlePan('up')} className="p-1 hover:bg-gray-700 rounded-md transition-colors flex justify-center" title="Pan Up"><ArrowIcon className="w-4 h-4"/></button>
                    <div></div>
                    <button onClick={() => handlePan('left')} className="p-1 hover:bg-gray-700 rounded-md transition-colors flex justify-center" title="Pan Left"><ArrowIcon className="w-4 h-4 transform -rotate-90"/></button>
                    <div></div>
                    <button onClick={() => handlePan('right')} className="p-1 hover:bg-gray-700 rounded-md transition-colors flex justify-center" title="Pan Right"><ArrowIcon className="w-4 h-4 transform rotate-90"/></button>
                    <div></div>
                    <button onClick={() => handlePan('down')} className="p-1 hover:bg-gray-700 rounded-md transition-colors flex justify-center" title="Pan Down"><ArrowIcon className="w-4 h-4 transform rotate-180"/></button>
                    <div></div>
                </div>
            </div>
            {backgroundVideo && (
                <div className="flex-shrink-0 pt-4 px-4 flex items-center justify-center space-x-4">
                    <input
                        type="range"
                        min="0"
                        max={videoDuration}
                        step="0.01"
                        value={videoCurrentTime}
                        onChange={(e) => setVideoCurrentTime(parseFloat(e.target.value))}
                        className="w-full md:w-1/2 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        title="Scrub video frame"
                    />
                    <span className="text-sm font-mono text-gray-400 whitespace-nowrap">
                        {new Date(videoCurrentTime * 1000).toISOString().substr(14, 5)} / {new Date(videoDuration * 1000).toISOString().substr(14, 5)}
                    </span>
                </div>
            )}
        </div>
        <div className="flex-shrink-0 flex justify-center items-center pt-2">
        </div>
      </main>
    </div>
  );
};

export default App;