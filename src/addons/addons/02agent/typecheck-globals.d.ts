declare module "*.less" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "*.svg" {
  const url: string;
  export default url;
}

declare module "react-dom" {
  export function createPortal(children: any, container: Element | DocumentFragment): any;
  const ReactDOM: { createPortal: typeof createPortal };
  export default ReactDOM;
}

declare module "/penguinmod/*" {
  const value: any;
  export default value;
}

declare const require: (id: string) => any;
declare const process: { env: Record<string, string | undefined> };

declare namespace Blockly {
  interface BlockSvg {
    id: string;
    type?: string;
    parentBlock_?: BlockSvg | null;
    svgPath_?: SVGElement | null;
    getNextBlock(): BlockSvg | null;
    getParent(): BlockSvg | null;
    getRootBlock(): BlockSvg;
    getSvgRoot?(): SVGElement | null;
    getBoundingRectangle(): any;
    getRelativeToSurfaceXY(): { x: number; y: number };
    getHeightWidth(): { width: number; height: number };
    dispose(healStack?: boolean, animate?: boolean): void;
    moveBy(dx: number, dy: number): void;
    [key: string]: any;
  }

  interface WorkspaceSvg {
    getAllBlocks(): BlockSvg[];
    getBlockById(id: string): BlockSvg | null;
    getTopBlocks(ordered?: boolean): BlockSvg[];
    getAllVariables(): any[];
    [key: string]: any;
  }
}

declare namespace Scratch {
  type RenderTarget = any;
}

interface PluginContext {
  vm: any;
  workspace: Blockly.WorkspaceSvg;
  [key: string]: any;
}

interface Window {
  Blockly: any;
  ScratchBlocks?: any;
}
