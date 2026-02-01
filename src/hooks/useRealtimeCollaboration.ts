import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { RealtimeChannel } from '@supabase/supabase-js';

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

interface Presence {
  userId: string;
  email: string;
  color: string;
  fileId?: string;
  lastSeen: number;
}

const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

function getColorForUser(userId: string): string {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

export function useRealtimeCollaboration(siteId: string, fileId?: string) {
  const { user } = useAuth();
  const [cursors, setCursors] = useState<Map<string, Cursor>>(new Map());
  const [activeUsers, setActiveUsers] = useState<Presence[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cursorTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const myColor = user ? getColorForUser(user.id) : '#888';

  // Broadcast cursor position
  const broadcastCursor = useCallback((position: { x: number; y: number; line?: number; column?: number }) => {
    if (!channelRef.current || !user) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'cursor',
      payload: {
        userId: user.id,
        email: user.email || 'Anonymous',
        color: myColor,
        x: position.x,
        y: position.y,
        line: position.line,
        column: position.column,
        fileId,
        timestamp: Date.now(),
      },
    });
  }, [user, myColor, fileId]);

  // Broadcast file change (for live updates)
  const broadcastFileChange = useCallback((content: string) => {
    if (!channelRef.current || !user || !fileId) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'file_change',
      payload: {
        userId: user.id,
        fileId,
        content,
        timestamp: Date.now(),
      },
    });
  }, [user, fileId]);

  useEffect(() => {
    if (!siteId || !user) return;

    const channelName = `site:${siteId}`;
    
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    // Handle cursor broadcasts
    channel.on('broadcast', { event: 'cursor' }, ({ payload }) => {
      if (payload.userId === user.id) return;

      setCursors((prev) => {
        const updated = new Map(prev);
        updated.set(payload.userId, payload as Cursor);
        return updated;
      });

      // Clear old timeout
      const existingTimeout = cursorTimeoutRef.current.get(payload.userId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set timeout to remove stale cursors
      const timeout = setTimeout(() => {
        setCursors((prev) => {
          const updated = new Map(prev);
          updated.delete(payload.userId);
          return updated;
        });
      }, 5000);

      cursorTimeoutRef.current.set(payload.userId, timeout);
    });

    // Handle presence
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users: Presence[] = [];
      
      Object.entries(state).forEach(([key, presences]) => {
        if (Array.isArray(presences) && presences.length > 0) {
          const presence = presences[0] as any;
          users.push({
            userId: key,
            email: presence.email || 'Anonymous',
            color: presence.color || getColorForUser(key),
            fileId: presence.fileId,
            lastSeen: Date.now(),
          });
        }
      });

      setActiveUsers(users.filter(u => u.userId !== user.id));
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('User joined:', key);
    });

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('User left:', key);
      setCursors((prev) => {
        const updated = new Map(prev);
        updated.delete(key);
        return updated;
      });
    });

    // Subscribe and track presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          email: user.email,
          color: myColor,
          fileId,
          online_at: new Date().toISOString(),
        });
      }
    });

    channelRef.current = channel;

    return () => {
      // Clear all timeouts
      cursorTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
      cursorTimeoutRef.current.clear();
      
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [siteId, user, myColor, fileId]);

  // Update presence when file changes
  useEffect(() => {
    if (!channelRef.current || !user) return;

    channelRef.current.track({
      email: user.email,
      color: myColor,
      fileId,
      online_at: new Date().toISOString(),
    });
  }, [fileId, user, myColor]);

  return {
    cursors: Array.from(cursors.values()),
    activeUsers,
    broadcastCursor,
    broadcastFileChange,
    myColor,
  };
}
