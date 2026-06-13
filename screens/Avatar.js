import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { avatarColor, avatarInitial, avatarSrc } from '../shared/avatar';
import { C } from '../shared/theme';

export default function Avatar({ profile, size = 40, style }) {
  const src = avatarSrc(profile);
  const dims = { width: size, height: size, borderRadius: size / 2 };
  if (src) {
    return (
      <Image
        source={{ uri: src }}
        style={[styles.image, dims, style]}
        cachePolicy="memory-disk"
        contentFit="cover"
      />
    );
  }
  return (
    <View style={[styles.placeholder, dims, { backgroundColor: avatarColor(profile) }, style]}>
      <Text style={[styles.initial, { fontSize: Math.round(size * 0.45) }]} allowFontScaling={false}>
        {avatarInitial(profile)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: C.surface,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#fff',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
