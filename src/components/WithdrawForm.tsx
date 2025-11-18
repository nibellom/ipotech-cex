import React, { useEffect, useState } from 'react';
import {
  Card, CardContent, Typography, Stack, TextField, MenuItem, Button,
  Table, TableHead, TableRow, TableCell, TableBody
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

type AssetRow = { asset: string; spot: number; trade: number; dividend: number; total: number };
type Withdrawal = { _id: string; asset: string; chain: string; amount: number; toAddress: string; status: string; txHash?: string; createdAt: string };

export default function WithdrawForm() {
  const { t } = useTranslation();
  const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
  const [assets, setAssets] = useState<string[]>(['USDT']);
  const [asset, setAsset] = useState('USDT');
  const [chain, setChain] = useState<'bsc' | 'eth'>('bsc');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<Withdrawal[]>([]);

  const load = async () => {
    // активы из балансов
    const bal = await axios.get<{ assets: AssetRow[] }>('/api/wallets/balances', auth);
    const list = (bal.data.assets || []).map(a => a.asset).filter(Boolean);
    const uniq = list.filter((v, i, arr) => arr.indexOf(v) === i);
    if (uniq.length) {
      setAssets(uniq);
      setAsset(prev => (uniq.includes(prev) ? prev : uniq[0]));
    }

    // история выводов
    const w = await axios.get<{ withdrawals: Withdrawal[] }>('/api/withdrawals/me', auth);
    setHistory(w.data.withdrawals || []);
  };

  useEffect(() => { load().catch(()=>{}); }, []);

  const canSubmit = asset && chain && toAddress && Number(amount) > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      await axios.post('/api/withdrawals/request', {
        asset, chain, amount: Number(amount), toAddress
      }, auth);
      setAmount('');
      setToAddress('');
      await load();
      alert(t('request_sent'));
    } catch (e: any) {
      alert(e?.response?.data?.message || t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6">{t('withdraw')}</Typography>

        <Stack spacing={2} mt={2}>
          <TextField
            select fullWidth label={t('asset')} value={asset} onChange={(e) => setAsset(e.target.value)}
          >
            {assets.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
          </TextField>

          <TextField
            select fullWidth label={t('chain')} value={chain} onChange={(e) => setChain(e.target.value as 'bsc'|'eth')}
            helperText={t('evm_networks')}
          >
            <MenuItem value="bsc">BSC</MenuItem>
            <MenuItem value="eth">ETH</MenuItem>
          </TextField>

          <TextField
            fullWidth label={t('recipient_address')} value={toAddress} onChange={(e)=>setToAddress(e.target.value)}
            placeholder="0x..."
          />

          <TextField
            fullWidth label={t('amount')} type="number" inputProps={{ min: 0, step: 'any' }}
            value={amount} onChange={(e)=>setAmount(e.target.value)}
          />

          <Button variant="contained" fullWidth size="large" disabled={!canSubmit} onClick={submit}>
            {t('create_request')}
          </Button>
        </Stack>

        <Typography variant="subtitle1" sx={{ mt: 3 }}>{t('my_withdrawals')}</Typography>
        <Table size="small" sx={{ mt: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell>{t('date')}</TableCell>
              <TableCell>{t('asset')}</TableCell>
              <TableCell>{t('chain')}</TableCell>
              <TableCell>{t('amount')}</TableCell>
              <TableCell>{t('address')}</TableCell>
              <TableCell>{t('status')}</TableCell>
              <TableCell>{t('tx')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.length === 0 && (
              <TableRow><TableCell colSpan={7}>{t('no_withdrawals')}</TableCell></TableRow>
            )}
            {history.map(w => (
              <TableRow key={w._id}>
                <TableCell>{new Date(w.createdAt).toLocaleString()}</TableCell>
                <TableCell>{w.asset}</TableCell>
                <TableCell>{w.chain.toUpperCase()}</TableCell>
                <TableCell>{w.amount}</TableCell>
                <TableCell style={{maxWidth:180, overflow:'hidden', textOverflow:'ellipsis'}}>{w.toAddress}</TableCell>
                <TableCell>{w.status}</TableCell>
                <TableCell>
                  {w.txHash ? <a href="#" onClick={(e)=>e.preventDefault()}>{w.txHash.slice(0,10)}…</a> : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
