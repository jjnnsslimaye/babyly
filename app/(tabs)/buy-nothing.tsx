import { View, Text, StyleSheet } from 'react-native';

export default function BuyNothing() {
  return (
    <View style={styles.container}>
      <Text>Buy Nothing</Text>
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
