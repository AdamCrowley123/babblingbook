import React, { useState } from 'react';
import type { BubbleProps, TailProps } from '../types';
import { ShapeType, TailType } from '../types';
import { FONT_FAMILIES, SHAPE_OPTIONS, BORDER_STYLE_OPTIONS, TEXT_ALIGN_OPTIONS } from '../constants';
import UploadIcon from './icons/UploadIcon';
import TrashIcon from './icons/TrashIcon';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import EmojiIcon from './icons/EmojiIcon';
import AddIcon from './icons/AddIcon';
import ResetIcon from './icons/ResetIcon';
import VideoIcon from './icons/VideoIcon';


interface ControlPanelProps {
  bubbleProps: BubbleProps;
  onUpdate: (updates: Partial<BubbleProps>) => void;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onVideoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearBackground: () => void;
  hasImage: boolean;
  hasVideo: boolean;
  onAddBubble: () => void;
  onDeleteBubble: () => void;
  bubbleCount: number;
  nextTailId: React.MutableRefObject<number>;
}

const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`mb-6 ${className}`}>
    <h3 className="text-md font-bold text-gray-200 mb-3 border-b border-gray-700 pb-2">
      {title}
    </h3>
    <div className="space-y-4">{children}</div>
  </div>
);

const Label: React.FC<{ htmlFor?: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="text-sm font-medium text-gray-300 block">
    {children}
  </label>
);

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 24, 32, 48, 64];

