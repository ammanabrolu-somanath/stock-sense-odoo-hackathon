import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'

import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { SignupPage } from '@/features/auth/SignupPage'
import { OPERATION_CONFIG } from '@/features/operations/config'
import { AppLayout } from './layouts/AppLayout'
import { AuthLayout } from './layouts/AuthLayout'
import { NotFoundPage } from './NotFoundPage'
import { GuestOnly, RequireAuth } from './RequireAuth'

const operationTypes = Object.values(OPERATION_CONFIG)

/*
 * Every signed-in page is code-split: the sign-in screen downloads only the shell and auth
 * forms, and each module (the dashboard carries the charting library) loads on first visit.
 */
const appRoutes: RouteObject[] = [
  {
    index: true,
    lazy: async () => ({ Component: (await import('@/features/dashboard/DashboardPage')).DashboardPage }),
    handle: { crumb: 'Dashboard' },
  },
  {
    path: 'products',
    handle: { crumb: 'Products' },
    children: [
      { index: true, lazy: async () => ({ Component: (await import('@/features/products/ProductsPage')).ProductsPage }) },
      {
        path: ':productId',
        lazy: async () => ({ Component: (await import('@/features/products/ProductDetailPage')).ProductDetailPage }),
        handle: { crumb: 'Product' },
      },
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
          {
            index: true,
            lazy: async () => {
              const { OperationListPage } = await import('@/features/operations/OperationListPage')
              return { element: <OperationListPage key={t.type} type={t.type} /> }
            },
          },
          {
            path: 'new',
            handle: { crumb: 'New' },
            lazy: async () => {
              const { OperationFormPage } = await import('@/features/operations/OperationFormPage')
              return { element: <OperationFormPage key={t.type} type={t.type} /> }
            },
          },
          {
            path: ':operationId',
            handle: { crumb: 'Document' },
            lazy: async () => {
              const { OperationDetailPage } = await import('@/features/operations/OperationDetailPage')
              return { element: <OperationDetailPage type={t.type} /> }
            },
          },
        ],
      })),
    ],
  },
  {
    path: 'moves',
    lazy: async () => ({ Component: (await import('@/features/moves/MovesPage')).MovesPage }),
    handle: { crumb: 'Move History' },
  },
  {
    path: 'settings',
    handle: { crumb: 'Settings' },
    children: [
      { index: true, element: <Navigate to="warehouses" replace /> },
      {
        path: 'warehouses',
        handle: { crumb: 'Warehouses' },
        children: [
          { index: true, lazy: async () => ({ Component: (await import('@/features/settings/WarehousesPage')).WarehousesPage }) },
          {
            path: ':warehouseId',
            lazy: async () => ({ Component: (await import('@/features/settings/WarehouseDetailPage')).WarehouseDetailPage }),
            handle: { crumb: 'Warehouse' },
          },
        ],
      },
      {
        path: 'general',
        lazy: async () => ({ Component: (await import('@/features/settings/GeneralSettingsPage')).GeneralSettingsPage }),
        handle: { crumb: 'General' },
      },
    ],
  },
  {
    path: 'profile',
    lazy: async () => ({ Component: (await import('@/features/profile/ProfilePage')).ProfilePage }),
    handle: { crumb: 'My Profile' },
  },
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
