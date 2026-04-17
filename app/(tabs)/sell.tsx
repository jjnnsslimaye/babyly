import { View, Text, StyleSheet } from 'react-native';

export default function Sell() {
  return (
    <View style={styles.container}>
      <Text>Sell</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});
