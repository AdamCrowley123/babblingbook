
import { ShapeType, BorderStyle, TextAlign } from './types';
import { getAllFontFamilies } from './utils/fontManager';

export const FONT_FAMILIES = getAllFontFamilies();

export const SHAPE_OPTIONS = [
  { value: ShapeType.OVAL, label: 'Oval' },
  { value: ShapeType.RECTANGLE, label: 'Rectangle (Rounded)' },
  { value: ShapeType.RECTANGLE_SHARP, label: 'Rectangle (Sharp)' },
  { value: ShapeType.SHOUT, label: 'Shout' },
  { value: ShapeType.THOUGHT, label: 'Thought' },
  { value: ShapeType.FREEHAND, label: 'Freehand' },
];

export const BORDER_STYLE_OPTIONS = [
  { value: BorderStyle.SOLID, label: 'Solid' },
  { value: BorderStyle.DASHED, label: 'Dashed' },
  { value: BorderStyle.DOTTED, label: 'Dotted' },
];

export const TEXT_ALIGN_OPTIONS = [
  { value: TextAlign.LEFT, label: 'Left' },
  { value: TextAlign.CENTER, label: 'Center' },
  { value: TextAlign.RIGHT, label: 'Right' },
];
