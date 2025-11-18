import { useEffect, useState, useMemo } from 'react';
import {
  Container, Card, CardContent, TextField, MenuItem, Button, Stack,
  Typography, Table, TableHead, TableRow, TableCell, TableBody, Grid,
  Link, Chip, Tooltip
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/http';

type TokenT = { _id: string; symbol: string; name?: string; chain?: string; contractAddress?: string };
type ListingT = any;
type PlanT = {
  _id: string;
  token?: TokenT;
  amountUSDT: number;
  recordTime: string;
  payoutTime: string;
  status: 'scheduled'|'funding'|'funded'|'processing'|'completed'|string;
};

type BalanceRec = { asset: string; walletType: 'spot'|'trade'|'dividend'; balance: number };

export default function DividendAdmin() {
  const { t } = useTranslation();
  const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };

  // --- справочники/данные
  const [tokens, setTokens] = useState<TokenT[]>([]);
  const [plans, setPlans]   = useState<PlanT[]>([]);
  const [myListings, setMyListings] = useState<ListingT[]>([]);
  const [balances, setBalances] = useState<BalanceRec[]>([]);

  // --- форма плана
  const [form, setForm] = useState({ tokenId: '', amountUSDT: '', recordTime: '', payoutTime: '' });
  const [errors, setErrors] = useState<{[k:string]: string}>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverMsg, setServerMsg] = useState<string>('');

  // --- листинг
  const [listing, setListing] = useState({
    symbol: '', name: '', decimals: 18, chain: 'bsc', contractAddress: '',
    description: '', website: ''
  });
  const [listSubmitting, setListSubmitting] = useState(false);
  const [listMsg, setListMsg] = useState('');

  const reload = async () => {
    try { const t = await api.get('/api/tokens/listed'); setTokens(t.data.tokens || []); } catch {}
    try { const p = await api.get('/api/company/dividends', auth); setPlans(p.data.plans || []); } catch {}
    try { const l = await api.get('/api/company/listings', auth); setMyListings(l.data.listings || []); } catch {}
    try { const b = await api.get('/api/me/balances', auth); setBalances(b.data.balances || []); } catch {}
  };

  useEffect(()=>{ reload(); },[]);

  // spot USDT — без учёта регистра + суммируем все записи на всякий случай
  const spotUSDT = useMemo(() => {
    const upper = (s:string) => (s||'').toUpperCase();
    return (balances || [])
      .filter(b => upper(b.asset) === 'USDT' && (b.walletType||'').toLowerCase() === 'spot')
      .reduce((sum, b) => sum + (Number(b.balance)||0), 0);
  }, [balances]);

  // --- валидация формы плана
  const validatePlan = () => {
    const e: {[k:string]: string} = {};
    const amt = Number(form.amountUSDT);

    if (!form.tokenId) e.tokenId = t('select_token');
    if (!Number.isFinite(amt) || amt <= 0) e.amountUSDT = t('enter_positive_amount');
    if (!form.recordTime) e.recordTime = t('specify_record_time');
    if (!form.payoutTime) e.payoutTime = t('specify_payout_time');

    // recordTime должен быть в будущем
    if (form.recordTime) {
      const rec = new Date(form.recordTime).getTime();
      if (Number.isFinite(rec) && rec <= Date.now()) {
        e.recordTime = t('record_time_must_be_future');
      }
    }
    // payout > record
    if (form.recordTime && form.payoutTime) {
      const rec = new Date(form.recordTime).getTime();
      const pay = new Date(form.payoutTime).getTime();
      if (Number.isFinite(rec) && Number.isFinite(pay) && pay <= rec) {
        e.payoutTime = t('payout_time_after_record');
      }
    }
    // хватает USDT на spot
    if (Number.isFinite(amt) && amt > spotUSDT) {
      e.amountUSDT = `${t('insufficient_spot')} (${t('available')} ${spotUSDT})`;
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // триггерим валидацию на каждое изменение формы — для мгновенной подсветки
  useEffect(() => { validatePlan(); /* eslint-disable-next-line */ }, [form, spotUSDT, t]);

  const createPlan = async () => {
    setServerMsg('');
    if (!validatePlan()) return;
    setSubmitting(true);
    try {
      await api.post('/api/company/dividends', {
        tokenId: form.tokenId,
        amountUSDT: Number(form.amountUSDT),
        recordTime: form.recordTime,
        payoutTime: form.payoutTime
      }, auth);
      setForm({ tokenId: '', amountUSDT: '', recordTime: '', payoutTime: '' });
      await reload();
      setServerMsg(t('plan_created'));
    } catch (e:any) {
      const msg = e?.response?.data?.message || t('error_creating_plan');
      setServerMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // единственная кнопка действия — Pay now
  const payNow = async (planId: string) => {
    try {
      const r = await api.post(`/api/company/dividends/${planId}/pay`, { force: false }, auth);
      const { recipients, totalDistributed, note } = r.data || {};
      await reload();
      alert(`${t('pay_now')} done.\n${t('recipients')}: ${recipients || 0}\n${t('total_distributed')}: ${totalDistributed || 0}${note ? `\n${t('note')}: ${note}` : ''}`);
    } catch (e:any) {
      alert(e?.response?.data?.message || t('error'));
    }
  };

  const planRows = useMemo(() => (plans || []).map(p => ({
    ...p,
    total: Number(p.amountUSDT || 0),
  })), [plans]);

  const canCreate = useMemo(() => {
    const amt = Number(form.amountUSDT);
    const valid =
      form.tokenId &&
      Number.isFinite(amt) && amt > 0 &&
      !!form.recordTime && !!form.payoutTime &&
      new Date(form.recordTime).getTime() > Date.now() &&
      new Date(form.payoutTime).getTime() > new Date(form.recordTime).getTime() &&
      amt <= spotUSDT;
    return !!valid && !submitting;
  }, [form, spotUSDT, submitting]);

  const statusChip = (s: PlanT['status']) => {
    const map: Record<string, {label: string; color: 'default'|'success'|'warning'|'error'|'info'}> = {
      scheduled: { label: t('scheduled'), color: 'info' },
      funding:   { label: t('funding'),   color: 'warning' },
      funded:    { label: t('funded'),    color: 'success' },
      processing:{ label: t('processing'),color: 'warning' },
      completed: { label: t('completed'), color: 'success' },
    };
    const a = map[s] || { label: s, color: 'default' };
    return <Chip size="small" label={a.label} color={a.color} />;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>{t('issuer_dashboard')}</Typography>

      <Grid container spacing={3}>
        {/* Листинг */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">{t('submit_listing')}</Typography>
              <Stack spacing={2} mt={2}>
                <TextField label={t('symbol')} value={listing.symbol}
                  onChange={e=>setListing({...listing, symbol: e.target.value})} />
                <TextField label={t('name')} value={listing.name}
                  onChange={e=>setListing({...listing, name: e.target.value})} />
                <TextField select label={t('chain')} value={listing.chain}
                  onChange={e=>setListing({...listing, chain: e.target.value})}>
                  {['bsc','eth','tron'].map(ch => <MenuItem key={ch} value={ch}>{ch.toUpperCase()}</MenuItem>)}
                </TextField>
                <TextField label={t('decimals')} type="number" value={listing.decimals}
                  onChange={e=>setListing({...listing, decimals: Number(e.target.value)})} />
                <TextField label={t('contract_address')} value={listing.contractAddress}
                  onChange={e=>setListing({...listing, contractAddress: e.target.value})} />
                <TextField
                  label={t('project_description')}
                  value={listing.description}
                  multiline minRows={3}
                  onChange={e=>setListing({...listing, description: e.target.value})}
                />
                <TextField
                  label={t('project_website')}
                  value={listing.website}
                  placeholder="https://example.com"
                  onChange={e=>setListing({...listing, website: e.target.value})}
                />
                <Stack direction="row" spacing={2} alignItems="center">
                  <Button variant="contained" onClick={async ()=>{
                    setListMsg('');
                    setListSubmitting(true);
                    try {
                      const body = { ...listing, decimals: Number(listing.decimals) };
                      await api.post('/api/company/listings', body, auth);
                      setListing({
                        symbol: '', name: '', decimals: 18, chain: 'bsc', contractAddress: '',
                        description: '', website: ''
                      });
                      await reload();
                      setListMsg(t('request_sent'));
                    } catch (e:any) {
                      setListMsg(e?.response?.data?.message || t('error_sending'));
                    } finally {
                      setListSubmitting(false);
                    }
                  }} disabled={listSubmitting}>
                    {listSubmitting ? t('sending') : t('send_request')}
                  </Button>
                  {listMsg && <Typography variant="body2">{listMsg}</Typography>}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Мои заявки на листинг */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">{t('my_listing_requests')}</Typography>
              <Table size="small" sx={{ mt: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('token')}</TableCell>
                    <TableCell>{t('chain')}</TableCell>
                    <TableCell>{t('contract')}</TableCell>
                    <TableCell>{t('status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {myListings.map((l:any)=>(
                    <TableRow key={l._id}>
                      <TableCell>{l.token?.symbol}</TableCell>
                      <TableCell>{l.token?.chain}</TableCell>
                      <TableCell style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {l.token?.contractAddress}
                      </TableCell>
                      <TableCell>{l.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* Создание плана дивидендов */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">{t('create_dividend_plan')}</Typography>
                <Tooltip title={`${t('spot_usdt')} ${t('on_your_wallet')}`}>
                  <Typography variant="body2" color="text.secondary">{t('spot_usdt')}: <b>{spotUSDT}</b></Typography>
                </Tooltip>
              </Stack>

              <Stack direction="row" spacing={2} mt={2} flexWrap="wrap" alignItems="flex-start">
                <TextField
                  select label={t('token')} value={form.tokenId}
                  onChange={e=>setForm({...form, tokenId: e.target.value})}
                  error={!!errors.tokenId} helperText={errors.tokenId}
                  sx={{ minWidth: 220 }}
                >
                  {tokens.map((tk)=> <MenuItem key={tk._id} value={tk._id}>{tk.symbol}</MenuItem>)}
                </TextField>

                <TextField
                  type="number" label={t('amount_usdt')} value={form.amountUSDT}
                  onChange={e=>setForm({...form, amountUSDT: e.target.value})}
                  error={!!errors.amountUSDT} helperText={errors.amountUSDT || t('amount_will_be_debited')}
                />

                <TextField
                  type="datetime-local" label={t('record_time')} InputLabelProps={{ shrink: true }}
                  value={form.recordTime}
                  onChange={e=>setForm({...form, recordTime: e.target.value})}
                  error={!!errors.recordTime} helperText={errors.recordTime}
                />

                <TextField
                  type="datetime-local" label={t('payout_time')} InputLabelProps={{ shrink: true }}
                  value={form.payoutTime}
                  onChange={e=>setForm({...form, payoutTime: e.target.value})}
                  error={!!errors.payoutTime} helperText={errors.payoutTime}
                />

                <Stack direction="row" spacing={2} alignItems="center">
                  <Button variant="contained" onClick={createPlan} disabled={!canCreate}>
                    {submitting ? t('creating') : t('create')}
                  </Button>
                  {serverMsg && <Typography variant="body2">{serverMsg}</Typography>}
                </Stack>
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                <b>{t('memo')}:</b> <br/>
                — {t('memo_record_time')} <br/>
                — {t('memo_payout')} <br/>
                — {t('memo_spot_check')}
              </Typography>

              {tokens.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {t('no_tokens_available')}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Мои планы дивидендов */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6">{t('my_dividend_plans')}</Typography>
              <Table size="small" sx={{ mt: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('token')}</TableCell>
                    <TableCell>{t('amount_usdt')}</TableCell>
                    <TableCell>{t('record_time')}</TableCell>
                    <TableCell>{t('payout_time')}</TableCell>
                    <TableCell>{t('status')}</TableCell>
                    <TableCell align="right">{t('actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {planRows.map(p => (
                    <TableRow key={p._id}>
                      <TableCell>{p.token?.symbol}</TableCell>
                      <TableCell>{p.total}</TableCell>
                      <TableCell>{new Date(p.recordTime).toLocaleString()}</TableCell>
                      <TableCell>{new Date(p.payoutTime).toLocaleString()}</TableCell>
                      <TableCell>{statusChip(p.status)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                          <Button size="small" variant="contained" onClick={()=>payNow(p._id)}>
                            {t('pay_now')}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {planRows.length === 0 && (
                    <TableRow><TableCell colSpan={6}>{t('no_plans_yet')}</TableCell></TableRow>
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
