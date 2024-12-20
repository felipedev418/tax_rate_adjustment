export * from "./run";
import { DiscountApplicationStrategy } from "../generated/api";

var EMPTY_DISCOUNT = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

var BULK_DISCOUNTS = [
  {
    quantity: 10,
    discount: 20.0,
    message: "20% off 10 or more",
  },
  {
    quantity: 40,
    discount: 30.0,
    message: "30% off 40 or more",
  },
];

export default (input) => {
  var config = BULK_DISCOUNTS;

  var targets = input.cart.lines
    .filter((line) => line.merchandise.__typename == "ProductVariant")
    .map((line) => {
      var variant = line.merchandise;

      return {
        productVariant: {
          id: variant.id,
        },
      };
    });

  var cartLinesQuantityTotal = input.cart.lines.reduce((total, line) => {
    total += line.quantity;
    return total;
  }, 0);

  var bulkDiscountActive = config.find((bulkDiscount) => {
    return cartLinesQuantityTotal >= bulkDiscount.quantity;
  });

  if (!bulkDiscountActive) {
    console.error("No cart lines qualify for this discount.");
    return EMPTY_DISCOUNT;
  }

  return {
    discounts: [
      {
        targets,
        value: {
          percentage: {
            value: bulkDiscountActive.discount,
          },
        },
        message: bulkDiscountActive.message,
      },
    ],
    discountApplicationStrategy: DiscountApplicationStrategy.First,
  };
};
