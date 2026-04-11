import React from 'react';
import { View, Text } from 'react-native';

export const MapView = ({ children, style }) => (
  <View style={[style, { backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', borderRadius: 12 }]}>
    <Text style={{ color: '#64748b', fontWeight: '600' }}>Maps are only available on mobile devices</Text>
    <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Please use the Expo Go app to view the interactive map.</Text>
    {children}
  </View>
);

export const Marker = ({ children }) => <View>{children}</View>;
export const PROVIDER_GOOGLE = 'google';
export const Polyline = () => null;
export const AnimatedRegion = class {
  constructor(config) {
    Object.assign(this, config);
  }
};
export const MapViewDirections = () => null;

export default MapView;
