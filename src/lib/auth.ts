export function saveAuth(token: string, role: string, email: string){
  localStorage.setItem('token', token);
  localStorage.setItem('role', role);
  localStorage.setItem('email', email);
}
export function clearAuth(){
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('email');
}
export function getRole(){ return localStorage.getItem('role') || 'guest'; }
export function isAuthed(){ return !!localStorage.getItem('token'); }
