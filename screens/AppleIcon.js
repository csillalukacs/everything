import { Image } from 'react-native';

const APPLE_SOURCE = require('../assets/splash-icon.png');

export default function AppleIcon({ size = 14, style }) {
  return (
    <Image
      source={APPLE_SOURCE}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
