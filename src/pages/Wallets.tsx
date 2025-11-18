import { useEffect, useMemo, useState } from 'react';
import {
  Container, Card, CardContent, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Grid, Chip, Tabs, Tab, Box, Stack, Divider
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import WalletTransfer from '../components/WalletTransfer';
import DepositAddresses from '../components/DepositAddresses';
import WithdrawForm from '../components/WithdrawForm';
import { getSocket } from '../realtime/socket';

type AssetRow = { asset: string; spot: number; trade: number; dividend: number; total: number };
type Entry = { asset: string; walletType: 'spot'|'trade'|'dividend'; balance: number };

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

// Преобразуем снапшот с сервера { spot:{USDT:{total...}}, trade:{...}, dividend:{...} } -> rows + entries
function snapshotToState(snap: any): { rows: AssetRow[]; entries: Entry[] } {
  const spot = (snap?.spot || {}) as Record<string, any>;
  const trade = (snap?.trade || {}) as Record<string, any>;
  const dividend = (snap?.dividend || {}) as Record<string, any>;

  const assets = new Set<string>([
    ...Object.keys(spot),
    ...Object.keys(trade),
    ...Object.keys(dividend),
  ]);

  const rows: AssetRow[] = [];
  const entries: Entry[] = [];

  for (const a of assets) {
    const s = Number(spot[a]?.total || 0);
    const t = Number(trade[a]?.total || 0);
    const d = Number(dividend[a]?.total || 0);
    rows.push({ asset: a, spot: s, trade: t, dividend: d, total: s + t + d });

    if (s > 0) entries.push({ asset: a, walletType: 'spot',     balance: s });
    if (t > 0) entries.push({ asset: a, walletType: 'trade',    balance: t });
    if (d > 0) entries.push({ asset: a, walletType: 'dividend', balance: d });
  }

  rows.sort((a, b) => a.asset.localeCompare(b.asset));
  entries.sort((a, b) => a.asset.localeCompare(b.asset) || a.walletType.localeCompare(b.walletType));

  return { rows, entries };
}

export default function Wallets() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [walletTab, setWalletTab] = useState<'spot'|'trade'|'dividend'>('spot');

  // цены активов в USDT (USDT:1 по умолчанию)
  const [prices, setPrices] = useState<Record<string, number>>({ USDT: 1 });

  // первичная загрузка
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    axios.get('/api/wallets/balances', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        setRows(r.data.assets || []);
        setEntries(r.data.entries || []);
      })
      .catch(() => { setRows([]); setEntries([]); });
  }, []);

  // realtime: обновления балансов
  useEffect(() => {
    const s = getSocket();
    const onBalances = (snap: any) => {
      try {
        const { rows, entries } = snapshotToState(snap);
        setRows(rows);
        setEntries(entries);
      } catch {}
    };
    s.on('wallet:balances', onBalances);
    return () => {
      s.off('wallet:balances', onBalances);
    };
  }, []);

  // при изменении набора активов — подгружаем последние цены <ASSET>-USDT
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || rows.length === 0) return;

    const assets = Array.from(new Set(rows.map(r => r.asset))).filter(a => a !== 'USDT');
    let stop = false;

    (async () => {
      const map: Record<string, number> = { USDT: 1 };
      await Promise.all(assets.map(async (a) => {
        try {
          const market = `${a}-USDT`;
          const r = await axios.get('/api/trade/trades', { ...auth(), params: { market, limit: 1 } });
          const price = r.data?.trades?.[0]?.price;
          if (price) map[a] = Number(price);
          // если сделок нет — актив не учитываем в суммах
        } catch {
          // рынок может отсутствовать — игнор
        }
      }));
      if (!stop) setPrices(map);
    })();

    return () => { stop = true; };
  }, [rows]);

  // агрегаты в USDT (учитываем только те активы, у которых есть цена)
  const totalsUSDT = useMemo(() => {
    return rows.reduce((acc, r) => {
      const p = r.asset === 'USDT' ? 1 : prices[r.asset];
      if (!p) return acc; // нет цены — пропускаем актив
      acc.spot     += r.spot     * p;
      acc.trade    += r.trade    * p;
      acc.dividend += r.dividend * p;
      acc.total    += r.total    * p;
      return acc;
    }, { spot: 0, trade: 0, dividend: 0, total: 0 });
  }, [rows, prices]);

  // данные для вкладок
  const perWalletAssets = useMemo(() => {
    const out: Record<'spot'|'trade'|'dividend', Entry[]> = { spot: [], trade: [], dividend: [] };
    for (const e of entries) if (e.balance > 0) out[e.walletType].push(e);
    (['spot','trade','dividend'] as const).forEach(w => out[w].sort((a,b)=>a.asset.localeCompare(b.asset)));
    return out;
  }, [entries]);

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>{t('my_wallets')}</Typography>

      {/* Итоги по всем активам (в USDT) */}
      <Grid container spacing={3} sx={{ mb: 2 }}>
        <Grid item xs={12} md={3}>
          <Card><CardContent>
            <Typography variant="subtitle2">{t('spot')} (USDT)</Typography>
            <Typography variant="h6">{fmt(totalsUSDT.spot)}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card><CardContent>
            <Typography variant="subtitle2">{t('trade_wallet')} (USDT)</Typography>
            <Typography variant="h6">{fmt(totalsUSDT.trade)}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card><CardContent>
            <Typography variant="subtitle2">{t('dividend_wallet')} (USDT)</Typography>
            <Typography variant="h6">{fmt(totalsUSDT.dividend)}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card><CardContent>
            <Typography variant="subtitle2">{t('total')} (USDT)</Typography>
            <Typography variant="h6">{fmt(totalsUSDT.total)}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Левая колонка: вкладки по активам + сводные карточки */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6">{t('wallet_contents')}</Typography>
              <Tabs
                value={walletTab}
                onChange={(_, v) => setWalletTab(v)}
                sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}
                variant="scrollable"
                allowScrollButtonsMobile
              >
                <Tab value="spot" label={t('spot')} />
                <Tab value="trade" label={t('trade_wallet')} />
                <Tab value="dividend" label={t('dividend_wallet')} />
              </Tabs>
              <Box sx={{ pt: 2 }}>
                {perWalletAssets[walletTab].length === 0 ? (
                  <Typography color="text.secondary">{t('empty')}</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('asset')}</TableCell>
                        <TableCell align="right">{t('amount')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {perWalletAssets[walletTab].map(entry => (
                        <TableRow key={`${walletTab}-${entry.asset}`}>
                          <TableCell><Chip label={entry.asset} size="small" /></TableCell>
                          <TableCell align="right">{entry.balance}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>
            </CardContent>
          </Card>

          <DepositAddresses />
        </Grid>

        {/* Правая колонка: перевод/вывод */}
        <Grid item xs={12} md={4}>
          
          <WalletTransfer />
          <WithdrawForm />
        </Grid>
      </Grid>
    </Container>
  );
}
