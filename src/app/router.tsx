import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'

import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { SignupPage } from '@/features/auth/SignupPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { AppLayout } from './layouts/AppLayout'
import { AuthLayout } from './layouts/AuthLayout'
import { NotFoundPage } from './NotFoundPage'
import { PlaceholderPage } from './PlaceholderPage'
import { GuestOnly, RequireAuth } from './RequireAuth'

const operationTypes = [
  { path: 'receipts', crumb: 'Receipts', description: 'Incoming goods from vendors.' },
  { path: 'deliveries', crumb: 'Deliveries', description: 'Outgoing goods to customers — pick, pack, validate.' },
  { path: 'transfers', crumb: 'Transfers', description: 'Stock moved between warehouses, racks and floors.' },
  { path: 'adjustments', crumb: 'Adjustments', description: 'Reconcile recorded stock with a physical count.' },
] as const

/** Everything inside the signed-in shell. */
const appRoutes: RouteObject[] = [
  { index: true, element: <PlaceholderPage description="A snapshot of inventory operations." />, handle: { crumb: 'Dashboard' } },
  {
    path: 'products',
    handle: { crumb: 'Products' },
    children: [
      { index: true, element: <PlaceholderPage description="Everything you stock, and where it is." /> },
      { path: ':productId', element: <PlaceholderPage />, handle: { crumb: 'Product' } },
    ],
  },
  {
    path: 'operations',
    children: [
      { index: true, element: <Navigate to="receipts" replace /> },
      ...operationTypes.map((t) => ({
        path: t.path,
        handle: { crumb: t.crumb },
        children: [
          { index: true, element: <PlaceholderPage description={t.description} /> },
          { path: 'new', element: <PlaceholderPage />, handle: { crumb: 'New' } },
          { path: ':operationId', element: <PlaceholderPage />, handle: { crumb: 'Detail' } },
        ],
      })),
    ],
  },
  { path: 'moves', element: <PlaceholderPage description="Every stock movement, append-only." />, handle: { crumb: 'Move History' } },
  {
    path: 'settings',
    handle: { crumb: 'Settings' },
    children: [
      { index: true, element: <Navigate to="warehouses" replace /> },
      {
        path: 'warehouses',
        handle: { crumb: 'Warehouses' },
        children: [
          { index: true, element: <PlaceholderPage description="Warehouses and their locations." /> },
          { path: ':warehouseId', element: <PlaceholderPage />, handle: { crumb: 'Warehouse' } },
        ],
      },
      { path: 'general', element: <PlaceholderPage description="Workspace preferences and demo data." />, handle: { crumb: 'General' } },
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
