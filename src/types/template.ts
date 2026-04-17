export type ElementType = 'text' | 'variable' | 'image' | 'rectangle' | 'items';

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
  src: string;
  objectFit: 'contain' | 'cover' | 'fill';
}

export interface RectangleElement extends BaseElement {
  type: 'rectangle';
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
}

export interface ItemsElement extends BaseElement {
  type: 'items';
  fontSize: number;
  rowHeight: number;          // px per data row
  headerBgColor: string;
  headerTextColor: string;
  borderColor: string;
  altRowBgColor: string;      // alternating row tint, '' = none
  summaryBgColor: string;     // background for Netto/MwSt/Brutto rows
  mwstRate: number;           // e.g. 19
  // column widths as fractions of element width (must sum to 1)
  colWidths: [number, number, number, number, number, number];
}

export type TemplateElement =
  | TextElement
  | VariableElement
  | ImageElement
  | RectangleElement
  | ItemsElement;

/** A single invoice line item used in WriteInvoice */
export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface TemplateVariable {
  key: string;
  label: string;
  defaultValue: string;
  settingsKey: string;
  multiline: boolean;
  autoCalculated?: boolean; // true = filled automatically from line items, not shown as input
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

