import { workspaceToken } from '@shared/services/workspace-token';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';


interface WorkspaceContextValue {
  connected: boolean;
  connect: (key: string) => void;
  disconnect: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState<boolean>(workspaceToken.has());

  const connect = useCallback((key: string) => {
    workspaceToken.set(key);
    setConnected(true);
  }, []);

  const disconnect = useCallback(() => {
    workspaceToken.clear();
    setConnected(false);
  }, []);

  return (
    <WorkspaceContext.Provider value={{ connected, connect, disconnect }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
