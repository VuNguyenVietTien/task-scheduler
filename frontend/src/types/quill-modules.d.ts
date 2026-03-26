declare module 'quill-better-table' {
  export interface TableModule {
    insertTable: (rows: number, columns: number) => void;
  }
  export interface QuillBetterTable {
    TableModule: any;
  }
}

declare module 'quill-image-resize-module-react' {
  export interface ImageResize {
    parchment: any;
    modules: string[];
  }
}

// Extend ReactQuill props
declare module 'react-quill' {
  import { RefAttributes } from 'react';
  
  interface ReactQuillProps {
    ref?: any;
    theme?: string;
    value?: string;
    onChange?: (
      value: string, 
      delta: any, 
      source: string, 
      editor: any
    ) => void;
    onChangeSelection?: (range: Range, source: Sources, editor: UnprivilegedEditor) => void;
    onFocus?: (range: Range, source: Sources, editor: UnprivilegedEditor) => void;
    onBlur?: (previousRange: Range, source: Sources, editor: UnprivilegedEditor) => void;
    onKeyPress?: (event: Event) => void;
    onKeyDown?: (event: Event) => void;
    onKeyUp?: (event: Event) => void;
    modules?: any;
    formats?: string[];
    placeholder?: string;
    readOnly?: boolean;
    defaultValue?: string;
    className?: string;
    tabIndex?: number;
    bounds?: string | HTMLElement;
    scrollingContainer?: string | HTMLElement;
  }

  const ReactQuill: React.ForwardRefExoticComponent<ReactQuillProps & RefAttributes<any>>;
  export default ReactQuill;
}