import { useEffect, useRef } from 'react';

interface Cursor {
  userId: string;
  email: string;
  color: string;
  x: number;
  y: number;
  line?: number;
  column?: number;
  fileId?: string;
  timestamp: number;
}

interface LiveCursorsProps {
  cursors: Cursor[];
  containerRef: React.RefObject<HTMLElement>;
  currentFileId?: string;
}

export default function LiveCursors({ cursors, containerRef, currentFileId }: LiveCursorsProps) {
  // Filter cursors to only show those in the current file
  const visibleCursors = cursors.filter(
    cursor => !currentFileId || cursor.fileId === currentFileId
  );

  if (visibleCursors.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {visibleCursors.map((cursor) => (
        <CursorPointer key={cursor.userId} cursor={cursor} containerRef={containerRef} />
      ))}
    </div>
  );
}

function CursorPointer({ 
  cursor, 
  containerRef 
}: { 
  cursor: Cursor; 
  containerRef: React.RefObject<HTMLElement>;
}) {
  const containerRect = containerRef.current?.getBoundingClientRect();
  
  if (!containerRect) return null;

  // Calculate position relative to viewport
  const x = containerRect.left + cursor.x;
  const y = containerRect.top + cursor.y;

  // Don't render if cursor is outside container bounds
  if (x < containerRect.left || x > containerRect.right || 
      y < containerRect.top || y > containerRect.bottom) {
    return null;
  }

  const displayName = cursor.email.split('@')[0];

  return (
    <div
      className="absolute transition-all duration-75 ease-out"
      style={{
        left: x,
        top: y,
        transform: 'translate(-2px, -2px)',
      }}
    >
      {/* Cursor arrow */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
      >
        <path
          d="M5.65376 12.4561L7.84937 18.4421C8.04237 18.9726 8.73763 19.0789 9.07621 18.6261L11.5 15.5L17.4905 8.88201C17.8296 8.48431 17.5526 7.86879 17.0268 7.86879H6.12681C5.60099 7.86879 5.32397 8.48431 5.66308 8.88201L5.65376 12.4561Z"
          fill={cursor.color}
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>
      
      {/* Name label */}
      <div
        className="absolute left-4 top-4 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
        style={{ 
          backgroundColor: cursor.color,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      >
        {displayName}
      </div>
    </div>
  );
}

interface ActiveUsersProps {
  users: Array<{
    userId: string;
    email: string;
    color: string;
    fileId?: string;
  }>;
}

export function ActiveUsers({ users }: ActiveUsersProps) {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {users.slice(0, 5).map((user) => {
        const initial = user.email.charAt(0).toUpperCase();
        return (
          <div
            key={user.userId}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-background"
            style={{ backgroundColor: user.color }}
            title={user.email}
          >
            {initial}
          </div>
        );
      })}
      {users.length > 5 && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-muted text-muted-foreground border-2 border-background">
          +{users.length - 5}
        </div>
      )}
    </div>
  );
}
