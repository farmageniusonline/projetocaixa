import React from 'react';
import { FixedSizeList as List } from 'react-window';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  renderItem: ({ index, style }: { index: number; style: React.CSSProperties }) => React.ReactNode;
  className?: string;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  height,
  renderItem,
  className = ''
}: VirtualizedListProps<T>) {
  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <p className="text-gray-400 text-sm">Nenhum item para exibir</p>
      </div>
    );
  }

  return (
    <List
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      className={className}
      overscanCount={5}
    >
      {renderItem}
    </List>
  );
}