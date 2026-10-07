import type * as React from "react";

declare module "react-draggable" {
  interface DraggableProps {
    children?: React.ReactNode;
  }

  interface DraggableCoreProps {
    children?: React.ReactNode;
  }
}
