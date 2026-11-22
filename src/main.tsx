import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import { ProfessionalSite } from './components/public/ProfessionalSite';
import { injectSpeedInsights } from '@vercel/speed-insights';
import './index.css';

injectSpeedInsights();

const InternalEntry = lazy(() => import('./InternalEntry'));
const internal = ['/admin', '/beauty-professional'].includes(window.location.pathname.replace(/\/$/, ''));
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {internal ? <Suspense fallback={<p role="status">Cargando acceso privado…</p>}><InternalEntry /></Suspense> : <ProfessionalSite />}
  </StrictMode>,
);
