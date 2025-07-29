
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { BubbleProps } from './types';
import { ShapeType, BorderStyle, TextAlign } from './types';
import { FONT_FAMILIES } from './constants';
import ControlPanel from './components/ControlPanel';
import BubblePreview from './components/BubblePreview';
import DownloadIcon from './components/icons/DownloadIcon';
import ResetIcon from './components/icons/ResetIcon';

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
  tailP1: { x: 225, y: 285 },
  tailP2: { x: 275, y: 285 },
  tailP3: { x: 250, y: 340 },
  tailBend: 0,
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
};

const App: React.FC = () => {
  const [bubbles, setBubbles] = useState<BubbleProps[]>([{ ...INITIAL_PROPS, id: 1 }]);
  const [activeBubbleId, setActiveBubbleId] = useState<number>(1);
  const nextId = useRef(2);

  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number, height: number } | null>(null);
  const backgroundImageRef = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // This is the bubble currently being edited.
  // It falls back to the first bubble if the active one isn't found
  // (e.g., during a deletion state transition), preventing crashes.
  const bubbleForPanel = bubbles.find(b => b.id === activeBubbleId) || bubbles[0];

  const handleUpdate = useCallback((updates: Partial<BubbleProps>) => {
    setBubbles(prevBubbles =>
        prevBubbles.map(b => (b.id === activeBubbleId ? { ...b, ...updates } : b))
    );
  }, [activeBubbleId]);
  
  const handleAddBubble = () => {
    const currentActiveBubble = bubbles.find(b => b.id === activeBubbleId);
    if (!currentActiveBubble) return;

    const newBubble: BubbleProps = {
      ...currentActiveBubble,
      id: nextId.current,
      x: currentActiveBubble.x + 30,
      y: currentActiveBubble.y + 30,
      tailP1: { x: currentActiveBubble.tailP1.x + 30, y: currentActiveBubble.tailP1.y + 30 },
      tailP2: { x: currentActiveBubble.tailP2.x + 30, y: currentActiveBubble.tailP2.y + 30 },
      tailP3: { x: currentActiveBubble.tailP3.x + 30, y: currentActiveBubble.tailP3.y + 30 },
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

  const handleClearImage = useCallback(() => {
    if (backgroundImageRef.current) {
      URL.revokeObjectURL(backgroundImageRef.current);
    }
    setBackgroundImage(null);
    setImageDimensions(null);
    backgroundImageRef.current = null;
  }, []);
  
  const handleReset = () => {
    setBubbles([{ ...INITIAL_PROPS, id: 1 }]);
    setActiveBubbleId(1);
    nextId.current = 2;
    handleClearImage();
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!file || !file.type.startsWith('image/')) {
        alert('Please select or drop a valid image file.');
        return;
    }
    handleClearImage();
    
    const newUrl = URL.createObjectURL(file);

    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      setBackgroundImage(newUrl);
      backgroundImageRef.current = newUrl;
    };
    img.onerror = () => {
      console.error("Failed to load image");
      alert("Sorry, there was an error loading the image.");
      URL.revokeObjectURL(newUrl);
    }
    img.src = newUrl;
  }, [handleClearImage]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
    e.target.value = '';
  };

  useEffect(() => {
    return () => {
      if (backgroundImageRef.current) {
        URL.revokeObjectURL(backgroundImageRef.current);
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

  const getCleanSvgString = useCallback(async (isForSceneExport = false): Promise<string> => {
    if (!svgRef.current) return '';

    const svgNode = svgRef.current.cloneNode(true) as SVGSVGElement;
    svgNode.querySelectorAll('.drag-handles')?.forEach(el => el.remove());
    
    if (isForSceneExport) {
      svgNode.querySelector('#background-image')?.remove();
    }
    
    const uniqueFonts = [...new Set(bubbles.map(b => b.fontFamily))];
    
    const foreignObjects = svgNode.querySelectorAll('foreignObject');
    foreignObjects.forEach((fo, index) => {
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

            for (const { originalUrl, dataUri } of await Promise.all(embeddedFontPromises)) {
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

  const handleExportSVG = async () => {
    const svgData = await getCleanSvgString();
    if (!svgData) return;
    
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    triggerDownload(url, 'speech-bubbles.svg');
  };

  const handleExportBubblePNG = async () => {
    const svgData = await getCleanSvgString();
    if (!svgData) return;

    const canvas = document.createElement('canvas');
    const svgSize = svgRef.current!.viewBox.baseVal;
    
    const scaleFactor = 3;
    canvas.width = svgSize.width * scaleFactor;
    canvas.height = svgSize.height * scaleFactor;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const svgImg = new Image();
    const svgPromise = new Promise<void>((resolve, reject) => {
        svgImg.onload = () => resolve();
        svgImg.onerror = () => reject(new Error('Failed to load bubble SVG for export.'));
        svgImg.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    });

    try {
        await svgPromise;
        ctx.drawImage(svgImg, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        triggerDownload(pngUrl, 'speech-bubbles.png');
    } catch (error) {
        console.error("Failed to load SVG for bubble export", error);
        alert(`Sorry, there was an error exporting the bubble. ${error instanceof Error ? error.message : ''}`);
    }
  };

  const getTransformedSvgStringForScene = useCallback(async (
    imageDimensions: { width: number; height: number; }
  ): Promise<string> => {
      const baseSvgString = await getCleanSvgString(true);
      if (!baseSvgString) return '';
  
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(baseSvgString, "image/svg+xml");
      const svgNode = svgDoc.documentElement;
      if (svgNode.querySelector('parsererror')) {
          console.error("SVG parsing error", svgNode.querySelector('parsererror')?.textContent);
          return '';
      }
  
      const { width: imageWidth, height: imageHeight } = imageDimensions;
      const svgPreviewWidth = 500;
      const svgPreviewHeight = 350;
  
      // Use Math.min for 'meet' behavior (contain/fit), vs Math.max for 'slice' (cover/crop)
      const scale = Math.min(svgPreviewWidth / imageWidth, svgPreviewHeight / imageHeight);
      const offsetXInPreview = (svgPreviewWidth - (imageWidth * scale)) / 2;
      const offsetYInPreview = (svgPreviewHeight - (imageHeight * scale)) / 2;
      
      const finalScale = 1 / scale;
      const finalTranslateX = -offsetXInPreview;
      const finalTranslateY = -offsetYInPreview;
      
      const g = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
      // The transform maps coordinates from the preview SVG to the final image coordinates.
      // It must first translate to account for the preview offset, then scale up.
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
  }, [getCleanSvgString]);

  const handleExportScenePNG = async () => {
    if (!backgroundImage || !imageDimensions) {
      alert("Please upload a background image first.");
      return;
    }

    const { width: imageWidth, height: imageHeight } = imageDimensions;
    const canvas = document.createElement('canvas');
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bgImg = new Image();
    const bgPromise = new Promise<void>((resolve, reject) => {
      bgImg.onload = () => resolve();
      bgImg.onerror = () => reject(new Error('Failed to load background image for export.'));
      bgImg.src = backgroundImage;
    });

    const svgData = await getTransformedSvgStringForScene(imageDimensions);
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
      await bgPromise;
      ctx.drawImage(bgImg, 0, 0, imageWidth, imageHeight);
      
      await svgPromise;
      ctx.drawImage(svgImg, 0, 0, imageWidth, imageHeight);

      const pngUrl = canvas.toDataURL('image/png');
      triggerDownload(pngUrl, 'comic-scene.png');
    } catch (error) {
      console.error("Failed to load images for scene export", error);
      alert(`Sorry, there was an error exporting the scene. ${error instanceof Error ? error.message : ''}`);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-gray-800 text-white font-sans">
      <header className="md:hidden p-4 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
        <h1 className="text-2xl" style={{fontFamily: 'Bangers, cursive'}}>Babbling Book</h1>
      </header>
      
      <aside className="w-full md:w-96 lg:w-[450px] flex-shrink-0 bg-gray-900 h-auto md:h-full flex flex-col">
         {bubbleForPanel ? (
            <ControlPanel 
                bubbleProps={bubbleForPanel} 
                onUpdate={handleUpdate}
                onImageUpload={handleFileInputChange}
                onClearImage={handleClearImage}
                hasImage={!!backgroundImage}
                onAddBubble={handleAddBubble}
                onDeleteBubble={handleDeleteBubble}
                bubbleCount={bubbles.length}
            />
         ) : (
            <div className="p-6 text-gray-400 flex items-center justify-center h-full">
                <p>Initializing...</p>
            </div>
         )}
      </aside>

      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden">
        <div className="flex-shrink-0 flex justify-between items-center mb-4">
          <h1 className="hidden md:block text-4xl text-white" style={{fontFamily: 'Bangers, cursive'}}>
            Babbling Book
          </h1>
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors"
              title="Reset to default"
            >
              <ResetIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              onClick={handleExportSVG}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors"
              title="Export bubble(s) as SVG"
            >
              <DownloadIcon className="w-5 h-5"/>
              <span className="hidden sm:inline">SVG</span>
            </button>
            <button
              onClick={handleExportBubblePNG}
              className="flex items-center space-x-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-md transition-colors"
              title="Export bubble(s) as PNG (transparent)"
            >
              <DownloadIcon className="w-5 h-5"/>
              <span className="hidden sm:inline">Bubbles</span>
            </button>
            <button
              onClick={handleExportScenePNG}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
              disabled={!backgroundImage}
              title={!backgroundImage ? "Upload a background to export the scene" : "Export scene as PNG"}
            >
              <DownloadIcon className="w-5 h-5"/>
              <span className="hidden sm:inline">Scene</span>
            </button>
          </div>
        </div>
        <div className="flex-grow min-h-0">
          <BubblePreview 
              svgRef={svgRef} 
              bubbles={bubbles} 
              activeBubbleId={activeBubbleId}
              onUpdate={handleUpdate}
              onActivateBubble={handleActivateBubble}
              backgroundImage={backgroundImage}
              onFileDrop={handleFileSelect}
          />
        </div>
      </main>
    </div>
  );
};

export default App;