import { useState } from 'react';
import { Card, CardContent, TextField, Button, Stack, Typography, Link } from '@mui/material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { saveAuth } from '../../lib/auth';

export default function Login(){
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async ()=>{
    setError('');
    try{
      const r = await axios.post('/api/auth/login', { email, password });
      saveAuth(r.data.token, r.data.role, r.data.email);
      window.location.href = '/';
    }catch(e:any){
      setError(e?.response?.data?.message || t('error'));
    }
  };

  return (
    <Card sx={{ maxWidth: 420, mx: 'auto', mt: 8 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>{t('login')}</Typography>
        <Stack spacing={2}>
          <TextField label={t('email')} value={email} onChange={e=>setEmail(e.target.value)} />
          <TextField label={t('password')} type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          {error && <Typography color="error">{error}</Typography>}
          <Button variant="contained" onClick={submit}>{t('login')}</Button>
          <Typography variant="body2">{t('no_account')} <Link href="/register">{t('register')}</Link></Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
