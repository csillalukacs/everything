import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';

export function Bar({ count, max, label }) {
  const heightPct = max > 0 ? (count / max) * 100 : 0;
  return (
    <View style={styles.barCol}>
      <View style={styles.barTrack}>
        {count > 0 && (
          <View style={[styles.barFill, { height: `${Math.max(heightPct, 2)}%` }]}>
            <Text style={styles.barValue}>{count}</Text>
          </View>
        )}
      </View>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function PieChart({ slices, total, size = 220 }) {
  const r = size / 2;
  const cx = size / 2;
  const cy = size / 2;
  const paths = useMemo(() => {
    if (slices.length === 1) {
      const path = Skia.Path.Make();
      path.addCircle(cx, cy, r);
      return [{ path, color: slices[0].color }];
    }
    let cumDeg = -90;
    return slices.map(slice => {
      const sweep = (slice.count / total) * 360;
      const startDeg = cumDeg;
      cumDeg += sweep;
      const path = Skia.Path.Make();
      path.moveTo(cx, cy);
      const startRad = (startDeg * Math.PI) / 180;
      path.lineTo(cx + r * Math.cos(startRad), cy + r * Math.sin(startRad));
      const oval = Skia.XYWHRect(cx - r, cy - r, 2 * r, 2 * r);
      path.arcToOval(oval, startDeg, sweep, false);
      path.close();
      return { path, color: slice.color };
    });
  }, [slices, total, cx, cy, r]);
  return (
    <Canvas style={{ width: size, height: size }}>
      {paths.map((p, i) => <Path key={i} path={p.path} color={p.color} />)}
    </Canvas>
  );
}

export function StatCard({ label, value, sub }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardSub} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  cardLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#999',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: '300',
    color: '#2D2D2D',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : undefined,
  },
  cardSub: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '90%',
    maxWidth: 28,
    backgroundColor: '#2D2D2D',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barValue: {
    position: 'absolute',
    top: -14,
    fontSize: 9,
    color: '#999',
    width: 24,
    textAlign: 'center',
    left: '50%',
    marginLeft: -12,
  },
  barLabel: {
    fontSize: 9,
    color: '#999',
    marginTop: 4,
    height: 12,
  },
});
