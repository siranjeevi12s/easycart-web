/** Local favorites (restaurants + dishes), persisted on-device. No backend. */
import AsyncStorage from '@react-native-async-storage/async-storage';

const REST_KEY = 'easycart_fav_restaurants';
const DISH_KEY = 'easycart_fav_dishes';

export interface FavDish {
  id: string;
  name: string;
  price: number;
  restaurantId: string;
  restaurantName: string;
  image?: string;
}

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const getFavRestaurants = () => read<string[]>(REST_KEY, []);
export const getFavDishes = () => read<FavDish[]>(DISH_KEY, []);

export async function toggleFavRestaurant(id: string): Promise<{ favs: string[]; added: boolean }> {
  const favs = await getFavRestaurants();
  const has = favs.includes(id);
  const next = has ? favs.filter((x) => x !== id) : [...favs, id];
  await AsyncStorage.setItem(REST_KEY, JSON.stringify(next));
  return { favs: next, added: !has };
}

export async function toggleFavDish(dish: FavDish): Promise<{ favs: FavDish[]; added: boolean }> {
  const favs = await getFavDishes();
  const has = favs.some((x) => x.id === dish.id);
  const next = has ? favs.filter((x) => x.id !== dish.id) : [...favs, dish];
  await AsyncStorage.setItem(DISH_KEY, JSON.stringify(next));
  return { favs: next, added: !has };
}
