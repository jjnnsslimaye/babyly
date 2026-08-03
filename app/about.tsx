import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';

const FOUNDERS = [
  {
    key: 'caroline',
    name: 'Caroline',
    title: 'Co-Founder',
    photo: require('../assets/founder-caroline.jpeg'),
    story:
      "As a mom of two, I spent more time than I'd like to admit hunting down the right gear at the right price. I knew there had to be a better way — one that felt safe, local, and actually fun to use.",
  },
  {
    key: 'monica',
    name: 'Monica',
    title: 'Co-Founder',
    photo: require('../assets/founder-monica.jpeg'),
    story:
      "I've always believed that communities are stronger when we share with each other. Babyly is my love letter to every mom who's ever passed along a perfectly good stroller to a neighbor who needed it more.",
  },
];

export default function About() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Wordmark */}
        <View style={styles.wordmarkSection}>
          <Text style={styles.wordmark}>Babyly</Text>
          <Text style={styles.tagline}>
            The neighborhood marketplace for moms
          </Text>
        </View>

        {/* Our Story */}
        <View style={styles.storySection}>
          <Text style={styles.sectionLabel}>OUR STORY</Text>
          <Text style={styles.storyBody}>
            Babyly was built by two moms who were tired of garage sales and
            Facebook groups. We wanted a better way to pass along the gear,
            clothes, and toys our kids outgrew — to other families right in
            our neighborhood. No shipping. No strangers from across the
            country. Just local moms helping local moms. That's Babyly.
          </Text>
        </View>

        {/* Founder cards */}
        {FOUNDERS.map((f) => (
          <View key={f.key} style={styles.founderCard}>
            <Image source={f.photo} style={styles.founderPhoto} resizeMode="cover" />
            <View style={styles.founderBody}>
              <Text style={styles.founderName}>{f.name}</Text>
              <Text style={styles.founderTitle}>{f.title}</Text>
              <Text style={styles.founderStory}>{f.story}</Text>
            </View>
          </View>
        ))}

        {/* Giveback Initiative */}
        <View style={styles.givebackSection}>
          <Ionicons
            name="heart"
            size={32}
            color="#A4C8D8"
            style={styles.givebackIcon}
          />
          <Text style={[styles.sectionLabel, styles.givebackLabel]}>
            THE GIVEBACK INITIATIVE
          </Text>
          <Text style={styles.givebackBody}>
            For every 100 items given away on Babyly's Buy Nothing feed, we
            donate a supply kit to a local school in need. Because giving
            back to the community doesn't stop at your doorstep.
          </Text>
          <Text style={styles.givebackPartner}>
            First partner school coming soon.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  // ─── Header ───────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  headerBack: {
    width: 28,
    height: 28,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 22,
    color: '#1A1A1A',
  },

  // ─── Scroll ───────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // ─── Wordmark ─────────────────────────────────────────────
  wordmarkSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  wordmark: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 32,
    color: '#A4C8D8',
    textAlign: 'center',
  },
  tagline: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 15,
    color: '#999999',
    marginTop: 4,
    textAlign: 'center',
  },

  // ─── Section labels ───────────────────────────────────────
  sectionLabel: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 11,
    color: '#999999',
    letterSpacing: 1,
    marginBottom: 12,
  },

  // ─── Our Story ────────────────────────────────────────────
  storySection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: '#FAFAFA',
  },
  storyBody: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 15,
    color: '#444444',
    lineHeight: 24,
  },

  // ─── Founder cards ────────────────────────────────────────
  founderCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  founderPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  founderBody: {
    padding: 20,
  },
  founderName: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 18,
    color: '#1A1A1A',
  },
  founderTitle: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#A4C8D8',
    marginTop: 2,
    marginBottom: 12,
  },
  founderStory: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#666666',
    lineHeight: 22,
  },

  // ─── Giveback ─────────────────────────────────────────────
  givebackSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderTopWidth: 0.5,
    borderTopColor: '#F0F0F0',
    alignItems: 'center',
  },
  givebackIcon: {
    marginBottom: 12,
  },
  givebackLabel: {
    textAlign: 'center',
  },
  givebackBody: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#666666',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 12,
  },
  givebackPartner: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#A4C8D8',
    textAlign: 'center',
  },
});
