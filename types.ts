
export enum ShapeType {
  OVAL = 'oval',
  RECTANGLE = 'rectangle',
  RECTANGLE_SHARP = 'rectangle_sharp',
  SHOUT = 'shout',
  THOUGHT = 'thought',
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

export interface TailPosition {
  x: number;
  y: number;
}

export interface BubbleProps {
  id: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  textAlign: TextAlign;
  lineHeight: number;
  shape: ShapeType;
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: BorderStyle;
  tailP1: TailPosition;
  tailP2: TailPosition;
  tailP3: TailPosition;
  tailBend: number;
  width: number;
  height: number;
  x: number;
  y: number;
  tailVisible: boolean;
  rotation: number;
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
}
