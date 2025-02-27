'use client';

import { ReactNode } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

interface DragDropProviderProps {
  children: ReactNode;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
}

export function DragDropProvider({ 
  children, 
  onDragEnd, 
  onDragStart 
}: DragDropProviderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor),
    useSensor(TouchSensor)
  );

  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
    >
      {children}
      <DragOverlay>
        {/* Drag overlay content */}
      </DragOverlay>
    </DndContext>
  );
}
