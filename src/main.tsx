import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { ThemeProvider, CssBaseline, AppBar, Toolbar, Button, Container, Box, Typography, Menu, MenuItem, IconButton, Drawer, List, ListItem, ListItemButton, ListItemText } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { useTranslation } from 'react-i18next'
import { theme } from './theme'
import './i18n'
import DividendCenter from './pages/DividendCenter'
import DividendAdmin from './pages/company/DividendAdmin'
import AdminDashboard from './pages/admin/AdminDashboard'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import VerifyEmail from './pages/auth/VerifyEmail'
import ProtectedRoute from './components/ProtectedRoute'
import Wallets from './pages/Wallets' 
import Trade from './pages/Trade';

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    handleClose();
  };

  return (
    <>
      <Button onClick={handleClick} color="inherit">
        {t('language')}: {i18n.language === 'ru' ? t('russian') : t('english')}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        <MenuItem onClick={() => changeLanguage('ru')}>{t('russian')}</MenuItem>
        <MenuItem onClick={() => changeLanguage('en')}>{t('english')}</MenuItem>
      </Menu>
    </>
  );
}

function Shell(){
  const { t } = useTranslation();
  const role = localStorage.getItem('role') || 'guest';
  const token = localStorage.getItem('token');
  const email = localStorage.getItem('email') || '';
  const logout = ()=>{ localStorage.clear(); window.location.href = '/'; };
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const menuItems = [
    { label: t('dividends'), to: '/', visible: true },
    { label: t('trade'), to: '/trade', visible: true },
    { label: t('wallets'), to: '/wallets', visible: true },
    { label: t('issuer'), to: '/company', visible: role === 'issuer' || role === 'admin' },
    { label: t('admin'), to: '/admin', visible: role === 'admin' },
  ].filter(item => item.visible);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" color="transparent">
        <Toolbar sx={{ justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
            <Box
              component={Link}
              to="/"
              sx={{
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 20,
                display: 'flex',
                alignItems: 'center',
                letterSpacing: 1,
              }}
            >
              <Box component="span" sx={{ color: '#ff9800' }}>IPO</Box>
              <Box component="span" sx={{ color: '#ff9800', ml: 0 }}>T</Box>
              <Box component="span" sx={{ color: '#ffffff', ml: 0 }}>ECH</Box>
            </Box>
            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
              {menuItems.map(item => (
                <Button key={item.to} component={Link} to={item.to}>{item.label}</Button>
              ))}
            </Box>
            <IconButton
              color="inherit"
              edge="start"
              sx={{ display: { xs: 'inline-flex', md: 'none' } }}
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LanguageSwitcher />
            {token ? (
              <>
                <Typography variant="body2" sx={{ mr:2, display:'inline-block' }}>{email} ({role})</Typography>
                <Button onClick={logout}>{t('logout')}</Button>
              </>
            ) : (
              <>
                <Button href="/login">{t('login')}</Button>
                <Button href="/register">{t('register')}</Button>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 240 }} role="presentation" onClick={() => setDrawerOpen(false)}>
          <List>
            {menuItems.map(item => (
              <ListItem key={item.to} disablePadding>
                <ListItemButton component={Link} to={item.to}>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Container sx={{ py: 3 }}>
        <Routes>
          <Route path="/login" element={<Login/>} />
          <Route path="/register" element={<Register/>} />
          <Route path="/verify-email" element={<VerifyEmail/>} />
          <Route path="/" element={<DividendCenter/>} />
          <Route path="/trade" element={<ProtectedRoute allow={['user','issuer','admin']}><Trade/></ProtectedRoute>} />
          <Route path="/wallets" element={<ProtectedRoute allow={['user','issuer','admin']}><Wallets/></ProtectedRoute>} />
          <Route path="/company" element={<ProtectedRoute allow={['issuer','admin']}><DividendAdmin/></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allow={['admin']}><AdminDashboard/></ProtectedRoute>} />
        </Routes>
      </Container>
    </ThemeProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Shell/>
    </BrowserRouter>
  </React.StrictMode>
)
