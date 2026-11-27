import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, NavLink, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom';
import { IconCalendar, IconChartBar, IconHome, IconListDetails } from '@tabler/icons-react';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/instrument-serif/latin-400.css';
import './styles/global.css';
import Home from './screens/Home';
import Summary from './screens/Summary';
import Calendar from './screens/Calendar';
import Plan from './screens/Plan';
import SessionForm from './screens/SessionForm';
import Settings from './screens/Settings';
import Connections, { PENDING_KEY } from './screens/Connections';
import { useState } from 'react';
import DotsBackground from './components/DotsBackground';
import RibbonBackground from './components/RibbonBackground';
import Splash from './components/Splash';
import { useSetting } from './db/hooks';
import { installGlobalHaptics } from './lib/haptics';

// Debe ir antes de crear el enrutador, que lee la dirección al crearse.
// Vuelta de la autorización de Strava (?code=…&state=pulso-strava): se guarda el código y se limpia la URL.
{
  const q = new URLSearchParams(location.search);
  if (q.get('state') === 'pulso-strava') {
    if (q.get('code')) sessionStorage.setItem(PENDING_KEY, q.get('code')!);
    history.replaceState(null, '', `${location.pathname}#/conexiones`);
  }
}

function TabsLayout() {
  const tabs = [
    { to: '/', label: 'Inicio', icon: IconHome },
    { to: '/resumen', label: 'Resumen', icon: IconChartBar },
    { to: '/calendario', label: 'Calendario', icon: IconCalendar },
    { to: '/plan', label: 'Plan', icon: IconListDetails }
  ];
  return (
    <>
      <Outlet />
      <nav className="tabbar" aria-label="Secciones">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} aria-label={label} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={20} stroke={1.9} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <ScrollRestoration />
    </>
  );
}

const router = createHashRouter([
  {
    element: <TabsLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/resumen', element: <Summary /> },
      { path: '/calendario', element: <Calendar /> },
      { path: '/plan', element: <Plan /> }
    ]
  },
  { path: '/sesion/nueva', element: <SessionForm /> },
  { path: '/sesion/:id', element: <SessionForm /> },
  { path: '/ajustes', element: <Settings /> },
  { path: '/conexiones', element: <Connections /> }
]);

installGlobalHaptics();

// Pide al navegador que no borre los datos locales si le falta espacio.
navigator.storage?.persist?.().catch(() => undefined);

function Root() {
  const legacy = useSetting<boolean>('animatedBackground', true);
  const background = useSetting<'ribbon' | 'dots' | 'off'>('background', legacy ? 'ribbon' : 'off');
  const [noWebGL, setNoWebGL] = useState(false);
  const kind = background === 'ribbon' && noWebGL ? 'dots' : background;
  return (
    <>
      {kind === 'ribbon' && <RibbonBackground onUnsupported={() => setNoWebGL(true)} />}
      <DotsBackground enabled={kind === 'dots'} />
      <RouterProvider router={router} />
      <Splash />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