const RichTextEditor: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const [showPicker, setShowPicker] = React.useState(false);
    const lastSelectionRef = React.useRef<Range | null>(null);

    React.useEffect(() => {
        if (editorRef.current && value !== editorRef.current.innerHTML) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        const newHtml = e.currentTarget.innerHTML;
        if (value !== newHtml) {
            onChange(newHtml);
        }
    };
    
    const execCommand = (command: string, valueArg?: string) => {
        document.execCommand(command, false, valueArg);
        if (editorRef.current) {
            editorRef.current.focus();
            onChange(editorRef.current.innerHTML);
        }
    }

    const applyFontSize = (size: string) => {
        if (!size) return;
        
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const container = document.createElement('div');
        container.appendChild(range.cloneContents());
        const selectedHTML = container.innerHTML;

        if (selectedHTML) {
            const newHTML = `<span style="font-size: ${size}px;">${selectedHTML}</span>`;
            execCommand('insertHTML', newHTML);
        }
    };
    
    const saveSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            lastSelectionRef.current = selection.getRangeAt(0).cloneRange();
        }
    };

    const restoreSelection = () => {
        if (lastSelectionRef.current) {
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(lastSelectionRef.current);
            }
        } else if (editorRef.current) {
            editorRef.current.focus();
        }
    };
    
    const handleEmojiClick = (emojiData: EmojiClickData) => {
        if (!editorRef.current) return;
        restoreSelection();
        document.execCommand('insertText', false, emojiData.emoji);
        onChange(editorRef.current.innerHTML);
        setShowPicker(false);
        editorRef.current.focus();
    };

    const handleEditorBlur = () => {
        saveSelection();
    };

    return (
        <div className="relative">
            <div className="flex items-center flex-wrap gap-2 mb-2 p-1 bg-gray-800 rounded-md">
                <button onClick={() => execCommand('bold')} className="px-3 py-1 font-bold rounded-md hover:bg-gray-700 transition-colors">B</button>
                <button onClick={() => execCommand('italic')} className="px-3 py-1 italic rounded-md hover:bg-gray-700 transition-colors">I</button>
                <input
                    type="color"
                    onInput={(e) => execCommand('foreColor', (e.target as HTMLInputElement).value)}
                    className="w-8 h-8 p-0 border-none bg-transparent cursor-pointer"
                    title="Change selected text color"
                />
                 <select
                    onChange={(e) => applyFontSize(e.target.value)}
                    className="px-2 py-1 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
                    defaultValue=""
                    title="Change selected text size"
                >
                    <option value="" disabled>Size</option>
                    {FONT_SIZES.map(size => <option key={size} value={size}>{size}px</option>)}
                </select>
                <button 
                    onClick={() => setShowPicker(p => !p)} 
                    className="p-1.5 rounded-md hover:bg-gray-700 transition-colors"
                    title="Add Emoji"
                >
                    <EmojiIcon className="w-5 h-5" />
                </button>
            </div>
             {showPicker && (
                <div className="absolute z-10 top-full mt-2 right-0">
                    <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        theme={Theme.DARK}
                        lazyLoadEmojis={true}
                    />
                </div>
            )}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onBlur={handleEditorBlur}
                suppressContentEditableWarning={true}
                className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition overflow-y-auto"
                style={{ minHeight: '112px', whiteSpace: 'pre-wrap' }}
            />
        </div>
    );
};

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void;}> = ({label, checked, onChange}) => (
    <div className="flex items-center justify-between">
        <Label htmlFor={`${label}-toggle`}>{label}</Label>
        <label htmlFor={`${label}-toggle`} className="flex items-center cursor-pointer">
          <div className="relative">
            <input type="checkbox" id={`${label}-toggle`} className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <div className="block bg-gray-600 w-12 h-7 rounded-full"></div>
            <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${checked ? 'transform translate-x-5 bg-indigo-400' : ''}`}></div>
          </div>
        </label>
    </div>
);

const ColorInput: React.FC<{ label: string; value: string; onChange: (value: string) => void;}> = ({label, value, onChange}) => (
     <div>
        <Label htmlFor={label}>{label}</Label>
        <input id={label} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-full mt-1 p-1 h-10 bg-gray-700 border border-gray-600 rounded-md cursor-pointer"/>
    </div>
);

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; unit?: string }> = ({ label, value, min, max, step = 1, onChange, unit = 'px' }) => (
    <div>
      <Label htmlFor={label}>{label}: {value}{unit}</Label>
      <input id={label} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(step === 1 ? parseInt(e.target.value) : parseFloat(e.target.value))} className="w-full mt-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
    </div>
);

const ControlPanel: React.FC<ControlPanelProps> = ({ bubbleProps, onUpdate, onImageUpload, onVideoUpload, onClearBackground, hasImage, hasVideo, onAddBubble, onDeleteBubble, bubbleCount, nextTailId }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'bubble'>('text');
  
    const handleAddTail = () => {
        const baseTail = bubbleProps.tails[bubbleProps.tails.length - 1] || {
            p1: { x: bubbleProps.x - 25, y: bubbleProps.y + bubbleProps.height / 2 },
            p2: { x: bubbleProps.x + 25, y: bubbleProps.y + bubbleProps.height / 2 },
            p3: { x: bubbleProps.x, y: bubbleProps.y + bubbleProps.height / 2 + 50 },
            type: TailType.CURVED,
            bend: 0,
            zigs: 7,
        };
        const newTail: TailProps = {
            id: nextTailId.current++,
            type: baseTail.type,
            // Deep copy position properties to prevent sharing object references
            p1: { ...baseTail.p1 },
            p2: { ...baseTail.p2 },
            // Offset the new tail's tip to make it visible
            p3: { x: baseTail.p3.x + 15, y: baseTail.p3.y - 15 },
            bend: baseTail.bend,
            zigs: baseTail.zigs,
        };
        onUpdate({ tails: [...bubbleProps.tails, newTail] });
    };

    const handleDeleteTail = (tailId: number) => {
        onUpdate({ tails: bubbleProps.tails.filter(t => t.id !== tailId) });
    };

    const handleUpdateTail = (tailId: number, updates: Partial<Omit<TailProps, 'id'>>) => {
        const newTails = bubbleProps.tails.map(t =>
            t.id === tailId ? { ...t, ...updates } : t
        );
        onUpdate({ tails: newTails });
    };
    const hasBackground = hasImage || hasVideo;
  return (
    <div className="bg-gray-900 h-full flex flex-col">
       <div className="p-6 border-b border-gray-800">
            <Section title="Global Settings">
                <div className="flex space-x-2">
                    <button onClick={onAddBubble} className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-md transition-colors" title="Add a new bubble">
                        <AddIcon className="w-5 h-5" />
                        <span>Add New</span>
                    </button>
                    <button onClick={onDeleteBubble} disabled={bubbleCount <= 1} className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed" title={bubbleCount <= 1 ? "Cannot delete the last bubble" : "Delete the active bubble"}>
                        <TrashIcon className="w-5 h-5" />
                        <span>Delete Active</span>
                    </button>
                </div>
                 <p className="text-xs text-gray-400 mt-2 text-center">Click a bubble in the preview to edit it.</p>
                <div className="flex items-center space-x-2 pt-4 border-t border-gray-700 mt-4">
                    <label htmlFor="image-upload" className={`flex-1 cursor-pointer flex items-center justify-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors ${hasVideo ? 'opacity-50 cursor-not-allowed' : ''}`} title={hasVideo ? "Clear video background to upload an image" : "Upload background image"}>
                        <UploadIcon className="w-5 h-5" />
                        <span>Image</span>
                    </label>
                    <input id="image-upload" type="file" accept="image/*" onChange={onImageUpload} className="hidden" disabled={hasVideo}/>

                    <label htmlFor="video-upload" className={`flex-1 cursor-pointer flex items-center justify-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors ${hasImage ? 'opacity-50 cursor-not-allowed' : ''}`} title={hasImage ? "Clear image background to upload a video" : "Upload background video"}>
                        <VideoIcon className="w-5 h-5" />
                        <span>Video</span>
                    </label>
                    <input id="video-upload" type="file" accept="video/*" onChange={onVideoUpload} className="hidden" disabled={hasImage}/>

                    {hasBackground && (
                        <button onClick={onClearBackground} className="p-2 bg-red-600 hover:bg-red-500 rounded-md transition-colors" title="Clear background">
                        <TrashIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </Section>
       </div>
       
       <div className="flex-grow flex flex-col overflow-hidden">
            <div className="flex-shrink-0 border-b-2 border-indigo-500">
                <nav className="flex space-x-2 px-6">
                    <button onClick={() => setActiveTab('text')} className={`px-4 py-3 text-sm font-bold transition-colors ${activeTab === 'text' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}>TEXT</button>
                    <button onClick={() => setActiveTab('bubble')} className={`px-4 py-3 text-sm font-bold transition-colors ${activeTab === 'bubble' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}>BUBBLE</button>
                </nav>
            </div>

            <div className="flex-grow p-6 overflow-y-auto">
                {activeTab === 'text' && (
                    <div id="text-panel">
                        <Section title="Content & Font">
                           <RichTextEditor key={bubbleProps.id} value={bubbleProps.text} onChange={(newText) => onUpdate({ text: newText })}/>
                            <div>
                                <Label htmlFor="font-family">Font Family</Label>
                                <select id="font-family" value={bubbleProps.fontFamily} onChange={(e) => onUpdate({ fontFamily: e.target.value })} className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition">
                                    {FONT_FAMILIES.map((font) => <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>)}
                                </select>
                            </div>
                            <Slider label="Default Font Size" value={bubbleProps.fontSize} min={10} max={72} onChange={(v) => onUpdate({ fontSize: v })} />
                            <ColorInput label="Default Text Color" value={bubbleProps.textColor} onChange={(v) => onUpdate({ textColor: v })} />
                             <div>
                                <Label>Text Align</Label>
                                <div className="flex mt-1 space-x-1 bg-gray-700 p-1 rounded-md">
                                    {TEXT_ALIGN_OPTIONS.map(({ value, label }) => (
                                    <button key={value} onClick={() => onUpdate({ textAlign: value })} className={`w-full py-1 rounded transition-colors text-sm ${ bubbleProps.textAlign === value ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600' }`}>
                                        {label}
                                    </button>
                                    ))}
                                </div>
                            </div>
                            <Slider label="Line Spacing" value={bubbleProps.lineHeight} min={0.8} max={3} step={0.1} onChange={(v) => onUpdate({ lineHeight: v })} unit="" />
                        </Section>
                        <Section title="Text Effects">
                             <div className="space-y-3 p-3 bg-gray-800 rounded-lg">
                                <Toggle label="Drop Shadow" checked={bubbleProps.textShadow} onChange={(v) => onUpdate({ textShadow: v })} />
                                {bubbleProps.textShadow && (
                                    <div className="space-y-3 pt-3 border-t border-gray-700">
                                        <ColorInput label="Shadow Color" value={bubbleProps.textShadowColor} onChange={(v) => onUpdate({ textShadowColor: v })} />
                                        <Slider label="Offset X" value={bubbleProps.textShadowOffsetX} min={-10} max={10} onChange={(v) => onUpdate({ textShadowOffsetX: v })} />
                                        <Slider label="Offset Y" value={bubbleProps.textShadowOffsetY} min={-10} max={10} onChange={(v) => onUpdate({ textShadowOffsetY: v })} />
                                        <Slider label="Blur" value={bubbleProps.textShadowBlur} min={0} max={20} onChange={(v) => onUpdate({ textShadowBlur: v })} />
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3 p-3 bg-gray-800 rounded-lg">
                                <Toggle label="Outline" checked={bubbleProps.textOutline} onChange={(v) => onUpdate({ textOutline: v })} />
                                {bubbleProps.textOutline && (
                                    <div className="space-y-3 pt-3 border-t border-gray-700">
                                        <ColorInput label="Outline Color" value={bubbleProps.textOutlineColor} onChange={(v) => onUpdate({ textOutlineColor: v })} />
                                        <Slider label="Outline Width" value={bubbleProps.textOutlineWidth} min={0} max={10} onChange={(v) => onUpdate({ textOutlineWidth: v })} />
                                    </div>
                                )}
                            </div>
                        </Section>
                    </div>
                )}
                {activeTab === 'bubble' && (
                    <div id="bubble-panel">
                        <Section title="Shape & Style">
                             <Toggle label="Show Bubble" checked={bubbleProps.bubbleVisible} onChange={(v) => onUpdate({ bubbleVisible: v })} />
                             <div>
                                <Label htmlFor="shape">Shape</Label>
                                <select id="shape" value={bubbleProps.shape} onChange={(e) => onUpdate({ shape: e.target.value as any })} className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition">
                                    {SHAPE_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </div>
                            {bubbleProps.shape === ShapeType.SHOUT && (
                                <Slider label="Spikes" value={bubbleProps.shoutSpikes} min={4} max={40} onChange={(v) => onUpdate({ shoutSpikes: v })} unit="" />
                            )}
                            {bubbleProps.shape === ShapeType.THOUGHT && (
                                <Slider label="Puffs" value={bubbleProps.thoughtPuffs} min={5} max={25} onChange={(v) => onUpdate({ thoughtPuffs: v })} unit="" />
                            )}
                            <ColorInput label="Fill Color" value={bubbleProps.fillColor} onChange={(v) => onUpdate({ fillColor: v })} />
                            <ColorInput label="Border Color" value={bubbleProps.borderColor} onChange={(v) => onUpdate({ borderColor: v })} />
                            <Slider label="Border Width" value={bubbleProps.borderWidth} min={0} max={20} onChange={(v) => onUpdate({ borderWidth: v })} />
                            <div>
                                <Label htmlFor="border-style">Border Style</Label>
                                <select id="border-style" value={bubbleProps.borderStyle} onChange={(e) => onUpdate({ borderStyle: e.target.value as any })} className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition">
                                    {BORDER_STYLE_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </div>
                        </Section>

                        <Section title="Drop Shadow">
                            <div className="space-y-3 p-3 bg-gray-800 rounded-lg">
                                <Toggle label="Bubble Shadow" checked={bubbleProps.bubbleShadow} onChange={(v) => onUpdate({ bubbleShadow: v })} />
                                {bubbleProps.bubbleShadow && (
                                    <div className="space-y-3 pt-3 border-t border-gray-700">
                                        <ColorInput label="Shadow Color" value={bubbleProps.bubbleShadowColor} onChange={(v) => onUpdate({ bubbleShadowColor: v })} />
                                        <Slider label="Offset X" value={bubbleProps.bubbleShadowOffsetX} min={-15} max={15} onChange={(v) => onUpdate({ bubbleShadowOffsetX: v })} />
                                        <Slider label="Offset Y" value={bubbleProps.bubbleShadowOffsetY} min={-15} max={15} onChange={(v) => onUpdate({ bubbleShadowOffsetY: v })} />
                                        <Slider label="Blur" value={bubbleProps.bubbleShadowBlur} min={0} max={30} onChange={(v) => onUpdate({ bubbleShadowBlur: v })} />
                                    </div>
                                )}
                            </div>
                        </Section>

                        <Section title="Tail & Transform">
                             <div>
                                <Label htmlFor="rotation">Rotation: {bubbleProps.rotation}°</Label>
                                <div className="flex items-center space-x-2">
                                <input id="rotation" type="range" min="-180" max="180" value={bubbleProps.rotation} onChange={(e) => onUpdate({ rotation: parseInt(e.target.value) })} className="w-full mt-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                                <button onClick={() => onUpdate({ rotation: 0 })} className="p-1.5 hover:bg-gray-700 rounded-md" title="Reset Rotation">
                                    <ResetIcon className="w-4 h-4" />
                                </button>
                                </div>
                            </div>
                            <Toggle label="Show Tails" checked={bubbleProps.tailVisible} onChange={(v) => onUpdate({ tailVisible: v })} />
                            
                            {bubbleProps.tailVisible && (
                                <div className="space-y-4 pt-3 border-t border-gray-700">
                                    {bubbleProps.tails.map((tail, index) => (
                                    <div key={tail.id} className="p-3 bg-gray-800 rounded-lg space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-semibold text-gray-300">Tail {index + 1}</h4>
                                            <button
                                                onClick={() => handleDeleteTail(tail.id)}
                                                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900 rounded-md transition-colors"
                                                title="Delete Tail"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div>
                                            <Label htmlFor={`tail-type-${tail.id}`}>Tail Type</Label>
                                            <select id={`tail-type-${tail.id}`} value={tail.type} onChange={e => handleUpdateTail(tail.id, { type: e.target.value as TailType })} className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition">
                                                <option value={TailType.CURVED}>Curved</option>
                                                <option value={TailType.LIGHTNING}>Lightning</option>
                                            </select>
                                        </div>
                                        
                                        {tail.type === TailType.CURVED && (
                                        <Slider label="Bend" value={tail.bend} min={-1} max={1} step={0.05} onChange={v => handleUpdateTail(tail.id, { bend: v })} unit="" />
                                        )}
                                        {tail.type === TailType.LIGHTNING && (
                                        <Slider label="Zigs" value={tail.zigs} min={2} max={15} onChange={v => handleUpdateTail(tail.id, { zigs: v })} unit="" />
                                        )}
                                    </div>
                                    ))}
                                    <button onClick={handleAddTail} className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors">
                                        <AddIcon className="w-5 h-5" />
                                        <span>Add Tail</span>
                                    </button>
                                </div>
                            )}

                            <div className="text-xs text-gray-400 mt-2 space-y-1">
                                <p>Move the bubble using its red center handle.</p>
                                <p>Drag the square handles to resize.</p>
                                <p>Drag the blue handles to shape the tail.</p>
                            </div>
                        </Section>
                    </div>
                )}
            </div>
       </div>
    </div>
  );
};

export default ControlPanel;
