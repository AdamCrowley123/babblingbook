
export enum ShapeType {
  OVAL = 'oval',
  RECTANGLE = 'rectangle',
  RECTANGLE_SHARP = 'rectangle_sharp',
  SHOUT = 'shout',
  THOUGHT = 'thought',
  FREEHAND = 'freehand',
}

export enum BorderStyle {
  SOLID = 'solid',
  DASHED = 'dashed',
  DOTTED = 'dotted',
}

export enum TextAlign {
  LEFT = 'left',
  CENTER = 'center',
  RIGHT = 'right',
}

export enum TailType {
  CURVED = 'curved',
  LIGHTNING = 'lightning',
}

export interface TailPosition {
  x: number;
  y: number;
}

export interface TailProps {
  id: number;
  type: TailType;
  p1: TailPosition;
  p2: TailPosition;
  p3: TailPosition;
  bend: number; // For CURVED
  zigs: number; // For LIGHTNING
}

export interface BackgroundFilters {
  contrast: number;
  brightness: number;
  saturate: number;
  temperature: number;
}

export interface ExportFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BubbleProps {
  id: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  textAlign: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  shape: ShapeType;
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: BorderStyle;
  tails: TailProps[];
  width: number;
  height: number;
  x: number;
  y: number;
  rotation: number;
  textRotation: number;
  textScaleX: number;
  textScaleY: number;
  bubbleVisible: boolean;
  textShadow: boolean;
  textShadowColor: string;
  textShadowBlur: number;
  textShadowOffsetX: number;
  textShadowOffsetY: number;
  textOutline: boolean;
  textOutlineColor: string;
  textOutlineWidth: number;
  bubbleShadow: boolean;
  bubbleShadowColor: string;
  bubbleShadowBlur: number;
  bubbleShadowOffsetX: number;
  bubbleShadowOffsetY: number;
  shoutSpikes: number;
  thoughtPuffs: number;
  freehandRawPoints?: { x: number; y: number }[];
  freehandPoints?: { x: number; y: number }[];
  freehandSmoothness?: number;
  freehandSimplification?: number;
  isDrawingEnabled?: boolean;
  tailVisible: boolean;
  charZoomRandomness: number;
  charYRandomness: number;
  charRotationRandomness: number;
}