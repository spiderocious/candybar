import { ROUTE_PATTERNS } from '@communique/core';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useWorkspace } from '@shared/providers/workspace-provider';

import { AppShell } from './app.shell.js';
import { ConnectScreen } from './features/connect/screen/connect-screen.js';
import { AudienceDetailScreen } from './features/audiences/screen/audience-detail-screen.js';
import { AudiencesScreen } from './features/audiences/screen/audiences-screen.js';
import { DeadLettersScreen } from './features/dead-letters/screen/dead-letters-screen.js';
import { MetricsScreen } from './features/metrics/screen/metrics-screen.js';
import { NotificationLogScreen } from './features/notification-log/screen/notification-log-screen.js';
import { ProvidersScreen } from './features/providers/screen/providers-screen.js';
import { RoutingRulesScreen } from './features/routing-rules/screen/routing-rules-screen.js';
import { SubscriberDetailScreen } from './features/subscribers/screen/subscriber-detail-screen.js';
import { SubscribersScreen } from './features/subscribers/screen/subscribers-screen.js';
import { TemplateDetailScreen } from './features/templates/screen/template-detail-screen.js';
import { TemplatesScreen } from './features/templates/screen/templates-screen.js';
import { TestDispatchScreen } from './features/test-dispatch/screen/test-dispatch-screen.js';

function RequireWorkspace({ children }: { children: React.ReactNode }) {
  const { connected } = useWorkspace();
  if (!connected) return <Navigate to={ROUTE_PATTERNS.CONNECT} replace />;
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTE_PATTERNS.CONNECT} element={<ConnectScreen />} />
      <Route
        element={
          <RequireWorkspace>
            <AppShell />
          </RequireWorkspace>
        }
      >
        <Route path={ROUTE_PATTERNS.OVERVIEW} element={<MetricsScreen />} />
        <Route path={ROUTE_PATTERNS.SUBSCRIBERS} element={<SubscribersScreen />} />
        <Route path={ROUTE_PATTERNS.SUBSCRIBER_DETAIL} element={<SubscriberDetailScreen />} />
        <Route path={ROUTE_PATTERNS.AUDIENCES} element={<AudiencesScreen />} />
        <Route path={ROUTE_PATTERNS.AUDIENCE_DETAIL} element={<AudienceDetailScreen />} />
        <Route path={ROUTE_PATTERNS.TEMPLATES} element={<TemplatesScreen />} />
        <Route path={ROUTE_PATTERNS.TEMPLATE_DETAIL} element={<TemplateDetailScreen />} />
        <Route path={ROUTE_PATTERNS.PROVIDERS} element={<ProvidersScreen />} />
        <Route path={ROUTE_PATTERNS.ROUTING_RULES} element={<RoutingRulesScreen />} />
        <Route path={ROUTE_PATTERNS.NOTIFICATION_LOG} element={<NotificationLogScreen />} />
        <Route path={ROUTE_PATTERNS.DEAD_LETTERS} element={<DeadLettersScreen />} />
        <Route path={ROUTE_PATTERNS.METRICS} element={<MetricsScreen />} />
        <Route path={ROUTE_PATTERNS.TEST_DISPATCH} element={<TestDispatchScreen />} />
      </Route>
      <Route path="*" element={<Navigate to={ROUTE_PATTERNS.OVERVIEW} replace />} />
    </Routes>
  );
}
