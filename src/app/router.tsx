import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'

import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { MovesPage } from '@/features/moves/MovesPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { SignupPage } from '@/features/auth/SignupPage'
import { OPERATION_CONFIG } from '@/features/operations/config'
import { OperationDetailPage } from '@/features/operations/OperationDetailPage'
import { OperationFormPage } from '@/features/operations/OperationFormPage'
import { OperationListPage } from '@/features/operations/OperationListPage'
import { ProductDetailPage } from '@/features/products/ProductDetailPage'
import { ProductsPage } from '@/features/products/ProductsPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { GeneralSettingsPage } from '@/features/settings/GeneralSettingsPage'
import { WarehouseDetailPage } from '@/features/settings/WarehouseDetailPage'
import { WarehousesPage } from '@/features/settings/WarehousesPage'
import { AppLayout } from './layouts/AppLayout'
import { AuthLayout } from './layouts/AuthLayout'
import { NotFoundPage } from './NotFoundPage'
import { GuestOnly, RequireAuth } from './RequireAuth'

const operationTypes = Object.values(OPERATION_CONFIG)

/** Everything inside the signed-in shell. */
const appRoutes: RouteObject[] = [
  { index: true, element: <DashboardPage />, handle: { crumb: 'Dashboard' } },
  {
    path: 'products',
    handle: { crumb: 'Products' },
    children: [
      { index: true, element: <ProductsPage /> },
      { path: ':productId', element: <ProductDetailPage />, handle: { crumb: 'Product' } },
    ],
  },
  {
    path: 'operations',
    children: [
      { index: true, element: <Navigate to="receipts" replace /> },
      ...operationTypes.map((t) => ({
        path: t.path,
        handle: { crumb: t.plural },
        children: [
          { index: true, element: <OperationListPage key={t.type} type={t.type} /> },
          { path: 'new', element: <OperationFormPage key={t.type} type={t.type} />, handle: { crumb: 'New' } },
          { path: ':operationId', element: <OperationDetailPage type={t.type} />, handle: { crumb: 'Document' } },
        ],
      })),
    ],
  },
  { path: 'moves', element: <MovesPage />, handle: { crumb: 'Move History' } },
  {
    path: 'settings',
    handle: { crumb: 'Settings' },
    children: [
      { index: true, element: <Navigate to="warehouses" replace /> },
      {
        path: 'warehouses',
        handle: { crumb: 'Warehouses' },
        children: [
          { index: true, element: <WarehousesPage /> },
          { path: ':warehouseId', element: <WarehouseDetailPage />, handle: { crumb: 'Warehouse' } },
        ],
      },
      { path: 'general', element: <GeneralSettingsPage />, handle: { crumb: 'General' } },
    ],
  },
  { path: 'profile', element: <ProfilePage />, handle: { crumb: 'My Profile' } },
  { path: '*', element: <NotFoundPage />, handle: { crumb: 'Not found' } },
]

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/signup', element: <SignupPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [{ path: '/', element: <AppLayout />, children: appRoutes }],
  },
])
