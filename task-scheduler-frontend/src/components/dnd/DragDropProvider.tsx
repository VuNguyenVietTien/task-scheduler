'use client';

import { ReactNode } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DragStart,
  DragUpdate,
  DropResult,
  type DroppableProvided,
  type DraggableProvided,
  type DraggableStateSnapshot,
} from '@hello-pangea/dnd';

interface DragDropProviderProps {
  children: ReactNode;
  onDragEnd: (result: DropResult) => void;
}

// Re-export types and components
export type {
  DroppableProvided,
  DraggableProvided,
  DraggableStateSnapshot,
  DropResult
};

export { Draggable, Droppable };

export function DragDropProvider({ children, onDragEnd }: DragDropProviderProps) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {children}
      <style jsx global>{`
        /* Dragging cursor styles */
        [data-rbd-draggable-context-id] {
          cursor: grab;
        }

        [data-rbd-draggable-context-id][data-rbd-dragging="true"] {
          cursor: grabbing;
        }

        /* Droppable area styles */
        [data-rbd-droppable-id] {
          transition: all 0.2s ease-in-out;
          min-height: 100px;
        }

        /* Drop target highlight styles */
        [data-rbd-droppable-id][data-rbd-droppable-context-id][data-is-dragging-over="true"] {
          background-color: rgba(37, 99, 235, 0.1) !important;
          box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.4);
          border-radius: 0.5rem;
        }

        /* Placeholder styles */
        [data-rbd-placeholder-context-id] {
          transition: height 0.2s ease;
        }
      `}</style>
    </DragDropContext>
  );
}
