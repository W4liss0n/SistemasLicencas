import type { ReactElement } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { getOperatorName } from './session';
import { AccessDeniedPage } from '../pages/AccessDeniedPage';
import { CustomersPage } from '../pages/CustomersPage';
import { DashboardPage } from '../pages/DashboardPage';
import { LicenseDetailPage } from '../pages/LicenseDetailPage';
import { LicenseProvisionPage } from '../pages/LicenseProvisionPage';
import { LicenseSearchPage } from '../pages/LicenseSearchPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PlansPage } from '../pages/PlansPage';
import { ProgramsPage } from '../pages/ProgramsPage';

function ProtectedRoute({ element }: { element: ReactElement }) {
  if (!getOperatorName()) {
    return <Navigate to="/login" replace />;
  }

  return element;
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
    element: <ProtectedRoute element={<DashboardPage />} />
  },
  {
    path: '/licenses/search',
    element: <ProtectedRoute element={<LicenseSearchPage />} />
  },
  {
    path: '/licenses/provision',
    element: <ProtectedRoute element={<LicenseProvisionPage />} />
  },
  {
    path: '/programs',
    element: <ProtectedRoute element={<ProgramsPage />} />
  },
  {
    path: '/plans',
    element: <ProtectedRoute element={<PlansPage />} />
  },
  {
    path: '/customers',
    element: <ProtectedRoute element={<CustomersPage />} />
  },
  {
    path: '/licenses/:licenseKey',
    element: <ProtectedRoute element={<LicenseDetailPage />} />
  },
  {
    path: '*',
    element: <NotFoundPage />
  }
]);
