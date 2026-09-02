
import React, { useState } from 'react';
import type { BackgroundFilters, ExportFrame } from '../types';
import UploadIcon from './icons/UploadIcon';
import TrashIcon from './icons/TrashIcon';
import AddIcon from './icons/AddIcon';
import ResetIcon from './icons/ResetIcon';
import VideoIcon from './icons/VideoIcon';

interface GlobalSettingsPanelProps {
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onVideoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearBackground: () => void;
  hasImage: boolean;
  hasVideo: boolean;
  onAddBubble: () => void;
  onDeleteBubble: () => void;
  bubbleCount: number;
  backgroundFilters: BackgroundFilters;
  onUpdateFilters: (updates: Partial<BackgroundFilters>) => void;
  showExportFrame: boolean;
  onSetShowExportFrame: (value: boolean) => void;
  exportFrame: ExportFrame | null;
  onUpdateExportFrame: (updates: Partial<ExportFrame>) => void;
  onResetExportFrame: () => void;
  canvasDimensions: { width: number; height: number };
  handleSize: number;
  onUpdateHandleSize: (value: number) => void;
  onSaveProject?: () => void;
  onLoadProject?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

// Helper components copied from ControlPanel to make this component self-contained.
const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`mb-6 ${className}`}>
    <h3 className="text-md font-bold text-stone-200 mb-3 border-b border-stone-700 pb-2">
      {title}
    </h3>
    <div className="space-y-4">{children}</div>
  </div>
);

