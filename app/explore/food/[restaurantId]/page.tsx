import { notFound } from "next/navigation";
import { RESTAURANTS, findRestaurant } from "@/lib/data/restaurants";
import { menuByRestaurant } from "@/lib/data/catalog";
import RestaurantMenuView from "@/components/RestaurantMenuView";

export function generateStaticParams() {
  return RESTAURANTS.map((r) => ({ restaurantId: r.id }));
}

export default async function RestaurantPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  const restaurant = findRestaurant(restaurantId);
  if (!restaurant) notFound();

  const items = menuByRestaurant(restaurantId);

  return <RestaurantMenuView restaurant={restaurant} items={items} />;
}
