import { LinearGradient, matchFont, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Area, CartesianChart, Line } from 'victory-native';
import { Colors } from '@/constants/theme';

export type ChartPoint = { t: number; price: number };

const font = matchFont({ fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }), fontSize: 10 });
const dateLabel = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' });

/**
 * Step chart: a stored price holds until the next change, so we draw `stepAfter` rather than
 * interpolating between changes (which would invent prices that never existed).
 */
export function PriceChart({ points, color }: { points: ChartPoint[]; color: string }) {
  const domainY = useMemo<[number, number] | undefined>(() => {
    if (points.length === 0) return undefined;
    const ys = points.map((p) => p.price);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const pad = Math.max((max - min) * 0.15, max * 0.01);
    return [Math.max(0, min - pad), max + pad];
  }, [points]);

  return (
    <View style={styles.wrap}>
      <CartesianChart
        data={points}
        xKey="t"
        yKeys={['price']}
        domain={{ y: domainY }}
        padding={{ left: 4, right: 4, bottom: 4 }}
        xAxis={{
          font,
          tickCount: 4,
          labelColor: Colors.textSecondary,
          lineColor: Colors.border,
          formatXLabel: (t) => dateLabel.format(new Date(t)),
        }}
        yAxis={[
          {
            font,
            tickCount: 4,
            labelColor: Colors.textSecondary,
            lineColor: Colors.border,
            formatYLabel: (v) => `₱${Number(v).toFixed(Number(v) < 20 ? 2 : 0)}`,
          },
        ]}>
        {({ points: p, chartBounds }) => (
          <>
            <Area points={p.price} y0={chartBounds.bottom} curveType="stepAfter" animate={{ type: 'timing', duration: 300 }}>
              <LinearGradient
                start={vec(0, chartBounds.top)}
                end={vec(0, chartBounds.bottom)}
                colors={[`${color}55`, `${color}00`]}
              />
            </Area>
            <Line points={p.price} color={color} strokeWidth={2} curveType="stepAfter" animate={{ type: 'timing', duration: 300 }} />
          </>
        )}
      </CartesianChart>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 240 },
});
