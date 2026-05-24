import { ROUTES } from '@communique/core';
import { Repeat } from 'meemaw';
import { NavLink, Outlet } from 'react-router-dom';

import {
  Activity,
  Inbox,
  Layers,
  Mail,
  Route as RouteIcon,
  Send,
  Settings,
  Users,
  Zap,
} from '@icons';
import { useWorkspace } from '@shared/providers/workspace-provider';
import { cn } from '@shared/utils/cn';
import { Button } from '@ui/components/primitives';
import { Logo } from '@ui/components/logo';

interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: typeof Users;
}

const NAV: readonly NavItem[] = [
  { to: ROUTES.METRICS, label: 'Overview', icon: Activity },
  { to: ROUTES.SUBSCRIBERS, label: 'Subscribers', icon: Users },
  { to: ROUTES.AUDIENCES, label: 'Audiences', icon: Layers },
  { to: ROUTES.TEMPLATES, label: 'Templates', icon: Mail },
  { to: ROUTES.PROVIDERS, label: 'Providers', icon: Settings },
  { to: ROUTES.ROUTING_RULES, label: 'Routing rules', icon: RouteIcon },
  { to: ROUTES.NOTIFICATION_LOG, label: 'Notification log', icon: Zap },
  { to: ROUTES.DEAD_LETTERS, label: 'Dead letters', icon: Inbox },
  { to: ROUTES.TEST_DISPATCH, label: 'Test dispatch', icon: Send },
];

export function AppShell() {
  const { disconnect } = useWorkspace();
  return (
    <div className="flex h-full">
      <aside className="flex w-60 flex-col border-r border-border bg-surface p-4">
        <Logo className="mb-6 px-2" />
        <nav className="flex flex-1 flex-col gap-1">
          <Repeat each={NAV}>
            {(item) => (
              <NavLink
                to={item.to}
                end={item.to === ROUTES.METRICS}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-muted hover:bg-surface-2 hover:text-text',
                  )
                }
              >
                <item.icon size={17} aria-hidden="true" />
                {item.label}
              </NavLink>
            )}
          </Repeat>
        </nav>
        <Button variant="ghost" onClick={disconnect} className="justify-start">
          Disconnect
        </Button>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
