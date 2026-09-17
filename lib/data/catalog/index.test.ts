import { describe, expect, it } from "vitest";
import { byCategory, CATALOG, cartWithItemAdded, findById, groceryByCategory, menuByRestaurant, roomsByHotel } from "@/lib/data/catalog";

describe("catalog lookups", () => {
  it("findById returns the matching item or undefined", () => {
    expect(findById("food-001")?.title).toBe("North Indian Thali");
    expect(findById("does-not-exist")).toBeUndefined();
  });

  it("byCategory only returns items in that category", () => {
    const food = byCategory("food");
    expect(food.length).toBeGreaterThan(0);
    expect(food.every((c) => c.category === "food")).toBe(true);
  });

  it("menuByRestaurant scopes to one provider within food", () => {
    const menu = menuByRestaurant("rest-spicehouse");
    expect(menu.length).toBeGreaterThan(0);
    expect(menu.every((c) => c.providerId === "rest-spicehouse")).toBe(true);
  });

  it("groceryByCategory scopes to one grocery sub-category", () => {
    const items = groceryByCategory("fruits-veg");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((c) => c.groceryCategoryId === "fruits-veg")).toBe(true);
  });

  it("roomsByHotel returns rooms for that hotel sorted by ascending price", () => {
    const hotelId = CATALOG.find((c) => c.category === "hotels")!.providerId;
    const rooms = roomsByHotel(hotelId);
    expect(rooms.length).toBeGreaterThan(0);
    for (let i = 1; i < rooms.length; i++) expect(rooms[i].price).toBeGreaterThanOrEqual(rooms[i - 1].price);
  });
});

describe("cartWithItemAdded", () => {
  it("adds a new item as a new cart line", () => {
    const { cart, restaurantSwitched } = cartWithItemAdded([], "food-001", 1);
    expect(cart).toEqual([{ itemId: "food-001", qty: 1 }]);
    expect(restaurantSwitched).toBe(false);
  });

  it("increments quantity when the same item is added again", () => {
    const { cart } = cartWithItemAdded([{ itemId: "food-001", qty: 1 }], "food-001", 2);
    expect(cart).toEqual([{ itemId: "food-001", qty: 3 }]);
  });

  it("clears other-restaurant food items and flags restaurantSwitched when switching restaurants", () => {
    const startingCart = [{ itemId: "food-001", qty: 1 }]; // rest-spicehouse
    const { cart, restaurantSwitched } = cartWithItemAdded(startingCart, "food-002", 1); // rest-tokyobites
    expect(restaurantSwitched).toBe(true);
    expect(cart).toEqual([{ itemId: "food-002", qty: 1 }]);
  });

  it("leaves non-food items untouched when switching restaurants", () => {
    const groceryItemId = CATALOG.find((c) => c.category === "grocery")!.id;
    const startingCart = [
      { itemId: "food-001", qty: 1 }, // rest-spicehouse
      { itemId: groceryItemId, qty: 1 },
    ];
    const { cart, restaurantSwitched } = cartWithItemAdded(startingCart, "food-002", 1); // rest-tokyobites
    expect(restaurantSwitched).toBe(true);
    expect(cart).toEqual([{ itemId: groceryItemId, qty: 1 }, { itemId: "food-002", qty: 1 }]);
  });

  it("no-ops for an unknown item id", () => {
    const startingCart = [{ itemId: "food-001", qty: 1 }];
    const { cart, restaurantSwitched } = cartWithItemAdded(startingCart, "does-not-exist", 1);
    expect(cart).toBe(startingCart);
    expect(restaurantSwitched).toBe(false);
  });
});
