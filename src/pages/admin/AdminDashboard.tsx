import { useEffect, useState } from 'react';
import { Container, Card, CardContent, Typography, Table, TableHead, TableRow, TableCell, TableBody, Button, Link, Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/http';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
  const [listings, setListings] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [hotWalletBalances, setHotWalletBalances] = useState<any[]>([]); // Предполагаем массив балансов по chain/asset
  const [feesStats, setFeesStats] = useState<any>(null);

  const reload = async () => {
    const l = await api.get('/api/admin/listings?status=pending', auth);
    setListings(l.data.listings || []);
    const p = await api.get('/api/admin/plans', auth);
    setPlans(p.data.plans || []);
    const a = await api.get('/api/admin/audits', auth);
    setAudits(a.data.audits || []);

    // Запрос баланса hot wallet (нужно реализовать на сервере)
    const hw = await api.get('/api/admin/hotwallet/balances', auth);
    setHotWalletBalances(hw.data.balances || []); // Ожидаем { balances: [{ chain, asset, balance }, ...] }

    // Запрос статистики комиссий
    const fees = await api.get('/api/admin/fees/stats', auth);
    setFeesStats(fees.data || null);
  };

  useEffect(() => { reload().catch(() => {}); }, []);

  const approve = async (id: string) => { await api.post('/api/admin/listings/' + id + '/approve', {}, auth); reload(); };
  const suspend = async (id: string) => { await api.post('/api/admin/listings/' + id + '/suspend', {}, auth); reload(); };

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>{t('admin_dashboard_title')}</Typography>

      {/* Статистика комиссий */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('trading_fees_revenue')}</Typography>
          {feesStats ? (
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">{t('total_revenue')}</Typography>
                      <Typography variant="h5">{fmt(feesStats.total?.fees || 0)} USDT</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('total_trades')}: {feesStats.total?.count || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('monthly_breakdown')}</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('month')}</TableCell>
                        <TableCell align="right">{t('fees_collected')}</TableCell>
                        <TableCell align="right">{t('trades_count')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {feesStats.monthly?.map((m: any) => (
                        <TableRow key={`${m.year}-${m.month}`}>
                          <TableCell>{m.monthLabel}</TableCell>
                          <TableCell align="right">{fmt(m.totalFees)} USDT</TableCell>
                          <TableCell align="right">{m.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Grid>
              </Grid>
            </>
          ) : (
            <Typography color="text.secondary">{t('loading')}...</Typography>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6">{t('hot_wallet_balances')} (0xA582b0A154c2FC7c209785F00083Bd7c93e0169E)</Typography>
          <Table size="small" sx={{ mt: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('chain')}</TableCell>
                <TableCell>{t('asset')}</TableCell>
                <TableCell>{t('amount')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hotWalletBalances.map((b: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell>{b.chain}</TableCell>
                  <TableCell>{b.asset}</TableCell>
                  <TableCell>{b.balance}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6">{t('listings')}</Typography>
          <Table size="small" sx={{ mt: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('token')}</TableCell>
                <TableCell>{t('issuer')}</TableCell>
                <TableCell>{t('project_website')}</TableCell>
                <TableCell>{t('project_description')}</TableCell>
                <TableCell>{t('status')}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listings.map((l: any) => (
                <TableRow key={l._id}>
                  <TableCell>{l.token?.symbol}</TableCell>
                  <TableCell>{l.issuer?.email}</TableCell>
                  <TableCell>
                    {l.projectWebsite && (
                      <Link href={/^https?:\/\//i.test(l.projectWebsite) ? l.projectWebsite : `https://${l.projectWebsite}`} target="_blank" rel="noopener">
                        {l.projectWebsite}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.projectDescription}
                  </TableCell>
                  <TableCell>{l.status}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => approve(l._id)}>{t('approve')}</Button>
                    <Button size="small" onClick={() => suspend(l._id)}>{t('suspend')}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6">{t('plans')}</Typography>
          <Table size="small" sx={{ mt: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('token')}</TableCell>
                <TableCell>{t('record_time')}</TableCell>
                <TableCell>{t('payout_time')}</TableCell>
                <TableCell>{t('amount_usdt')}</TableCell>
                <TableCell>{t('status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plans.map(p => (
                <TableRow key={p._id}>
                  <TableCell>{p.token?.symbol}</TableCell>
                  <TableCell>{new Date(p.recordTime).toLocaleString()}</TableCell>
                  <TableCell>{new Date(p.payoutTime).toLocaleString()}</TableCell>
                  <TableCell>{p.amountUSDT}</TableCell>
                  <TableCell>{p.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">{t('audits')}</Typography>
          <Table size="small" sx={{ mt: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('time')}</TableCell>
                <TableCell>{t('actions')}</TableCell>
                <TableCell>{t('target')}</TableCell>
                <TableCell>{t('meta')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {audits.map(a => (
                <TableRow key={a._id}>
                  <TableCell>{new Date(a.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{a.action}</TableCell>
                  <TableCell>{a.targetType} #{a.targetId}</TableCell>
                  <TableCell><pre style={{ margin: 0 }}>{JSON.stringify(a.meta || {}, null, 2)}</pre></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Container>
  );
}