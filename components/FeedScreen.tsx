import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
import type { Restaurant } from '../types';
import { RESTAURANTS } from './constants/restaurants';
import { colors } from './constants/theme';
import { isMapsConfigured } from './constants/config';
import { getNearbyRestaurantsPage, getPlaceDetailsPhotos, isPlacesApiId } from '../lib/places';

function RestaurantCard({
  restaurant,
  onPress,
}: {
  restaurant: Restaurant;
  onPress: () => void;
}) {
  const photoUri = restaurant.photoUrl ?? null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.cardPhoto} resizeMode="cover" />
      ) : (
        <View style={styles.photoPlaceholder} />
      )}
      <View style={styles.cardContent}>
        <Text style={styles.restaurantName} numberOfLines={1}>{restaurant.name}</Text>
        <Text style={styles.cuisine} numberOfLines={1}>{restaurant.cuisine}</Text>
        <View style={styles.ratingContainer}>
          <Text style={styles.rating}>★ {restaurant.rating > 0 ? restaurant.rating.toFixed(1) : '—'}</Text>
        </View>
        <Text style={styles.address} numberOfLines={2}>{restaurant.address}</Text>
      </View>
    </TouchableOpacity>
  );
}

function RestaurantDetailModal({
  restaurant,
  detailPhotoUrls,
  detailPhotosLoading,
  onClose,
}: {
  restaurant: Restaurant;
  detailPhotoUrls: string[] | null;
  detailPhotosLoading: boolean;
  onClose: () => void;
}) {
  const fallbackUrls = restaurant.photoUrls?.length ? restaurant.photoUrls : (restaurant.photoUrl ? [restaurant.photoUrl] : []);
  const detailSet = new Set(detailPhotoUrls ?? []);
  const extraFromList = fallbackUrls.filter((u) => !detailSet.has(u));
  const photoUrls =
    (detailPhotoUrls?.length ?? 0) > 0
      ? [...detailPhotoUrls!, ...extraFromList]
      : fallbackUrls;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query_place_id=${restaurant.id}`;

  const openMaps = useCallback(() => {
    Linking.openURL(mapsUrl);
  }, [mapsUrl]);

  const photoScrollRef = useRef<ScrollView>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  useEffect(() => setPhotoIndex(0), [restaurant.id]);
  const canGoLeft = photoUrls.length > 1 && photoIndex > 0;
  const canGoRight = photoUrls.length > 1 && photoIndex < photoUrls.length - 1;

  const goPrev = useCallback(() => {
    if (!canGoLeft) return;
    const next = photoIndex - 1;
    setPhotoIndex(next);
    photoScrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
  }, [canGoLeft, photoIndex]);

  const goNext = useCallback(() => {
    if (!canGoRight) return;
    const next = photoIndex + 1;
    setPhotoIndex(next);
    photoScrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
  }, [canGoRight, photoIndex]);

  const onPhotoScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / SCREEN_WIDTH);
    setPhotoIndex(Math.min(index, photoUrls.length - 1));
  }, [photoUrls.length]);

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            {detailPhotosLoading ? (
              <View style={styles.detailPhotoPlaceholder}>
                <Text style={styles.detailPhotosLoadingText}>Loading photos…</Text>
              </View>
            ) : photoUrls.length > 0 ? (
              <View style={styles.detailPhotosWrap}>
                <ScrollView
                  ref={photoScrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={styles.detailPhotos}
                  contentContainerStyle={[styles.detailPhotosContent, { width: photoUrls.length * SCREEN_WIDTH }]}
                  onMomentumScrollEnd={onPhotoScrollEnd}
                  onScrollEndDrag={onPhotoScrollEnd}
                >
                  {photoUrls.map((uri, i) => (
                    <Image key={`${uri}-${i}`} source={{ uri }} style={styles.detailPhoto} resizeMode="cover" />
                  ))}
                </ScrollView>
                {photoUrls.length > 1 && (
                  <>
                    <Pressable
                      style={[styles.photoArrow, styles.photoArrowLeft]}
                      onPress={goPrev}
                      disabled={!canGoLeft}
                    >
                      <Text style={[styles.photoArrowText, !canGoLeft && styles.photoArrowDisabled]}>‹</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.photoArrow, styles.photoArrowRight]}
                      onPress={goNext}
                      disabled={!canGoRight}
                    >
                      <Text style={[styles.photoArrowText, !canGoRight && styles.photoArrowDisabled]}>›</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : (
              <View style={styles.detailPhotoPlaceholder} />
            )}
            <View style={styles.detailBody}>
              <Text style={styles.detailName}>{restaurant.name}</Text>
              <Text style={styles.detailCuisine}>{restaurant.cuisine}</Text>
              <View style={styles.ratingContainer}>
                <Text style={styles.rating}>★ {restaurant.rating > 0 ? restaurant.rating.toFixed(1) : '—'}</Text>
              </View>
              <Text style={styles.detailAddress}>{restaurant.address}</Text>
            </View>
          </ScrollView>
          <Pressable style={styles.closeButtonFloating} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
          <Pressable style={styles.mapsButtonFloating} onPress={openMaps}>
            <Text style={styles.mapsButtonText}>Open in Google Maps</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function FeedScreen() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [detailPhotoUrls, setDetailPhotoUrls] = useState<string[] | null>(null);
  const [detailPhotosLoading, setDetailPhotosLoading] = useState(false);

  useEffect(() => {
    if (!selectedRestaurant) {
      setDetailPhotoUrls(null);
      setDetailPhotosLoading(false);
      return;
    }
    if (!isMapsConfigured || !isPlacesApiId(selectedRestaurant.id)) {
      setDetailPhotoUrls(null);
      setDetailPhotosLoading(false);
      return;
    }
    setDetailPhotoUrls(null);
    setDetailPhotosLoading(true);
    getPlaceDetailsPhotos(selectedRestaurant.id)
      .then((urls) => {
        setDetailPhotoUrls(urls);
      })
      .catch(() => setDetailPhotoUrls([]))
      .finally(() => setDetailPhotosLoading(false));
  }, [selectedRestaurant?.id]);

  useEffect(() => {
    if (isMapsConfigured) {
      getNearbyRestaurantsPage()
        .then(({ restaurants: list, nextPageToken: token }) => {
          setRestaurants(list);
          setNextPageToken(token);
          setError(null);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load restaurants');
          setRestaurants(RESTAURANTS);
          setNextPageToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setRestaurants(RESTAURANTS);
      setNextPageToken(null);
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (!isMapsConfigured || !nextPageToken || loadingMore) return;
    setLoadingMore(true);
    getNearbyRestaurantsPage(nextPageToken)
      .then(({ restaurants: list, nextPageToken: token }) => {
        setRestaurants((prev) => {
          const ids = new Set(prev.map((r) => r.id));
          const newOnes = list.filter((r) => !ids.has(r.id));
          return prev.concat(newOnes);
        });
        setNextPageToken(token);
      })
      .catch(() => { /* keep current list and token so user can retry by scrolling again */ })
      .finally(() => setLoadingMore(false));
  }, [nextPageToken, loadingMore]);

  const renderItem = useCallback(
    ({ item }: { item: Restaurant }) => (
      <RestaurantCard restaurant={item} onPress={() => setSelectedRestaurant(item)} />
    ),
    []
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: SCREEN_HEIGHT,
      offset: SCREEN_HEIGHT * index,
      index,
    }),
    []
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading restaurants…</Text>
      </View>
    );
  }
  if (error && restaurants.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.fallbackHint}>Showing sample list.</Text>
        </View>
        <FlatList
          data={restaurants}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          getItemLayout={getItemLayout}
          pagingEnabled
          snapToInterval={SCREEN_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <View style={styles.footerLoader}><Text style={styles.footerLoaderText}>Loading more…</Text></View> : null}
        />
      </View>
    );
  }
  if (restaurants.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>No restaurants found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={restaurants}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        getItemLayout={getItemLayout}
        pagingEnabled
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <View style={styles.footerLoader}><Text style={styles.footerLoaderText}>Loading more…</Text></View> : null}
      />
      {selectedRestaurant && (
        <RestaurantDetailModal
          restaurant={selectedRestaurant}
          detailPhotoUrls={detailPhotoUrls}
          detailPhotosLoading={detailPhotosLoading}
          onClose={() => setSelectedRestaurant(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textDim,
    fontSize: 18,
  },
  errorText: {
    color: colors.accent,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  fallbackHint: {
    color: colors.textDim,
    fontSize: 14,
  },
  errorBanner: {
    padding: 12,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
  },
  footerLoader: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    height: SCREEN_HEIGHT * 0.2,
  },
  footerLoaderText: {
    color: colors.textDim,
    fontSize: 16,
  },
  card: {
    width: '100%',
    height: SCREEN_HEIGHT,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cardPhoto: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.55,
    backgroundColor: colors.surfaceSecondary,
  },
  photoPlaceholder: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.55,
    backgroundColor: colors.surfaceSecondary,
  },
  cardContent: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
  },
  restaurantName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  cuisine: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 8,
  },
  ratingContainer: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accentText,
  },
  address: {
    fontSize: 14,
    color: colors.textDim,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  modalContent: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 100,
  },
  detailPhotosWrap: {
    position: 'relative',
    height: SCREEN_HEIGHT * 0.75,
  },
  detailPhotos: {
    height: SCREEN_HEIGHT * 0.75,
  },
  detailPhotosContent: {
    alignItems: 'center',
  },
  photoArrow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoArrowLeft: {
    left: 0,
  },
  photoArrowRight: {
    right: 0,
  },
  photoArrowText: {
    fontSize: 36,
    color: colors.text,
    fontWeight: '300',
  },
  photoArrowDisabled: {
    opacity: 0.3,
  },
  detailPhoto: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
    backgroundColor: colors.surfaceSecondary,
  },
  detailPhotoPlaceholder: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.75,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailPhotosLoadingText: {
    color: colors.textDim,
    fontSize: 16,
  },
  detailBody: {
    padding: 24,
  },
  detailName: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  detailCuisine: {
    fontSize: 18,
    color: colors.textMuted,
    marginBottom: 12,
  },
  detailAddress: {
    fontSize: 16,
    color: colors.textDim,
    marginBottom: 24,
  },
  closeButtonFloating: {
    position: 'absolute',
    top: 48,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  mapsButtonFloating: {
    position: 'absolute',
    bottom: 40,
    right: 16,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    zIndex: 10,
  },
  mapsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accentText,
  },
});
