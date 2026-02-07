import { useCallback } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { Restaurant } from '../types';
import { RESTAURANTS } from '../constants/restaurants';
import { colors } from '../constants/theme';

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const { height } = useWindowDimensions();

  return (
    <View style={[styles.card, { height }]}>
      <View style={styles.cardContent}>
        <Text style={styles.restaurantName}>{restaurant.name}</Text>
        <Text style={styles.cuisine}>{restaurant.cuisine}</Text>
        <View style={styles.ratingContainer}>
          <Text style={styles.rating}>★ {restaurant.rating}</Text>
        </View>
        <Text style={styles.address}>{restaurant.address}</Text>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const { height } = useWindowDimensions();

  const renderItem = useCallback(
    ({ item }: { item: Restaurant }) => <RestaurantCard restaurant={item} />,
    []
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: height,
      offset: height * index,
      index,
    }),
    [height]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={RESTAURANTS}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        getItemLayout={getItemLayout}
        pagingEnabled
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSecondary,
  },
  cardContent: {
    padding: 24,
    alignItems: 'center',
  },
  restaurantName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  cuisine: {
    fontSize: 18,
    color: colors.textMuted,
    marginBottom: 16,
  },
  ratingContainer: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  rating: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.accentText,
  },
  address: {
    fontSize: 16,
    color: colors.textDim,
  },
});
