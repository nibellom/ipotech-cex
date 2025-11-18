import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allow }: { children: JSX.Element, allow: string[] }){
  const role = localStorage.getItem('role') || 'guest';
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  if (!allow.includes(role)) return <Navigate to="/" replace />;
  return children;
}
