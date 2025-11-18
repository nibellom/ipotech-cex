import React, { useEffect, useMemo, useRef } from 'react';
import { createChart, Time } from 'lightweight-charts';

export type Candle = { ts: number; o: number; h: number; l: number; c: number; v: number; q: number };

type Props = {
  candles: Candle[];                 // отсортированы по ts по возрастанию
  height?: number;
  theme?: 'dark' | 'light';
  barMs?: number;                    // длительность бара (ms) — для триггера догрузки
  onNeedMoreLeft?: (oldestTs: number) => void; // вызов, когда доскроллили к левому краю
};

export default function CandlesChart({
  candles,
  height = 420,
  theme = 'dark',                    // тёмная тема по умолчанию
  barMs = 86_400_000,                // 1 день по умолчанию
  onNeedMoreLeft,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const volSeriesRef = useRef<any>(null);
  const oldestTsRef = useRef<number | null>(null);
  const pendingLeftRequestForTsRef = useRef<number | null>(null);

  const isDark = theme === 'dark';

  const dataCandles = useMemo(
    () =>
      candles.map((c) => ({
        time: (c.ts / 1000) as Time,
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
      })),
    [candles]
  );

  // объём: раскрашиваем в цвет направления свечи (полупрозрачно),
  // чтобы визуально не “перебивать” сами свечи
  const dataVolume = useMemo(
    () =>
      candles.map((c) => ({
        time: (c.ts / 1000) as Time,
        value: c.q, // объём в USDT (quote)
        color: (c.c >= c.o)
          ? (isDark ? '#26a69a90' : '#26a69a80')
          : (isDark ? '#ef535090' : '#ef535080'),
      })),
    [candles, isDark]
  );

  useEffect(() => {
    if (!rootRef.current) return;

    const chart = createChart(rootRef.current, {
      height,
      layout: {
        background: { color: isDark ? '#0b0f15' : '#ffffff' },
        textColor:  isDark ? '#d1d4dc' : '#333333',
      },
      grid: {
        vertLines: { color: isDark ? '#1f2a37' : '#eeeeee' },
        horzLines: { color: isDark ? '#1f2a37' : '#eeeeee' },
      },
      crosshair: { mode: 1 },
      timeScale: {
        rightOffset: 0,
        barSpacing: 6,
        rightBarStaysOnScroll: true,
        timeVisible: true,
        secondsVisible: false,
        borderVisible: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
    });
    chartRef.current = chart;

    // 1) ВАЖНО: сначала добавляем ОБЪЁМ, потом свечи,
    // чтобы свечи рисовались поверх гистограммы (иначе “налезает”)
    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    } as any);
    volSeriesRef.current = volSeries;

    // объём кладём в нижние ~20% панели
    const volScale = chart.priceScale('volume');
    volScale.applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    // 2) основная серия (свечи) — будет поверх
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    } as any);
    candleSeriesRef.current = candleSeries;

    // свечам оставляем место над “подвалом” объёмов
    chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.25 },
    });

    const onResize = () => chart.applyOptions({ width: rootRef.current?.clientWidth || 600 });
    window.addEventListener('resize', onResize);
    onResize();

    // подписка на изменение видимого диапазона — чтобы догружать историю слева
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (!range || !onNeedMoreLeft) return;
      const fromSec = (range as any).from as number | undefined;
      const oldest = oldestTsRef.current;
      if (!fromSec || !oldest) return;

      const leftEdgeMs = fromSec * 1000;
      // Если приблизились к самой старой свече — попросим подгрузить ещё
      if (leftEdgeMs <= oldest + barMs) {
        // не спамим один и тот же запрос
        if (pendingLeftRequestForTsRef.current !== oldest) {
          pendingLeftRequestForTsRef.current = oldest;
          onNeedMoreLeft(oldest);
        }
      }
    });

    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volSeriesRef.current = null;
    };
  }, [isDark, height, barMs, onNeedMoreLeft]);

  useEffect(() => {
    if (!candleSeriesRef.current || !volSeriesRef.current) return;
    candleSeriesRef.current.setData(dataCandles);
    volSeriesRef.current.setData(dataVolume);

    if (candles.length) {
      const oldest = candles[0].ts;
      oldestTsRef.current = oldest;
      // если подгрузили ещё левее — сбросим «флажок», чтобы следующий скролл снова мог триггернуть догрузку
      if (pendingLeftRequestForTsRef.current && oldest < pendingLeftRequestForTsRef.current) {
        pendingLeftRequestForTsRef.current = null;
      }
    }
  }, [dataCandles, dataVolume, candles]);

  return <div ref={rootRef} style={{ width: '100%', height }} />;
}
