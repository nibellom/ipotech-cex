import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0f1222', paper: '#14182a' },
    primary: { main: '#f3b229' },
    secondary: { main: '#5ec0ff' },
    text: { primary: '#e8eaf6', secondary: '#b0b8c4' }
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCard: { styleOverrides: { root: { border: '1px solid #232846' } } },
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 12 } } },
  }
});