const Label: React.FC<{ htmlFor?: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="text-sm font-medium text-stone-300 block">
    {children}
  </label>
);

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void;}> = ({label, checked, onChange}) => (
    <div className="flex items-center justify-between">
        <Label htmlFor={`${label}-toggle`}>{label}</Label>
        <label htmlFor={`${label}-toggle`} className="flex items-center cursor-pointer">
          <div className="relative">
            <input type="checkbox" id={`${label}-toggle`} className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <div className="block bg-stone-600 w-12 h-7 rounded-full"></div>
            <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${checked ? 'transform translate-x-5 bg-indigo-400' : ''}`}></div>
          </div>
        </label>
    </div>
);

const ChevronDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    {...props}
  >
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const SaveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);

const FolderIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const CompactSlider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; unit?: string }> = ({ label, value, min, max, step = 1, onChange, unit = 'px' }) => (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <label htmlFor={`compact-slider-${label}`} className="text-xs font-medium text-stone-300">{label}</label>
        <span className="text-xs font-mono text-stone-400">{value}{unit}</span>
      </div>
      <input id={`compact-slider-${label}`} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(step === 1 ? parseInt(e.target.value) : parseFloat(e.target.value))} className="w-full mt-0 h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
    </div>
);


const GlobalSettingsPanel: React.FC<GlobalSettingsPanelProps> = ({ 
    onImageUpload, onVideoUpload, onClearBackground, hasImage, hasVideo, onAddBubble, onDeleteBubble, bubbleCount, backgroundFilters, onUpdateFilters, showExportFrame, onSetShowExportFrame, exportFrame, onUpdateExportFrame, onResetExportFrame, canvasDimensions, handleSize, onUpdateHandleSize, onSaveProject, onLoadProject
}) => {
  const [isEffectsExpanded, setIsEffectsExpanded] = useState(true);
  const [isExportAreaExpanded, setIsExportAreaExpanded] = useState(true);
  const hasBackground = hasImage || hasVideo;

  return (
    <div className="h-full flex flex-col overflow-y-auto">
       <div className="p-6">
            <Section title="Project">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onSaveProject}
                        className="flex items-center justify-center space-x-1 px-3 py-2 bg-stone-700 hover:bg-stone-600 rounded-md transition-colors text-sm"
                        title="Save project as JSON file"
                    >
                        <SaveIcon className="w-4 h-4" />
                        <span>Save (.json)</span>
                    </button>
                    <label
                        htmlFor="project-load-input"
                        className="cursor-pointer flex items-center justify-center space-x-1 px-3 py-2 bg-stone-700 hover:bg-stone-600 rounded-md transition-colors text-sm"
                        title="Open previously saved JSON project"
                    >
                        <FolderIcon className="w-4 h-4" />
                        <span>Load (.json)</span>
                    </label>
                    <input
                        id="project-load-input"
                        type="file"
                        accept=".json,application/json"
                        onChange={onLoadProject}
                        className="hidden"
                    />
                </div>
            </Section>

            <Section title="Global Actions">
                <div className="flex flex-col space-y-2">
                    <button onClick={onAddBubble} className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-md transition-colors" title="Add a new bubble">
                        <AddIcon className="w-5 h-5" />
                        <span>Add New Bubble</span>
                    </button>
                    <button onClick={onDeleteBubble} disabled={bubbleCount <= 1} className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-md transition-colors disabled:bg-stone-600 disabled:cursor-not-allowed" title={bubbleCount <= 1 ? "Cannot delete the last bubble" : "Delete the active bubble"}>
                        <TrashIcon className="w-5 h-5" />
                        <span>Delete Active</span>
                    </button>
                </div>
                 <p className="text-xs text-stone-400 mt-2 text-center">Click a bubble in the preview to edit it.</p>
                <div className="flex flex-col space-y-2 pt-4 border-t border-stone-700 mt-4">
                    <label htmlFor="image-upload" className={`w-full cursor-pointer flex items-center justify-center space-x-2 px-4 py-2 bg-stone-700 hover:bg-stone-600 rounded-md transition-colors ${hasVideo ? 'opacity-50 cursor-not-allowed' : ''}`} title={hasVideo ? "Clear video background to upload an image" : "Upload background image"}>
                        <UploadIcon className="w-5 h-5" />
                        <span>Image</span>
                    </label>
                    <input id="image-upload" type="file" accept="image/*" onChange={onImageUpload} className="hidden" disabled={hasVideo}/>

                    <label htmlFor="video-upload" className={`w-full cursor-pointer flex items-center justify-center space-x-2 px-4 py-2 bg-stone-700 hover:bg-stone-600 rounded-md transition-colors ${hasImage ? 'opacity-50 cursor-not-allowed' : ''}`} title={hasImage ? "Clear image background to upload a video" : "Upload background video"}>
                        <VideoIcon className="w-5 h-5" />
                        <span>Video</span>
                    </label>
                    <input id="video-upload" type="file" accept="video/*" onChange={onVideoUpload} className="hidden" disabled={hasImage}/>

                    <p className="text-xs text-stone-400 text-center pt-1">
                        💡 Premi <kbd className="px-1 py-0.5 bg-stone-700 rounded text-stone-300 border border-stone-600 font-mono">Ctrl+V</kbd> per incollare un'immagine dagli appunti, o <kbd className="px-1 py-0.5 bg-stone-700 rounded text-stone-300 border border-stone-600 font-mono">Ctrl+C</kbd> per copiare il canvas!
                    </p>

                    {hasBackground && (
                        <button onClick={onClearBackground} className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-md transition-colors" title="Clear background">
                            <TrashIcon className="w-5 h-5" />
                            <span>Clear Background</span>
                        </button>
                    )}
                </div>
            </Section>
            
            <Section title="Editor Display">
                 <CompactSlider 
                    label="Handle Size" 
                    value={handleSize} 
                    min={0.5} 
                    max={3} 
                    step={0.1} 
                    onChange={onUpdateHandleSize} 
                    unit="x" 
                />
                {hasBackground && (
                    <div className="mt-4">
                        <Toggle label="Show Export Frame" checked={showExportFrame} onChange={onSetShowExportFrame} />
                    </div>
                )}
            </Section>

            {hasBackground && (
                <div className="mt-4">
                    <h3 
                        className="text-md font-bold text-stone-200 mb-3 border-b border-stone-700 pb-2 flex justify-between items-center cursor-pointer select-none"
                        onClick={() => setIsEffectsExpanded(!isEffectsExpanded)}
                    >
                        <span>Background Effects</span>
                        <ChevronDownIcon className={`w-5 h-5 text-stone-400 transform transition-transform duration-200 ${isEffectsExpanded ? '' : '-rotate-90'}`} />
                    </h3>
                    {isEffectsExpanded && (
                        <div className="pt-2 animate-fade-in-down">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                <CompactSlider label="Brightness" value={backgroundFilters.brightness} min={0} max={200} onChange={(v) => onUpdateFilters({ brightness: v })} unit="%" />
                                <CompactSlider label="Contrast" value={backgroundFilters.contrast} min={0} max={200} onChange={(v) => onUpdateFilters({ contrast: v })} unit="%" />
                                <CompactSlider label="Saturation" value={backgroundFilters.saturate} min={0} max={200} onChange={(v) => onUpdateFilters({ saturate: v })} unit="%" />
                                <CompactSlider label="Temperature" value={backgroundFilters.temperature} min={-100} max={100} onChange={(v) => onUpdateFilters({ temperature: v })} unit="" />
                            </div>
                            <button
                                onClick={() => onUpdateFilters({ brightness: 100, contrast: 100, saturate: 100, temperature: 0 })}
                                className="w-full mt-4 flex items-center justify-center space-x-2 px-4 py-2 bg-stone-600 hover:bg-stone-500 rounded-md transition-colors text-sm"
                            >
                                <ResetIcon className="w-4 h-4" />
                                <span>Reset Filters</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
            {hasBackground && showExportFrame && exportFrame && (
                <div className="mt-4">
                    <h3 
                        className="text-md font-bold text-stone-200 mb-3 border-b border-stone-700 pb-2 flex justify-between items-center cursor-pointer select-none"
                        onClick={() => setIsExportAreaExpanded(!isExportAreaExpanded)}
                    >
                        <span>Export Area</span>
                        <ChevronDownIcon className={`w-5 h-5 text-stone-400 transform transition-transform duration-200 ${isExportAreaExpanded ? '' : '-rotate-90'}`} />
                    </h3>
                    {isExportAreaExpanded && (
                         <div className="pt-2 animate-fade-in-down">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                <CompactSlider label="Crop X" value={exportFrame.x} min={0} max={canvasDimensions.width - exportFrame.width} onChange={(v) => onUpdateExportFrame({ x: v })} unit="px" />
                                <CompactSlider label="Crop Y" value={exportFrame.y} min={0} max={canvasDimensions.height - exportFrame.height} onChange={(v) => onUpdateExportFrame({ y: v })} unit="px" />
                                <CompactSlider label="Crop Width" value={exportFrame.width} min={50} max={canvasDimensions.width} onChange={(v) => onUpdateExportFrame({ width: v })} unit="px" />
                                <CompactSlider label="Crop Height" value={exportFrame.height} min={50} max={canvasDimensions.height} onChange={(v) => onUpdateExportFrame({ height: v })} unit="px" />
                            </div>
                            <button
                                onClick={onResetExportFrame}
                                className="w-full mt-4 flex items-center justify-center space-x-2 px-4 py-2 bg-stone-600 hover:bg-stone-500 rounded-md transition-colors text-sm"
                            >
                                <ResetIcon className="w-4 h-4" />
                                <span>Reset Crop Area</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
       </div>
    </div>
  );
};

export default GlobalSettingsPanel;
