import { Routes, Route } from 'react-router-dom';
import ServiceListPage from './pages/ServiceListPage';
import ServiceBookingPage from './pages/ServiceBookingPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ServiceListPage />} />
      <Route path="/:gender/:serviceSlug" element={<ServiceBookingPage />} />
    </Routes>
  );
}
