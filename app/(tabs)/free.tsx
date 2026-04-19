import { View, Text, StyleSheet } from 'react-native';

export default function Free() {
  return (
    <View style={styles.container}>
      <Text>Free</Text>
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
