// client/src/pages/DividendCenter.tsx
import { useEffect, useState } from 'react';
import {
  Container, Grid, Card, CardContent, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, LinearProgress, Stack, Chip, Tooltip
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/http';
import { getSocket } from '../realtime/socket';

type FundingDest = { chain: string; address: string };
type Plan = {
  _id: string;
  token?: { symbol: string };
  amountUSDT: number;
  fundedUSDT?: number;
  recordTime: string | number | Date;
  payoutTime: string | number | Date;
  status: string;
  funding?: FundingDest[];
  fundingAddress?: string; // бэкап
};

type Payout = {
  _id: string;
  plan?: { token?: { symbol: string } };
  shareUSDT: number;
  status: string;
  createdAt: string | number | Date;
};

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

function safeDate(x: any) {
  const d = new Date(x);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function percent(a?: number, b?: number) {
  const x = Number(a || 0), y = Number(b || 0);
  if (y <= 0) return 0;
  const p = Math.max(0, Math.min(100, (x / y) * 100));
  return Math.round(p);
}

export default function DividendCenter() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  // начальная загрузка + лёгкий поллинг (на случай отсутствия сокетов)
  useEffect(() => {
    const load = async () => {
      try {
        const [pub, me] = await Promise.all([
          api.get('/api/dividends/plans', { params: { _t: Date.now() } }),
          api.get('/api/dividends/me/payouts', { ...auth(), params: { _t: Date.now() } }).catch(() => ({ data: { payouts: [] } }))
        ]);
        setPlans(pub.data.plans || []);
        setPayouts(me.data.payouts || []);
      } catch {
        setPlans([]); setPayouts([]);
      }
    };
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  // realtime (если сервер шлёт события — обновится мгновенно)
  useEffect(() => {
    const s = getSocket();
    const onPlans = (list: Plan[]) => setPlans(list || []);
    const onPayouts = (list: Payout[]) => setPayouts(list || []);
    s.on('dividends:plans', onPlans);
    s.on('dividends:payouts', onPayouts);
    return () => {
      s.off('dividends:plans', onPlans);
      s.off('dividends:payouts', onPayouts);
    };
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>{t('dividends')}</Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          {/* Планы дивидендов */}
          <Card>
            <CardContent>
              <Typography variant="h6">{t('upcoming_dividends')}</Typography>
              <Table size="small" sx={{ mt: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('token')}</TableCell>
                    <TableCell>Record</TableCell>
                    <TableCell>Payout</TableCell>
                    <TableCell>{t('dividend_amount_usdt')}</TableCell>
                    <TableCell>{t('status')}</TableCell>
                    <TableCell>{t('funding')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plans.filter(p => p.status !== 'completed').map(p => {
                    const funded = Number(p.fundedUSDT || 0);
                    const total  = Number(p.amountUSDT || 0);
                    const prc = percent(funded, total);

                    // адреса фондирования (массив или одиночный)
                    const destinations: FundingDest[] =
                      (Array.isArray(p.funding) && p.funding.length ? p.funding :
                       p.fundingAddress ? [{ chain: 'bsc', address: p.fundingAddress }] : [])
                      .map(f => ({ chain: (f.chain || 'bsc').toUpperCase(), address: f.address }));

                    return (
                      <TableRow key={p._id}>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip label={p.token?.symbol || '—'} size="small" />
                          </Stack>
                        </TableCell>
                        <TableCell>{safeDate(p.recordTime)}</TableCell>
                        <TableCell>{safeDate(p.payoutTime)}</TableCell>
                        <TableCell>{total}</TableCell>
                        <TableCell>{p.status}</TableCell>
                        <TableCell>
                          <Stack spacing={1}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="caption">{funded} / {total} USDT</Typography>
                              <Typography variant="caption">({prc}%)</Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={prc} />
                            {destinations.length > 0 && (
                              <Stack spacing={0.5}>
                                {destinations.map((f, i) => (
                                  <Tooltip key={`${p._id}-f-${i}`} title={f.address}>
                                    <Typography variant="caption">
                                      {f.chain}: {f.address.slice(0, 6)}…{f.address.slice(-4)}
                                    </Typography>
                                  </Tooltip>
                                ))}
                              </Stack>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {plans.length === 0 && (
                    <TableRow><TableCell colSpan={6}>{t('no_data') || '—'}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* История выплат */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6">{t('payout_history')}</Typography>
              <Table size="small" sx={{ mt: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('token')}</TableCell>
                    <TableCell>USDT</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payouts.map(p => (
                    <TableRow key={p._id}>
                      <TableCell>{p?.plan?.token?.symbol || '—'}</TableCell>
                      <TableCell>{p.shareUSDT}</TableCell>
                      <TableCell>{p.status}</TableCell>
                      <TableCell>{safeDate(p.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                  {payouts.length === 0 && (
                    <TableRow><TableCell colSpan={4}>{t('no_data') || '—'}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

      </Grid>
    </Container>
  );
}
