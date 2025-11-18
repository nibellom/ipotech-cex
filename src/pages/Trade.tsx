import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Container, Grid, Card, CardContent, Typography, Stack, TextField, MenuItem,
  Tabs, Tab, Button, Table, TableHead, TableRow, TableCell, TableBody, Divider, Box
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import CandlesChart, { Candle as CandleT } from '../components/CandlesChart';
import { getSocket } from '../realtime/socket';

type Level = { price: number; amount: number };
type Orderbook = { bids: Level[]; asks: Level[] };
type TradeRow = { _id: string; price: number; amount: number; quote: number; takerSide: 'buy'|'sell'; createdAt: string };
type MyOrder = { _id: string; market: string; side: 'buy'|'sell'; price: number; amount: number; remaining: number; status: string; createdAt: string };
type MyTrade = TradeRow & { fee?: number };
type LevelCum = Level & { cum: number };

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export const TF_LIST = ['1m','5m','1h','1d','1w'] as const;
export type TF = typeof TF_LIST[number];

function intervalMs(tf: TF) {
  switch (tf) {
    case '1m': return 60_000;
    case '5m': return 300_000;
    case '1h': return 3_600_000;
    case '1d': return 86_400_000;
    case '1w': return 7 * 86_400_000;
    default:   return 86_400_000;
  }
}

// Обновляем/достраиваем свечи по пришедшим трейдам (для активной/близких свечей)
function mergeTradesIntoCandles(candles: CandleT[], trades: TradeRow[], barMs: number): CandleT[] {
  if (!trades?.length) return candles;
  const map = new Map<number, CandleT>();
  for (const c of candles) map.set(c.ts, c);

  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const t of sortedTrades) {
    const ts = Math.floor(new Date(t.createdAt).getTime() / barMs) * barMs;
    const prev = map.get(ts) || { ts, o: t.price, h: t.price, l: t.price, c: t.price, v: 0, q: 0 };
    const next: CandleT = {
      ts,
      o: prev.o ?? t.price,
      h: Math.max(prev.h ?? t.price, t.price),
      l: Math.min(prev.l ?? t.price, t.price),
      c: t.price,
      v: (prev.v || 0) + (t.amount || 0),
      q: (prev.q || 0) + (t.quote || (t.price * t.amount))
    };
    map.set(ts, next);
  }
  return Array.from(map.values()).sort((a,b)=>a.ts-b.ts);
}

// форматтеры (по желанию подкорректируйте)
const fmtPrice = (v: number) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 8 });
const fmtQty   = (v: number) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 8 });

