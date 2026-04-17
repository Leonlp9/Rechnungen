export type ElementType = 'text' | 'variable' | 'image' | 'rectangle';

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
}

export interface VariableElement extends BaseElement {
  type: 'variable';
  variableKey: string;
  prefix: string;
  suffix: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string; // base64 data-URL
  objectFit: 'contain' | 'cover' | 'fill';
}

export interface RectangleElement extends BaseElement {
  type: 'rectangle';
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
}

export type TemplateElement =
  | TextElement
  | VariableElement
  | ImageElement
  | RectangleElement;

export interface TemplateVariable {
  key: string;
  label: string;
  defaultValue: string;
  settingsKey: string; // if set, auto-filled from settings
  multiline: boolean;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  templateType: 'invoice' | 'credit';
  isBuiltin: boolean; // built-in templates cannot be deleted
  variables: TemplateVariable[];
  elements: TemplateElement[];
  createdAt: string;
  updatedAt: string;
}

// A4 canvas dimensions in px at 96dpi
export const CANVAS_W = 794;
export const CANVAS_H = 1123;
export const PX_TO_MM = 210 / CANVAS_W; // ≈ 0.2646

