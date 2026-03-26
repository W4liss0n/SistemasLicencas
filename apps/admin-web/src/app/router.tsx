import { Box, CircularProgress } from '@mui/material';
import type { ReactElement, ReactNode } from 'react';
import { Suspense, lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { hasOperatorContext } from './session';
import { AccessDeniedPage } from '../pages/AccessDeniedPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';

const DashboardPage = lazy(async () => {
  const module = await import('../pages/DashboardPage');
  return { default: module.DashboardPage };
});

const LicenseSearchPage = lazy(async () => {
  const module = await import('../pages/LicenseSearchPage');
  return { default: module.LicenseSearchPage };
});

const LicenseProvisionPage = lazy(async () => {
  const module = await import('../pages/LicenseProvisionPage');
  return { default: module.LicenseProvisionPage };
});

const ProgramsPage = lazy(async () => {
  const module = await import('../pages/ProgramsPage');
  return { default: module.ProgramsPage };
});

const PlansPage = lazy(async () => {
  const module = await import('../pages/PlansPage');
  return { default: module.PlansPage };
});

const CustomersPage = lazy(async () => {
  const module = await import('../pages/CustomersPage');
  return { default: module.CustomersPage };
});

const LicenseDetailPage = lazy(async () => {
  const module = await import('../pages/LicenseDetailPage');
  return { default: module.LicenseDetailPage };
});

function RouteLoadingFallback() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        backgroundColor: 'var(--controlroom-canvas)'
      }}
    >
      <CircularProgress size={28} />
    </Box>
  );
}

function OperatorContextRoute({ element }: { element: ReactElement }) {
  if (!hasOperatorContext()) {
    return <Navigate to="/login" replace />;
  }

  return <Suspense fallback={<RouteLoadingFallback />}>{element}</Suspense>;
}

function protect(element: ReactElement): ReactNode {
  return <OperatorContextRoute element={element} />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />
  },
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/access-denied',
    element: <AccessDeniedPage />
  },
  {
    path: '/dashboard',
    element: protect(<DashboardPage />)
  },
  {
    path: '/licenses/search',
    element: protect(<LicenseSearchPage />)
  },
  {
    path: '/licenses/provision',
    element: protect(<LicenseProvisionPage />)
  },
  {
    path: '/programs',
    element: protect(<ProgramsPage />)
  },
  {
    path: '/plans',
    element: protect(<PlansPage />)
  },
  {
    path: '/customers',
    element: protect(<CustomersPage />)
  },
  {
    path: '/licenses/:licenseKey',
    element: protect(<LicenseDetailPage />)
  },
  {
    path: '*',
    element: <NotFoundPage />
  }
]);
