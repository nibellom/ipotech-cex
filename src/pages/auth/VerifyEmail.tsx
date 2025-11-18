import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, Typography, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/http';

export default function VerifyEmail(){
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(t('verifying'));
  const token = params.get('token');

  useEffect(()=>{
    async function run(){
      try{
            const r = await api.get('/api/auth/verify', { params: { token } });
        setStatus(r.data.message || t('verified'));
      }catch(e:any){
        setStatus(e?.response?.data?.message || t('invalid_or_expired_link'));
      }
    }
    if (token) run();
  }, [token, t]);

  return (
    <Card sx={{ maxWidth: 520, mx: 'auto', mt: 8 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>{t('email_verification')}</Typography>
        <Typography sx={{ mb: 2 }}>{status}</Typography>
        <Button href="/login" variant="contained">{t('go_to_login')}</Button>
      </CardContent>
    </Card>
  );
}
