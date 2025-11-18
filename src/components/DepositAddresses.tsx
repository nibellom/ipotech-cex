import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Button, Stack, List, ListItem, ListItemText, IconButton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import axios from 'axios';

type DepAddr = { _id: string; chain: string; address: string; createdAt: string };

export default function DepositAddresses() {
  const { t } = useTranslation();
  const [list, setList] = useState<DepAddr[]>([]);
  const [loading, setLoading] = useState(false);
  const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };

  const load = async () => {
    const r = await axios.get('/api/deposits/me', auth);
    setList(r.data.addresses || []);
  };

  useEffect(() => { load().catch(()=>{}); }, []);

  const issue = async (chain: 'bsc' | 'eth') => {
    setLoading(true);
    try {
      await axios.get(`/api/deposits/address?chain=${chain}`, auth);
      await load();
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(t('copied'));
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      alert(t('copied'));
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>{t('deposit_addresses')}</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button variant="outlined" size="small" onClick={() => issue('bsc')} disabled={loading}>{t('get_bsc')}</Button>
          <Button variant="outlined" size="small" onClick={() => issue('eth')} disabled={loading}>{t('get_eth')}</Button>
        </Stack>
        {list.length === 0 ? (
          <Typography color="text.secondary">{t('no_addresses_yet')}</Typography>
        ) : (
          <List dense>
            {list.map((a) => (
              <ListItem key={a._id} secondaryAction={
                <Tooltip title={t('copy')}>
                  <IconButton edge="end" onClick={() => copy(a.address)}><ContentCopyIcon fontSize="small"/></IconButton>
                </Tooltip>
              }>
                <ListItemText
                  primary={`${a.chain.toUpperCase()} — ${a.address}`}
                  secondary={new Date(a.createdAt).toLocaleString()}
                />
              </ListItem>
            ))}
          </List>
        )}
        <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
          {t('deposit_info')}
        </Typography>
      </CardContent>
    </Card>
  );
}
