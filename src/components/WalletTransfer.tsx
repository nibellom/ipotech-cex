import React, { useEffect, useState } from 'react';
import { Card, CardContent, TextField, MenuItem, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/http';

const walletTypes: string[] = ['spot', 'trade', 'dividend'];

type ApiBalancesResponse = {
  assets: { asset: string; spot: number; trade: number; dividend: number; total: number }[];
};

export default function WalletTransfer() {
  const { t } = useTranslation();

  const [assets, setAssets] = useState<string[]>(['USDT']);
  const [asset, setAsset] = useState<string>('USDT');
  const [from, setFrom] = useState<string>('spot');
  const [to, setTo] = useState<string>('dividend');
  const [amount, setAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Подгружаем список доступных активов из балансов пользователя
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    api
      .get<ApiBalancesResponse>('/api/wallets/balances', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        const list = (data?.assets || [])
          .map((a) => String(a.asset))
          .filter((x) => !!x);

        // уникализация без Set (совместимо с любым tsconfig)
        const uniqList = list.filter((v, i, arr) => arr.indexOf(v) === i);

        if (uniqList.length) {
          setAssets(uniqList);
          // не тянем `asset` в deps: выбираем актуальный из списка
          setAsset((prev) => (uniqList.includes(prev) ? prev : uniqList[0]));
        }
      })
      .catch(() => {
        /* noop */
      });
  }, []); // один раз при монтировании

  const canSubmit =
    asset &&
    from &&
    to &&
    from !== to &&
    Number(amount) > 0 &&
    !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      await api.post(
        '/api/wallets/transfer',
        {
          asset,
          fromWallet: from,
          toWallet: to,
          amount: Number(amount),
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setAmount('');
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6">{t('transfer_between_wallets')}</Typography>

        <Stack spacing={2} mt={2}>
          <TextField
            select
            fullWidth
            label={t('asset')}
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
          >
            {assets.map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            fullWidth
            label={t('from_wallet')}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            {walletTypes.map((w) => (
              <MenuItem key={w} value={w}>
                {w}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            fullWidth
            label={t('to_wallet')}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          >
            {walletTypes.map((w) => (
              <MenuItem key={w} value={w} disabled={w === from}>
                {w}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            label={t('amount')}
            type="number"
            inputProps={{ min: 0, step: 'any' }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <Button
            variant="contained"
            fullWidth
            size="large"
            disabled={!canSubmit}
            onClick={submit}
          >
            {t('transfer')}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
