import { useState } from 'react';
import { Card, CardContent, TextField, Button, Stack, Typography, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

export default function Register(){
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [message, setMessage] = useState('');
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const submit = async ()=> {
    setMessage('');
    const cleanEmail = email.trim().toLowerCase();
    if (!re.test(cleanEmail)) {
      setMessage(t('invalid_email'));
      return;
    }
    try{
      const r = await axios.post('/api/auth/register', { email: cleanEmail, password, role });
      setMessage(r.data.message || t('registered_check_email'));
    }catch(e:any){
      setMessage(e?.response?.data?.message || t('error'));
    }
  };

  return (
    <Card sx={{ maxWidth: 500, mx: 'auto', mt: 8 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>{t('register')}</Typography>
        <Stack spacing={2}>
          <TextField label={t('email')} value={email} onChange={e=>setEmail(e.target.value)} />
          <TextField label={t('password')} type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          <TextField select label={t('role')} value={role} onChange={e=>setRole(e.target.value)}>
            <MenuItem value="user">{t('user')}</MenuItem>
            <MenuItem value="issuer">{t('issuer')}</MenuItem>
          </TextField>
          {message && <Typography>{message}</Typography>}
          <Button variant="contained" onClick={submit}>{t('register')}</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