export default function Trade() {
  const { t } = useTranslation();
  const [markets, setMarkets] = useState<string[]>([]);
  const [market, setMarket] = useState<string>('');
  const [orderbook, setOrderbook] = useState<Orderbook>({ bids: [], asks: [] });
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [candles, setCandles] = useState<CandleT[]>([]);
  const [tab, setTab] = useState<'buy'|'sell'>('buy');

  const [price, setPrice] = useState<string>('');
  const [amount, setAmount] = useState<string>('');

  const [myOrders, setMyOrders] = useState<MyOrder[]>([]);
  const [myTrades, setMyTrades] = useState<MyTrade[]>([]);

  const [tf, setTf] = useState<TF>('1d');
  const [loadingCandles, setLoadingCandles] = useState(false);

  // ---- График: первичная загрузка последних свечей для выбранного ТФ
  const loadInitialCandles = useCallback(async () => {
    if (!market) return;
    setLoadingCandles(true);
    try {
      const r = await axios.get('/api/trade/candles', {
        ...auth(),
        params: { market, interval: tf, limit: 300, _t: Date.now() } // bust cache
      });
      const arr: CandleT[] = (r.data.candles || []).map((c:any) => ({
        ts: c.ts, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v, q: c.q
      }));
      setCandles(arr);
    } finally {
      setLoadingCandles(false);
    }
  }, [market, tf]);

  useEffect(() => {
    loadInitialCandles();
  }, [loadInitialCandles]);

  // ---- График: лёгкий поллинг только последних свечей (не ломает текущий зум)
  useEffect(() => {
    if (!market) return;
    const id = setInterval(async () => {
      try {
        const r = await axios.get('/api/trade/candles', {
          ...auth(),
          params: { market, interval: tf, limit: 120, _t: Date.now() } // bust cache
        });
        const fresh: CandleT[] = (r.data.candles || []).map((c:any) => ({
          ts: c.ts, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v, q: c.q
        }));
        // мердж по ts
        setCandles(prev => {
          const map = new Map<number, CandleT>();
          for (const x of prev) map.set(x.ts, x);
          for (const x of fresh) map.set(x.ts, x);
          return Array.from(map.values()).sort((a,b)=>a.ts-b.ts);
        });
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [market, tf]);

  // ---- Дозагрузка истории при скролле влево на графике
  const loadMoreLeft = useCallback(async (oldestTs: number) => {
    try {
      const r = await axios.get('/api/trade/candles', {
        ...auth(),
        params: { market, interval: tf, to: oldestTs, limit: 300, _t: Date.now() } // bust cache
      });
      const more: CandleT[] = (r.data.candles || []).map((c:any) => ({
        ts: c.ts, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v, q: c.q
      }));
      if (!more.length) return;
      setCandles(prev => {
        const map = new Map<number, CandleT>();
        for (const x of more) map.set(x.ts, x);
        for (const x of prev) map.set(x.ts, x);
        return Array.from(map.values()).sort((a,b)=>a.ts-b.ts);
      });
    } catch {}
  }, [market, tf]);

  // ---- Рынки (один раз)
  useEffect(() => {
    axios.get('/api/trade/markets', auth())
      .then(r => {
        const arr = r.data.markets || [];
        setMarkets(arr);
        setMarket(prev => prev || (arr[0] || ''));
      })
      .catch(()=>{});
  }, []);

  // ---- Начальные данные стакана/тик-ленты по текущему рынку (однократно при смене market)
  useEffect(() => {
    if (!market) return;
    let cancelled = false;
    (async () => {
      try {
        const [ob, tr] = await Promise.all([
          axios.get('/api/trade/orderbook', { ...auth(), params: { market, depth: 20 } }),
          axios.get('/api/trade/trades',    { ...auth(), params: { market, limit: 50 } }),
        ]);
        if (!cancelled) {
          setOrderbook(ob.data);
          setTrades(tr.data.trades || []);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [market]);

  // ---- Мои заявки/сделки: первичная загрузка (без поллинга)
  useEffect(() => {
    if (!market) return;
    let stop = false;
    (async () => {
      try {
        const [o, t] = await Promise.all([
          axios.get('/api/trade/my/orders', { ...auth(), params: { status: 'open', market } }),
          axios.get('/api/trade/my/trades', { ...auth(), params: { market, limit: 100 } }),
        ]);
        if (!stop) {
          setMyOrders(o.data.orders || []);
          setMyTrades(t.data.trades || []);
        }
      } catch {}
    })();
    return () => { stop = true; };
  }, [market]);

  // ---- Реал-тайм через сокеты: стакан/сделки/мои данные
  useEffect(() => {
    const s = getSocket();
    let mounted = true;

    const handleOrderbook = (snapshot: any) => {
      if (!mounted) return;
      setOrderbook(snapshot || { bids: [], asks: [] });
    };
    const handleTrades = (list: any[]) => {
      if (!mounted) return;
      setTrades(list || []);
      setCandles(prev => mergeTradesIntoCandles(prev, list as any, intervalMs(tf)));
    };
    const handleMyOrders = (list: any[]) => { if (mounted) setMyOrders(list || []); };
    const handleMyTrades = (list: any[]) => { if (mounted) setMyTrades(list || []); };

    if (market) {
      s.emit('sub:market', market);
      s.on('orderbook', handleOrderbook);
      s.on('trades', handleTrades);
    }

    s.on('my:orders', handleMyOrders);
    s.on('my:trades', handleMyTrades);

    return () => {
      mounted = false;
      if (market) s.emit('unsub:market', market);
      s.off('orderbook', handleOrderbook);
      s.off('trades', handleTrades);
      s.off('my:orders', handleMyOrders);
      s.off('my:trades', handleMyTrades);
    };
  }, [market, tf]);

  const bestBid = orderbook.bids[0]?.price || 0;
  const bestAsk = orderbook.asks[0]?.price || 0;

  const canSubmit = market && Number(price) > 0 && Number(amount) > 0;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await axios.post('/api/trade/order', {
        market, side: tab, price: Number(price), amount: Number(amount)
      }, auth());
      setAmount('');
    } catch (e:any) {
      alert(e?.response?.data?.message || t('error'));
    }
  };

  const cancel = async (id: string) => {
    try {
      await axios.post(`/api/trade/cancel/${id}`, {}, auth());
    } catch (e:any) {
      alert(e?.response?.data?.message || t('error'));
    }
  };

  // ====== ДОБАВЛЕНО: вычисления для стакана ======

  // Последняя сделка (по максимальному createdAt)
  const lastTrade = useMemo(() => {
    if (!trades?.length) return null;
    return trades.reduce((a, b) => (new Date(a.createdAt) > new Date(b.createdAt) ? a : b));
  }, [trades]);

  // Сортировки:
  // 1) Asks — по цене убыванию (обратный порядок)
  const asksSorted: Level[] = useMemo(
    () => [...(orderbook?.asks || [])].sort((a, b) => b.price - a.price).slice(0, 20),
    [orderbook?.asks]
  );
  // 2) Bids — для единообразия тоже по убыванию (верх — лучший бид)
  const bidsSorted: Level[] = useMemo(
    () => [...(orderbook?.bids || [])].sort((a, b) => b.price - a.price).slice(0, 20),
    [orderbook?.bids]
  );

  // Кумулятивные объёмы (нарастающим итогом сверху вниз) — отдельно для каждой стороны
  const asksWithCum: LevelCum[] = useMemo(() => {
    let cum = 0;
    return asksSorted.map(l => {
      cum += Number(l.amount) || 0;
      return { ...l, cum };
    });
  }, [asksSorted]);

  const bidsWithCum: LevelCum[] = useMemo(() => {
    let cum = 0;
    return bidsSorted.map(l => {
      cum += Number(l.amount) || 0;
      return { ...l, cum };
    });
  }, [bidsSorted]);

  const lastLineColor = lastTrade?.takerSide === 'buy' ? '#1b5e20' : '#b71c1c';

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{t('trade')}</Typography>
        <TextField
          select size="small" label={t('market')} value={market}
          onChange={(e)=>setMarket(e.target.value)} sx={{ minWidth: 180 }}
        >
          {markets.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
        </TextField>
        <Box sx={{ ml: 'auto' }}>
          <Typography variant="body2" color="text.secondary">
            Bid: {bestBid || '—'} | Ask: {bestAsk || '—'}
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={3}>
        {/* ЛЕВО: стакан + последние сделки */}
        <Grid item xs={12} md={3}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1">{t('orderbook')}</Typography>
              <Divider sx={{ my: 1 }}/>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ width: '40%' }}>{t('price')} (USDT)</Typography>
                <Typography variant="caption" sx={{ width: '30%', textAlign: 'right' }}>{t('quantity')}</Typography>
                <Typography variant="caption" sx={{ width: '30%', textAlign: 'right' }}>{t('cumulative')}</Typography>
              </Stack>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {/* ASKS — по цене в обратном порядке */}
                {asksWithCum.map((l, i) => (
                  <Stack key={'a'+i} direction="row" spacing={1} sx={{ color: '#b71c1c' }}>
                    <Typography sx={{ width: '40%' }}>{fmtPrice(l.price)}</Typography>
                    <Typography sx={{ width: '30%', textAlign: 'right' }}>{fmtQty(l.amount)}</Typography>
                    <Typography sx={{ width: '30%', textAlign: 'right' }}>{fmtQty(l.cum)}</Typography>
                  </Stack>
                ))}

                {/* Последняя сделка — между асками и бидами */}
                <Divider sx={{ my: 1 }}/>
                <Stack direction="row" spacing={1} sx={{ color: lastLineColor, fontWeight: 600 }}>
                  <Typography sx={{ width: '40%' }}>
                    {lastTrade ? `${t('last')}: ${fmtPrice(lastTrade.price)}` : `${t('last')}: —`}
                  </Typography>
                  <Typography sx={{ width: '30%', textAlign: 'right' }}>
                    {lastTrade ? fmtQty(lastTrade.amount) : '—'}
                  </Typography>
                  <Typography sx={{ width: '30%', textAlign: 'right' }}>
                    {lastTrade ? new Date(lastTrade.createdAt).toLocaleTimeString() : '—'}
                  </Typography>
                </Stack>
                <Divider sx={{ my: 1 }}/>

                {/* BIDS */}
                {bidsWithCum.map((l, i) => (
                  <Stack key={'b'+i} direction="row" spacing={1} sx={{ color: '#1b5e20' }}>
                    <Typography sx={{ width: '40%' }}>{fmtPrice(l.price)}</Typography>
                    <Typography sx={{ width: '30%', textAlign: 'right' }}>{fmtQty(l.amount)}</Typography>
                    <Typography sx={{ width: '30%', textAlign: 'right' }}>{fmtQty(l.cum)}</Typography>
                  </Stack>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle1">{t('recent_trades')}</Typography>
              <Divider sx={{ my: 1 }}/>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {trades.map(t => (
                  <Stack key={t._id} direction="row" spacing={1} sx={{ color: t.takerSide==='buy' ? '#1b5e20' : '#b71c1c' }}>
                    <Typography sx={{ width: '40%' }}>{fmtPrice(t.price)}</Typography>
                    <Typography sx={{ width: '30%' }}>{fmtQty(t.amount)}</Typography>
                    <Typography sx={{ width: '30%', textAlign: 'right' }}>{new Date(t.createdAt).toLocaleTimeString()}</Typography>
                  </Stack>
                ))}
                {trades.length===0 && <Typography color="text.secondary">{t('no_trades')}</Typography>}
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* ЦЕНТР: график */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                <Typography variant="subtitle1">{t('chart')} {market}</Typography>
                <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                  {TF_LIST.map(x => (
                    <Button key={x} size="small" variant={tf===x?'contained':'outlined'} onClick={()=>setTf(x as TF)}>{x}</Button>
                  ))}
                </Stack>
              </Stack>
              <Divider sx={{ mb: 1 }}/>
              <div style={{ width: '100%', height: 460 }}>
                <CandlesChart
                  candles={candles}
                  height={460}
                  theme="dark"
                  barMs={intervalMs(tf)}
                  onNeedMoreLeft={loadMoreLeft}
                />
              </div>
              {loadingCandles && <Typography variant="caption" color="text.secondary">Загрузка…</Typography>}
            </CardContent>
          </Card>
        </Grid>

        {/* ПРАВО: форма заявок */}
        <Grid item xs={12} md={3}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Tabs value={tab} onChange={(_,v)=>setTab(v)} variant="fullWidth">
                <Tab value="buy"  label={t('buy')} />
                <Tab value="sell" label={t('sell')} />
              </Tabs>
              <Stack spacing={2} sx={{ mt: 2 }}>
                <TextField
                  label={`${t('price')} (USDT)`} type="number" value={price} onChange={e=>setPrice(e.target.value)}
                  inputProps={{ min: 0, step: 'any' }} fullWidth
                />
                <TextField
                  label={t('quantity')} type="number" value={amount} onChange={e=>setAmount(e.target.value)}
                  inputProps={{ min: 0, step: 'any' }} fullWidth
                />
                <Button variant="contained" onClick={submit} disabled={!canSubmit}>
                  {tab === 'buy' ? t('buy') : t('sell')}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  {t('trade_from_wallet')}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle1">{t('my_open_orders')}</Typography>
              <Divider sx={{ my: 1 }}/>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {myOrders.length === 0 && <Typography color="text.secondary">{t('no_open_orders')}</Typography>}
                {myOrders.map(o => (
                  <Stack key={o._id} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography sx={{ width: '28%' }}>{o.side.toUpperCase()}</Typography>
                    <Typography sx={{ width: '22%' }}>{fmtPrice(o.price)}</Typography>
                    <Typography sx={{ width: '28%' }}>{fmtQty(o.remaining)}/{fmtQty(o.amount)}</Typography>
                    <Button size="small" variant="outlined" onClick={()=>cancel(o._id)}>{t('cancel')}</Button>
                  </Stack>
                ))}
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* НИЗ: Мои сделки */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1">{t('my_trades')}</Typography>
              <Divider sx={{ my: 1 }}/>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('time')}</TableCell>
                    <TableCell>{t('side')}</TableCell>
                    <TableCell>{t('price')}</TableCell>
                    <TableCell>{t('quantity')}</TableCell>
                    <TableCell>{t('sum_usdt')}</TableCell>
                    <TableCell align="right">{t('fee')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {myTrades.length === 0 && (
                    <TableRow><TableCell colSpan={6}>{t('none_yet')}</TableCell></TableRow>
                  )}
                  {myTrades.map(t => (
                    <TableRow key={t._id}>
                      <TableCell>{new Date(t.createdAt).toLocaleString()}</TableCell>
                      <TableCell sx={{ color: t.takerSide==='buy' ? '#1b5e20' : '#b71c1c' }}>
                        {t.takerSide.toUpperCase()}
                      </TableCell>
                      <TableCell>{fmtPrice(t.price)}</TableCell>
                      <TableCell>{fmtQty(t.amount)}</TableCell>
                      <TableCell>{fmtQty(t.quote)}</TableCell>
                      <TableCell align="right">
                        {t.fee && t.fee > 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            {fmtQty(t.fee)} USDT
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
