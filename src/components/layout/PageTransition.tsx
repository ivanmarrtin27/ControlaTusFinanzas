import { Outlet, useLocation } from 'react-router-dom'

/** Subtle fade/slide on route change (pathname only — query updates stay quiet). */
export function PageTransition() {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="page-transition">
      <Outlet />
    </div>
  )
}
